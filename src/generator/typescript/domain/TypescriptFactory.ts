import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { NodePackagesVersionsReader } from '../../../shared/module/domain/PackageVersions.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('typescript');

export class TypescriptFactory {
  constructor(private readonly versions: NodePackagesVersionsReader) {}

  buildModule(properties: ModuleProperties): CraftModule {
    const common = this.versions.get();

    return moduleBuilder(properties)
      .addFile(SOURCE.template('tsconfig.json'), 'tsconfig.json')
      .addDevDependency('typescript', common)
      .addDevDependency('@types/node', common)
      .addScript('typecheck', 'tsc --noEmit')
      .build();
  }
}
