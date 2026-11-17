import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import { FetchClientApplicationService } from '../../application/FetchClientApplicationService.js';

export const fetchClientSlug = 'fetch-client';

export const createFetchClientModuleResource = (): ModuleResource => {
  const modules = new FetchClientApplicationService();

  return moduleResource()
    .slug(fetchClientSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().build())
    .apiDoc('Frontend', 'Adds a typed HTTP client (fetch) to the front-end application')
    .dependsOn('vitest')
    .requires('front')
    .tags('frontend', 'http')
    .factory((properties) => modules.buildModule(properties));
};
