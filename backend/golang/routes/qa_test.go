package routes_test

// qa_test.go — QA-added tests for behaviors called out in the
// cognito-auth-testable plan that were missing from the original test suite.

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/krishm/spots/backend/golang/routes"
	"github.com/krishm/spots/backend/golang/services/identity"
	"github.com/krishm/spots/backend/golang/services/profile"
	"github.com/krishm/spots/backend/golang/services/reco"
)

// ── Tracking auth provider ────────────────────────────────────────────────────

// trackingAuthProvider wraps stubAuthProvider and records whether GetUser was
// called. Used to assert the empty-email fallback fires (or does not fire) on
// GET /v1/users/me.
type trackingAuthProvider struct {
	stubAuthProvider
	getUserCalled bool
	getUserResult string
	getUserErr    error
}

func (p *trackingAuthProvider) GetUser(_ context.Context, _ string) (string, error) {
	p.getUserCalled = true
	return p.getUserResult, p.getUserErr
}

// newGetMeServerWithProvider builds a server with a full set of deps
// (TokenVerifier, Authenticator, ProfileSvc, AuthProvider, UserStore) for
// testing GET /v1/users/me with the empty-email fallback logic.
func newGetMeServerWithProvider(
	t *testing.T,
	verifier identity.TokenVerifier,
	authr identity.Authenticator,
	ap identity.AuthProvider,
	store identity.UserStore,
) *routes.Server {
	t.Helper()
	profileSvc := profile.NewService(profile.NewMemStore())
	return routes.NewServer(":0", routes.Deps{
		RecoChecker:   reco.NewChecker("http://localhost:0"),
		TokenVerifier: verifier,
		Authenticator: authr,
		ProfileSvc:    profileSvc,
		AuthProvider:  ap,
		UserStore:     store,
	})
}

// ── Caveat-1: GetUser fallback in GET /v1/users/me ───────────────────────────

// TestGetMe_EmptyEmail_GetUserFallback_Fires asserts that when the resolved
// user has an empty email, GET /v1/users/me calls AuthProvider.GetUser to
// backfill the email and returns it in the response body (users.go lines 42-49).
func TestGetMe_EmptyEmail_GetUserFallback_Fires(t *testing.T) {
	t.Parallel()

	store := identity.NewMemStore()

	// Authenticator returns a user with empty email.
	emptyEmailUser := &identity.User{
		ID:         "user-empty",
		CognitoSub: "sub-empty",
		Email:      "", // no email — triggers the fallback
		Status:     "active",
	}
	// Pre-populate the store so UpdateEmail has a row to update.
	if err := store.Create(context.Background(), emptyEmailUser); err != nil {
		t.Fatalf("seed store: %v", err)
	}

	authr := &stubAuthenticator{user: emptyEmailUser}
	verifier := &stubVerifier{claims: identity.Claims{Subject: "sub-empty"}}

	provider := &trackingAuthProvider{
		getUserResult: "fallback@example.com",
	}

	srv := newGetMeServerWithProvider(t, verifier, authr, provider, store)

	req := httptest.NewRequest(http.MethodGet, "/v1/users/me", nil)
	req.Header.Set("Authorization", "Bearer some-access-token")
	rec := httptest.NewRecorder()
	srv.HTTP.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}
	if !provider.getUserCalled {
		t.Error("GetUser fallback: expected GetUser to be called when user.Email is empty, but it was not")
	}
	if !strings.Contains(rec.Body.String(), "fallback@example.com") {
		t.Errorf("response body: expected fallback email in response, got: %s", rec.Body.String())
	}
}

// TestGetMe_NonEmptyEmail_GetUserFallback_NotCalled asserts that when the
// resolved user already has an email, GET /v1/users/me does NOT call
// AuthProvider.GetUser (the common happy path makes no extra Cognito call).
func TestGetMe_NonEmptyEmail_GetUserFallback_NotCalled(t *testing.T) {
	t.Parallel()

	store := identity.NewMemStore()

	// Authenticator returns a user WITH email already set.
	userWithEmail := &identity.User{
		ID:         "user-with-email",
		CognitoSub: "sub-with-email",
		Email:      "present@example.com", // email is present → no fallback
		Status:     "active",
	}
	if err := store.Create(context.Background(), userWithEmail); err != nil {
		t.Fatalf("seed store: %v", err)
	}

	authr := &stubAuthenticator{user: userWithEmail}
	verifier := &stubVerifier{claims: identity.Claims{Subject: "sub-with-email"}}

	provider := &trackingAuthProvider{
		getUserResult: "should-not-be-returned@example.com",
	}

	srv := newGetMeServerWithProvider(t, verifier, authr, provider, store)

	req := httptest.NewRequest(http.MethodGet, "/v1/users/me", nil)
	req.Header.Set("Authorization", "Bearer some-access-token")
	rec := httptest.NewRecorder()
	srv.HTTP.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}
	if provider.getUserCalled {
		t.Error("GetUser fallback: expected GetUser NOT to be called when user.Email is already set (extra Cognito call on the happy path)")
	}
	if !strings.Contains(rec.Body.String(), "present@example.com") {
		t.Errorf("response body: expected original email in response, got: %s", rec.Body.String())
	}
}

