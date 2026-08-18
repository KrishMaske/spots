package routes_test

import (
	"context"
	"encoding/json"
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

// ── Stub AuthProvider ─────────────────────────────────────────────────────────

type stubAuthProvider struct {
	registerResult identity.RegisterResult
	registerErr    error
	confirmErr     error
	loginResult    identity.TokenSet
	loginErr       error
	refreshResult  identity.TokenSet
	refreshErr     error
	logoutErr      error
	getUserResult  string
	getUserErr     error

	forgotPasswordErr error
	resetPasswordErr  error

	// Captured arguments, in the style of capturingAuthenticator. Cheap
	// insurance against argument-order bugs in the three-string
	// ConfirmForgotPassword(ctx, email, code, newPassword) signature.
	gotForgotEmail   string
	gotResetEmail    string
	gotResetCode     string
	gotResetPassword string
}

func (s *stubAuthProvider) Register(_ context.Context, _, _ string) (identity.RegisterResult, error) {
	return s.registerResult, s.registerErr
}

func (s *stubAuthProvider) Confirm(_ context.Context, _, _ string) error {
	return s.confirmErr
}

func (s *stubAuthProvider) Login(_ context.Context, _, _ string) (identity.TokenSet, error) {
	return s.loginResult, s.loginErr
}

func (s *stubAuthProvider) Refresh(_ context.Context, _ string) (identity.TokenSet, error) {
	return s.refreshResult, s.refreshErr
}

func (s *stubAuthProvider) Logout(_ context.Context, _ string) error {
	return s.logoutErr
}

func (s *stubAuthProvider) GetUser(_ context.Context, _ string) (string, error) {
	return s.getUserResult, s.getUserErr
}

func (s *stubAuthProvider) ForgotPassword(_ context.Context, email string) error {
	s.gotForgotEmail = email
	return s.forgotPasswordErr
}

func (s *stubAuthProvider) ConfirmForgotPassword(_ context.Context, email, code, newPassword string) error {
	s.gotResetEmail = email
	s.gotResetCode = code
	s.gotResetPassword = newPassword
	return s.resetPasswordErr
}

// ── capturingAuthenticator records the last Authenticate call ─────────────────

type capturingAuthenticator struct {
	gotClaims identity.Claims
	user      *identity.User
	err       error
}

func (c *capturingAuthenticator) Authenticate(_ context.Context, claims identity.Claims) (*identity.User, error) {
	c.gotClaims = claims
	return c.user, c.err
}

// ── Server builder helpers ────────────────────────────────────────────────────

// newProviderOnlyServer builds a server with only an AuthProvider (no verifier).
func newProviderOnlyServer(_ *testing.T, ap identity.AuthProvider) *routes.Server {
	return routes.NewServer(":0", routes.Deps{
		RecoChecker:  reco.NewChecker("http://localhost:0"),
		AuthProvider: ap,
	})
}

// newFullAuthServer builds a server with AuthProvider, TokenVerifier,
// Authenticator, ProfileSvc, and UserStore for enrichment-path tests.
func newFullAuthServer(
	_ *testing.T,
	ap identity.AuthProvider,
	v identity.TokenVerifier,
	authr identity.Authenticator,
	store identity.UserStore,
) *routes.Server {
	profileSvc := profile.NewService(profile.NewMemStore())
	return routes.NewServer(":0", routes.Deps{
		RecoChecker:   reco.NewChecker("http://localhost:0"),
		AuthProvider:  ap,
		TokenVerifier: v,
		Authenticator: authr,
		ProfileSvc:    profileSvc,
		UserStore:     store,
	})
}

// postJSON sends a POST request with a JSON body string.
func postJSON(srv *routes.Server, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.HTTP.Handler.ServeHTTP(rec, req)
	return rec
}

// ── POST /v1/auth/register ────────────────────────────────────────────────────

func TestRegister_Success_201(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{
		registerResult: identity.RegisterResult{UserSub: "sub-abc", ConfirmationRequired: true},
	}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/register", `{"email":"u@x.com","password":"StrongPass1!"}`)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status: got %d, want 201 (body: %s)", rec.Code, rec.Body.String())
	}
	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["user_sub"] != "sub-abc" {
		t.Errorf("user_sub: got %v, want sub-abc", body["user_sub"])
	}
	if body["confirmation_required"] != true {
		t.Errorf("confirmation_required: got %v, want true", body["confirmation_required"])
	}
}

