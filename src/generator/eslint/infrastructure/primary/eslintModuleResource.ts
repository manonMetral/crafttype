import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import type { NodePackagesVersionsReader } from '../../../../shared/module/domain/PackageVersions.js';
import { EslintApplicationService } from '../../application/EslintApplicationService.js';

export const eslintSlug = 'eslint';

export const createEslintModuleResource = (versions: NodePackagesVersionsReader): ModuleResource => {
  const modules = new EslintApplicationService(versions);

  return moduleResource()
    .slug(eslintSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().build())
    .apiDoc('Quality', 'Adds ESLint with a flat config for TypeScript sources')
    .dependsOn('typescript')
    .tags('quality')
    .factory((properties) => modules.buildModule(properties));
};
