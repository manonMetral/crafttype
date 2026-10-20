import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import type { NodePackagesVersionsReader } from '../../../../shared/module/domain/PackageVersions.js';
import { VitestFactory } from '../../domain/VitestFactory.js';

export const vitestSlug = 'vitest';

export const createVitestModuleResource = (versions: NodePackagesVersionsReader): ModuleResource => {
  const factory = new VitestFactory(versions);

  return moduleResource()
    .slug(vitestSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().build())
    .apiDoc('Tests', 'Ajoute Vitest')
    .dependsOn('typescript')
    .tags('test')
    .factory((properties) => factory.buildModule(properties));
};
