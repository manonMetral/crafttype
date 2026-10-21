import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { NodePackagesVersionsReader } from '../../../shared/module/domain/PackageVersions.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('vue-router');
const WEBAPP = 'src/webapp';

export class VueRouterFactory {
  constructor(private readonly versions: NodePackagesVersionsReader) {}

  /** Branche le routeur dans les fichiers de vue-app (`main.ts` et `App.vue`) par les repères que ce module y a posés. */
  buildModule(properties: ModuleProperties): CraftModule {
    return moduleBuilder(properties)
      .addFile(SOURCE.file('router.ts'), `${WEBAPP}/router.ts`)
      .addFile(SOURCE.file('HomeView.vue'), `${WEBAPP}/views/HomeView.vue`)
      .addDependency('vue-router', this.versions.get('vue'))
      .insertAtNeedle(`${WEBAPP}/main.ts`, 'main-imports', "import { router } from './router.js';")
      .insertAtNeedle(`${WEBAPP}/main.ts`, 'main-plugins', 'app.use(router);')
      .insertAtNeedle(`${WEBAPP}/App.vue`, 'app-template', '<RouterView />')
      .build();
  }
}
