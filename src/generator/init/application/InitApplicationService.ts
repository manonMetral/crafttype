import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { CraftModule } from '../../../shared/module/domain/CraftModule.js';
import { InitFactory } from '../domain/InitFactory.js';

export class InitApplicationService {
  private readonly factory: InitFactory;

  constructor() {
    this.factory = new InitFactory();
  }

  buildModule(properties: ModuleProperties): CraftModule {
    return this.factory.buildModule(properties);
  }
}
