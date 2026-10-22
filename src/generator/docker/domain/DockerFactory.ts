import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('docker');

export class DockerFactory {
  /** A multi-stage image of the Fastify server: build, production dependencies, then a small runtime stage. */
  buildModule(properties: ModuleProperties): CraftModule {
    return moduleBuilder(properties)
      .addFile(SOURCE.template('Dockerfile'), 'Dockerfile')
      .addFile(SOURCE.file('dockerignore'), '.dockerignore')
      .build();
  }
}
