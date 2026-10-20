import { fileURLToPath } from 'node:url';

/**
 * Racine du dossier `resources/`, identique depuis `src/` (tests, tsx) et depuis `dist/` (paquet publié),
 * car les deux arborescences ont la même profondeur.
 */
export const resourcesRoot = (): string => fileURLToPath(new URL('../../../../../resources/', import.meta.url));
