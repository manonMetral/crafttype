import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { CraftModule } from '../../../shared/module/domain/CraftModule.js';
import { DockerFactory } from '../domain/DockerFactory.js';

export class DockerApplicationService {
  private readonly factory = new DockerFactory();

  buildModule(properties: ModuleProperties): CraftModule {
    return this.factory.buildModule(properties);
  }
}
