import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tmpDirForTest } from '../../../test/ModuleAssertions.js';
import { readPackageVersion } from './readPackageVersion.js';

describe('readPackageVersion', () => {
  it('reads the version of the package', () => {
    const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

    expect(readPackageVersion()).toBe(version);
    expect(readPackageVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('reads the version of any package.json it is given', () => {
    const file = join(tmpDirForTest(), 'package.json');
    writeFileSync(file, JSON.stringify({ name: 'x', version: '4.5.6' }));

    expect(readPackageVersion(file)).toBe('4.5.6');
  });

  it.each([{ name: 'x' }, { name: 'x', version: 7 }])(
    'refuses a package.json without a text version: %j',
    (content) => {
      const file = join(tmpDirForTest(), 'package.json');
      writeFileSync(file, JSON.stringify(content));

      expect(() => readPackageVersion(file)).toThrow(`No version in ${file}`);
    },
  );
});
