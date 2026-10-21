import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { CraftModule } from '../../../shared/module/domain/CraftModule.js';
import { GithubActionsFactory } from '../domain/GithubActionsFactory.js';

export class GithubActionsApplicationService {
  private readonly factory = new GithubActionsFactory();

  buildModule(properties: ModuleProperties): CraftModule {
    return this.factory.buildModule(properties);
  }
}
