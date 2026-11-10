import { randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { JwtService, VerifiedJwtClaims } from './jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: VerifiedJwtClaims;
  }
}

const MIN_SECRET_LENGTH = 32;
const RANDOM_SECRET_BYTES = 32;
const AUTH_HEADER_PREFIX = 'Bearer ';

/**
 * Secret used by the auth module, read from AUTH_JWT_SECRET (at least 32 characters).
 * Without it, production refuses to start; elsewhere a random secret is drawn for the life of the process, so there is
 * no secret known in advance and the tokens stop being valid at restart.
 */
export const authSecretFromEnv = (
  env: Readonly<Record<string, string | undefined>> = process.env,
): string => {
  const configured = env['AUTH_JWT_SECRET']?.trim() ?? '';
  if (configured === '') {
    if (env['NODE_ENV'] === 'production') {
      throw new Error(
        'Missing AUTH_JWT_SECRET: required when NODE_ENV=production',
      );
    }
    return randomBytes(RANDOM_SECRET_BYTES).toString('hex');
  }
  if (configured.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `Invalid AUTH_JWT_SECRET: expected at least ${MIN_SECRET_LENGTH} characters`,
    );
  }
  return configured;
};

/**
 * The token route signs any subject and role without credentials: it is a demo tool, off unless AUTH_DEMO_TOKENS=true,
 * and never available in production.
 */
export const demoTokensFromEnv = (
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean => {
  if (env['AUTH_DEMO_TOKENS'] !== 'true') {
    return false;
  }
  if (env['NODE_ENV'] === 'production') {
    throw new Error(
      'AUTH_DEMO_TOKENS cannot be enabled when NODE_ENV=production',
    );
  }
  return true;
};

/** Fastify preHandler middleware: verifies the bearer token and stores claims on request.auth. */
export const authenticateRequest =
  (jwt: JwtService) =>
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const token = readBearerToken(request.headers.authorization);
    if (token === undefined) {
      await reply
        .code(401)
        .send({ error: 'Missing or invalid Authorization header' });
      return;
    }

    try {
      request.auth = jwt.verify(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid token';
      await reply.code(401).send({ error: message });
    }
  };

const readBearerToken = (
  authorization: string | undefined,
): string | undefined => {
  if (
    authorization === undefined ||
    !authorization.startsWith(AUTH_HEADER_PREFIX)
  ) {
    return undefined;
  }
  const token = authorization.slice(AUTH_HEADER_PREFIX.length).trim();
  return token === '' ? undefined : token;
};