func TestRegister_UsernameExists_409(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{registerErr: identity.ErrUsernameExists}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/register", `{"email":"u@x.com","password":"StrongPass1!"}`)

	if rec.Code != http.StatusConflict {
		t.Errorf("status: got %d, want 409", rec.Code)
	}
}

func TestRegister_InvalidPassword_400(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{registerErr: identity.ErrInvalidPassword}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/register", `{"email":"u@x.com","password":"weak"}`)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want 400", rec.Code)
	}
}

func TestRegister_MalformedBody_400(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/register", `not-json`)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want 400", rec.Code)
	}
}

func TestRegister_MissingFields_400(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/register", `{"email":"u@x.com"}`) // no password

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want 400", rec.Code)
	}
}

// ── POST /v1/auth/confirm ─────────────────────────────────────────────────────

func TestConfirm_Success_204(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/confirm", `{"email":"u@x.com","code":"123456"}`)

	if rec.Code != http.StatusNoContent {
		t.Errorf("status: got %d, want 204", rec.Code)
	}
}

func TestConfirm_CodeMismatch_400(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{confirmErr: identity.ErrCodeMismatch}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/confirm", `{"email":"u@x.com","code":"wrong"}`)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want 400", rec.Code)
	}
}

func TestConfirm_CodeExpired_400(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{confirmErr: identity.ErrCodeExpired}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/confirm", `{"email":"u@x.com","code":"expired"}`)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want 400", rec.Code)
	}
}

func TestConfirm_MissingFields_400(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/confirm", `{"email":"u@x.com"}`) // no code

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want 400", rec.Code)
	}
}

// ── POST /v1/auth/login ───────────────────────────────────────────────────────

func TestLogin_Success_200(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{
		loginResult: identity.TokenSet{
			AccessToken:  "access-tok",
			IDToken:      "id-tok",
			RefreshToken: "refresh-tok",
			ExpiresIn:    3600,
			TokenType:    "Bearer",
		},
	}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/login", `{"email":"u@x.com","password":"StrongPass1!"}`)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}
	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["access_token"] != "access-tok" {
		t.Errorf("access_token: got %v, want access-tok", body["access_token"])
	}
	if body["id_token"] != "id-tok" {
		t.Errorf("id_token: got %v, want id-tok", body["id_token"])
	}
	if body["refresh_token"] != "refresh-tok" {
		t.Errorf("refresh_token: got %v, want refresh-tok", body["refresh_token"])
	}
	if body["token_type"] != "Bearer" {
		t.Errorf("token_type: got %v, want Bearer", body["token_type"])
	}
}

func TestLogin_InvalidCredentials_401(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{loginErr: identity.ErrInvalidCredentials}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/login", `{"email":"u@x.com","password":"wrong"}`)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: got %d, want 401", rec.Code)
	}
}

func TestLogin_UserNotConfirmed_403(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{loginErr: identity.ErrUserNotConfirmed}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/login", `{"email":"u@x.com","password":"StrongPass1!"}`)

	if rec.Code != http.StatusForbidden {
		t.Errorf("status: got %d, want 403", rec.Code)
	}
}

// TestLogin_EmailEnrichment_BootstrapsUserRow verifies that a successful login
// calls Authenticate with the login email so the Spots user row is populated.
func TestLogin_EmailEnrichment_BootstrapsUserRow(t *testing.T) {
	t.Parallel()

	const loginEmail = "alice@example.com"
	const fakeSub = "sub-alice"

	ap := &stubAuthProvider{
		loginResult: identity.TokenSet{
			AccessToken: "access-tok",
			IDToken:     "id-tok",
			TokenType:   "Bearer",
		},
	}
	verifier := &stubVerifier{
		claims: identity.Claims{Subject: fakeSub},
	}
	authr := &capturingAuthenticator{
		user: &identity.User{ID: "u1", CognitoSub: fakeSub, Email: loginEmail, Status: "active"},
	}
	store := identity.NewMemStore()
	srv := newFullAuthServer(t, ap, verifier, authr, store)

	rec := postJSON(srv, "/v1/auth/login", `{"email":"`+loginEmail+`","password":"StrongPass1!"}`)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}

	// Assert Authenticate was called and received the login email.
	if authr.gotClaims.Subject != fakeSub {
		t.Errorf("claims.Subject: got %q, want %q", authr.gotClaims.Subject, fakeSub)
	}
	if authr.gotClaims.Email != loginEmail {
		t.Errorf("claims.Email: got %q, want %q", authr.gotClaims.Email, loginEmail)
	}
}

