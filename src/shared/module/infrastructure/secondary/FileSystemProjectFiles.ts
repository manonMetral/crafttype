import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

  write(projectFolder: string, path: string, content: string): void {
    const target = join(projectFolder, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
}
