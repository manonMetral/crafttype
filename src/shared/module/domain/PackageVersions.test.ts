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

describe('PackageVersions immutability', () => {
  it('is not affected by a later change to the record it was built from', () => {
    const source: Record<string, string> = { fastify: '5.12.7' };
    const versions = new PackageVersions(source);

    source['fastify'] = '0.0.0';
    source['vue'] = '3.5.0';

    expect(versions.get('fastify')).toBe('5.12.7');
    expect(() => versions.get('vue')).toThrow(UnknownPackageVersionError);
  });
});
