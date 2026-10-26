import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('auth');
const SERVER = 'src/server';
const AUTH = `${SERVER}/auth`;

export class AuthFactory {
  /** JWT authentication routes and a bearer middleware wired into `buildApp`. */
  buildModule(properties: ModuleProperties): CraftModule {
    return moduleBuilder(properties)
      .addFile(SOURCE.file('jwt.ts'), `${AUTH}/jwt.ts`)
      .addFile(SOURCE.file('jwt.test.ts'), `${AUTH}/jwt.test.ts`)
      .addFile(SOURCE.file('authentication.ts'), `${AUTH}/authentication.ts`)
      .addFile(SOURCE.file('authRoutes.ts'), `${AUTH}/authRoutes.ts`)
      .addFile(SOURCE.file('authRoutes.test.ts'), `${AUTH}/authRoutes.test.ts`)
      .insertAtNeedle(`${SERVER}/app.ts`, 'app-imports', "import { registerAuthRoutes } from './auth/authRoutes.js';")
      .insertAtNeedle(`${SERVER}/app.ts`, 'app-routes', 'registerAuthRoutes(app);')
      .build();
  }
}
