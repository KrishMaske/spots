import { request } from './client';
import { HealthzResponse } from './types';

/** GET /healthz — dev connectivity smoke test (base URL, port, cleartext, firewall). */
export function checkHealth(): Promise<HealthzResponse> {
  return request<HealthzResponse>('/healthz', { method: 'GET' });
}
