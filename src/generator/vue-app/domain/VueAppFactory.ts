import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { NodePackagesVersionsReader } from '../../../shared/module/domain/PackageVersions.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('vue-app');
const WEBAPP = 'src/webapp';

export class VueAppFactory {
  constructor(private readonly versions: NodePackagesVersionsReader) {}

  buildModule(properties: ModuleProperties): CraftModule {
    const vue = this.versions.get('vue');

    return moduleBuilder(properties)
      .addFile(SOURCE.template('vite.config.ts'), 'vite.config.ts')
      .addFile(SOURCE.template('index.html'), `${WEBAPP}/index.html`)
      .addFile(SOURCE.file('main.ts'), `${WEBAPP}/main.ts`)
      .addFile(SOURCE.file('App.vue'), `${WEBAPP}/App.vue`)
      .addFile(SOURCE.file('env.d.ts'), `${WEBAPP}/env.d.ts`)
      .addFile(SOURCE.file('tsconfig.webapp.json'), 'tsconfig.webapp.json')
      .addDependency('vue', vue)
      .addDevDependency('vite', vue)
      .addDevDependency('@vitejs/plugin-vue', vue)
      .addScript('webapp:dev', 'vite')
      .addScript('webapp:build', 'vite build')
      .addScript('webapp:typecheck', 'tsc --noEmit -p tsconfig.webapp.json')
      .build();
  }
}
