import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Version of the crafttype package, read from its `package.json`. The same path works from `src/` (tests, tsx) and from
 * `dist/` (published package), because both trees have the same depth (see `resourcesRoot`).
 */
export const readPackageVersion = (): string => {
  const path = fileURLToPath(new URL('../../../../../package.json', import.meta.url));
  const { version } = JSON.parse(readFileSync(path, 'utf8')) as { version?: unknown };
  if (typeof version !== 'string') {
    throw new Error(`No version in ${path}`);
  }
  return version;
};
