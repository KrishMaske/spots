package identity

import (
	"context"
	"errors"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"
)

// CognitoClientAPI is the subset of cognitoidentityprovider.Client methods used
// by CognitoAuthProvider. Defined as an interface so tests can supply a fake
// without making real network calls. All AWS SDK types are confined to this file.
type CognitoClientAPI interface {
	SignUp(
		ctx context.Context,
		params *cognitoidentityprovider.SignUpInput,
		optFns ...func(*cognitoidentityprovider.Options),
	) (*cognitoidentityprovider.SignUpOutput, error)

	ConfirmSignUp(
		ctx context.Context,
		params *cognitoidentityprovider.ConfirmSignUpInput,
		optFns ...func(*cognitoidentityprovider.Options),
	) (*cognitoidentityprovider.ConfirmSignUpOutput, error)

	InitiateAuth(
		ctx context.Context,
		params *cognitoidentityprovider.InitiateAuthInput,
		optFns ...func(*cognitoidentityprovider.Options),
	) (*cognitoidentityprovider.InitiateAuthOutput, error)

	GlobalSignOut(
		ctx context.Context,
		params *cognitoidentityprovider.GlobalSignOutInput,
		optFns ...func(*cognitoidentityprovider.Options),
	) (*cognitoidentityprovider.GlobalSignOutOutput, error)

	GetUser(
		ctx context.Context,
		params *cognitoidentityprovider.GetUserInput,
		optFns ...func(*cognitoidentityprovider.Options),
	) (*cognitoidentityprovider.GetUserOutput, error)

	ForgotPassword(
		ctx context.Context,
		params *cognitoidentityprovider.ForgotPasswordInput,
		optFns ...func(*cognitoidentityprovider.Options),
	) (*cognitoidentityprovider.ForgotPasswordOutput, error)

	ConfirmForgotPassword(
		ctx context.Context,
		params *cognitoidentityprovider.ConfirmForgotPasswordInput,
		optFns ...func(*cognitoidentityprovider.Options),
	) (*cognitoidentityprovider.ConfirmForgotPasswordOutput, error)
}

// CognitoAuthProvider implements AuthProvider via Cognito's unauthenticated API.
// All AWS SDK types are confined to this file; no SDK types leak to callers.
// The app client must have GenerateSecret: false — no SECRET_HASH is sent.
type CognitoAuthProvider struct {
	client      CognitoClientAPI
	appClientID string
}

// NewCognitoAuthProvider constructs a CognitoAuthProvider backed by a real
// Cognito client. The client uses anonymous credentials — the operations used
// (SignUp, ConfirmSignUp, InitiateAuth, GlobalSignOut, GetUser, ForgotPassword,
// ConfirmForgotPassword) are Cognito's unauthenticated APIs; no IAM credentials
// or signing are required.
func NewCognitoAuthProvider(ctx context.Context, region, appClientID string) (*CognitoAuthProvider, error) {
	if region == "" {
		return nil, fmt.Errorf("cognito provider: region is required")
	}
	if appClientID == "" {
		return nil, fmt.Errorf("cognito provider: appClientID is required")
	}
	cfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(region),
		awsconfig.WithCredentialsProvider(aws.AnonymousCredentials{}),
	)
	if err != nil {
		return nil, fmt.Errorf("cognito provider: load AWS config: %w", err)
	}
	client := cognitoidentityprovider.NewFromConfig(cfg)
	return &CognitoAuthProvider{client: client, appClientID: appClientID}, nil
}

// NewCognitoAuthProviderWithClient constructs a CognitoAuthProvider with a
// caller-supplied client. Intended for unit tests; use NewCognitoAuthProvider
// in production code.
func NewCognitoAuthProviderWithClient(appClientID string, client CognitoClientAPI) *CognitoAuthProvider {
	return &CognitoAuthProvider{client: client, appClientID: appClientID}
}

// Register creates a new Cognito user and returns whether email confirmation
// is required before the user can log in.
func (p *CognitoAuthProvider) Register(ctx context.Context, email, password string) (RegisterResult, error) {
	out, err := p.client.SignUp(ctx, &cognitoidentityprovider.SignUpInput{
		ClientId: aws.String(p.appClientID),
		Username: aws.String(email),
		Password: aws.String(password),
	})
	if err != nil {
		return RegisterResult{}, mapCognitoErr(err)
	}
	sub := aws.ToString(out.UserSub)
	return RegisterResult{
		UserSub:              sub,
		ConfirmationRequired: !out.UserConfirmed,
	}, nil
}

