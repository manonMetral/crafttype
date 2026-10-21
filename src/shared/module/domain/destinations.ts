import type { CraftModule } from './CraftModule.js';
import { DuplicateDestinationError } from './errors.js';
import type { PathNormalizer } from './ports.js';

/**
 * Gives the module's destination paths their normal form, and refuses a module that declares the same file twice, or
 * both creates and modifies it (a defect in the module definition). Applying it to an already normalized module changes
 * nothing.
 */
export const normalizeDestinations = (module: CraftModule, paths: PathNormalizer): CraftModule => {
  const files = module.files.map((file) => ({ ...file, destination: paths.normalize(file.destination) }));
  const edits = module.edits.map((edit) => ({ ...edit, path: paths.normalize(edit.path) }));

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
