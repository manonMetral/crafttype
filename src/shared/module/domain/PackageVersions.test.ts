import { describe, expect, it } from 'vitest';
import { UnknownPackageVersionError } from './errors.js';
import { PackageVersions } from './PackageVersions.js';

describe('PackageVersions', () => {
  const versions = new PackageVersions({ fastify: '5.12.7' });

  it('returns the catalog version', () => {
    expect(versions.get('fastify')).toBe('5.12.7');
  });

  it('rejects a package missing from the catalog, naming it', () => {
    expect(() => versions.get('unknown')).toThrow(UnknownPackageVersionError);
    expect(() => versions.get('unknown')).toThrow(/unknown/);
  });
});
