import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { FastifyInstance } from 'fastify';

const LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
const REQUEST_ID_HEADER = 'x-request-id';
// A client-supplied id ends up in the logs: it is only reused when short and free of unusual characters.
const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

/** Fastify (pino) logger options: level chosen by LOG_LEVEL (info by default), level written as a label rather than a number. */
export function loggerOptions(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  return {
    level: parseLevel(env['LOG_LEVEL']),
    formatters: { level: (label: string) => ({ level: label }) },
  };
}

/** Reuses the client's x-request-id header when it is valid, otherwise generates an id. */
export function genReqId(request: IncomingMessage): string {
  const header = request.headers[REQUEST_ID_HEADER];
  return typeof header === 'string' && VALID_REQUEST_ID.test(header)
    ? header
    : randomUUID();
}

/** Returns the request id in the x-request-id header of the response. */
export function echoRequestId(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    reply.header(REQUEST_ID_HEADER, request.id);
  });
}

function parseLevel(value: string | undefined): string {
  const level = value?.trim().toLowerCase() ?? '';
  if (level === '') {
    return 'info';
  }
  if (!LEVELS.includes(level)) {
    throw new Error(
      `Invalid LOG_LEVEL: "${value}" (expected one of ${LEVELS.join(', ')})`,
    );
  }
  return level;
}
