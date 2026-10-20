import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { NodePackagesVersionsReader } from '../../../shared/module/domain/PackageVersions.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('fastify-server');
const SERVER_DESTINATION = 'src/server';

export class FastifyServerFactory {
  constructor(private readonly versions: NodePackagesVersionsReader) {}

  buildModule(properties: ModuleProperties): CraftModule {
    const common = this.versions.get();

    return moduleBuilder(properties)
      .addFile(SOURCE.template('src/app.ts'), `${SERVER_DESTINATION}/app.ts`)
      .addFile(SOURCE.template('src/main.ts'), `${SERVER_DESTINATION}/main.ts`)
      .addFile(SOURCE.template('src/app.test.ts'), `${SERVER_DESTINATION}/app.test.ts`)
      .addFile(SOURCE.template('tsconfig.build.json'), 'tsconfig.build.json')
      .addDependency('fastify', common)
      .addDevDependency('tsx', common)
      .addScript('server:dev', `tsx watch ${SERVER_DESTINATION}/main.ts`)
      .addScript('server:build', 'tsc -p tsconfig.build.json')
      .addScript('server:start', 'node dist/server/main.js')
      .build();
  }
}
