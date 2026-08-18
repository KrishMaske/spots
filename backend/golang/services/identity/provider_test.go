package identity_test

import (
	"context"
	"errors"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"

	"github.com/krishm/spots/backend/golang/services/identity"
)

// ── Fake SDK client ───────────────────────────────────────────────────────────

// fakeCognitoClient implements identity.CognitoClientAPI with preconfigured
// outputs. A nil error field means the call succeeds.
type fakeCognitoClient struct {
	signUpOut               *cognitoidentityprovider.SignUpOutput
	signUpErr               error
	confirmSignUpErr        error
	initiateAuthOut         *cognitoidentityprovider.InitiateAuthOutput
	initiateAuthErr         error
	globalSignOutErr        error
	getUserOut              *cognitoidentityprovider.GetUserOutput
	getUserErr              error
	forgotPasswordErr        error
	confirmForgotPasswordErr error

	// Captured inputs, so tests can assert what was actually sent to Cognito.
	forgotPasswordIn        *cognitoidentityprovider.ForgotPasswordInput
	confirmForgotPasswordIn *cognitoidentityprovider.ConfirmForgotPasswordInput
}

func (f *fakeCognitoClient) SignUp(_ context.Context, _ *cognitoidentityprovider.SignUpInput, _ ...func(*cognitoidentityprovider.Options)) (*cognitoidentityprovider.SignUpOutput, error) {
	return f.signUpOut, f.signUpErr
}

func (f *fakeCognitoClient) ConfirmSignUp(_ context.Context, _ *cognitoidentityprovider.ConfirmSignUpInput, _ ...func(*cognitoidentityprovider.Options)) (*cognitoidentityprovider.ConfirmSignUpOutput, error) {
	return &cognitoidentityprovider.ConfirmSignUpOutput{}, f.confirmSignUpErr
}

func (f *fakeCognitoClient) InitiateAuth(_ context.Context, _ *cognitoidentityprovider.InitiateAuthInput, _ ...func(*cognitoidentityprovider.Options)) (*cognitoidentityprovider.InitiateAuthOutput, error) {
	return f.initiateAuthOut, f.initiateAuthErr
}

func (f *fakeCognitoClient) GlobalSignOut(_ context.Context, _ *cognitoidentityprovider.GlobalSignOutInput, _ ...func(*cognitoidentityprovider.Options)) (*cognitoidentityprovider.GlobalSignOutOutput, error) {
	return &cognitoidentityprovider.GlobalSignOutOutput{}, f.globalSignOutErr
}

func (f *fakeCognitoClient) GetUser(_ context.Context, _ *cognitoidentityprovider.GetUserInput, _ ...func(*cognitoidentityprovider.Options)) (*cognitoidentityprovider.GetUserOutput, error) {
	return f.getUserOut, f.getUserErr
}

func (f *fakeCognitoClient) ForgotPassword(_ context.Context, in *cognitoidentityprovider.ForgotPasswordInput, _ ...func(*cognitoidentityprovider.Options)) (*cognitoidentityprovider.ForgotPasswordOutput, error) {
	f.forgotPasswordIn = in
	return &cognitoidentityprovider.ForgotPasswordOutput{}, f.forgotPasswordErr
}

func (f *fakeCognitoClient) ConfirmForgotPassword(_ context.Context, in *cognitoidentityprovider.ConfirmForgotPasswordInput, _ ...func(*cognitoidentityprovider.Options)) (*cognitoidentityprovider.ConfirmForgotPasswordOutput, error) {
	f.confirmForgotPasswordIn = in
	return &cognitoidentityprovider.ConfirmForgotPasswordOutput{}, f.confirmForgotPasswordErr
}

// ── Error-mapping tests ───────────────────────────────────────────────────────

