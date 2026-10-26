import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

describe('auth routes', () => {
  it('issues a token and exposes claims through the auth middleware', async () => {
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
