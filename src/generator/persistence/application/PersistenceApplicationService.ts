import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { CraftModule } from '../../../shared/module/domain/CraftModule.js';
import { PersistenceFactory } from '../domain/PersistenceFactory.js';

export class PersistenceApplicationService {
  private readonly factory = new PersistenceFactory();

  buildModule(properties: ModuleProperties): CraftModule {
    return this.factory.buildModule(properties);
  }
}
