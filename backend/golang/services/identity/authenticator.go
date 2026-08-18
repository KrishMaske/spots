package identity

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"time"
)

// Authenticator maps verified token claims to a Spots User. It is the primary
// entry point for the auth flow after token verification: given valid claims,
// it returns the corresponding Spots User, creating the user row on first login.
//
// The interface is intentionally provider-agnostic. The Cognito-backed
// implementation is the only production implementation, but anything that can
// supply verified Claims can drive it (e.g. a different OIDC provider or a
// test stub).
type Authenticator interface {
	Authenticate(ctx context.Context, claims Claims) (*User, error)
}

// CognitoAuthenticator is the Cognito-backed Authenticator. It looks up the
// user by Cognito sub and creates a Spots user row on first login.
//
// Profile bootstrapping (display name, avatar, etc.) is deferred: the profile
// service lazy-creates a stub profile on the first GET /v1/users/me request,
// which keeps the identity and profile service boundaries clean.
type CognitoAuthenticator struct {
	store UserStore
	newID func() string
}

// NewCognitoAuthenticator constructs a CognitoAuthenticator.
// newID is a function that generates a new unique user ID. When nil, it
// defaults to a stdlib-only UUID v4 generator (no external deps).
func NewCognitoAuthenticator(store UserStore, newID func() string) *CognitoAuthenticator {
	if newID == nil {
		newID = newUserID
	}
	return &CognitoAuthenticator{store: store, newID: newID}
}

// Authenticate looks up the user by claims.Subject (Cognito sub). On a
// first-login (ErrNotFound), a new Spots user row is created. On subsequent
// logins the last-login timestamp is updated.
func (a *CognitoAuthenticator) Authenticate(ctx context.Context, claims Claims) (*User, error) {
	user, err := a.store.FindBySub(ctx, claims.Subject)
	if errors.Is(err, ErrNotFound) {
		// First login: bootstrap the Spots user row.
		user = &User{
			ID:          a.newID(),
			CognitoSub:  claims.Subject,
			Email:       claims.Email,
			Status:      "active",
			CreatedAt:   time.Now().UTC(),
			LastLoginAt: time.Now().UTC(),
		}
		if createErr := a.store.Create(ctx, user); createErr != nil {
			return nil, fmt.Errorf("authenticate: create user on first login: %w", createErr)
		}
		return user, nil
	}
	if err != nil {
		return nil, fmt.Errorf("authenticate: find user: %w", err)
	}

	// Existing user: update last-login. Non-fatal — do not fail auth on a
	// bookkeeping write error (it will be visible in the DB diff).
	_ = a.store.UpdateLastLogin(ctx, user.ID)

	// Email self-heal (caveat 2 from cognito-auth-testable plan): if the stored
	// row was created without an email (e.g. via a non-login token path) and the
	// current claims carry one, backfill it now. Non-fatal.
	if claims.Email != "" && user.Email != claims.Email {
		if updateErr := a.store.UpdateEmail(ctx, user.ID, claims.Email); updateErr == nil {
			user.Email = claims.Email
		}
	}

	return user, nil
}

// UserFromContext retrieves the authenticated Spots User from ctx.
// Returns nil, false when no user is present (unauthenticated request).
func UserFromContext(ctx context.Context) (*User, bool) {
	u, ok := ctx.Value(contextKeyUser).(*User)
	return u, ok
}

// ContextWithUser returns a new context carrying user.
// Called by the route middleware after successful authentication.
func ContextWithUser(ctx context.Context, user *User) context.Context {
	return context.WithValue(ctx, contextKeyUser, user)
}

// contextKey is the unexported type for context keys in this package.
// Using a package-local type prevents collisions with other packages.
type contextKey int

const contextKeyUser contextKey = 0

// newUserID generates a random UUID v4 using crypto/rand (stdlib only).
func newUserID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(fmt.Sprintf("identity: failed to generate UUID: %v", err))
	}
	// Set version bits (version 4).
	b[6] = (b[6] & 0x0f) | 0x40
	// Set variant bits (RFC 4122).
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
