import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Root of the package, the same from `src/` (tests, tsx) and from `dist/` (published package): both trees have the
 * same depth.
 */
export const PACKAGE_ROOT = fileURLToPath(new URL('../../../../../../', import.meta.url));

/** Folder of the built page (`web/dist`), or `undefined` while it is not built. */
export const frontRoot = (packageRoot: string = PACKAGE_ROOT): string | undefined => {
  const root = join(packageRoot, 'web', 'dist');
  return existsSync(join(root, 'index.html')) ? root : undefined;
};
