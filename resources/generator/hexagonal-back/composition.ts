import type { FastifyInstance } from 'fastify';
import { GreetingApplicationService } from './greeting/application/GreetingApplicationService.js';
import { greetingRoutes } from './greeting/infrastructure/primary/greetingRoutes.js';
import { InMemoryGreetingCounter } from './greeting/infrastructure/secondary/InMemoryGreetingCounter.js';

/**
 * Composition root: the only place that knows both the primary and the
 * secondary adapters. Add the contexts of the application here.
 */
export function registerContexts(app: FastifyInstance): void {
  const greeting = new GreetingApplicationService(
    new InMemoryGreetingCounter(),
  );
  app.register(greetingRoutes(greeting));
}
