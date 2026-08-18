package identity

import (
	"context"
	"errors"
)

// AuthProvider performs credential/session operations against the managed
// identity provider (Cognito today). It is provider-neutral: handlers depend on
// this interface and the DTOs below, never on AWS SDK types.
type AuthProvider interface {
	Register(ctx context.Context, email, password string) (RegisterResult, error)
	Confirm(ctx context.Context, email, code string) error
	Login(ctx context.Context, email, password string) (TokenSet, error)
	Refresh(ctx context.Context, refreshToken string) (TokenSet, error)
	Logout(ctx context.Context, accessToken string) error
	// GetUser returns the email for the bearer of accessToken (Cognito GetUser).
	// Used as the empty-email fallback for tokens that never hit /v1/auth/login.
	GetUser(ctx context.Context, accessToken string) (email string, err error)

	// ForgotPassword starts the self-service password reset flow: Cognito emails a
	// one-time code to the address on file (valid for one hour).
	//
	// Enumeration note: with PreventUserExistenceErrors=ENABLED, Cognito succeeds
	// for unknown, disabled, and unverified users alike, returning a simulated
	// delivery destination and sending nothing. Callers must therefore treat a nil
	// error as "request accepted", never as "this account exists".
	ForgotPassword(ctx context.Context, email string) error

	// ConfirmForgotPassword completes the reset: it exchanges the emailed code for
	// a new password. The new password must satisfy the pool's password policy.
	// Never log code or newPassword.
	ConfirmForgotPassword(ctx context.Context, email, code, newPassword string) error
}

// TokenSet is a provider-neutral bundle of issued tokens.
type TokenSet struct {
	AccessToken  string
	IDToken      string
	RefreshToken string // empty on Refresh responses (Cognito omits it)
	ExpiresIn    int    // seconds
	TokenType    string // "Bearer"
}

// RegisterResult reports whether Cognito requires a confirmation step.
type RegisterResult struct {
	UserSub              string
	ConfirmationRequired bool // true when AutoVerifiedAttributes requires ConfirmSignUp
}

// Sentinel errors so handlers can map provider failures to HTTP codes
// without importing the AWS SDK.
var (
	// ErrInvalidCredentials is returned for bad username/password or when a
	// user does not exist (to preserve PreventUserExistenceErrors behavior).
	ErrInvalidCredentials = errors.New("identity: invalid credentials")

	// ErrUserNotConfirmed is returned when the user has not completed email
	// verification before attempting to log in.
	ErrUserNotConfirmed = errors.New("identity: user not confirmed")

	// ErrCodeMismatch is returned when the confirmation code is wrong.
	ErrCodeMismatch = errors.New("identity: confirmation code invalid")

	// ErrCodeExpired is returned when the confirmation code has expired.
	ErrCodeExpired = errors.New("identity: confirmation code expired")

	// ErrUsernameExists is returned when a registration email is already taken.
	ErrUsernameExists = errors.New("identity: user already exists")

	// ErrInvalidPassword is returned when the password does not satisfy the
	// pool's password policy (length, complexity).
	ErrInvalidPassword = errors.New("identity: password does not meet policy")

	// ErrTooManyRequests is returned when the provider throttles the caller.
	// Cognito allows a limited number of password-reset requests or code entries
	// per user per hour (risk-dependent and subject to change), and enforces
	// account-level request quotas. Maps to HTTP 429.
	ErrTooManyRequests = errors.New("identity: too many requests")

	// ErrRecoveryUnavailable is returned when the account has no verified
	// destination for a reset code. Under PreventUserExistenceErrors=ENABLED this
	// should not surface for the self-service flow (Cognito simulates delivery
	// instead), but ConfirmForgotPassword and future pool configurations can still
	// produce it. The forgot-password handler deliberately swallows this into 204
	// so it cannot be used to probe account state.
	ErrRecoveryUnavailable = errors.New("identity: no verified recovery method")

	// ErrProviderUnavailable is returned for any Cognito error that does not
	// map to a more specific sentinel (e.g. service errors, throttling).
	ErrProviderUnavailable = errors.New("identity: provider unavailable")
)