func TestCognitoProvider_ErrMapping(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		sdkErr error
		want   error
		method string // "login" | "register" | "confirm" | "logout" | "forgot" | "resetpw"
	}{
		{
			name:   "NotAuthorizedException → ErrInvalidCredentials",
			sdkErr: &types.NotAuthorizedException{Message: aws.String("bad creds")},
			want:   identity.ErrInvalidCredentials,
			method: "login",
		},
		{
			name:   "UserNotFoundException → ErrInvalidCredentials (enumeration safety)",
			sdkErr: &types.UserNotFoundException{Message: aws.String("not found")},
			want:   identity.ErrInvalidCredentials,
			method: "login",
		},
		{
			name:   "UserNotConfirmedException → ErrUserNotConfirmed",
			sdkErr: &types.UserNotConfirmedException{Message: aws.String("not confirmed")},
			want:   identity.ErrUserNotConfirmed,
			method: "login",
		},
		{
			name:   "CodeMismatchException → ErrCodeMismatch",
			sdkErr: &types.CodeMismatchException{Message: aws.String("bad code")},
			want:   identity.ErrCodeMismatch,
			method: "confirm",
		},
		{
			name:   "ExpiredCodeException → ErrCodeExpired",
			sdkErr: &types.ExpiredCodeException{Message: aws.String("expired")},
			want:   identity.ErrCodeExpired,
			method: "confirm",
		},
		{
			name:   "UsernameExistsException → ErrUsernameExists",
			sdkErr: &types.UsernameExistsException{Message: aws.String("exists")},
			want:   identity.ErrUsernameExists,
			method: "register",
		},
		{
			name:   "InvalidPasswordException → ErrInvalidPassword",
			sdkErr: &types.InvalidPasswordException{Message: aws.String("too weak")},
			want:   identity.ErrInvalidPassword,
			method: "register",
		},
		{
			name:   "unknown error → ErrProviderUnavailable",
			sdkErr: errors.New("service unavailable"),
			want:   identity.ErrProviderUnavailable,
			method: "login",
		},

		// ── Password reset ────────────────────────────────────────────────────
		// Throttling: assert only that the exception maps to ErrTooManyRequests.
		// Cognito's actual per-user hourly budget is risk-dependent and documented
		// as subject to change, so no threshold is asserted anywhere.
		{
			name:   "LimitExceededException → ErrTooManyRequests (forgot)",
			sdkErr: &types.LimitExceededException{Message: aws.String("attempt limit exceeded")},
			want:   identity.ErrTooManyRequests,
			method: "forgot",
		},
		{
			name:   "LimitExceededException → ErrTooManyRequests (reset)",
			sdkErr: &types.LimitExceededException{Message: aws.String("attempt limit exceeded")},
			want:   identity.ErrTooManyRequests,
			method: "resetpw",
		},
		{
			name:   "TooManyRequestsException → ErrTooManyRequests (forgot)",
			sdkErr: &types.TooManyRequestsException{Message: aws.String("slow down")},
			want:   identity.ErrTooManyRequests,
			method: "forgot",
		},
		{
			name:   "TooManyRequestsException → ErrTooManyRequests (reset)",
			sdkErr: &types.TooManyRequestsException{Message: aws.String("slow down")},
			want:   identity.ErrTooManyRequests,
			method: "resetpw",
		},
		{
			name:   "TooManyFailedAttemptsException → ErrTooManyRequests (reset)",
			sdkErr: &types.TooManyFailedAttemptsException{Message: aws.String("too many bad codes")},
			want:   identity.ErrTooManyRequests,
			method: "resetpw",
		},
		{
			name:   "InvalidParameterException → ErrRecoveryUnavailable (forgot)",
			sdkErr: &types.InvalidParameterException{Message: aws.String("no verified email")},
			want:   identity.ErrRecoveryUnavailable,
			method: "forgot",
		},
		{
			name:   "PasswordHistoryPolicyViolationException → ErrInvalidPassword (reset)",
			sdkErr: &types.PasswordHistoryPolicyViolationException{Message: aws.String("password reused")},
			want:   identity.ErrInvalidPassword,
			method: "resetpw",
		},
		{
			name:   "InvalidPasswordException → ErrInvalidPassword (reset)",
			sdkErr: &types.InvalidPasswordException{Message: aws.String("too weak")},
			want:   identity.ErrInvalidPassword,
			method: "resetpw",
		},
		{
			// Also what Cognito returns for a nonexistent or disabled user under
			// PreventUserExistenceErrors — which is why 400 "code is invalid" is
			// the right, non-leaking answer.
			name:   "CodeMismatchException → ErrCodeMismatch (reset)",
			sdkErr: &types.CodeMismatchException{Message: aws.String("bad code")},
			want:   identity.ErrCodeMismatch,
			method: "resetpw",
		},
		{
			// Also fires when no code was ever requested.
			name:   "ExpiredCodeException → ErrCodeExpired (reset)",
			sdkErr: &types.ExpiredCodeException{Message: aws.String("expired")},
			want:   identity.ErrCodeExpired,
			method: "resetpw",
		},
		{
			name:   "UserNotConfirmedException → ErrUserNotConfirmed (reset)",
			sdkErr: &types.UserNotConfirmedException{Message: aws.String("not confirmed")},
			want:   identity.ErrUserNotConfirmed,
			method: "resetpw",
		},
		{
			name:   "UserNotFoundException → ErrInvalidCredentials (forgot, enumeration safety)",
			sdkErr: &types.UserNotFoundException{Message: aws.String("not found")},
			want:   identity.ErrInvalidCredentials,
			method: "forgot",
		},
		{
			// CodeDeliveryFailureException is left on the default path at the
			// provider; handleForgotPassword swallows the resulting 502 into 204.
			name:   "CodeDeliveryFailureException → ErrProviderUnavailable (forgot)",
			sdkErr: &types.CodeDeliveryFailureException{Message: aws.String("delivery failed")},
			want:   identity.ErrProviderUnavailable,
			method: "forgot",
		},
		{
			name:   "unknown error → ErrProviderUnavailable (forgot)",
			sdkErr: errors.New("service unavailable"),
			want:   identity.ErrProviderUnavailable,
			method: "forgot",
		},
		{
			name:   "unknown error → ErrProviderUnavailable (reset)",
			sdkErr: errors.New("service unavailable"),
			want:   identity.ErrProviderUnavailable,
			method: "resetpw",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			fake := &fakeCognitoClient{}
			provider := identity.NewCognitoAuthProviderWithClient("client-id", fake)

			var got error
			switch tc.method {
			case "login":
				fake.initiateAuthErr = tc.sdkErr
				_, got = provider.Login(context.Background(), "u@x.com", "pass")
			case "register":
				fake.signUpErr = tc.sdkErr
				_, got = provider.Register(context.Background(), "u@x.com", "pass")
			case "confirm":
				fake.confirmSignUpErr = tc.sdkErr
				got = provider.Confirm(context.Background(), "u@x.com", "123456")
			case "logout":
				fake.globalSignOutErr = tc.sdkErr
				got = provider.Logout(context.Background(), "tok")
			case "forgot":
				fake.forgotPasswordErr = tc.sdkErr
				got = provider.ForgotPassword(context.Background(), "u@x.com")
			case "resetpw":
				fake.confirmForgotPasswordErr = tc.sdkErr
				got = provider.ConfirmForgotPassword(context.Background(), "u@x.com", "123456", "N3wSup3rSecret!!")
			}

			if !errors.Is(got, tc.want) {
				t.Errorf("error: got %v, want %v", got, tc.want)
			}
		})
	}
}

