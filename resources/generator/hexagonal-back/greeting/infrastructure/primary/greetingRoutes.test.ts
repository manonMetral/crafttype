import { describe, expect, it } from 'vitest';
import { buildApp } from '../../../app.js';

// Through `buildApp`: the route is checked as the server serves it.
describe('GET /api/greeting', () => {
  const get = async (url: string) => {
    const app = buildApp({ logger: false });
    try {
      return await app.inject({ method: 'GET', url });
    } finally {
      await app.close();
    }
  };

  it('greets the world without a name', async () => {
    const response = await get('/api/greeting');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: 'Hello, world!', count: 1 });
  });

  it('greets the given name', async () => {
    const response = await get('/api/greeting?name=Ada');

    expect(response.json()).toMatchObject({ message: 'Hello, Ada!' });
  });

  it('counts the greetings of the same server', async () => {
    const app = buildApp({ logger: false });

    await app.inject({ method: 'GET', url: '/api/greeting' });
    const second = await app.inject({ method: 'GET', url: '/api/greeting' });
    await app.close();

    expect(second.json()).toMatchObject({ count: 2 });
  });

  it('refuses a name that is too long with a 400 and the reason', async () => {
    const response = await get(`/api/greeting?name=${'a'.repeat(51)}`);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'at most 50 characters' });
  });

  it('leaves the health route alone', async () => {
    const response = await get('/api/health');

    expect(response.json()).toEqual({ status: 'UP' });
  });
});
