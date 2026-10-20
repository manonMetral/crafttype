import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { NodePackagesVersionsReader } from '../../../shared/module/domain/PackageVersions.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('vitest');

export class VitestFactory {
  constructor(private readonly versions: NodePackagesVersionsReader) {}

  buildModule(properties: ModuleProperties): CraftModule {
    return moduleBuilder(properties)
      .addFile(SOURCE.template('vitest.config.ts'), 'vitest.config.ts')
      .addDevDependency('vitest', this.versions.get())
      .addScript('test', 'vitest run')
      .addScript('test:watch', 'vitest')
      .build();
  }
}
