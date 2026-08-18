import * as SecureStore from 'expo-secure-store';

import { TokenResponse } from '../api/types';

const SESSION_KEY = 'spots.session';

export interface Session {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  /** `Date.now() + expires_in * 1000`, computed at save time. */
  accessTokenExpiresAt: number;
  tokenType: string;
}

/** Builds a `Session` from a login `TokenResponse` (which always carries a
 * `refresh_token`). */
export function sessionFromLoginTokens(tokens: TokenResponse): Session {
  if (!tokens.refresh_token) {
    throw new Error('login response is missing refresh_token');
  }
  return {
    accessToken: tokens.access_token,
    idToken: tokens.id_token,
    refreshToken: tokens.refresh_token,
    accessTokenExpiresAt: Date.now() + tokens.expires_in * 1000,
    tokenType: tokens.token_type,
  };
}

/** Merges a refresh `TokenResponse` (no `refresh_token`) into an existing
 * session, retaining the previously stored refresh token. */
export function sessionFromRefreshTokens(previous: Session, tokens: TokenResponse): Session {
  return {
    accessToken: tokens.access_token,
    idToken: tokens.id_token,
    refreshToken: previous.refreshToken,
    accessTokenExpiresAt: Date.now() + tokens.expires_in * 1000,
    tokenType: tokens.token_type,
  };
}

export function isExpired(session: Session): boolean {
  return Date.now() >= session.accessTokenExpiresAt;
}

/** Persists the session to SecureStore (iOS Keychain / Android Keystore). */
export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

/** Loads the persisted session, or `null` if none exists or the stored blob
 * is corrupt. */
export async function loadSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
