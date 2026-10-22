import { describe, expect, it } from 'vitest';
import { InMemoryGreetingCounter } from './InMemoryGreetingCounter.js';

describe('InMemoryGreetingCounter', () => {
  it('counts from one, and each counter has its own count', () => {
    const counter = new InMemoryGreetingCounter();

    expect([counter.increment(), counter.increment()]).toEqual([1, 2]);
    expect(new InMemoryGreetingCounter().increment()).toBe(1);
  });
});
