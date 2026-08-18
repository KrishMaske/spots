package routes

import (
	"net/http"
	"strings"

	"github.com/krishm/spots/backend/golang/services/identity"
)

// requireAuth returns middleware that validates the Bearer token in the
// Authorization header, resolves the Spots user via authenticator, and
// injects the user into the request context.
//
// On any auth failure the handler is NOT called and a JSON error is returned:
//   - 401 Unauthorized: missing header, invalid/expired token, or token type mismatch.
//   - 500 Internal Server Error: user lookup/creation failure (store error).
//
// On success the downstream handler can retrieve the user with
// identity.UserFromContext(r.Context()).
func requireAuth(verifier identity.TokenVerifier, authr identity.Authenticator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if !strings.HasPrefix(authHeader, "Bearer ") {
				writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "missing or malformed Authorization header"})
				return
			}
			rawToken := strings.TrimPrefix(authHeader, "Bearer ")

			claims, err := verifier.Verify(r.Context(), rawToken)
			if err != nil {
				// Never surface internal details; log separately when observability is wired.
				writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "invalid or expired token"})
				return
			}

			user, err := authr.Authenticate(r.Context(), claims)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "authentication failed"})
				return
			}

			ctx := identity.ContextWithUser(r.Context(), user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
