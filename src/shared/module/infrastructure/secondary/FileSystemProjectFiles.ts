import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { ProjectFiles } from '../../domain/ports.js';

export class FileSystemProjectFiles implements ProjectFiles {
  read(projectFolder: string, path: string): string | undefined {
    try {
      return readFileSync(join(projectFolder, path), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Writes to a temporary file next to the target, then renames it over the target: a crash or a full disk never
   * leaves a truncated file (a user's `package.json` for instance). The mode of an existing file is kept, and a
   * symbolic link is written through, as a plain write would.
   */
  write(projectFolder: string, path: string, content: string): void {
    const wanted = join(projectFolder, path);
    mkdirSync(dirname(wanted), { recursive: true });
    const target = existsSync(wanted) ? realpathSync(wanted) : wanted;
    const temporary = join(dirname(target), `.${basename(target)}.crafttype-${process.pid}-${Date.now()}.tmp`);

    try {
      writeFileSync(temporary, content);
      if (existsSync(target)) {
        chmodSync(temporary, statSync(target).mode & 0o7777);
      }
      renameSync(temporary, target);
    } catch (error) {
      rmSync(temporary, { force: true });
      throw namingTarget(error, temporary, target);
    }
  }
}

/** The user never asked for the temporary file: an error that names it is made to name the file being written. */
const namingTarget = (error: unknown, temporary: string, target: string): unknown => {
  if (typeof error === 'object' && error !== null && 'path' in error && error.path === temporary) {
    error.path = target;
  }
  return error;
};
