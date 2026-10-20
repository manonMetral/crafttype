import { describe, expect, it } from 'vitest';
import { FileSystemNodePackagesVersionsReader } from '../../../shared/module/infrastructure/secondary/FileSystemNodePackagesVersionsReader.js';
import { resourcesRoot } from '../../../shared/module/infrastructure/secondary/resourcesRoot.js';
import { assertThatModule, propertiesFixture } from '../../../shared/test/ModuleAssertions.js';
import { FastifyServerFactory } from './FastifyServerFactory.js';

describe('FastifyServerFactory', () => {
  const factory = new FastifyServerFactory(new FileSystemNodePackagesVersionsReader(resourcesRoot()));

  it('crée le serveur sur le port demandé', () => {
    const module = factory.buildModule(propertiesFixture({ serverPort: 4321 }));

    const result = assertThatModule(module)
      .hasFiles('src/server/app.ts', 'src/server/app.test.ts', 'tsconfig.build.json')
      .hasFileContaining('src/server/main.ts', '?? 4321');

    expect(result.hasPackageJson().dependencies).toHaveProperty('fastify');
    expect(result.hasPackageJson().scripts).toHaveProperty('server:dev');
  });
});
