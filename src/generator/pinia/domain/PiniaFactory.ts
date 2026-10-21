import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { NodePackagesVersionsReader } from '../../../shared/module/domain/PackageVersions.js';
import { moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

// Fichier et repères posés par le module vue-app (resources/generator/vue-app/main.ts).
const MAIN = 'src/webapp/main.ts';

export class PiniaFactory {
  constructor(private readonly versions: NodePackagesVersionsReader) {}

  buildModule(properties: ModuleProperties): CraftModule {
    return moduleBuilder(properties)
      .addDependency('pinia', this.versions.get('vue'))
      .insertAtNeedle(MAIN, 'main-imports', "import { createPinia } from 'pinia';")
      .insertAtNeedle(MAIN, 'main-plugins', 'app.use(createPinia());')
      .build();
  }
}
