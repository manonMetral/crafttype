import type { GreetingCounter } from '../../domain/GreetingCounter.js';

/** Adapter of the `GreetingCounter` port: the count is lost when the server stops. */
export class InMemoryGreetingCounter implements GreetingCounter {
  private count = 0;

  increment(): number {
    this.count += 1;
    return this.count;
  }
}