// ── TokenSet population ───────────────────────────────────────────────────────

func TestCognitoProvider_Login_TokenSetPopulated(t *testing.T) {
	t.Parallel()

	fake := &fakeCognitoClient{
		initiateAuthOut: &cognitoidentityprovider.InitiateAuthOutput{
			AuthenticationResult: &types.AuthenticationResultType{
				AccessToken:  aws.String("access-tok"),
				IdToken:      aws.String("id-tok"),
				RefreshToken: aws.String("refresh-tok"),
				ExpiresIn:    3600,
			},
		},
	}
	provider := identity.NewCognitoAuthProviderWithClient("client-id", fake)

	tokens, err := provider.Login(context.Background(), "u@x.com", "pass")
	if err != nil {
		t.Fatalf("login: %v", err)
	}

	if tokens.AccessToken != "access-tok" {
		t.Errorf("AccessToken: got %q, want access-tok", tokens.AccessToken)
	}
	if tokens.IDToken != "id-tok" {
		t.Errorf("IDToken: got %q, want id-tok", tokens.IDToken)
	}
	if tokens.RefreshToken != "refresh-tok" {
		t.Errorf("RefreshToken: got %q, want refresh-tok", tokens.RefreshToken)
	}
	if tokens.ExpiresIn != 3600 {
		t.Errorf("ExpiresIn: got %d, want 3600", tokens.ExpiresIn)
	}
	if tokens.TokenType != "Bearer" {
		t.Errorf("TokenType: got %q, want Bearer", tokens.TokenType)
	}
}

