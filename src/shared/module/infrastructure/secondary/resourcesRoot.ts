import { fileURLToPath } from 'node:url';

/**
 * Root of the `resources/` folder, the same from `src/` (tests, tsx) and from `dist/` (published package),
 * because both trees have the same depth.
 */
export const resourcesRoot = (): string => fileURLToPath(new URL('../../../../../resources/', import.meta.url));
