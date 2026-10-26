import type { FastifyReply, FastifyRequest } from 'fastify';
import type { JwtService, VerifiedJwtClaims } from './jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: VerifiedJwtClaims;
  }
}

const DEFAULT_JWT_SECRET = 'dev-secret-change-me';
const AUTH_HEADER_PREFIX = 'Bearer ';

/** Secret used by the auth module. Override with AUTH_JWT_SECRET in the environment. */
export const authSecretFromEnv = (
  env: Readonly<Record<string, string | undefined>> = process.env,
): string => {
  const configured = env['AUTH_JWT_SECRET']?.trim() ?? '';
  return configured === '' ? DEFAULT_JWT_SECRET : configured;
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
