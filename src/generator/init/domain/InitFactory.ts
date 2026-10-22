import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('init');

/**
 * Node versions the generated project supports: the dependency tree of `vue-router` (through `ast-walker-scope` and
 * `@babel/*` 8) requires Node 22.18 or 24.11, and the project warns (EBADENGINE) on older ones. The 24 line is listed
 * explicitly: `^22.18.0` alone would reject Node 24.
 */
export const GENERATED_NODE_RANGE = '^22.18.0 || >=24.11.0';

export class InitFactory {
  buildModule(properties: ModuleProperties): CraftModule {
    return moduleBuilder(properties)
      .addFile(SOURCE.template('gitignore'), '.gitignore')
      .addFile(SOURCE.template('editorconfig'), '.editorconfig')
      .addFile(SOURCE.template('README.md'), 'README.md')
      .setPackageJsonField('name', properties.string('projectName'))
      .setPackageJsonField('version', '0.0.1')
      .setPackageJsonField('private', true)
      .setPackageJsonField('type', 'module')
      .setPackageJsonField('engines', { node: GENERATED_NODE_RANGE })
      .build();
  }
}
