import { afterEach, expect, it, vi } from 'vitest';
import { fetchHealth } from './health.js';
import { ApiError } from './http.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

it('reads the status of the server on /api/health', async () => {
  const fetchStub = vi.fn<typeof fetch>(() =>
    Promise.resolve(new Response('{"status":"UP"}')),
  );
  vi.stubGlobal('fetch', fetchStub);

  await expect(fetchHealth()).resolves.toEqual({ status: 'UP' });

  expect(fetchStub.mock.calls[0]?.[0]).toBe('/api/health');
});

it('fails with an ApiError when the server is down', async () => {
  vi.stubGlobal('fetch', () =>
    Promise.resolve(new Response(null, { status: 503 })),
  );

  await expect(fetchHealth()).rejects.toBeInstanceOf(ApiError);
});
