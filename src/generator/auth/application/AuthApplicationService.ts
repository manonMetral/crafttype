import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { CraftModule } from '../../../shared/module/domain/CraftModule.js';
import { AuthFactory } from '../domain/AuthFactory.js';

export class AuthApplicationService {
  private readonly factory = new AuthFactory();

  buildModule(properties: ModuleProperties): CraftModule {
    return this.factory.buildModule(properties);
  }
}
