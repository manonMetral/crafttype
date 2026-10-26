import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { NodePackagesVersionsReader } from '../../../shared/module/domain/PackageVersions.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('eslint');

export class EslintFactory {
  constructor(private readonly versions: NodePackagesVersionsReader) {}

  /** ESLint 10 with Babel parser for TypeScript sources (`.ts`), without depending on `typescript-eslint`. */
  buildModule(properties: ModuleProperties): CraftModule {
    const common = this.versions.get();

    return moduleBuilder(properties)
      .addFile(SOURCE.file('eslint.config.js'), 'eslint.config.js')
      .addDevDependency('eslint', common)
      .addDevDependency('@eslint/js', common)
      .addDevDependency('@babel/eslint-parser', common)
      .addDevDependency('@babel/preset-typescript', common)
      .addScript('lint', 'eslint . --ext .ts,.js,.mjs,.cjs')
      .addScript('lint:fix', 'eslint . --ext .ts,.js,.mjs,.cjs --fix')
      .build();
  }
}
