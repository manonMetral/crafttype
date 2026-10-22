import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { NodePackagesVersionsReader } from '../../../shared/module/domain/PackageVersions.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('hexagonal-back');
const SERVER = 'src/server';

/** The files of the `greeting` example, laid out as `<context>/<layer>/...`. */
const GREETING_FILES = [
  'greeting/domain/Greeting.ts',
  'greeting/domain/Greeting.test.ts',
  'greeting/domain/GreetingCounter.ts',
  'greeting/domain/InvalidGreetingNameError.ts',
  'greeting/application/GreetingApplicationService.ts',
  'greeting/application/GreetingApplicationService.test.ts',
  'greeting/infrastructure/primary/greetingRoutes.ts',
  'greeting/infrastructure/primary/greetingRoutes.test.ts',
  'greeting/infrastructure/secondary/InMemoryGreetingCounter.ts',
  'greeting/infrastructure/secondary/InMemoryGreetingCounter.test.ts',
] as const;

export class HexagonalBackFactory {
  constructor(private readonly versions: NodePackagesVersionsReader) {}

  /**
   * An example context, its composition root and an architecture test. The route is registered through the
   * `app-imports` and `app-plugins` needles of fastify-server, inside a Fastify plugin.
   */
  buildModule(properties: ModuleProperties): CraftModule {
    const builder = moduleBuilder(properties)
      .addFile(SOURCE.file('composition.ts'), `${SERVER}/composition.ts`)
      .addFile(SOURCE.file('architecture.test.ts'), `${SERVER}/architecture.test.ts`)
      .addFile(SOURCE.file('ARCHITECTURE.md'), `${SERVER}/ARCHITECTURE.md`);

    for (const path of GREETING_FILES) {
      builder.addFile(SOURCE.file(path), `${SERVER}/${path}`);
    }

    return builder
      .addDevDependency('arch-unit-ts', this.versions.get())
      .insertAtNeedle(`${SERVER}/app.ts`, 'app-imports', "import { registerContexts } from './composition.js';")
      .insertAtNeedle(`${SERVER}/app.ts`, 'app-plugins', 'registerContexts(app);')
      .build();
  }
}
