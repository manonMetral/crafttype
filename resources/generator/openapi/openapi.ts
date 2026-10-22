import { readFileSync } from 'node:fs';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

const OPENAPI_VERSION = '3.1.0';
const DOCUMENT_PATH = '/api/openapi.json';
const UI_PATH = '/api/docs';

/**
 * Whether the documentation is served. By default it is, except when NODE_ENV is `production`: an API description
 * and a page to try it out are not something to expose by accident. OPENAPI_DOCS=true or false decides explicitly.
 */
export function docsEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const value = env['OPENAPI_DOCS']?.trim().toLowerCase() ?? '';
  if (value === '') {
    return env['NODE_ENV'] !== 'production';
  }
  if (value !== 'true' && value !== 'false') {
    throw new Error(
      `Invalid OPENAPI_DOCS: "${env['OPENAPI_DOCS']}" (expected true or false)`,
    );
  }
  return value === 'true';
}

/** Name and version of the project, read from its package.json (two folders above `src/server` and `dist/server`). */
function readProject(): { name: string; version: string } {
  const file = new URL('../../package.json', import.meta.url);
  const { name, version } = JSON.parse(readFileSync(file, 'utf8')) as {
    name?: unknown;
    version?: unknown;
  };
  return {
    name: typeof name === 'string' ? name : 'api',
    version: typeof version === 'string' ? version : '0.0.1',
  };
}

/**
 * Describes the routes of the application in OpenAPI: the document is served at /api/openapi.json and a Swagger UI
 * at /api/docs. Call it before the routes are declared, the plugin collects the ones that follow.
 */
export function registerOpenApi(
  app: FastifyInstance,
  env: Readonly<Record<string, string | undefined>> = process.env,
): void {
  if (!docsEnabled(env)) {
    return;
  }

  const { name, version } = readProject();
  app.register(swagger, {
    openapi: { openapi: OPENAPI_VERSION, info: { title: name, version } },
  });
  app.register(swaggerUi, { routePrefix: UI_PATH });
  app.get(DOCUMENT_PATH, { schema: { hide: true } }, async () => app.swagger());
}
