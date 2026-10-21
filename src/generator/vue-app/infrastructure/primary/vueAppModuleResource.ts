import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import type { NodePackagesVersionsReader } from '../../../../shared/module/domain/PackageVersions.js';
import { VueAppApplicationService } from '../../application/VueAppApplicationService.js';

export const vueAppSlug = 'vue-app';

export const createVueAppModuleResource = (versions: NodePackagesVersionsReader): ModuleResource => {
  const modules = new VueAppApplicationService(versions);

  return moduleResource()
    .slug(vueAppSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().addProjectName().addServerPort().build())
    .apiDoc('Frontend', 'Adds a Vue.js application with Vite')
    .dependsOn('typescript')
    .tags('webapp')
    .factory((properties) => modules.buildModule(properties));
};
