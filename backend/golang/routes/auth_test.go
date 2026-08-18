package routes_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/krishm/spots/backend/golang/routes"
	"github.com/krishm/spots/backend/golang/services/identity"
	"github.com/krishm/spots/backend/golang/services/profile"
	"github.com/krishm/spots/backend/golang/services/reco"
)

// ── Stub implementations ──────────────────────────────────────────────────────

type stubVerifier struct {
	claims identity.Claims
	err    error
}

func (v *stubVerifier) Verify(_ context.Context, _ string) (identity.Claims, error) {
	return v.claims, v.err
}

type stubAuthenticator struct {
	user *identity.User
	err  error
}

func (a *stubAuthenticator) Authenticate(_ context.Context, _ identity.Claims) (*identity.User, error) {
	return a.user, a.err
}

// newAuthServer builds a routes.Server with the given stub auth deps for
// GET /v1/users/me tests.
func newAuthServer(t *testing.T, verifier identity.TokenVerifier, authr identity.Authenticator) *routes.Server {
	t.Helper()
	profileSvc := profile.NewService(profile.NewMemStore())
	return routes.NewServer(":0", routes.Deps{
		RecoChecker:   reco.NewChecker("http://localhost:0"),
		TokenVerifier: verifier,
		Authenticator: authr,
		ProfileSvc:    profileSvc,
	})
}

// ── Auth middleware tests ─────────────────────────────────────────────────────

func TestRequireAuth_MissingHeader_401(t *testing.T) {
	t.Parallel()

	validUser := &identity.User{ID: "u1", CognitoSub: "sub1", Email: "a@b.com", Status: "active"}
	srv := newAuthServer(t,
		&stubVerifier{claims: identity.Claims{Subject: "sub1"}},
		&stubAuthenticator{user: validUser},
	)

	req := httptest.NewRequest(http.MethodGet, "/v1/users/me", nil)
	// No Authorization header.
	rec := httptest.NewRecorder()
	srv.HTTP.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: got %d, want 401", rec.Code)
	}
}

func TestRequireAuth_NonBearerHeader_401(t *testing.T) {
	t.Parallel()

	validUser := &identity.User{ID: "u1", CognitoSub: "sub1", Email: "a@b.com", Status: "active"}
	srv := newAuthServer(t,
		&stubVerifier{claims: identity.Claims{Subject: "sub1"}},
		&stubAuthenticator{user: validUser},
	)

	req := httptest.NewRequest(http.MethodGet, "/v1/users/me", nil)
	req.Header.Set("Authorization", "Basic dXNlcjpwYXNz")
	rec := httptest.NewRecorder()
	srv.HTTP.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: got %d, want 401", rec.Code)
	}
}

func TestRequireAuth_InvalidToken_401(t *testing.T) {
	t.Parallel()

	srv := newAuthServer(t,
		&stubVerifier{err: errors.New("signature mismatch")},
		&stubAuthenticator{user: &identity.User{ID: "u1"}},
	)

	req := httptest.NewRequest(http.MethodGet, "/v1/users/me", nil)
	req.Header.Set("Authorization", "Bearer bad-token")
	rec := httptest.NewRecorder()
	srv.HTTP.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: got %d, want 401", rec.Code)
	}
}

func TestRequireAuth_AuthenticatorError_500(t *testing.T) {
	t.Parallel()

	srv := newAuthServer(t,
		&stubVerifier{claims: identity.Claims{Subject: "sub1"}},
		&stubAuthenticator{err: errors.New("db down")},
	)

	req := httptest.NewRequest(http.MethodGet, "/v1/users/me", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rec := httptest.NewRecorder()
	srv.HTTP.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status: got %d, want 500", rec.Code)
	}
}

func TestRequireAuth_NoAuthDeps_RouteNotRegistered(t *testing.T) {
	t.Parallel()

	// Server with no auth deps: /v1/users/me should not be registered (404).
	srv := routes.NewServer(":0", routes.Deps{
		RecoChecker: reco.NewChecker("http://localhost:0"),
	})

	req := httptest.NewRequest(http.MethodGet, "/v1/users/me", nil)
	rec := httptest.NewRecorder()
	srv.HTTP.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status without auth deps: got %d, want 404", rec.Code)
	}
}

// ── GET /v1/users/me handler tests ───────────────────────────────────────────

func TestGetMe_ValidToken_200(t *testing.T) {
	t.Parallel()

	user := &identity.User{
		ID:         "user-001",
		CognitoSub: "sub-001",
		Email:      "alice@example.com",
		Status:     "active",
	}
	srv := newAuthServer(t,
		&stubVerifier{claims: identity.Claims{Subject: "sub-001"}},
		&stubAuthenticator{user: user},
	)

	req := httptest.NewRequest(http.MethodGet, "/v1/users/me", nil)
	req.Header.Set("Authorization", "Bearer valid-access-token")
	rec := httptest.NewRecorder()
	srv.HTTP.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}

	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}

	if got := body["user_id"]; got != "user-001" {
		t.Errorf("user_id: got %v, want user-001", got)
	}
	if got := body["email"]; got != "alice@example.com" {
		t.Errorf("email: got %v, want alice@example.com", got)
	}
	if got := body["status"]; got != "active" {
		t.Errorf("status: got %v, want active", got)
	}
	// display_name from profile service (stub profile returns empty string for new users).
	if _, ok := body["display_name"]; !ok {
		t.Error("missing display_name field")
	}
	if _, ok := body["member_since"]; !ok {
		t.Error("missing member_since field")
	}
}

func TestGetMe_WithProfile_ReturnsProfileData(t *testing.T) {
	t.Parallel()

	user := &identity.User{
		ID:         "user-002",
		CognitoSub: "sub-002",
		Email:      "bob@example.com",
		Status:     "active",
	}

	// Pre-populate the profile store before building the server.
	profileStore := profile.NewMemStore()
	if err := profileStore.CreateOrUpdate(context.Background(), &profile.Profile{
		UserID:      "user-002",
		DisplayName: "Bobby",
		HomeBase:    "Tokyo",
	}); err != nil {
		t.Fatalf("seed profile: %v", err)
	}

	profileSvc := profile.NewService(profileStore)
	srv := routes.NewServer(":0", routes.Deps{
		RecoChecker:   reco.NewChecker("http://localhost:0"),
		TokenVerifier: &stubVerifier{claims: identity.Claims{Subject: "sub-002"}},
		Authenticator: &stubAuthenticator{user: user},
		ProfileSvc:    profileSvc,
	})

	req := httptest.NewRequest(http.MethodGet, "/v1/users/me", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rec := httptest.NewRecorder()
	srv.HTTP.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}

	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}

	if got := body["display_name"]; got != "Bobby" {
		t.Errorf("display_name: got %v, want Bobby", got)
	}
	if got := body["home_base"]; got != "Tokyo" {
		t.Errorf("home_base: got %v, want Tokyo", got)
	}
}
