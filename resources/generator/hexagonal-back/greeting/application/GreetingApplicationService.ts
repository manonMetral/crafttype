import { Greeting } from '../domain/Greeting.js';
import type { GreetingCounter } from '../domain/GreetingCounter.js';
import { InvalidGreetingNameError } from '../domain/InvalidGreetingNameError.js';

/** What the primary adapters get: no domain type, no exception to translate. */
export type GreetingResult =
  | {
      readonly kind: 'greeted';
      readonly message: string;
      readonly count: number;
    }
  | { readonly kind: 'invalid-name'; readonly reason: string };

/** Orchestration only: the rules are in the domain, the counter is a port. */
export class GreetingApplicationService {
  constructor(private readonly counter: GreetingCounter) {}

  greet(name?: string): GreetingResult {
    try {
      const greeting = Greeting.to(name);
      return {
        kind: 'greeted',
        message: greeting.message,
        count: this.counter.increment(),
      };
    } catch (error) {
      if (error instanceof InvalidGreetingNameError) {
        return { kind: 'invalid-name', reason: error.reason };
      }
      throw error;
    }
  }
}
