import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PackageVersions, type NodePackagesVersionsReader } from '../../domain/PackageVersions.js';

export class FileSystemNodePackagesVersionsReader implements NodePackagesVersionsReader {
  constructor(private readonly root: string) {}

  get(source = 'common'): PackageVersions {
    const content = JSON.parse(readFileSync(join(this.root, 'generator', 'dependencies', source, 'package.json'), 'utf8'));
    return new PackageVersions({ ...content.dependencies, ...content.devDependencies });
  }
}
