import { InvalidGreetingNameError } from './InvalidGreetingNameError.js';

const DEFAULT_NAME = 'world';
const MAX_NAME_LENGTH = 50;

/** A greeting addressed to someone. The rules on the name live here, nowhere else. */
export class Greeting {
  private constructor(readonly name: string) {
    Object.freeze(this);
  }

  /** A missing or blank name greets the world; a name that is too long is refused. */
  static to(name?: string): Greeting {
    const trimmed = name?.trim() ?? '';
    if (trimmed.length > MAX_NAME_LENGTH) {
      throw new InvalidGreetingNameError(
        `at most ${MAX_NAME_LENGTH} characters`,
      );
    }
    return new Greeting(trimmed === '' ? DEFAULT_NAME : trimmed);
  }

  /** A greeting is defined by its name: two greetings to the same name are equal. */
  equals(other: Greeting): boolean {
    return this.name === other.name;
  }

  get message(): string {
    return `Hello, ${this.name}!`;
  }
}
