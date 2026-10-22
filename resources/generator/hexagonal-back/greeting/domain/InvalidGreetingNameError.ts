/** The name to greet is not acceptable: a rule of the domain, not an HTTP concern. */
export class InvalidGreetingNameError extends Error {
  constructor(readonly reason: string) {
    super(`Invalid name: ${reason}`);
    this.name = 'InvalidGreetingNameError';
  }
}
