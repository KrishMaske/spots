// Hand-written request/response DTOs mirroring the Go structs in
// backend/golang/routes/auth_endpoints.go and backend/golang/routes/users.go.
// Field names are snake_case on the wire — do not camelCase these.

// POST /v1/auth/register -> 201
export interface RegisterRequest {
  email: string;
  password: string;
}

export interface RegisterResponse {
  user_sub: string;
  confirmation_required: boolean;
}

// POST /v1/auth/confirm -> 204 (no body)
export interface ConfirmRequest {
  email: string;
  code: string;
}

// POST /v1/auth/login -> 200
export interface LoginRequest {
  email: string;
  password: string;
}

// Body for successful login and refresh responses.
export interface TokenResponse {
  access_token: string;
  id_token: string;
  /** Present on login, OMITTED on refresh. */
  refresh_token?: string;
  /** Seconds. */
  expires_in: number;
  /** Always "Bearer". */
  token_type: string;
}

// POST /v1/auth/refresh -> 200 (TokenResponse without refresh_token)
export interface RefreshRequest {
  refresh_token: string;
}

// POST /v1/auth/logout -> 204; requires Authorization: Bearer <access_token>

// POST /v1/auth/forgot-password -> 204 (no body)
// Always 204, whether or not an account exists for the address — the edge
// deliberately does not reveal that. 429 when throttled.
export interface ForgotPasswordRequest {
  email: string;
}

// POST /v1/auth/reset-password -> 204 (no body)
export interface ResetPasswordRequest {
  email: string;
  /** 6-digit code emailed by Cognito. Valid for ONE HOUR — shorter than the
   * 24-hour sign-up confirmation code. */
  code: string;
  /** The new password. Must meet the pool policy (see validators.ts). */
  password: string;
}

// GET /v1/users/me -> 200 (used only to smoke-test the session, optional)
export interface MeResponse {
  user_id: string;
  email: string;
  status: string;
  display_name: string;
  avatar_url: string;
  home_base: string;
  /** RFC3339 */
  member_since: string;
}

export interface ApiErrorBody {
  error: string;
}

// GET /healthz
export interface HealthzResponse {
  status: string;
  service: string;
  version: string;
  commit: string;
}
