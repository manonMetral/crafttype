import { readFileSync } from 'node:fs';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { docsEnabled, registerOpenApi } from './openapi.js';

const project = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { name: string; version: string };

describe('OpenAPI document', () => {
  it('describes the routes of the application, with the name and version of the project', async () => {
    const app = buildApp({ logger: false });

    const response = await app.inject({
      method: 'GET',
      url: '/api/openapi.json',
    });

    expect(response.statusCode).toBe(200);
    const document = response.json();
    expect(document.openapi).toBe('3.1.0');
    expect(document.info).toEqual({
      title: project.name,
      version: project.version,
    });
    expect(document.paths['/api/health'].get.responses['200']).toBeDefined();
  });

  it('does not describe itself', async () => {
    const app = buildApp({ logger: false });

    const response = await app.inject({
      method: 'GET',
      url: '/api/openapi.json',
    });

    expect(response.json().paths).not.toHaveProperty('/api/openapi.json');
  });

  it('serves the Swagger UI', async () => {
    const app = buildApp({ logger: false });

    const response = await app.inject({ method: 'GET', url: '/api/docs/' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
  });
});

describe('docsEnabled', () => {
  it.each([
    [{}, true],
    [{ NODE_ENV: 'development' }, true],
    [{ NODE_ENV: 'production' }, false],
    [{ NODE_ENV: 'production', OPENAPI_DOCS: 'true' }, true],
    [{ NODE_ENV: 'development', OPENAPI_DOCS: 'false' }, false],
    [{ OPENAPI_DOCS: ' TRUE ' }, true],
    [{ NODE_ENV: 'production', OPENAPI_DOCS: '' }, false],
  ])('for %j: %s', (env, expected) => {
    expect(docsEnabled(env)).toBe(expected);
  });

  it('rejects a value that is neither true nor false', () => {
    expect(() => docsEnabled({ OPENAPI_DOCS: 'maybe' })).toThrow(
      'Invalid OPENAPI_DOCS: "maybe" (expected true or false)',
    );
  });
});

describe('registerOpenApi in production', () => {
  it('serves neither the document nor the UI', async () => {
    const app = Fastify();
    registerOpenApi(app, { NODE_ENV: 'production' });

    const document = await app.inject({
      method: 'GET',
      url: '/api/openapi.json',
    });
    const ui = await app.inject({ method: 'GET', url: '/api/docs/' });

    expect(document.statusCode).toBe(404);
    expect(ui.statusCode).toBe(404);
  });
});
