import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import { AuthProvider } from '../AuthContext';
import { useAuth } from '../useAuth';
import * as authApi from '../../api/auth';
import { ApiError } from '../../api/client';
import { sessionFromLoginTokens } from '../session';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../../api/auth', () => ({
  register: jest.fn(),
  confirm: jest.fn(),
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedAuthApi = authApi as jest.Mocked<typeof authApi>;

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

/** Session bootstrap on app start — the O4-scoped one-shot refresh described
 * in the mobile-auth-screens plan. Not covered by the session.ts unit tests
 * (which only exercise the storage helpers, not the AuthContext effect that
 * wires them together). */
describe('AuthContext session bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves to signedOut with no session when nothing is stored', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.status).toBe('loading');

    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.session).toBeNull();
    expect(mockedAuthApi.refresh).not.toHaveBeenCalled();
  });

  it('resolves to signedOut when the stored session blob is corrupt', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValueOnce('not-json{{');

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.session).toBeNull();
    expect(mockedAuthApi.refresh).not.toHaveBeenCalled();
  });

  it('resolves to signedIn directly when the stored access token has not expired, without refreshing', async () => {
    const validSession = sessionFromLoginTokens({
      access_token: 'access',
      id_token: 'id',
      refresh_token: 'refresh',
      expires_in: 3600,
      token_type: 'Bearer',
    });
    mockedSecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(validSession));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    expect(result.current.session?.accessToken).toBe('access');
    expect(mockedAuthApi.refresh).not.toHaveBeenCalled();
  });

  it('one-shot refreshes an expired stored session and resolves to signedIn, retaining the old refresh token', async () => {
    const expiredSession = {
      ...sessionFromLoginTokens({
        access_token: 'old-access',
        id_token: 'old-id',
        refresh_token: 'original-refresh',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
      accessTokenExpiresAt: Date.now() - 1000,
    };
    mockedSecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(expiredSession));
    mockedAuthApi.refresh.mockResolvedValueOnce({
      access_token: 'new-access',
      id_token: 'new-id',
      expires_in: 900,
      token_type: 'Bearer',
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    expect(mockedAuthApi.refresh).toHaveBeenCalledWith({ refresh_token: 'original-refresh' });
    expect(result.current.session?.accessToken).toBe('new-access');
    expect(result.current.session?.refreshToken).toBe('original-refresh');
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalled();
  });

  it('clears the session and resolves to signedOut when the one-shot refresh fails (e.g. 401 revoked)', async () => {
    const expiredSession = {
      ...sessionFromLoginTokens({
        access_token: 'old-access',
        id_token: 'old-id',
        refresh_token: 'original-refresh',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
      accessTokenExpiresAt: Date.now() - 1000,
    };
    mockedSecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(expiredSession));
    mockedAuthApi.refresh.mockRejectedValueOnce(new ApiError(401, 'invalid refresh token'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.session).toBeNull();
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('spots.session');
  });
});

describe('AuthContext confirmAndSignIn (auto-login after verification)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSecureStore.getItemAsync.mockResolvedValue(null);
  });

  const loginTokens = {
    access_token: 'access',
    id_token: 'id',
    refresh_token: 'refresh',
    expires_in: 3600,
    token_type: 'Bearer',
  };

  it('auto-signs-in after a successful confirm using the just-registered credentials', async () => {
    mockedAuthApi.register.mockResolvedValueOnce({ user_sub: 'sub-1', confirmation_required: true });
    mockedAuthApi.confirm.mockResolvedValueOnce(undefined);
    mockedAuthApi.login.mockResolvedValueOnce(loginTokens);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(async () => {
      await result.current.register({ email: 'krish@example.com', password: 'Correct1Horse!' });
    });

    let outcome: { signedIn: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.confirmAndSignIn({ email: 'krish@example.com', code: '123456' });
    });

    expect(outcome).toEqual({ signedIn: true });
    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    expect(mockedAuthApi.login).toHaveBeenCalledWith({ email: 'krish@example.com', password: 'Correct1Horse!' });
    expect(result.current.session?.accessToken).toBe('access');
  });

  it('reports signedIn:false and stays signed out when the post-confirm auto-login fails', async () => {
    mockedAuthApi.register.mockResolvedValueOnce({ user_sub: 'sub-1', confirmation_required: true });
    mockedAuthApi.confirm.mockResolvedValueOnce(undefined);
    mockedAuthApi.login.mockRejectedValueOnce(new ApiError(502, 'auth provider unavailable'));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(async () => {
      await result.current.register({ email: 'krish@example.com', password: 'Correct1Horse!' });
    });

    let outcome: { signedIn: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.confirmAndSignIn({ email: 'krish@example.com', code: '123456' });
    });

    expect(outcome).toEqual({ signedIn: false });
    expect(result.current.status).toBe('signedOut');
  });

  it('does not attempt auto-login when there are no pending credentials (confirm without register)', async () => {
    mockedAuthApi.confirm.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    let outcome: { signedIn: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.confirmAndSignIn({ email: 'krish@example.com', code: '123456' });
    });

    expect(outcome).toEqual({ signedIn: false });
    expect(mockedAuthApi.login).not.toHaveBeenCalled();
    expect(result.current.status).toBe('signedOut');
  });

  it('clears the stored credentials after a failed auto-login so a retry does not silently re-login', async () => {
    mockedAuthApi.register.mockResolvedValueOnce({ user_sub: 'sub-1', confirmation_required: true });
    mockedAuthApi.confirm.mockResolvedValue(undefined);
    mockedAuthApi.login.mockRejectedValueOnce(new ApiError(502, 'down'));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(async () => {
      await result.current.register({ email: 'krish@example.com', password: 'Correct1Horse!' });
    });
    await act(async () => {
      await result.current.confirmAndSignIn({ email: 'krish@example.com', code: '123456' });
    });
    // Retry after the failed auto-login must NOT trigger another login attempt.
    await act(async () => {
      await result.current.confirmAndSignIn({ email: 'krish@example.com', code: '123456' });
    });

    expect(mockedAuthApi.login).toHaveBeenCalledTimes(1);
  });
});

describe('AuthContext signOut', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSecureStore.getItemAsync.mockResolvedValue(null);
  });

  it('clears the local session even when the logout API call fails', async () => {
    mockedAuthApi.login.mockResolvedValueOnce({
      access_token: 'access',
      id_token: 'id',
      refresh_token: 'refresh',
      expires_in: 3600,
      token_type: 'Bearer',
    });
    mockedAuthApi.logout.mockRejectedValueOnce(new ApiError(502, 'auth provider unavailable'));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(async () => {
      await result.current.signIn({ email: 'krish@example.com', password: 'Correct1Horse!' });
    });
    await waitFor(() => expect(result.current.status).toBe('signedIn'));

    await act(async () => {
      await result.current.signOut();
    });

    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.session).toBeNull();
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('spots.session');
  });
});