// ── Error mapping: ErrProviderUnavailable → 502 ───────────────────────────────

// TestRegister_ProviderUnavailable_502 asserts that ErrProviderUnavailable from
// the AuthProvider maps to 502 Bad Gateway on POST /v1/auth/register.
func TestRegister_ProviderUnavailable_502(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{registerErr: identity.ErrProviderUnavailable}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/register", `{"email":"u@x.com","password":"StrongPass1!"}`)

	if rec.Code != http.StatusBadGateway {
		t.Errorf("status: got %d, want 502 for ErrProviderUnavailable", rec.Code)
	}
}

// TestLogin_ProviderUnavailable_502 asserts the 502 mapping on POST /v1/auth/login.
func TestLogin_ProviderUnavailable_502(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{loginErr: identity.ErrProviderUnavailable}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/login", `{"email":"u@x.com","password":"StrongPass1!"}`)

	if rec.Code != http.StatusBadGateway {
		t.Errorf("status: got %d, want 502 for ErrProviderUnavailable", rec.Code)
	}
}

// TestConfirm_ProviderUnavailable_502 asserts the 502 mapping on POST /v1/auth/confirm.
func TestConfirm_ProviderUnavailable_502(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{confirmErr: identity.ErrProviderUnavailable}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/confirm", `{"email":"u@x.com","code":"123456"}`)

	if rec.Code != http.StatusBadGateway {
		t.Errorf("status: got %d, want 502 for ErrProviderUnavailable", rec.Code)
	}
}

// TestRefresh_ProviderUnavailable_502 asserts the 502 mapping on POST /v1/auth/refresh.
func TestRefresh_ProviderUnavailable_502(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{refreshErr: identity.ErrProviderUnavailable}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/refresh", `{"refresh_token":"old-refresh"}`)

	if rec.Code != http.StatusBadGateway {
		t.Errorf("status: got %d, want 502 for ErrProviderUnavailable", rec.Code)
	}
}

// ── Authorization header edge cases ──────────────────────────────────────────

// TestLogout_LowercaseBearer_401 documents that the Authorization header scheme
// matching is case-sensitive: "bearer" (lowercase) is rejected with 401.
// RFC 7235 §2.1 says the scheme is case-insensitive; the current implementation
// is stricter. This test documents the actual behavior.
func TestLogout_LowercaseBearer_401(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{}
	srv := newProviderOnlyServer(t, ap)

	req := httptest.NewRequest(http.MethodPost, "/v1/auth/logout", nil)
	req.Header.Set("Authorization", "bearer valid-token") // lowercase scheme
	rec := httptest.NewRecorder()
	srv.HTTP.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: got %d, want 401 for lowercase 'bearer' scheme", rec.Code)
	}
}

// TestLogout_EmptyTokenAfterBearer asserts that "Bearer " with no token after
// the prefix is rejected with 401 before the provider is called, rather than
// forwarding an empty access token to GlobalSignOut.
func TestLogout_EmptyTokenAfterBearer(t *testing.T) {
	t.Parallel()

	// If the empty-token guard regresses, the stub would succeed and return 204.
	ap := &stubAuthProvider{logoutErr: nil}
	srv := newProviderOnlyServer(t, ap)

	req := httptest.NewRequest(http.MethodPost, "/v1/auth/logout", nil)
	req.Header.Set("Authorization", "Bearer ") // no token after the prefix
	rec := httptest.NewRecorder()
	srv.HTTP.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: got %d, want 401 for empty token after 'Bearer '", rec.Code)
	}
}

