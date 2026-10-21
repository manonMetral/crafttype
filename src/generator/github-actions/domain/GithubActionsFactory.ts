import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('github-actions');

export class GithubActionsFactory {
  /** A single workflow that runs the scripts the other modules add, skipping the ones that are not there. */
  buildModule(properties: ModuleProperties): CraftModule {
    return moduleBuilder(properties).addFile(SOURCE.file('ci.yml'), '.github/workflows/ci.yml').build();
  }
}
