import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { NodePackagesVersionsReader } from '../../../shared/module/domain/PackageVersions.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('openapi');
const SERVER = 'src/server';

export class OpenapiFactory {
  constructor(private readonly versions: NodePackagesVersionsReader) {}

  /**
   * Describes the routes of `buildApp` through the `app-imports` and `app-plugins` needles of fastify-server. The
   * `app-plugins` needle is above the routes, which the plugin needs: it collects the routes declared after it.
   */
  buildModule(properties: ModuleProperties): CraftModule {
    const common = this.versions.get();

    return moduleBuilder(properties)
      .addFile(SOURCE.file('openapi.ts'), `${SERVER}/openapi.ts`)
      .addFile(SOURCE.file('openapi.test.ts'), `${SERVER}/openapi.test.ts`)
      .addDependency('@fastify/swagger', common)
      .addDependency('@fastify/swagger-ui', common)
      .insertAtNeedle(`${SERVER}/app.ts`, 'app-imports', "import { registerOpenApi } from './openapi.js';")
      .insertAtNeedle(`${SERVER}/app.ts`, 'app-plugins', 'registerOpenApi(app);')
      .build();
  }
}