// TestLogin_EnrichmentVerifyFails_Still200 asserts that a failed token
// verification during email enrichment does not fail the login response.
func TestLogin_EnrichmentVerifyFails_Still200(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{
		loginResult: identity.TokenSet{AccessToken: "tok", TokenType: "Bearer"},
	}
	// Verifier fails — enrichment should be skipped.
	verifier := &stubVerifier{err: errors.New("signature mismatch")}
	authr := &capturingAuthenticator{
		user: &identity.User{ID: "u1", CognitoSub: "sub", Status: "active"},
	}
	store := identity.NewMemStore()
	srv := newFullAuthServer(t, ap, verifier, authr, store)

	rec := postJSON(srv, "/v1/auth/login", `{"email":"u@x.com","password":"pass"}`)

	// The login itself succeeded; enrichment failure must not surface as an error.
	if rec.Code != http.StatusOK {
		t.Errorf("status: got %d, want 200", rec.Code)
	}
}

// TestLogin_EnrichmentAuthenticateFails_Still200 asserts that a failed
// Authenticate call during email enrichment does not fail the login response.
func TestLogin_EnrichmentAuthenticateFails_Still200(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{
		loginResult: identity.TokenSet{AccessToken: "tok", TokenType: "Bearer"},
	}
	verifier := &stubVerifier{claims: identity.Claims{Subject: "sub"}}
	// Authenticator fails — enrichment should be swallowed.
	authr := &capturingAuthenticator{
		err: errors.New("store down"),
	}
	store := identity.NewMemStore()
	srv := newFullAuthServer(t, ap, verifier, authr, store)

	rec := postJSON(srv, "/v1/auth/login", `{"email":"u@x.com","password":"pass"}`)

	if rec.Code != http.StatusOK {
		t.Errorf("status: got %d, want 200", rec.Code)
	}
}

// ── POST /v1/auth/refresh ─────────────────────────────────────────────────────

func TestRefresh_Success_200(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{
		refreshResult: identity.TokenSet{
			AccessToken: "new-access",
			IDToken:     "new-id",
			ExpiresIn:   3600,
			TokenType:   "Bearer",
		},
	}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/refresh", `{"refresh_token":"old-refresh"}`)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}
	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["access_token"] != "new-access" {
		t.Errorf("access_token: got %v, want new-access", body["access_token"])
	}
	// refresh_token should be omitted (Cognito does not issue one on refresh).
	if _, ok := body["refresh_token"]; ok {
		t.Errorf("refresh_token should be omitted from refresh response, got %v", body["refresh_token"])
	}
}

func TestRefresh_InvalidToken_401(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{refreshErr: identity.ErrInvalidCredentials}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/refresh", `{"refresh_token":"bad-token"}`)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: got %d, want 401", rec.Code)
	}
}

func TestRefresh_MissingField_400(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/refresh", `{}`) // no refresh_token

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want 400", rec.Code)
	}
}

// ── POST /v1/auth/logout ──────────────────────────────────────────────────────

func TestLogout_WithBearerHeader_204(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{}
	srv := newProviderOnlyServer(t, ap)

	req := httptest.NewRequest(http.MethodPost, "/v1/auth/logout", nil)
	req.Header.Set("Authorization", "Bearer valid-access-token")
	rec := httptest.NewRecorder()
	srv.HTTP.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("status: got %d, want 204", rec.Code)
	}
}

func TestLogout_MissingAuthHeader_401(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{}
	srv := newProviderOnlyServer(t, ap)

	req := httptest.NewRequest(http.MethodPost, "/v1/auth/logout", nil)
	// No Authorization header.
	rec := httptest.NewRecorder()
	srv.HTTP.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: got %d, want 401", rec.Code)
	}
}

