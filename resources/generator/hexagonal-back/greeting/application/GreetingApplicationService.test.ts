import { describe, expect, it } from 'vitest';
import type { GreetingCounter } from '../domain/GreetingCounter.js';
import { GreetingApplicationService } from './GreetingApplicationService.js';

// A fake of the port: the application is tested without any adapter.
class FakeGreetingCounter implements GreetingCounter {
  incremented = 0;

  increment(): number {
    this.incremented += 1;
    return this.incremented + 100;
  }
}

describe('GreetingApplicationService', () => {
  it('greets and reports the count given by the port', () => {
    const service = new GreetingApplicationService(new FakeGreetingCounter());

    expect(service.greet('Ada')).toEqual({
      kind: 'greeted',
      message: 'Hello, Ada!',
      count: 101,
    });
  });

  it('does not count a refused name, and says why', () => {
    const counter = new FakeGreetingCounter();

    const result = new GreetingApplicationService(counter).greet(
      'a'.repeat(51),
    );

    expect(result).toEqual({
      kind: 'invalid-name',
      reason: 'at most 50 characters',
    });
    expect(counter.incremented).toBe(0);
  });

  it('lets an unexpected failure of the port reach the caller', () => {
    const broken: GreetingCounter = {
      increment: () => {
        throw new Error('counter is down');
      },
    };

    expect(() => new GreetingApplicationService(broken).greet('Ada')).toThrow(
      'counter is down',
    );
  });
});
