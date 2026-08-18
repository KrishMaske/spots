package routes

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/krishm/spots/backend/golang/services/identity"
)

// registerAuthRoutes wires the seven /v1/auth/* endpoints onto mux.
// Called only when deps.AuthProvider is non-nil.
func registerAuthRoutes(mux *http.ServeMux, deps Deps) {
	mux.HandleFunc("POST /v1/auth/register", handleRegister(deps))
	mux.HandleFunc("POST /v1/auth/confirm", handleConfirm(deps))
	mux.HandleFunc("POST /v1/auth/login", handleLogin(deps))
	mux.HandleFunc("POST /v1/auth/refresh", handleRefresh(deps))
	mux.HandleFunc("POST /v1/auth/logout", handleLogout(deps))
	mux.HandleFunc("POST /v1/auth/forgot-password", handleForgotPassword(deps))
	mux.HandleFunc("POST /v1/auth/reset-password", handleResetPassword(deps))
}

// ── Request / response types ──────────────────────────────────────────────────

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type registerResponse struct {
	UserSub              string `json:"user_sub"`
	ConfirmationRequired bool   `json:"confirmation_required"`
}

type confirmRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// tokenResponse is the JSON body for successful login and refresh responses.
type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	IDToken      string `json:"id_token"`
	RefreshToken string `json:"refresh_token,omitempty"` // omitted on refresh
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type forgotPasswordRequest struct {
	Email string `json:"email"`
}

type resetPasswordRequest struct {
	Email    string `json:"email"`
	Code     string `json:"code"`
	Password string `json:"password"`
}

// ── Handlers ──────────────────────────────────────────────────────────────────

// handleRegister handles POST /v1/auth/register.
// Creates a new Cognito user. Returns 201 with the user sub and whether
// confirmation is required. Returns 400 on invalid/weak password, 409 on
// an existing email.
func handleRegister(deps Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req registerRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid request body"})
			return
		}
		if req.Email == "" || req.Password == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "email and password are required"})
			return
		}

		result, err := deps.AuthProvider.Register(r.Context(), req.Email, req.Password)
		if err != nil {
			writeJSON(w, authErrStatus(err), errorResponse{Error: authErrMessage(err)})
			return
		}

		writeJSON(w, http.StatusCreated, registerResponse{
			UserSub:              result.UserSub,
			ConfirmationRequired: result.ConfirmationRequired,
		})
	}
}

// handleConfirm handles POST /v1/auth/confirm.
// Verifies the confirmation code emailed to the user. Returns 204 on success,
// 400 on code mismatch or expiry.
func handleConfirm(deps Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req confirmRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid request body"})
			return
		}
		if req.Email == "" || req.Code == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "email and code are required"})
			return
		}

		if err := deps.AuthProvider.Confirm(r.Context(), req.Email, req.Code); err != nil {
			writeJSON(w, authErrStatus(err), errorResponse{Error: authErrMessage(err)})
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

// handleLogin handles POST /v1/auth/login.
//
// Authenticates the user with USER_PASSWORD_AUTH and returns the token set.
// After a successful Cognito login, the handler performs email enrichment
// (best-effort): it verifies the returned access token to get the trusted sub,
// then calls Authenticate with the login email to bootstrap or update the Spots
// user row. A failure here is logged and does NOT fail the login response.
//
// Never log the password, access token, or refresh token.
func handleLogin(deps Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req loginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid request body"})
			return
		}
		if req.Email == "" || req.Password == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "email and password are required"})
			return
		}

		tokens, err := deps.AuthProvider.Login(r.Context(), req.Email, req.Password)
		if err != nil {
			writeJSON(w, authErrStatus(err), errorResponse{Error: authErrMessage(err)})
			return
		}

		// Email enrichment: bootstrap or update the Spots user row with the login
		// email so GET /v1/users/me always returns a populated email.
		// Best-effort — a failure here must not fail the login response.
		if deps.TokenVerifier != nil && deps.Authenticator != nil {
			if claims, verifyErr := deps.TokenVerifier.Verify(r.Context(), tokens.AccessToken); verifyErr == nil {
				claims.Email = req.Email // login email is trusted (Cognito accepted the password)
				if _, authErr := deps.Authenticator.Authenticate(r.Context(), claims); authErr != nil {
					log.Printf("auth: login enrichment: authenticate failed: %v", authErr)
				}
			} else {
				log.Printf("auth: login enrichment: verify access token failed: %v", verifyErr)
			}
		}

		writeJSON(w, http.StatusOK, tokenResponse{
			AccessToken:  tokens.AccessToken,
			IDToken:      tokens.IDToken,
			RefreshToken: tokens.RefreshToken,
			ExpiresIn:    tokens.ExpiresIn,
			TokenType:    tokens.TokenType,
		})
	}
}

// handleRefresh handles POST /v1/auth/refresh.
// Exchanges a refresh token for new access and ID tokens. The response does not
// include a new refresh token (Cognito does not issue one on refresh).
func handleRefresh(deps Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req refreshRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid request body"})
			return
		}
		if req.RefreshToken == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "refresh_token is required"})
			return
		}

		tokens, err := deps.AuthProvider.Refresh(r.Context(), req.RefreshToken)
		if err != nil {
			writeJSON(w, authErrStatus(err), errorResponse{Error: authErrMessage(err)})
			return
		}

		writeJSON(w, http.StatusOK, tokenResponse{
			AccessToken: tokens.AccessToken,
			IDToken:     tokens.IDToken,
			// RefreshToken intentionally omitted on refresh.
			ExpiresIn: tokens.ExpiresIn,
			TokenType: tokens.TokenType,
		})
	}
}

