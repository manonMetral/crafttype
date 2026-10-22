import { describe, expect, it } from 'vitest';
import {
  CraftTypeError,
  DuplicateDestinationError,
  InvalidDestinationError,
  InvalidProjectFileError,
  InvalidPropertyDefinitionError,
  InvalidPropertyError,
  isDomainError,
  MissingModuleDependenciesError,
  MissingPropertyError,
  ModuleConflictError,
  NeedleError,
  PropertyAccessError,
  UnknownModuleError,
  UnknownPackageVersionError,
  type DomainError,
} from './errors.js';

describe('errors', () => {
  // One instance per class of the `DomainError` union: the compiler rejects a missing or an extra member.
  const samples: Record<DomainError['kind'], DomainError> = {
    'unknown-module': new UnknownModuleError('x'),
    'missing-property': new MissingPropertyError('x'),
    'invalid-property': new InvalidPropertyError('x', 'reason'),
    'property-access': new PropertyAccessError('x', 'reason'),
    'invalid-property-definition': new InvalidPropertyDefinitionError('x', 'reason'),
    'missing-module-dependencies': new MissingModuleDependenciesError('x', ['y']),
    'unknown-package-version': new UnknownPackageVersionError('x'),
    'duplicate-destination': new DuplicateDestinationError('x'),
    'invalid-destination': new InvalidDestinationError('x', 'reason'),
    needle: new NeedleError('x', 'y', 'reason'),
    'module-conflict': new ModuleConflictError(['x']),
    'invalid-project-file': new InvalidProjectFileError('x', 'reason'),
  };

  it.each(Object.entries(samples))('the kind of %s is the one of its class', (kind, error) => {
    expect(error.kind).toBe(kind);
  });

  it.each(Object.values(samples).map((error) => [error.kind, error] as const))(
    '%s is recognized as a domain error, with a stack trace and its class name',
    (_kind, error) => {
      expect(isDomainError(error)).toBe(true);
      expect(error).toBeInstanceOf(CraftTypeError);
      expect(error.stack).toContain(error.name);
      expect(error.name).toMatch(/Error$/);
    },
  );

  it('does not take other errors for domain errors', () => {
    expect(isDomainError(new Error('boom'))).toBe(false);
    expect(isDomainError(new TypeError('boom'))).toBe(false);
    expect(isDomainError({ kind: 'needle' })).toBe(false);
    expect(isDomainError('needle')).toBe(false);
  });
});
