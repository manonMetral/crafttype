import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import { GithubActionsApplicationService } from '../../application/GithubActionsApplicationService.js';

export const githubActionsSlug = 'github-actions';

export const createGithubActionsModuleResource = (): ModuleResource => {
  const modules = new GithubActionsApplicationService();

  return moduleResource()
    .slug(githubActionsSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().build())
    .apiDoc('CI', 'Adds a GitHub Actions workflow (format, typecheck, tests, builds)')
    .dependsOn('typescript', 'vitest')
    .tags('ci', 'github')
    .factory((properties) => modules.buildModule(properties));
};
