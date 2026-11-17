import { describe, expect, it } from 'vitest';
import {
  CapabilityAlreadyProvidedError,
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
    'capability-already-provided': new CapabilityAlreadyProvidedError('x', 'front', 'y'),
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

  describe('missing prerequisites', () => {
    it('names the modules that must be applied first', () => {
      const error = new MissingModuleDependenciesError('vitest', ['typescript', 'init']);

      expect(error.message).toBe('Module vitest requires these modules to be applied first: typescript, init');
      expect(error.missing).toEqual(['typescript', 'init']);
      expect(error.missingCapabilities).toEqual([]);
    });

    it('names the capabilities that no applied module provides, with the modules that could', () => {
      const error = new MissingModuleDependenciesError(
        'fetch-client',
        [],
        [{ capability: 'front', providers: ['vue-app', 'react-app'] }],
      );

      expect(error.message).toBe(
        'Module fetch-client requires these modules to be applied first: a module that provides front (vue-app or react-app)',
      );
      expect(error.missing).toEqual([]);
      expect(error.missingCapabilities).toEqual([{ capability: 'front', providers: ['vue-app', 'react-app'] }]);
    });

    it('names both, the modules first', () => {
      const error = new MissingModuleDependenciesError(
        'fetch-client',
        ['vitest'],
        [{ capability: 'front', providers: ['vue-app'] }],
      );

      expect(error.message).toBe(
        'Module fetch-client requires these modules to be applied first: vitest, a module that provides front (vue-app)',
      );
    });
  });

  it('says which module already provides the capability another one brings', () => {
    const error = new CapabilityAlreadyProvidedError('react-app', 'front', 'vue-app');

    expect(error.message).toBe('Module react-app cannot be applied: front is already provided by vue-app');
    expect(error.capability).toBe('front');
    expect(error.provider).toBe('vue-app');
  });

  it('does not take other errors for domain errors', () => {
    expect(isDomainError(new Error('boom'))).toBe(false);
    expect(isDomainError(new TypeError('boom'))).toBe(false);
    expect(isDomainError({ kind: 'needle' })).toBe(false);
    expect(isDomainError('needle')).toBe(false);
  });
});