func TestLogout_InvalidToken_401(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{logoutErr: identity.ErrInvalidCredentials}
	srv := newProviderOnlyServer(t, ap)

	req := httptest.NewRequest(http.MethodPost, "/v1/auth/logout", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")
	rec := httptest.NewRecorder()
	srv.HTTP.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: got %d, want 401", rec.Code)
	}
}

// ── POST /v1/auth/forgot-password ─────────────────────────────────────────────
//
// The enumeration contract for this endpoint: it answers 204 whether or not an
// account exists for the address, AND swallows provider failures into 204 as
// well. The user pool sets PreventUserExistenceErrors=ENABLED, under which
// Cognito already returns a simulated delivery destination for unknown,
// disabled, and unverified users. Varying the response here would hand back the
// account-enumeration oracle Cognito just took away. The three swallowed-error
// tests below ARE that contract — do not "fix" them into error responses.

func TestForgotPassword_Success_204(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/forgot-password", `{"email":"u@x.com"}`)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status: got %d, want 204 (body: %s)", rec.Code, rec.Body.String())
	}
	if body := rec.Body.String(); body != "" {
		t.Errorf("body: got %q, want empty on 204", body)
	}
}

func TestForgotPassword_PassesEmailToProvider(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{}
	srv := newProviderOnlyServer(t, ap)
	postJSON(srv, "/v1/auth/forgot-password", `{"email":"alice@example.com"}`)

	if ap.gotForgotEmail != "alice@example.com" {
		t.Errorf("provider email: got %q, want alice@example.com", ap.gotForgotEmail)
	}
}

// TestForgotPassword_RecoveryUnavailable_204 asserts that "this account has no
// verified recovery destination" is swallowed. Surfacing it would confirm the
// account exists.
func TestForgotPassword_RecoveryUnavailable_204(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{forgotPasswordErr: identity.ErrRecoveryUnavailable}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/forgot-password", `{"email":"u@x.com"}`)

	if rec.Code != http.StatusNoContent {
		t.Errorf("status: got %d, want 204 — ErrRecoveryUnavailable must never reach the client", rec.Code)
	}
}

// TestForgotPassword_ProviderUnavailable_204 asserts that a provider failure is
// swallowed rather than returned as 502. CodeDeliveryFailureException lands on
// ErrProviderUnavailable, and a delivery failure can only happen for a REAL
// account — simulated deliveries cannot fail — so a 502 here would be a clean
// existence oracle.
func TestForgotPassword_ProviderUnavailable_204(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{forgotPasswordErr: identity.ErrProviderUnavailable}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/forgot-password", `{"email":"u@x.com"}`)

	if rec.Code != http.StatusNoContent {
		t.Errorf("status: got %d, want 204 — provider failures are swallowed on this endpoint", rec.Code)
	}
}

// TestForgotPassword_InvalidCredentials_204 asserts that the UserNotFound →
// ErrInvalidCredentials mapping does NOT surface as a 401 here, which would
// directly reveal non-existence.
func TestForgotPassword_InvalidCredentials_204(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{forgotPasswordErr: identity.ErrInvalidCredentials}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/forgot-password", `{"email":"nobody@x.com"}`)

	if rec.Code != http.StatusNoContent {
		t.Errorf("status: got %d, want 204 — a 401 here would reveal the account does not exist", rec.Code)
	}
}

// TestForgotPassword_TooManyRequests_429 is the one non-204 provider outcome.
// It asserts the mapping only; Cognito's actual per-user budget is
// risk-dependent and subject to change, so no threshold is tested.
func TestForgotPassword_TooManyRequests_429(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{forgotPasswordErr: identity.ErrTooManyRequests}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/forgot-password", `{"email":"u@x.com"}`)

	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("status: got %d, want 429", rec.Code)
	}
}

func TestForgotPassword_MalformedBody_400(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/forgot-password", `not-json`)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want 400", rec.Code)
	}
}

func TestForgotPassword_MissingEmail_400(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/forgot-password", `{}`)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want 400", rec.Code)
	}
	if ap.gotForgotEmail != "" {
		t.Error("provider was called despite a missing email")
	}
}

// ── POST /v1/auth/reset-password ──────────────────────────────────────────────

func TestResetPassword_Success_204(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/reset-password",
		`{"email":"u@x.com","code":"123456","password":"N3wSup3rSecret!!"}`)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status: got %d, want 204 (body: %s)", rec.Code, rec.Body.String())
	}
	if body := rec.Body.String(); body != "" {
		t.Errorf("body: got %q, want empty on 204", body)
	}
}

