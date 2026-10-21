import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { echoRequestId, genReqId, loggerOptions } from './logger.js';

describe('loggerOptions', () => {
  it('logue au niveau info par défaut', () => {
    expect(loggerOptions({}).level).toBe('info');
  });

  it('lit LOG_LEVEL sans tenir compte de la casse', () => {
    expect(loggerOptions({ LOG_LEVEL: 'Debug' }).level).toBe('debug');
  });

  it('refuse un niveau inconnu', () => {
    expect(() => loggerOptions({ LOG_LEVEL: 'bavard' })).toThrow(
      'LOG_LEVEL invalide',
    );
  });

  it('écrit le niveau en toutes lettres plutôt qu’en nombre', () => {
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

  it.each(['abc-123', 'A.b_c-9', 'a'.repeat(128)])('reprend %s', (id) => {
    expect(genReqId(request(id))).toBe(id);
  });

  it.each([
    ['trop long', 'a'.repeat(129)],
    ['avec une espace', 'abc 123'],
    ['avec des guillemets', 'abc"123'],
    ['vide', ''],
    ['répété', ['abc', 'def']],
  ])('génère un identifiant quand celui du client est %s', (_, id) => {
    const generated = genReqId(request(id));

    expect(generated).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('génère un identifiant quand le client n’en envoie pas', () => {
    expect(genReqId(request())).not.toBe(genReqId(request()));
  });
});

describe('identifiant de requête dans buildApp', () => {
  const appWithIdRoute = () => {
    const app = buildApp({ logger: false });
    app.get('/id', async (request) => ({ id: request.id }));
    return app;
  };

  it('reprend x-request-id du client et le renvoie dans la réponse', async () => {
    const response = await appWithIdRoute().inject({
      method: 'GET',
      url: '/id',
      headers: { 'x-request-id': 'abc-123' },
    });

    expect(response.json()).toEqual({ id: 'abc-123' });
    expect(response.headers['x-request-id']).toBe('abc-123');
  });

  it('remplace un identifiant invalide par un identifiant généré, renvoyé lui aussi', async () => {
    const response = await appWithIdRoute().inject({
      method: 'GET',
      url: '/id',
      headers: { 'x-request-id': 'a'.repeat(5000) },
    });

    const { id } = response.json<{ id: string }>();
    expect(id).toHaveLength(36);
    expect(response.headers['x-request-id']).toBe(id);
  });

  it('renvoie aussi l’identifiant quand la route n’existe pas', async () => {
    const response = await appWithIdRoute().inject({
      method: 'GET',
      url: '/absente',
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['x-request-id']).toBeTruthy();
  });
});

describe('contenu des logs', () => {
  it('écrit l’identifiant de requête et le niveau en toutes lettres', async () => {
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
