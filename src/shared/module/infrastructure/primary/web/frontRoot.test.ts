import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tmpDirForTest } from '../../../../test/ModuleAssertions.js';
import { frontRoot, PACKAGE_ROOT } from './frontRoot.js';

describe('folder of the built page', () => {
  it('is web/dist of the package, once the page is built', () => {
    const root = tmpDirForTest();
    mkdirSync(join(root, 'web', 'dist'), { recursive: true });
    writeFileSync(join(root, 'web', 'dist', 'index.html'), '<html></html>');

    expect(frontRoot(root)).toBe(join(root, 'web', 'dist'));
  });

  it('is nothing while the page is not built', () => {
    const root = tmpDirForTest();

    expect(frontRoot(root)).toBeUndefined();
    mkdirSync(join(root, 'web', 'dist'), { recursive: true });
    expect(frontRoot(root)).toBeUndefined();
  });

  it('is looked for at the root of the package, from the sources as from the compiled code', () => {
    expect(existsSync(join(PACKAGE_ROOT, 'package.json'))).toBe(true);
    expect(join(PACKAGE_ROOT, 'src')).toSatisfy(existsSync);
  });
});
