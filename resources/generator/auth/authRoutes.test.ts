import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';

const STRONG_SECRET = 'a-secret-of-at-least-32-characters!!';

describe('auth routes', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('issues a token and exposes claims through the auth middleware in demo mode', async () => {
    vi.stubEnv('AUTH_DEMO_TOKENS', 'true');
    const app = buildApp({ logger: false });

    const tokenResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/token',
      payload: { sub: 'alice', role: 'admin' },
    });
    expect(tokenResponse.statusCode).toBe(200);
    const { token } = tokenResponse.json() as { token: string };

    const meResponse = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toMatchObject({ sub: 'alice', role: 'admin' });

    await app.close();
  });

  it('does not expose the token route unless the demo mode is on', async () => {
    const app = buildApp({ logger: false });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/token',
      payload: { sub: 'alice', role: 'admin' },
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  it('keeps the token route off when AUTH_DEMO_TOKENS is not exactly true', async () => {
    vi.stubEnv('AUTH_DEMO_TOKENS', 'yes');
    const app = buildApp({ logger: false });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/token',
      payload: { sub: 'alice' },
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  it('refuses the demo mode in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_JWT_SECRET', STRONG_SECRET);
    vi.stubEnv('AUTH_DEMO_TOKENS', 'true');

    expect(() => buildApp({ logger: false })).toThrow(
      'AUTH_DEMO_TOKENS cannot be enabled when NODE_ENV=production',
    );
  });

  it('refuses to start in production without a secret', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_JWT_SECRET', '');

    expect(() => buildApp({ logger: false })).toThrow(
      'Missing AUTH_JWT_SECRET: required when NODE_ENV=production',
    );
  });

  it('starts in production with a strong secret and no token route', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_JWT_SECRET', STRONG_SECRET);
    const app = buildApp({ logger: false });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/token',
      payload: { sub: 'alice' },
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  it.each([
    ['an empty role', { sub: 'alice', role: '' }],
    ['a blank role', { sub: 'alice', role: '   ' }],
    ['an empty subject', { sub: '', role: 'admin' }],
    ['a blank subject', { sub: '  ' }],
  ])(
    'rejects %s with a 400 instead of signing an unusable token',
    async (_name, payload) => {
      vi.stubEnv('AUTH_DEMO_TOKENS', 'true');
      const app = buildApp({ logger: false });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/token',
        payload,
      });

      expect(response.statusCode).toBe(400);

      await app.close();
    },
  );

  it('rejects /api/auth/me without bearer token', async () => {
    const app = buildApp({ logger: false });

    const response = await app.inject({ method: 'GET', url: '/api/auth/me' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: 'Missing or invalid Authorization header',
    });

    await app.close();
  });
});