// Confirm verifies the confirmation code sent to the user's email address.
func (p *CognitoAuthProvider) Confirm(ctx context.Context, email, code string) error {
	_, err := p.client.ConfirmSignUp(ctx, &cognitoidentityprovider.ConfirmSignUpInput{
		ClientId:         aws.String(p.appClientID),
		Username:         aws.String(email),
		ConfirmationCode: aws.String(code),
	})
	return mapCognitoErr(err)
}

// Login authenticates the user with email and password using USER_PASSWORD_AUTH.
//
// Security note: with USER_PASSWORD_AUTH the user's password transits this Go
// edge in the /v1/auth/login request body. This is acceptable for a public
// no-secret app client over TLS — it is exactly what a mobile or SPA client
// using USER_PASSWORD_AUTH would do directly against Cognito. The SRP flow
// remains enabled for future mobile client use. Never log passwords or tokens.
func (p *CognitoAuthProvider) Login(ctx context.Context, email, password string) (TokenSet, error) {
	out, err := p.client.InitiateAuth(ctx, &cognitoidentityprovider.InitiateAuthInput{
		AuthFlow: types.AuthFlowTypeUserPasswordAuth,
		ClientId: aws.String(p.appClientID),
		AuthParameters: map[string]string{
			"USERNAME": email,
			"PASSWORD": password,
		},
	})
	if err != nil {
		return TokenSet{}, mapCognitoErr(err)
	}
	return tokenSetFromResult(out.AuthenticationResult), nil
}

// Refresh exchanges a refresh token for new access and ID tokens.
// The returned TokenSet has an empty RefreshToken (Cognito omits it on refresh).
func (p *CognitoAuthProvider) Refresh(ctx context.Context, refreshToken string) (TokenSet, error) {
	out, err := p.client.InitiateAuth(ctx, &cognitoidentityprovider.InitiateAuthInput{
		AuthFlow: types.AuthFlowTypeRefreshTokenAuth,
		ClientId: aws.String(p.appClientID),
		AuthParameters: map[string]string{
			"REFRESH_TOKEN": refreshToken,
		},
	})
	if err != nil {
		return TokenSet{}, mapCognitoErr(err)
	}
	return tokenSetFromResult(out.AuthenticationResult), nil
}

// Logout revokes all sessions for the user that holds accessToken by calling
// GlobalSignOut. This invalidates all refresh tokens for the user.
func (p *CognitoAuthProvider) Logout(ctx context.Context, accessToken string) error {
	_, err := p.client.GlobalSignOut(ctx, &cognitoidentityprovider.GlobalSignOutInput{
		AccessToken: aws.String(accessToken),
	})
	return mapCognitoErr(err)
}

// GetUser returns the email address for the holder of accessToken by calling
// Cognito's GetUser API (the access token is its own authorization; no IAM creds
// required). Used as the empty-email fallback for tokens that never went through
// /v1/auth/login.
func (p *CognitoAuthProvider) GetUser(ctx context.Context, accessToken string) (string, error) {
	out, err := p.client.GetUser(ctx, &cognitoidentityprovider.GetUserInput{
		AccessToken: aws.String(accessToken),
	})
	if err != nil {
		return "", mapCognitoErr(err)
	}
	for _, attr := range out.UserAttributes {
		if aws.ToString(attr.Name) == "email" {
			return aws.ToString(attr.Value), nil
		}
	}
	return "", nil
}

// ForgotPassword asks Cognito to email a one-time password-reset code to the
// address on file. The code is valid for one hour — note this is shorter than
// the 24-hour sign-up confirmation code.
//
// The CodeDeliveryDetails in the response (a masked destination like "a***@e***")
// is deliberately discarded: it is a weak account-existence signal and callers
// have no use for it. With PreventUserExistenceErrors=ENABLED, Cognito returns a
// simulated delivery destination — and sends nothing — for unknown, disabled, and
// unverified users, so a nil error here means "request accepted", never "this
// account exists".
func (p *CognitoAuthProvider) ForgotPassword(ctx context.Context, email string) error {
	_, err := p.client.ForgotPassword(ctx, &cognitoidentityprovider.ForgotPasswordInput{
		ClientId: aws.String(p.appClientID),
		Username: aws.String(email),
	})
	return mapCognitoErr(err)
}

