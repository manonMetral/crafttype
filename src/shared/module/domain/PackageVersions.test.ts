import { describe, expect, it } from 'vitest';
import { UnknownPackageVersionError } from './errors.js';
import { PackageVersions } from './PackageVersions.js';

describe('PackageVersions', () => {
  const versions = new PackageVersions({ fastify: '5.12.7' });

  it('rend la version du catalogue', () => {
    expect(versions.get('fastify')).toBe('5.12.7');
  });

  it('refuse un paquet absent du catalogue en le nommant', () => {
    expect(() => versions.get('inconnu')).toThrow(UnknownPackageVersionError);
    expect(() => versions.get('inconnu')).toThrow(/inconnu/);
  });
});
