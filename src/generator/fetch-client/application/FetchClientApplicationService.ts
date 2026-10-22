import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { CraftModule } from '../../../shared/module/domain/CraftModule.js';
import { FetchClientFactory } from '../domain/FetchClientFactory.js';

export class FetchClientApplicationService {
  private readonly factory = new FetchClientFactory();

  buildModule(properties: ModuleProperties): CraftModule {
    return this.factory.buildModule(properties);
  }
}