// TestLogout_NonBearerScheme_401 asserts that a non-Bearer scheme (e.g. Basic)
// is rejected with 401.
func TestLogout_NonBearerScheme_401(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{}
	srv := newProviderOnlyServer(t, ap)

	req := httptest.NewRequest(http.MethodPost, "/v1/auth/logout", nil)
	req.Header.Set("Authorization", "Basic dXNlcjpwYXNz")
	rec := httptest.NewRecorder()
	srv.HTTP.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: got %d, want 401 for Basic scheme on logout", rec.Code)
	}
}

// TestLogin_EmptyBody_400 asserts that a completely empty request body to
// POST /v1/auth/login returns 400 (json.Decode returns io.EOF).
func TestLogin_EmptyBody_400(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{}
	srv := newProviderOnlyServer(t, ap)

	req := httptest.NewRequest(http.MethodPost, "/v1/auth/login", strings.NewReader(""))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.HTTP.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want 400 for empty body", rec.Code)
	}
}

// TestRegister_EmptyBody_400 asserts that a completely empty request body to
// POST /v1/auth/register returns 400.
func TestRegister_EmptyBody_400(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{}
	srv := newProviderOnlyServer(t, ap)

	req := httptest.NewRequest(http.MethodPost, "/v1/auth/register", strings.NewReader(""))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.HTTP.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want 400 for empty body", rec.Code)
	}
}

// ── Password reset: the enumeration contract ─────────────────────────────────

// TestForgotPassword_AlwaysNoContent is the guard rail for the account
// enumeration rule on POST /v1/auth/forgot-password.
//
// The rule: the response must be byte-identical whether the address belongs to a
// real confirmed user, an unconfirmed user, a disabled user, or nobody at all.
// The user pool sets PreventUserExistenceErrors=ENABLED, so Cognito itself
// already returns a simulated delivery destination (and sends no email) for
// accounts it cannot deliver to. Every provider error except throttling is
// therefore swallowed into 204 and logged server-side instead.
//
// If this test starts failing because someone added a "helpful" error response,
// that is the bug — not this test. Do not "fix" it. The same reasoning is why
// UserNotFoundException maps to 401 rather than 404 on login.
func TestForgotPassword_AlwaysNoContent(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		providerErr error
	}{
		{name: "success", providerErr: nil},
		{name: "no verified recovery destination", providerErr: identity.ErrRecoveryUnavailable},
		{name: "unknown user (mapped to invalid credentials)", providerErr: identity.ErrInvalidCredentials},
		{name: "provider/code-delivery failure", providerErr: identity.ErrProviderUnavailable},
		{name: "user not confirmed", providerErr: identity.ErrUserNotConfirmed},
		{name: "code mismatch", providerErr: identity.ErrCodeMismatch},
		{name: "unmapped error", providerErr: errors.New("something else entirely")},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ap := &stubAuthProvider{forgotPasswordErr: tc.providerErr}
			srv := newProviderOnlyServer(t, ap)
			rec := postJSON(srv, "/v1/auth/forgot-password", `{"email":"u@x.com"}`)

			if rec.Code != http.StatusNoContent {
				t.Errorf("status: got %d, want 204 — every outcome except throttling must look identical", rec.Code)
			}
			if body := rec.Body.String(); body != "" {
				t.Errorf("body: got %q, want empty — a response body could differentiate outcomes", body)
			}
		})
	}
}

// TestResetPassword_MissingEachField_400 asserts the handler rejects a request
// missing any one of the three required fields before calling the provider.
func TestResetPassword_MissingEachField_400(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		body string
	}{
		{name: "missing email", body: `{"code":"123456","password":"N3wSup3rSecret!!"}`},
		{name: "missing code", body: `{"email":"u@x.com","password":"N3wSup3rSecret!!"}`},
		{name: "missing password", body: `{"email":"u@x.com","code":"123456"}`},
		{name: "empty email", body: `{"email":"","code":"123456","password":"N3wSup3rSecret!!"}`},
		{name: "empty code", body: `{"email":"u@x.com","code":"","password":"N3wSup3rSecret!!"}`},
		{name: "empty password", body: `{"email":"u@x.com","code":"123456","password":""}`},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ap := &stubAuthProvider{}
			srv := newProviderOnlyServer(t, ap)
			rec := postJSON(srv, "/v1/auth/reset-password", tc.body)

			if rec.Code != http.StatusBadRequest {
				t.Errorf("status: got %d, want 400", rec.Code)
			}
			// The provider must not be reached with a blank code or password.
			if ap.gotResetEmail != "" || ap.gotResetCode != "" || ap.gotResetPassword != "" {
				t.Error("provider was called despite an incomplete request body")
			}
		})
	}
}
