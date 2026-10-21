import type { CraftModule } from './CraftModule.js';
import { DuplicateDestinationError, InvalidDestinationError } from './errors.js';
import type { PathNormalizer } from './ports.js';

/** Why a destination cannot be a file inside the project folder, or `undefined` if it can. Applied to the normal form. */
const refusalOf = (declared: string, normalized: string): string | undefined => {
  if (declared.includes('\\')) {
    return 'use `/` as separator, not a backslash';
  }
  if (normalized === '.' || normalized.endsWith('/')) {
    return 'a file path is expected, not a folder';
  }
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
    return 'the path must be relative to the project folder';
  }
  if (normalized === '..' || normalized.startsWith('../')) {
    return 'the path leaves the project folder';
  }
  return undefined;
};

const checked = (declared: string, paths: PathNormalizer): string => {
  const normalized = paths.normalize(declared);
  const refusal = refusalOf(declared, normalized);
  if (refusal !== undefined) {
    throw new InvalidDestinationError(declared, refusal);
  }
  return normalized;
};

/**
 * Gives the module's destination paths their normal form, and refuses a module that declares a path outside the project
 * folder (or a folder, or a backslash path), the same file twice, or both creates and modifies a file: all defects in the
 * module definition. Applying it to an already normalized module changes nothing.
 */
export const normalizeDestinations = (module: CraftModule, paths: PathNormalizer): CraftModule => {
  const files = module.files.map((file) => ({ ...file, destination: checked(file.destination, paths) }));
  const edits = module.edits.map((edit) => ({ ...edit, path: checked(edit.path, paths) }));

  const created = new Set<string>();
  for (const { destination } of files) {
    if (created.has(destination)) {
      throw new DuplicateDestinationError(destination);
    }
    created.add(destination);
  }
  for (const { path } of edits) {
    if (created.has(path)) {
      throw new DuplicateDestinationError(path);
    }
  }

  return { ...module, files, edits };
};
