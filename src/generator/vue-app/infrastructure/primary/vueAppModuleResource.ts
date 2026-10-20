import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import type { NodePackagesVersionsReader } from '../../../../shared/module/domain/PackageVersions.js';
import { VueAppFactory } from '../../domain/VueAppFactory.js';

export const vueAppSlug = 'vue-app';

export const createVueAppModuleResource = (versions: NodePackagesVersionsReader): ModuleResource => {
  const factory = new VueAppFactory(versions);

  return moduleResource()
    .slug(vueAppSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().addProjectName().addServerPort().build())
    .apiDoc('Frontend', 'Ajoute une application Vue.js avec Vite')
    .dependsOn('typescript')
    .tags('webapp')
    .factory((properties) => factory.buildModule(properties));
};
