import { request } from './client';
import {
  ConfirmRequest,
  ForgotPasswordRequest,
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
  TokenResponse,
} from './types';

/** POST /v1/auth/register -> 201 */
export function register(body: RegisterRequest): Promise<RegisterResponse> {
  return request<RegisterResponse>('/v1/auth/register', { method: 'POST', body });
}

/** POST /v1/auth/confirm -> 204 */
export function confirm(body: ConfirmRequest): Promise<void> {
  return request<void>('/v1/auth/confirm', { method: 'POST', body });
}

/** POST /v1/auth/login -> 200 */
export function login(body: LoginRequest): Promise<TokenResponse> {
  return request<TokenResponse>('/v1/auth/login', { method: 'POST', body });
}

/** POST /v1/auth/refresh -> 200 (TokenResponse without refresh_token) */
export function refresh(body: RefreshRequest): Promise<TokenResponse> {
  return request<TokenResponse>('/v1/auth/refresh', { method: 'POST', body });
}

/** POST /v1/auth/logout -> 204; requires the access token as Bearer. */
export function logout(accessToken: string): Promise<void> {
  return request<void>('/v1/auth/logout', { method: 'POST', token: accessToken });
}

/**
 * POST /v1/auth/forgot-password -> 204
 *
 * Resolving does NOT mean an account exists for the address: the edge answers
 * 204 either way on purpose, so this endpoint can't be used to discover which
 * emails are registered. Never tell the user "no account found" here.
 * Throws ApiError(429) when throttled.
 */
export function forgotPassword(body: ForgotPasswordRequest): Promise<void> {
  return request<void>('/v1/auth/forgot-password', { method: 'POST', body });
}

/** POST /v1/auth/reset-password -> 204 */
export function resetPassword(body: ResetPasswordRequest): Promise<void> {
  return request<void>('/v1/auth/reset-password', { method: 'POST', body });
}
