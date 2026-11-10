import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  authSecretFromEnv,
  authenticateRequest,
  demoTokensFromEnv,
} from './authentication.js';
import { createJwtService } from './jwt.js';

interface TokenRequestBody {
  readonly sub: string;
  readonly role?: string;
}

/** Adds JWT routes and the bearer middleware to the Fastify app. */
export const registerAuthRoutes = (
  app: FastifyInstance,
  env: Readonly<Record<string, string | undefined>> = process.env,
): void => {
  const jwt = createJwtService(authSecretFromEnv(env));
  const demoTokens = demoTokensFromEnv(env);
  const authenticate = authenticateRequest(jwt);
  app.register(authRoutes(authenticate, demoTokens ? jwt.sign : undefined));
};

const NON_BLANK = { type: 'string', minLength: 1, pattern: '\\S' } as const;

const registerTokenRoute = (
  routes: FastifyInstance,
  signToken: ReturnType<typeof createJwtService>['sign'],
): void => {
  routes.post<{ Body: TokenRequestBody }>(
    '/api/auth/token',
    {
      schema: {
        body: {
          type: 'object',
          properties: { sub: NON_BLANK, role: NON_BLANK },
          required: ['sub'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              token: { type: 'string' },
            },
            required: ['token'],
          },
        },
      },
    },
    async (request) => ({
      token: signToken({ sub: request.body.sub, role: request.body.role }),
    }),
  );
};

const authRoutes =
  (
    authenticate: ReturnType<typeof authenticateRequest>,
    signToken: ReturnType<typeof createJwtService>['sign'] | undefined,
  ): FastifyPluginAsync =>
  async (routes) => {
    if (signToken !== undefined) {
      registerTokenRoute(routes, signToken);
    }

    routes.get(
      '/api/auth/me',
      {
        preHandler: authenticate,
        schema: {
          response: {
            200: {
              type: 'object',
              properties: {
                sub: { type: 'string' },
                role: { type: ['string', 'null'] },
                expiresAt: { type: 'integer' },
              },
              required: ['sub', 'role', 'expiresAt'],
            },
            401: {
              type: 'object',
              properties: {
                error: { type: 'string' },
              },
              required: ['error'],
            },
          },
        },
      },
      async (request, reply) => {
        const auth = request.auth;
        if (auth === undefined) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        return {
          sub: auth.sub,
          role: auth.role ?? null,
          expiresAt: auth.exp,
        };
      },
    );
  };
