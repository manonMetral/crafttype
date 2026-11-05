import { resolve } from 'node:path';
import type { ProjectFiles } from '../../domain/ports.js';

/**
 * A project seen through what was written to it: reads see the writes first, then the files of `base`, and the writes
 * stay in memory. Used to try modules on a project without changing it.
 */
export class OverlayProjectFiles implements ProjectFiles {
  private readonly written = new Map<string, string>();

  constructor(private readonly base: ProjectFiles) {}

  read(projectFolder: string, path: string): string | undefined {
    return this.written.get(locationOf(projectFolder, path)) ?? this.base.read(projectFolder, path);
  }

  write(projectFolder: string, path: string, content: string): void {
    this.written.set(locationOf(projectFolder, path), content);
  }
}

/** `src/a.ts`, `./src//a.ts` and `src/x/../a.ts` are one file. */
const locationOf = (projectFolder: string, path: string): string => resolve(projectFolder, path);
