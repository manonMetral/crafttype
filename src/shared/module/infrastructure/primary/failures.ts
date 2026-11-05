import { isDomainError, type DomainError } from '../../domain/errors.js';
import { describeSystemError, isSystemError } from './systemErrors.js';

/**
 * What went wrong, as the primary adapters need to tell it. They share this classification and keep their own
 * wording and codes (an exit code and a message on the command line, a status and JSON over HTTP).
 */
export type Failure =
  /** The tool refuses: a wrong option, an unknown module, a conflict... The user can act on it. */
  | { readonly kind: 'domain'; readonly error: DomainError }
  /** The operating system refuses (permission denied, not a folder...), already described on one line. */
  | { readonly kind: 'system'; readonly message: string }
  /** A bug: nothing the user can do. */
  | { readonly kind: 'unexpected'; readonly error: unknown };

export const classify = (error: unknown): Failure => {
  if (isDomainError(error)) {
    return { kind: 'domain', error };
  }
  if (isSystemError(error)) {
    return { kind: 'system', message: describeSystemError(error) };
  }
  return { kind: 'unexpected', error };
};
