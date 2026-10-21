import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { echoRequestId, genReqId, loggerOptions } from './logger.js';

describe('loggerOptions', () => {
  it('logs at info level by default', () => {
    expect(loggerOptions({}).level).toBe('info');
  });

  it('reads LOG_LEVEL case-insensitively', () => {
    expect(loggerOptions({ LOG_LEVEL: 'Debug' }).level).toBe('debug');
  });

  it('rejects an unknown level', () => {
    expect(() => loggerOptions({ LOG_LEVEL: 'verbose' })).toThrow(
      'Invalid LOG_LEVEL',
    );
  });

  it('writes the level as a label rather than a number', () => {
    expect(loggerOptions({}).formatters.level('warn')).toEqual({
      level: 'warn',
    });
  });
});

describe('genReqId', () => {
  const request = (header?: string | string[]) =>
    ({
      headers: header === undefined ? {} : { 'x-request-id': header },
    }) as never;

  it.each(['abc-123', 'A.b_c-9', 'a'.repeat(128)])('reuses %s', (id) => {
    expect(genReqId(request(id))).toBe(id);
  });

  it.each([
    ['too long', 'a'.repeat(129)],
    ['with a space', 'abc 123'],
    ['with quotes', 'abc"123'],
    ['empty', ''],
    ['repeated', ['abc', 'def']],
  ])('generates an id when the one from the client is %s', (_, id) => {
    const generated = genReqId(request(id));

    expect(generated).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('generates an id when the client sends none', () => {
    expect(genReqId(request())).not.toBe(genReqId(request()));
  });
});

describe('request id in buildApp', () => {
  const appWithIdRoute = () => {
    const app = buildApp({ logger: false });
    app.get('/id', async (request) => ({ id: request.id }));
    return app;
  };

  it('reuses the client x-request-id and returns it in the response', async () => {
    const response = await appWithIdRoute().inject({
      method: 'GET',
      url: '/id',
      headers: { 'x-request-id': 'abc-123' },
    });

    expect(response.json()).toEqual({ id: 'abc-123' });
    expect(response.headers['x-request-id']).toBe('abc-123');
  });

  it('replaces an invalid id with a generated one, also returned', async () => {
    const response = await appWithIdRoute().inject({
      method: 'GET',
      url: '/id',
      headers: { 'x-request-id': 'a'.repeat(5000) },
    });

    const { id } = response.json<{ id: string }>();
    expect(id).toHaveLength(36);
    expect(response.headers['x-request-id']).toBe(id);
  });

  it('also returns the id when the route does not exist', async () => {
    const response = await appWithIdRoute().inject({
      method: 'GET',
      url: '/missing',
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['x-request-id']).toBeTruthy();
  });
});

describe('log content', () => {
  it('writes the request id and the level as a label', async () => {
    const lines: string[] = [];
    const app = Fastify({
      logger: {
        ...loggerOptions({}),
        stream: {
          write: (line: string) => {
            lines.push(line);
          },
        },
      },
      genReqId,
    });
    echoRequestId(app);
    app.get('/id', async () => ({}));

    await app.inject({
      method: 'GET',
      url: '/id',
      headers: { 'x-request-id': 'abc-123' },
    });

    const entries = lines.map(
      (line) => JSON.parse(line) as { level: string; reqId?: string },
    );
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every(({ level }) => level === 'info')).toBe(true);
    expect(entries.some(({ reqId }) => reqId === 'abc-123')).toBe(true);
  });
});