// TestResetPassword_PassesArgumentsInOrder pins email/code/password onto the
// right parameters of the three-string provider signature. Mis-ordering them is
// the most likely defect in this change and would otherwise pass every
// status-code test in this file.
func TestResetPassword_PassesArgumentsInOrder(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{}
	srv := newProviderOnlyServer(t, ap)
	postJSON(srv, "/v1/auth/reset-password",
		`{"email":"alice@example.com","code":"123456","password":"N3wSup3rSecret!!"}`)

	if ap.gotResetEmail != "alice@example.com" {
		t.Errorf("email: got %q, want alice@example.com", ap.gotResetEmail)
	}
	if ap.gotResetCode != "123456" {
		t.Errorf("code: got %q, want 123456", ap.gotResetCode)
	}
	if ap.gotResetPassword != "N3wSup3rSecret!!" {
		t.Errorf("password: got %q, want the new password", ap.gotResetPassword)
	}
}

func TestResetPassword_CodeMismatch_400(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{resetPasswordErr: identity.ErrCodeMismatch}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/reset-password",
		`{"email":"u@x.com","code":"wrong","password":"N3wSup3rSecret!!"}`)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want 400", rec.Code)
	}
}

func TestResetPassword_CodeExpired_400(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{resetPasswordErr: identity.ErrCodeExpired}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/reset-password",
		`{"email":"u@x.com","code":"expired","password":"N3wSup3rSecret!!"}`)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want 400", rec.Code)
	}
}

func TestResetPassword_InvalidPassword_400(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{resetPasswordErr: identity.ErrInvalidPassword}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/reset-password",
		`{"email":"u@x.com","code":"123456","password":"weak"}`)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want 400", rec.Code)
	}
}

func TestResetPassword_UserNotConfirmed_403(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{resetPasswordErr: identity.ErrUserNotConfirmed}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/reset-password",
		`{"email":"u@x.com","code":"123456","password":"N3wSup3rSecret!!"}`)

	if rec.Code != http.StatusForbidden {
		t.Errorf("status: got %d, want 403", rec.Code)
	}
}

func TestResetPassword_TooManyRequests_429(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{resetPasswordErr: identity.ErrTooManyRequests}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/reset-password",
		`{"email":"u@x.com","code":"123456","password":"N3wSup3rSecret!!"}`)

	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("status: got %d, want 429", rec.Code)
	}
}

func TestResetPassword_ProviderUnavailable_502(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{resetPasswordErr: identity.ErrProviderUnavailable}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/reset-password",
		`{"email":"u@x.com","code":"123456","password":"N3wSup3rSecret!!"}`)

	if rec.Code != http.StatusBadGateway {
		t.Errorf("status: got %d, want 502", rec.Code)
	}
}

func TestResetPassword_MalformedBody_400(t *testing.T) {
	t.Parallel()

	ap := &stubAuthProvider{}
	srv := newProviderOnlyServer(t, ap)
	rec := postJSON(srv, "/v1/auth/reset-password", `not-json`)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want 400", rec.Code)
	}
}

// ── Route gating: AuthProvider == nil ────────────────────────────────────────

func TestAuthRoutes_NoAuthProvider_404(t *testing.T) {
	t.Parallel()

	// Server with no AuthProvider: all /v1/auth/* routes must return 404.
	srv := routes.NewServer(":0", routes.Deps{
		RecoChecker: reco.NewChecker("http://localhost:0"),
	})

	paths := []string{
		"/v1/auth/register",
		"/v1/auth/confirm",
		"/v1/auth/login",
		"/v1/auth/refresh",
		"/v1/auth/logout",
		"/v1/auth/forgot-password",
		"/v1/auth/reset-password",
	}
	for _, p := range paths {
		p := p
		t.Run(p, func(t *testing.T) {
			t.Parallel()
			req := httptest.NewRequest(http.MethodPost, p, strings.NewReader("{}"))
			rec := httptest.NewRecorder()
			srv.HTTP.Handler.ServeHTTP(rec, req)
			if rec.Code != http.StatusNotFound {
				t.Errorf("%s: got %d, want 404 when AuthProvider is nil", p, rec.Code)
			}
		})
	}
}
