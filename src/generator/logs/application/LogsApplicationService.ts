import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { CraftModule } from '../../../shared/module/domain/CraftModule.js';
import { LogsFactory } from '../domain/LogsFactory.js';

export class LogsApplicationService {
  private readonly factory: LogsFactory;

  constructor() {
    this.factory = new LogsFactory();
  }

  buildModule(properties: ModuleProperties): CraftModule {
    return this.factory.buildModule(properties);
  }
}
