package routes

import (
	"net/http"
	"strings"
	"time"

	"github.com/krishm/spots/backend/golang/services/identity"
)

// meResponse is the JSON body for GET /v1/users/me.
// It combines data from the identity mapping (User) and the profile service
// (Profile) so callers get a single, complete picture of the current user.
type meResponse struct {
	UserID      string    `json:"user_id"`
	Email       string    `json:"email"`
	Status      string    `json:"status"`
	DisplayName string    `json:"display_name"`
	AvatarURL   string    `json:"avatar_url"`
	HomeBase    string    `json:"home_base"`
	MemberSince time.Time `json:"member_since"`
}

// handleGetMe returns the handler for GET /v1/users/me.
// The route requires a valid Bearer token; the auth middleware (requireAuth)
// must wrap this handler and populate the request context with the user.
func handleGetMe(deps Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := identity.UserFromContext(r.Context())
		if !ok {
			// Should never happen when the route is correctly wrapped with
			// requireAuth, but guard defensively.
			writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "not authenticated"})
			return
		}

		// Empty-email fallback (caveat 1 from cognito-auth-testable plan):
		// tokens that never went through /v1/auth/login may have created the
		// user row without an email. Call GetUser once to backfill and persist.
		// This runs only when email is empty, so the common path makes no extra
		// Cognito call. Skip silently when either dep is absent.
		if user.Email == "" && deps.AuthProvider != nil && deps.UserStore != nil {
			authHeader := r.Header.Get("Authorization")
			rawToken := strings.TrimPrefix(authHeader, "Bearer ")
			if email, getErr := deps.AuthProvider.GetUser(r.Context(), rawToken); getErr == nil && email != "" {
				_ = deps.UserStore.UpdateEmail(r.Context(), user.ID, email)
				user.Email = email
			}
		}

		p, err := deps.ProfileSvc.Get(r.Context(), user.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "failed to load profile"})
			return
		}

		writeJSON(w, http.StatusOK, meResponse{
			UserID:      user.ID,
			Email:       user.Email,
			Status:      user.Status,
			DisplayName: p.DisplayName,
			AvatarURL:   p.AvatarURL,
			HomeBase:    p.HomeBase,
			MemberSince: user.CreatedAt,
		})
	}
}
