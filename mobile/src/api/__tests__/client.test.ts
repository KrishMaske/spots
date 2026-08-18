import { ApiError, request } from '../client';
import { env } from '../../config/env';

function mockFetchOnce(response: { status: number; body?: unknown }) {
  const text = response.body === undefined ? '' : JSON.stringify(response.body);
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    status: response.status,
    ok: response.status >= 200 && response.status < 300,
    text: () => Promise.resolve(text),
  });
}

describe('api/client request()', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('composes the base URL, path, and JSON headers for a GET', async () => {
    mockFetchOnce({ status: 200, body: { status: 'ok' } });

    await request('/healthz');

    expect(global.fetch).toHaveBeenCalledWith(
      `${env.apiBaseUrl}/healthz`,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    );
  });

  it('attaches an Authorization Bearer header when a token is passed', async () => {
    mockFetchOnce({ status: 204 });

    await request('/v1/auth/logout', { method: 'POST', token: 'abc123' });

    expect(global.fetch).toHaveBeenCalledWith(
      `${env.apiBaseUrl}/v1/auth/logout`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer abc123' }),
      })
    );
  });

  it('does not attach an Authorization header when no token is passed', async () => {
    mockFetchOnce({ status: 200, body: {} });

    await request('/v1/auth/login', { method: 'POST', body: { email: 'a@b.com', password: 'x' } });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('tolerates a 204 empty body and resolves to undefined', async () => {
    mockFetchOnce({ status: 204 });

    const result = await request('/v1/auth/confirm', { method: 'POST', body: {} });

    expect(result).toBeUndefined();
  });

  it('returns parsed JSON on 200', async () => {
    mockFetchOnce({ status: 200, body: { access_token: 't', id_token: 'i', expires_in: 3600, token_type: 'Bearer' } });

    const result = await request<{ access_token: string }>('/v1/auth/login', { method: 'POST' });

    expect(result.access_token).toBe('t');
  });

  it.each([
    [400, { error: 'email and password are required' }],
    [401, { error: 'invalid credentials' }],
    [403, { error: 'user not confirmed' }],
    [409, { error: 'email address already registered' }],
    [502, { error: 'auth provider unavailable' }],
  ])('normalizes a %i response into an ApiError with the server message', async (status, body) => {
    mockFetchOnce({ status, body });

    await expect(request('/v1/auth/login', { method: 'POST' })).rejects.toMatchObject({
      status,
      message: body.error,
    });
  });

  it('throws a typed ApiError instance (not a bare object) on non-2xx', async () => {
    mockFetchOnce({ status: 401, body: { error: 'invalid credentials' } });

    await expect(request('/v1/auth/login', { method: 'POST' })).rejects.toBeInstanceOf(ApiError);
  });

  it('falls back to a generic message when the error body has no `error` field', async () => {
    mockFetchOnce({ status: 502, body: {} });

    await expect(request('/v1/auth/login', { method: 'POST' })).rejects.toMatchObject({
      status: 502,
      message: 'Something went wrong. Please try again.',
    });
  });

  it('normalizes an unreachable host (fetch throw) into a friendly ApiError', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network request failed'));

    try {
      await request('/healthz');
      throw new Error('expected request() to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(0);
      expect((err as ApiError).message.toLowerCase()).toContain("can't reach");
    }
  });
});