// handleLogout handles POST /v1/auth/logout.
// Extracts the Bearer access token from the Authorization header and calls
// GlobalSignOut, revoking all sessions for the user. Returns 204 on success.
// Returns 401 when the header is missing or malformed.
func handleLogout(deps Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "missing or malformed Authorization header"})
			return
		}
		rawToken := strings.TrimPrefix(authHeader, "Bearer ")
		if rawToken == "" {
			writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "missing or malformed Authorization header"})
			return
		}

		if err := deps.AuthProvider.Logout(r.Context(), rawToken); err != nil {
			writeJSON(w, authErrStatus(err), errorResponse{Error: authErrMessage(err)})
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

// handleForgotPassword handles POST /v1/auth/forgot-password.
//
// Starts the self-service password reset flow: Cognito emails a one-time code,
// valid for one hour (shorter than the 24-hour sign-up confirmation code).
//
// This endpoint answers 204 whether or not an account exists for the address,
// and deliberately swallows provider failures into 204 as well. The user pool
// sets PreventUserExistenceErrors=ENABLED, under which Cognito itself returns a
// simulated delivery destination for unknown, disabled, and unverified users;
// varying the response here would hand back the account-enumeration oracle that
// Cognito just took away. This is the same load-bearing rule as the
// UserNotFound → 401 mapping on login. Do not "fix" it.
//
// The only non-204 outcomes are a malformed request (400) and provider
// throttling (429).
//
// Because failures are hidden from the client, every request is logged with its
// outcome class — and nothing else. Never log the email address.
func handleForgotPassword(deps Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req forgotPasswordRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid request body"})
			return
		}
		if req.Email == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "email is required"})
			return
		}

		err := deps.AuthProvider.ForgotPassword(r.Context(), req.Email)
		switch {
		case err == nil:
			log.Printf("auth: forgot-password outcome=accepted")
		case errors.Is(err, identity.ErrTooManyRequests):
			log.Printf("auth: forgot-password outcome=throttled")
			writeJSON(w, http.StatusTooManyRequests, errorResponse{Error: authErrMessage(err)})
			return
		default:
			// Swallowed on purpose. ErrRecoveryUnavailable, ErrInvalidCredentials,
			// and ErrProviderUnavailable (which is where CodeDeliveryFailure lands)
			// each say something about the account: a delivery failure in
			// particular can only happen for a real one, since simulated
			// deliveries cannot fail. Surfacing any of them would be an existence
			// oracle, so they are logged here and reported as success.
			log.Printf("auth: forgot-password outcome=swallowed:%v", err)
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

// handleResetPassword handles POST /v1/auth/reset-password.
//
// Exchanges the emailed reset code for a new password. Returns 204 on success;
// 400 for a bad/expired code or a password that fails the pool policy; 403 when
// the user never confirmed their email; 429 when throttled.
//
// A code that is wrong, expired, or was never requested all return the same 400,
// as does a code for an account that does not exist — Cognito raises
// CodeMismatchException for unknown users under PreventUserExistenceErrors, and
// that uniformity is intentional.
//
// This handler does NOT end the user's other sessions: access tokens already
// issued stay valid until they expire, and existing refresh tokens are not
// explicitly revoked. Forcing a global sign-out would need an IAM-authenticated
// Cognito admin API, which this edge deliberately does not use.
//
// Never log the code or the new password.
func handleResetPassword(deps Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req resetPasswordRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid request body"})
			return
		}
		if req.Email == "" || req.Code == "" || req.Password == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "email, code, and password are required"})
			return
		}

		if err := deps.AuthProvider.ConfirmForgotPassword(r.Context(), req.Email, req.Code, req.Password); err != nil {
			writeJSON(w, authErrStatus(err), errorResponse{Error: authErrMessage(err)})
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

// ── Error mapping ─────────────────────────────────────────────────────────────

// authErrStatus maps a provider sentinel error to an HTTP status code.
//
// identity.ErrRecoveryUnavailable is deliberately absent: it is swallowed inside
// handleForgotPassword and must never reach a client, because it would reveal
// that an account exists but has no verified recovery destination. Should it
// ever arrive here anyway, the 502 default is a safe landing spot. Do not add an
// arm for it.
func authErrStatus(err error) int {
	switch {
	case errors.Is(err, identity.ErrInvalidCredentials):
		return http.StatusUnauthorized
	case errors.Is(err, identity.ErrUserNotConfirmed):
		return http.StatusForbidden
	case errors.Is(err, identity.ErrCodeMismatch),
		errors.Is(err, identity.ErrCodeExpired),
		errors.Is(err, identity.ErrInvalidPassword):
		return http.StatusBadRequest
	case errors.Is(err, identity.ErrUsernameExists):
		return http.StatusConflict
	case errors.Is(err, identity.ErrTooManyRequests):
		return http.StatusTooManyRequests
	default:
		return http.StatusBadGateway
	}
}

// authErrMessage returns a safe, public-facing error message for the error.
func authErrMessage(err error) string {
	switch {
	case errors.Is(err, identity.ErrInvalidCredentials):
		return "invalid credentials"
	case errors.Is(err, identity.ErrUserNotConfirmed):
		return "user not confirmed"
	case errors.Is(err, identity.ErrCodeMismatch):
		return "confirmation code is invalid"
	case errors.Is(err, identity.ErrCodeExpired):
		return "confirmation code has expired"
	case errors.Is(err, identity.ErrUsernameExists):
		return "email address already registered"
	case errors.Is(err, identity.ErrInvalidPassword):
		return "password does not meet the requirements"
	case errors.Is(err, identity.ErrTooManyRequests):
		return "too many requests, try again later"
	default:
		return "auth provider unavailable"
	}
}
