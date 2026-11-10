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

  it('is equal to another greeting to the same name, and only to those', () => {
    expect(Greeting.to(' Ada').equals(Greeting.to('Ada'))).toBe(true);
    expect(Greeting.to().equals(Greeting.to('world'))).toBe(true);
    expect(Greeting.to('Ada').equals(Greeting.to('Grace'))).toBe(false);
  });

  it('cannot be modified once created', () => {
    const greeting = Greeting.to('Ada');

    expect(() => {
      (greeting as { name: string }).name = 'Grace';
    }).toThrow(TypeError);
    expect(greeting.message).toBe('Hello, Ada!');
  });
});
