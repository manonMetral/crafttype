import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import type { NodePackagesVersionsReader } from '../../../../shared/module/domain/PackageVersions.js';
import { VueRouterApplicationService } from '../../application/VueRouterApplicationService.js';

export const vueRouterSlug = 'vue-router';

export const createVueRouterModuleResource = (versions: NodePackagesVersionsReader): ModuleResource => {
  const modules = new VueRouterApplicationService(versions);

  return moduleResource()
    .slug(vueRouterSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().build())
    .apiDoc('Frontend', 'Adds Vue Router to the Vue application')
    .dependsOn('vue-app')
    .tags('frontend', 'routing')
    .factory((properties) => modules.buildModule(properties));
};
