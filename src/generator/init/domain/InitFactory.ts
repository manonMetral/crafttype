import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('init');

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
      .setPackageJsonField('engines', { node: '>=22.12' })
      .build();
  }
}
