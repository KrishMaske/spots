// Reads EXPO_PUBLIC_API_BASE_URL (inlined at build time by Expo) with a safe
// dev-time default. The value is a bare origin (scheme + host + port) — it
// does NOT include `/v1`; `api/client.ts` owns the `/v1` and `/healthz` paths.
//
// TODO(LAN IP): the fallback below is Krish's current dev machine's LAN IP on
// 2026-07-03. It WILL change across networks/reboots. Prefer setting
// EXPO_PUBLIC_API_BASE_URL in `mobile/.env` over editing this fallback — see
// `mobile/README.md` for "how to find your LAN IP and set it".
const DEFAULT_API_BASE_URL = 'http://192.168.1.175:8080';

export interface Env {
  apiBaseUrl: string;
}

function readApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.trim().replace(/\/+$/, '');
  }
  return DEFAULT_API_BASE_URL;
}

export const env: Env = {
  apiBaseUrl: readApiBaseUrl(),
};
