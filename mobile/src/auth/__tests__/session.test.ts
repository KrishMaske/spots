import * as SecureStore from 'expo-secure-store';

import {
  clearSession,
  isExpired,
  loadSession,
  saveSession,
  sessionFromLoginTokens,
  sessionFromRefreshTokens,
} from '../session';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('auth/session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds a session from login tokens with a computed expiry', () => {
    const now = Date.now();
    const session = sessionFromLoginTokens({
      access_token: 'access',
      id_token: 'id',
      refresh_token: 'refresh',
      expires_in: 3600,
      token_type: 'Bearer',
    });

    expect(session.accessToken).toBe('access');
    expect(session.refreshToken).toBe('refresh');
    expect(session.accessTokenExpiresAt).toBeGreaterThanOrEqual(now + 3600 * 1000 - 50);
  });

  it('throws when building a login session without a refresh_token', () => {
    expect(() =>
      sessionFromLoginTokens({
        access_token: 'access',
        id_token: 'id',
        expires_in: 3600,
        token_type: 'Bearer',
      })
    ).toThrow(/refresh_token/);
  });

  it('retains the previous refresh token when merging a refresh response', () => {
    const previous = sessionFromLoginTokens({
      access_token: 'old-access',
      id_token: 'old-id',
      refresh_token: 'original-refresh',
      expires_in: 3600,
      token_type: 'Bearer',
    });

    const merged = sessionFromRefreshTokens(previous, {
      access_token: 'new-access',
      id_token: 'new-id',
      expires_in: 900,
      token_type: 'Bearer',
    });

    expect(merged.accessToken).toBe('new-access');
    expect(merged.refreshToken).toBe('original-refresh');
  });

  it('isExpired reflects accessTokenExpiresAt', () => {
    const past = { accessTokenExpiresAt: Date.now() - 1000 } as ReturnType<typeof sessionFromLoginTokens>;
    const future = { accessTokenExpiresAt: Date.now() + 60_000 } as ReturnType<typeof sessionFromLoginTokens>;

    expect(isExpired(past)).toBe(true);
    expect(isExpired(future)).toBe(false);
  });

  it('round-trips save/load through SecureStore', async () => {
    const session = sessionFromLoginTokens({
      access_token: 'access',
      id_token: 'id',
      refresh_token: 'refresh',
      expires_in: 3600,
      token_type: 'Bearer',
    });

    let stored: string | null = null;
    mockedSecureStore.setItemAsync.mockImplementation(async (_key, value) => {
      stored = value;
    });
    mockedSecureStore.getItemAsync.mockImplementation(async () => stored);

    await saveSession(session);
    const loaded = await loadSession();

    expect(loaded).toEqual(session);
  });

  it('loadSession returns null when nothing is stored', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValueOnce(null);

    expect(await loadSession()).toBeNull();
  });

  it('loadSession returns null for a corrupt blob', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValueOnce('not-json{{');

    expect(await loadSession()).toBeNull();
  });

  it('loadSession returns null when required fields are missing', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify({ accessToken: 'only-this' }));

    expect(await loadSession()).toBeNull();
  });

  it('clearSession deletes the stored key', async () => {
    await clearSession();

    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('spots.session');
  });
});
