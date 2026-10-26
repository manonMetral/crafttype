import type { FastifyPluginAsync } from 'fastify';
import type { GreetingApplicationService } from '../../application/GreetingApplicationService.js';

/**
 * `GET /api/greeting?name=`. A Fastify plugin: routes are declared inside one,
 * never on the root instance, so that the plugins registered before it
 * (OpenAPI for instance) see them.
 */
export const greetingRoutes =
  (service: GreetingApplicationService): FastifyPluginAsync =>
  async (app) => {
    app.get<{ Querystring: { name?: string } }>(
      '/api/greeting',
      {
        schema: {
          querystring: {
            type: 'object',
            properties: { name: { type: 'string' } },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                count: { type: 'integer' },
              },
            },
            400: {
              type: 'object',
              properties: { error: { type: 'string' } },
            },
          },
        },
      },
      async (request, reply) => {
        const result = service.greet(request.query.name);
        if (result.kind === 'invalid-name') {
          return reply.code(400).send({ error: result.reason });
        }
        return { message: result.message, count: result.count };
      },
    );
  };