func TestCognitoProvider_Refresh_NoRefreshTokenInResponse(t *testing.T) {
	t.Parallel()

	fake := &fakeCognitoClient{
		initiateAuthOut: &cognitoidentityprovider.InitiateAuthOutput{
			AuthenticationResult: &types.AuthenticationResultType{
				AccessToken: aws.String("new-access"),
				IdToken:     aws.String("new-id"),
				// RefreshToken intentionally nil — Cognito omits it on refresh.
				ExpiresIn: 3600,
			},
		},
	}
	provider := identity.NewCognitoAuthProviderWithClient("client-id", fake)

	tokens, err := provider.Refresh(context.Background(), "old-refresh")
	if err != nil {
		t.Fatalf("refresh: %v", err)
	}

	if tokens.AccessToken != "new-access" {
		t.Errorf("AccessToken: got %q, want new-access", tokens.AccessToken)
	}
	if tokens.RefreshToken != "" {
		t.Errorf("RefreshToken: got %q, want empty on refresh response", tokens.RefreshToken)
	}
}

// ── RegisterResult population ─────────────────────────────────────────────────

func TestCognitoProvider_Register_ResultPopulated(t *testing.T) {
	t.Parallel()

	fake := &fakeCognitoClient{
		signUpOut: &cognitoidentityprovider.SignUpOutput{
			UserSub:       aws.String("sub-abc"),
			UserConfirmed: false, // email confirmation required
		},
	}
	provider := identity.NewCognitoAuthProviderWithClient("client-id", fake)

	result, err := provider.Register(context.Background(), "u@x.com", "StrongPass1!")
	if err != nil {
		t.Fatalf("register: %v", err)
	}

	if result.UserSub != "sub-abc" {
		t.Errorf("UserSub: got %q, want sub-abc", result.UserSub)
	}
	if !result.ConfirmationRequired {
		t.Error("ConfirmationRequired: got false, want true (UserConfirmed=false)")
	}
}

func TestCognitoProvider_Register_AutoConfirmed(t *testing.T) {
	t.Parallel()

	fake := &fakeCognitoClient{
		signUpOut: &cognitoidentityprovider.SignUpOutput{
			UserSub:       aws.String("sub-xyz"),
			UserConfirmed: true, // auto-confirmed
		},
	}
	provider := identity.NewCognitoAuthProviderWithClient("client-id", fake)

	result, err := provider.Register(context.Background(), "u@x.com", "StrongPass1!")
	if err != nil {
		t.Fatalf("register: %v", err)
	}

	if result.ConfirmationRequired {
		t.Error("ConfirmationRequired: got true, want false (UserConfirmed=true)")
	}
}

// ── GetUser ───────────────────────────────────────────────────────────────────

func TestCognitoProvider_GetUser_ReturnsEmail(t *testing.T) {
	t.Parallel()

	fake := &fakeCognitoClient{
		getUserOut: &cognitoidentityprovider.GetUserOutput{
			Username: aws.String("user1"),
			UserAttributes: []types.AttributeType{
				{Name: aws.String("sub"), Value: aws.String("sub-123")},
				{Name: aws.String("email"), Value: aws.String("alice@example.com")},
			},
		},
	}
	provider := identity.NewCognitoAuthProviderWithClient("client-id", fake)

	email, err := provider.GetUser(context.Background(), "access-tok")
	if err != nil {
		t.Fatalf("GetUser: %v", err)
	}
	if email != "alice@example.com" {
		t.Errorf("email: got %q, want alice@example.com", email)
	}
}

func TestCognitoProvider_GetUser_MissingEmail_ReturnsEmpty(t *testing.T) {
	t.Parallel()

	fake := &fakeCognitoClient{
		getUserOut: &cognitoidentityprovider.GetUserOutput{
			Username:       aws.String("user1"),
			UserAttributes: []types.AttributeType{}, // no email attribute
		},
	}
	provider := identity.NewCognitoAuthProviderWithClient("client-id", fake)

	email, err := provider.GetUser(context.Background(), "access-tok")
	if err != nil {
		t.Fatalf("GetUser: %v", err)
	}
	if email != "" {
		t.Errorf("email: got %q, want empty", email)
	}
}

