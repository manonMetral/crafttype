import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { NodePackagesVersionsReader } from '../../../shared/module/domain/PackageVersions.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('vue-router');
const WEBAPP = 'src/webapp';

export class VueRouterFactory {
  constructor(private readonly versions: NodePackagesVersionsReader) {}

  /** Wires the router into the vue-app files (`main.ts` and `App.vue`) through the needles that module placed there. */
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
