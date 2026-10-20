import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ModuleResourcesReader } from '../../domain/ports.js';

export class FileSystemModuleResourcesReader implements ModuleResourcesReader {
  constructor(private readonly root: string) {}

  read(module: string, path: string): string {
    return readFileSync(join(this.root, 'generator', module, path), 'utf8');
  }
}