// ConfirmForgotPassword exchanges the emailed reset code for a new password.
// Cognito applies the pool's password policy to the new password.
//
// Security note: like Login, the user's password transits this Go edge in the
// /v1/auth/reset-password request body, along with the one-time code. Never log
// the code or the new password.
func (p *CognitoAuthProvider) ConfirmForgotPassword(ctx context.Context, email, code, newPassword string) error {
	_, err := p.client.ConfirmForgotPassword(ctx, &cognitoidentityprovider.ConfirmForgotPasswordInput{
		ClientId:         aws.String(p.appClientID),
		Username:         aws.String(email),
		ConfirmationCode: aws.String(code),
		Password:         aws.String(newPassword),
	})
	return mapCognitoErr(err)
}

// tokenSetFromResult converts a Cognito AuthenticationResultType to a TokenSet.
func tokenSetFromResult(r *types.AuthenticationResultType) TokenSet {
	if r == nil {
		return TokenSet{TokenType: "Bearer"}
	}
	return TokenSet{
		AccessToken:  aws.ToString(r.AccessToken),
		IDToken:      aws.ToString(r.IdToken),
		RefreshToken: aws.ToString(r.RefreshToken),
		ExpiresIn:    int(r.ExpiresIn),
		TokenType:    "Bearer",
	}
}

// mapCognitoErr maps Cognito SDK exception types to provider-neutral sentinel
// errors so callers do not need to import the AWS SDK.
// UserNotFoundException on login is mapped to ErrInvalidCredentials to preserve
// PreventUserExistenceErrors=ENABLED behavior (do not reveal non-existence).
func mapCognitoErr(err error) error {
	if err == nil {
		return nil
	}
	var (
		notAuth          *types.NotAuthorizedException
		userNotFound     *types.UserNotFoundException
		userNotConf      *types.UserNotConfirmedException
		codeMismatch     *types.CodeMismatchException
		expiredCode      *types.ExpiredCodeException
		userExists       *types.UsernameExistsException
		invalidPwd       *types.InvalidPasswordException
		pwdHistory       *types.PasswordHistoryPolicyViolationException
		limitExceeded    *types.LimitExceededException
		tooManyRequests  *types.TooManyRequestsException
		tooManyAttempts  *types.TooManyFailedAttemptsException
		invalidParameter *types.InvalidParameterException
	)
	switch {
	case errors.As(err, &notAuth):
		return ErrInvalidCredentials
	case errors.As(err, &userNotFound):
		// Map to ErrInvalidCredentials: preserves PreventUserExistenceErrors behavior.
		return ErrInvalidCredentials
	case errors.As(err, &userNotConf):
		return ErrUserNotConfirmed
	case errors.As(err, &codeMismatch):
		return ErrCodeMismatch
	case errors.As(err, &expiredCode):
		return ErrCodeExpired
	case errors.As(err, &userExists):
		return ErrUsernameExists
	case errors.As(err, &invalidPwd):
		return ErrInvalidPassword
	case errors.As(err, &pwdHistory):
		// Cannot fire under the current template (no PasswordHistory configured),
		// but ESSENTIALS supports it. Mapped so it lands on the same public
		// "password does not meet the requirements" 400 rather than a confusing
		// 502 the day password history is enabled.
		return ErrInvalidPassword
	case errors.As(err, &limitExceeded):
		// Cognito's per-user hourly password-reset budget.
		return ErrTooManyRequests
	case errors.As(err, &tooManyRequests):
		// Account-level request quota for the operation.
		return ErrTooManyRequests
	case errors.As(err, &tooManyAttempts):
		// Too many bad codes. Distinct from CodeMismatch on purpose: the user
		// needs to stop retrying, not retype.
		return ErrTooManyRequests
	case errors.As(err, &invalidParameter):
		// ForgotPassword raises this when neither a verified email nor a verified
		// phone number exists. The forgot-password handler still answers 204 so
		// this cannot be used to probe account state.
		return ErrRecoveryUnavailable
	}
	return ErrProviderUnavailable
}
