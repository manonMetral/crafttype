import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import type { NodePackagesVersionsReader } from '../../../../shared/module/domain/PackageVersions.js';
import { PiniaApplicationService } from '../../application/PiniaApplicationService.js';

export const piniaSlug = 'pinia';

export const createPiniaModuleResource = (versions: NodePackagesVersionsReader): ModuleResource => {
  const modules = new PiniaApplicationService(versions);

  return moduleResource()
    .slug(piniaSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().build())
    .apiDoc('Front', "Ajoute Pinia pour l'état partagé de l'application Vue")
    .dependsOn('vue-app')
    .tags('frontend', 'state')
    .factory((properties) => modules.buildModule(properties));
};
