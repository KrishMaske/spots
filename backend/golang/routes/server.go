// Package routes is the public HTTP surface of the spotsd monolith.
// It registers all routes on a stdlib ServeMux (Go 1.22+ method-pattern
// routing) and holds no domain data.
package routes

import (
	"net/http"
	"time"

	"github.com/krishm/spots/backend/golang/routes/openapi"
	"github.com/krishm/spots/backend/golang/services/identity"
	"github.com/krishm/spots/backend/golang/services/profile"
	"github.com/krishm/spots/backend/golang/services/reco"
)

// Deps holds all service dependencies injected into the HTTP server.
// Auth routes (/v1/users/me and the auth middleware) are only registered
// when TokenVerifier, Authenticator, and ProfileSvc are all non-nil.
type Deps struct {
	// RecoChecker is used by /readyz to probe the Python reco service.
	RecoChecker *reco.Checker
	// TokenVerifier verifies bearer tokens on protected routes.
	// Set to nil to disable auth (all /v1 protected routes return 404).
	TokenVerifier identity.TokenVerifier
	// Authenticator maps verified claims to Spots user records.
	// Required when TokenVerifier is non-nil.
	Authenticator identity.Authenticator
	// ProfileSvc provides profile data for authenticated user responses.
	// Required when TokenVerifier is non-nil.
	ProfileSvc *profile.Service
	// AuthProvider performs Cognito credential operations for /v1/auth/* routes.
	// Set to nil to leave the auth endpoints unregistered (they return 404).
	AuthProvider identity.AuthProvider
	// UserStore is used in GET /v1/users/me for the empty-email backfill fallback.
	// When non-nil and AuthProvider is non-nil, a missing email in the stored user
	// row is backfilled via AuthProvider.GetUser and persisted here.
	UserStore identity.UserStore
}

// Server wraps a configured *http.Server ready to call ListenAndServe.
type Server struct {
	HTTP *http.Server
}

// errorResponse is the JSON body used for all error responses in this package.
type errorResponse struct {
	Error string `json:"error"`
}

// NewServer constructs the HTTP Server, wires all routes, and returns it.
// addr is the TCP listen address (e.g. ":8080").
// deps provides the service dependencies; see Deps for wiring rules.
func NewServer(addr string, deps Deps) *Server {
	mux := http.NewServeMux()

	// Health routes — always unauthenticated and registered unconditionally.
	mux.HandleFunc("GET /healthz", handleHealthz)
	mux.HandleFunc("GET /readyz", handleReadyz(deps.RecoChecker))

	// API documentation — public, no auth.
	mux.HandleFunc("GET /openapi.json", openapi.SpecHandler)
	mux.HandleFunc("GET /docs", openapi.DocsHandler)

	// Auth-protected routes: only wired when all auth deps are provided.
	if deps.TokenVerifier != nil && deps.Authenticator != nil && deps.ProfileSvc != nil {
		auth := requireAuth(deps.TokenVerifier, deps.Authenticator)
		mux.Handle("GET /v1/users/me", auth(handleGetMe(deps)))
	}

	// Auth credential endpoints: only wired when an AuthProvider is provided.
	// They are independently registrable — no dependency on the verifier.
	if deps.AuthProvider != nil {
		registerAuthRoutes(mux, deps)
	}

	srv := &http.Server{
		Addr:         addr,
		Handler:      logRequests(mux),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	return &Server{HTTP: srv}
}
