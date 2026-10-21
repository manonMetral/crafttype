import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readPackageVersion } from './readPackageVersion.js';

describe('readPackageVersion', () => {
  it('reads the version of the package', () => {
    const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

    expect(readPackageVersion()).toBe(version);
    expect(readPackageVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