func TestCognitoProvider_GetUser_Error_MapsToSentinel(t *testing.T) {
	t.Parallel()

	fake := &fakeCognitoClient{
		getUserErr: &types.NotAuthorizedException{Message: aws.String("invalid token")},
	}
	provider := identity.NewCognitoAuthProviderWithClient("client-id", fake)

	_, err := provider.GetUser(context.Background(), "bad-token")
	if !errors.Is(err, identity.ErrInvalidCredentials) {
		t.Errorf("error: got %v, want ErrInvalidCredentials", err)
	}
}

// ── Logout ────────────────────────────────────────────────────────────────────

func TestCognitoProvider_Logout_Success(t *testing.T) {
	t.Parallel()

	fake := &fakeCognitoClient{globalSignOutErr: nil}
	provider := identity.NewCognitoAuthProviderWithClient("client-id", fake)

	if err := provider.Logout(context.Background(), "valid-tok"); err != nil {
		t.Errorf("logout: got %v, want nil", err)
	}
}

func TestCognitoProvider_Logout_InvalidToken_ErrInvalidCredentials(t *testing.T) {
	t.Parallel()

	fake := &fakeCognitoClient{
		globalSignOutErr: &types.NotAuthorizedException{Message: aws.String("invalid token")},
	}
	provider := identity.NewCognitoAuthProviderWithClient("client-id", fake)

	err := provider.Logout(context.Background(), "bad-tok")
	if !errors.Is(err, identity.ErrInvalidCredentials) {
		t.Errorf("error: got %v, want ErrInvalidCredentials", err)
	}
}

// ── Password reset ────────────────────────────────────────────────────────────

func TestCognitoProvider_ForgotPassword_Success(t *testing.T) {
	t.Parallel()

	fake := &fakeCognitoClient{forgotPasswordErr: nil}
	provider := identity.NewCognitoAuthProviderWithClient("client-id", fake)

	if err := provider.ForgotPassword(context.Background(), "u@x.com"); err != nil {
		t.Fatalf("ForgotPassword: got %v, want nil", err)
	}

	if got := aws.ToString(fake.forgotPasswordIn.ClientId); got != "client-id" {
		t.Errorf("ClientId: got %q, want client-id", got)
	}
	if got := aws.ToString(fake.forgotPasswordIn.Username); got != "u@x.com" {
		t.Errorf("Username: got %q, want u@x.com", got)
	}
	// GenerateSecret is false on the app client, so no SECRET_HASH is ever sent.
	if fake.forgotPasswordIn.SecretHash != nil {
		t.Errorf("SecretHash: got %q, want nil (public client has no secret)", aws.ToString(fake.forgotPasswordIn.SecretHash))
	}
}

// TestCognitoProvider_ConfirmForgotPassword_Success also pins the argument order
// of the three-string signature (email, code, newPassword) onto the right SDK
// fields — the most likely defect in this change.
func TestCognitoProvider_ConfirmForgotPassword_Success(t *testing.T) {
	t.Parallel()

	fake := &fakeCognitoClient{confirmForgotPasswordErr: nil}
	provider := identity.NewCognitoAuthProviderWithClient("client-id", fake)

	err := provider.ConfirmForgotPassword(context.Background(), "u@x.com", "123456", "N3wSup3rSecret!!")
	if err != nil {
		t.Fatalf("ConfirmForgotPassword: got %v, want nil", err)
	}

	in := fake.confirmForgotPasswordIn
	if got := aws.ToString(in.ClientId); got != "client-id" {
		t.Errorf("ClientId: got %q, want client-id", got)
	}
	if got := aws.ToString(in.Username); got != "u@x.com" {
		t.Errorf("Username: got %q, want u@x.com", got)
	}
	if got := aws.ToString(in.ConfirmationCode); got != "123456" {
		t.Errorf("ConfirmationCode: got %q, want 123456", got)
	}
	if got := aws.ToString(in.Password); got != "N3wSup3rSecret!!" {
		t.Errorf("Password: got %q, want the new password", got)
	}
}
