import { describe, expect, it } from 'vitest';
import { Greeting } from './Greeting.js';
import { InvalidGreetingNameError } from './InvalidGreetingNameError.js';

describe('Greeting', () => {
  it('greets the given name, without the spaces around it', () => {
    expect(Greeting.to('  Ada ').message).toBe('Hello, Ada!');
  });

  it.each([undefined, '', '   '])('greets the world for %j', (name) => {
    expect(Greeting.to(name).message).toBe('Hello, world!');
  });

  it('accepts a name of 50 characters and refuses a longer one', () => {
    expect(Greeting.to('a'.repeat(50)).name).toHaveLength(50);
    expect(() => Greeting.to('a'.repeat(51))).toThrow(InvalidGreetingNameError);
  });

  it('says why a name is refused', () => {
    expect(() => Greeting.to('a'.repeat(51))).toThrow(
      'Invalid name: at most 50 characters',
    );
  });
});
