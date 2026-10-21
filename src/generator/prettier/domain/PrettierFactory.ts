import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { NodePackagesVersionsReader } from '../../../shared/module/domain/PackageVersions.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('prettier');

export class PrettierFactory {
  constructor(private readonly versions: NodePackagesVersionsReader) {}

  buildModule(properties: ModuleProperties): CraftModule {
    return moduleBuilder(properties)
      .addFile(SOURCE.file('.prettierrc.json'), '.prettierrc.json')
      .addDevDependency('prettier', this.versions.get())
      .addScript('format', 'prettier --write .')
      .addScript('format:check', 'prettier --check .')
      .build();
  }
}
