import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { FastifyInstance } from 'fastify';

const LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
const REQUEST_ID_HEADER = 'x-request-id';
// L'identifiant d'un client finit dans les logs : on ne le reprend que court et sans caractère exotique.
const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

/** Options du logger Fastify (pino) : niveau choisi par LOG_LEVEL (info par défaut), niveau écrit en toutes lettres. */
export function loggerOptions(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  return {
    level: parseLevel(env['LOG_LEVEL']),
    formatters: { level: (label: string) => ({ level: label }) },
  };
}

/** Reprend l'en-tête x-request-id du client s'il est valide, sinon génère un identifiant. */
export function genReqId(request: IncomingMessage): string {
  const header = request.headers[REQUEST_ID_HEADER];
  return typeof header === 'string' && VALID_REQUEST_ID.test(header)
    ? header
    : randomUUID();
}

/** Renvoie l'identifiant de la requête dans l'en-tête x-request-id de la réponse. */
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
      `LOG_LEVEL invalide : « ${value} » (${LEVELS.join(', ')} attendus)`,
    );
  }
  return level;
}
