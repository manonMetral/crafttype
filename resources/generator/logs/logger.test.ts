import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { loggerOptions } from './logger.js';

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

  it('reprend l’en-tête x-request-id comme identifiant de requête dans les logs', async () => {
    const app = buildApp({ logger: false });
    app.get('/id', async (request) => ({ id: request.id }));

    const response = await app.inject({
      method: 'GET',
      url: '/id',
      headers: { 'x-request-id': 'abc-123' },
    });

    expect(response.json()).toEqual({ id: 'abc-123' });
  });
});
