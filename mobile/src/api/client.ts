import { env } from '../config/env';
import { ApiErrorBody } from './types';

const DEFAULT_TIMEOUT_MS = 10000;

/** Typed error thrown by `request()` for any non-2xx response, or when the
 * host is unreachable. Screens switch on `status`. */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  /** Access token attached as `Authorization: Bearer <token>` when present. */
  token?: string;
  timeoutMs?: number;
}

/**
 * Single fetch wrapper for the Go edge: prefixes `env.apiBaseUrl`, sets
 * `Content-Type: application/json`, attaches the Bearer token when passed,
 * tolerates 204 empty bodies, and normalizes non-2xx responses into a typed
 * `ApiError`. A short `AbortController` timeout prevents hung requests
 * against an unreachable dev host.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    throw new ApiError(0, "Can't reach Spots. Check your connection and try again.");
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const raw = await response.text();
  const data = raw.length > 0 ? JSON.parse(raw) : undefined;

  if (!response.ok) {
    const message = isApiErrorBody(data) ? data.error : 'Something went wrong. Please try again.';
    throw new ApiError(response.status, message);
  }

  return data as T;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as Record<string, unknown>).error === 'string'
  );
}
