import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { CraftModule } from '../../../shared/module/domain/CraftModule.js';
import { ConfigFactory } from '../domain/ConfigFactory.js';

export class ConfigApplicationService {
  private readonly factory: ConfigFactory;

  constructor() {
    this.factory = new ConfigFactory();
  }

  buildModule(properties: ModuleProperties): CraftModule {
    return this.factory.buildModule(properties);
  }
}
