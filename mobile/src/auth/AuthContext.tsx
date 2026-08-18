import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import * as authApi from '../api/auth';
import { ConfirmRequest, LoginRequest, RegisterRequest, RegisterResponse } from '../api/types';
import {
  Session,
  clearSession,
  isExpired,
  loadSession,
  saveSession,
  sessionFromLoginTokens,
  sessionFromRefreshTokens,
} from './session';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  register: (body: RegisterRequest) => Promise<RegisterResponse>;
  /** Confirms the email code and, when the confirmation immediately follows
   * registration in this session, auto-signs-in with the stored credentials.
   * `signedIn` is false when the caller should fall back to the Login screen
   * (no pending credentials, or the post-confirm auto-login failed). */
  confirmAndSignIn: (body: ConfirmRequest) => Promise<{ signedIn: boolean }>;
  signIn: (body: LoginRequest) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);

  // In-memory ONLY (never persisted, kept out of navigation state): the
  // just-registered credentials, so a successful email confirmation can sign
  // the user straight in without a manual login (auto-login, approach B).
  // Cleared on sign-in and after a failed auto-login.
  const pendingSignupRef = useRef<{ email: string; password: string } | null>(null);

  // Session bootstrap: load any stored session; if the access token is
  // already expired, attempt a single one-shot refresh before deciding the
  // gate state (plan O4 scope — no broader auto-refresh-on-401 interceptor).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await loadSession();
      if (!stored) {
        if (!cancelled) setStatus('signedOut');
        return;
      }

      if (!isExpired(stored)) {
        if (!cancelled) {
          setSession(stored);
          setStatus('signedIn');
        }
        return;
      }

      try {
        const tokens = await authApi.refresh({ refresh_token: stored.refreshToken });
        const next = sessionFromRefreshTokens(stored, tokens);
        await saveSession(next);
        if (!cancelled) {
          setSession(next);
          setStatus('signedIn');
        }
      } catch {
        await clearSession();
        if (!cancelled) {
          setSession(null);
          setStatus('signedOut');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const register = useCallback(async (body: RegisterRequest) => {
    const result = await authApi.register(body);
    // Stash credentials for auto-login after email confirmation (approach B).
    // Only reached when register() resolves, so failed registrations don't stash.
    pendingSignupRef.current = { email: body.email, password: body.password };
    return result;
  }, []);

  const signIn = useCallback(async (body: LoginRequest) => {
    const tokens = await authApi.login(body);
    const next = sessionFromLoginTokens(tokens);
    await saveSession(next);
    pendingSignupRef.current = null;
    setSession(next);
    setStatus('signedIn');
  }, []);

  const confirmAndSignIn = useCallback(
    async (body: ConfirmRequest): Promise<{ signedIn: boolean }> => {
      await authApi.confirm(body); // throws on bad code — caller handles

      // Auto-login only when we still hold the password for this exact email
      // (confirmation immediately following registration in the same session).
      const pending = pendingSignupRef.current;
      if (pending && pending.email === body.email) {
        try {
          await signIn({ email: pending.email, password: pending.password });
          return { signedIn: true };
        } catch {
          // Account IS confirmed, but auto-login failed (network/throttle).
          // Drop the plaintext and let the user sign in manually.
          pendingSignupRef.current = null;
          return { signedIn: false };
        }
      }
      return { signedIn: false };
    },
    [signIn]
  );

  const signOut = useCallback(async () => {
    if (session) {
      try {
        await authApi.logout(session.accessToken);
      } catch {
        // Best-effort: still clear local session even if the server call fails.
      }
    }
    await clearSession();
    setSession(null);
    setStatus('signedOut');
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, register, confirmAndSignIn, signIn, signOut }),
    [status, session, register, confirmAndSignIn, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
