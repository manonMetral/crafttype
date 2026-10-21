import { describe, expect, it } from 'vitest';
import { SemverVersionComparator } from './SemverVersionComparator.js';

describe('SemverVersionComparator', () => {
  const comparator = new SemverVersionComparator();

  it.each([
    ['5.13.0', '5.12.7', 'newer exact version'],
    ['6.0.0', '5.12.7', 'newer major version'],
    ['^5.13.0', '5.12.7', 'range whose minimum is newer'],
    ['^5.0.0', '5.12.7', 'range that accepts the catalog version'],
    ['>=5', '5.12.7', 'open range'],
    ['*', '5.12.7', 'any version'],
  ])('keeps %s against %s (%s)', (existing, wanted) => {
    expect(comparator.keepsExistingVersion(existing, wanted)).toBe(true);
  });

  it.each([
    ['5.0.0', '5.12.7', 'older version'],
    ['^4.0.0', '5.12.7', 'older major'],
    ['~5.1.0', '5.12.7', 'range that excludes the catalog version'],
    ['5.0.0-beta.1', '5.0.0', 'prerelease against the final version'],
    ['latest', '5.12.7', 'tag'],
    ['github:org/repo', '5.12.7', 'URL'],
    ['workspace:*', '5.12.7', 'workspace reference'],
    ['file:../fastify', '5.12.7', 'local path'],
    ['<0.0.0', '5.12.7', 'range with no version'],
    ['5.12.7', '<0.0.0', 'catalog version with no minimum'],
  ])('does not keep %s against %s (%s)', (existing, wanted) => {
    expect(comparator.keepsExistingVersion(existing, wanted)).toBe(false);
  });
});
