import { moduleBuilder } from '../module/domain/CraftModule.js';
import { ModulePropertiesDefinition } from '../module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../module/domain/ModuleResource.js';

/** Modules de test qui portent leurs propres propriétés, sans toucher au catalogue réel. */
export const databaseModuleResources: readonly ModuleResource[] = [
  moduleResource()
    .slug('database')
    .propertiesDefinition(
      ModulePropertiesDefinition.builder()
        .addString('databaseName', { description: 'Nom de la base', mandatory: true })
        .addNumber('poolSize', {
          description: 'Taille du pool de connexions',
          defaultValue: 10,
          validate: (size) => (Number(size) >= 1 ? undefined : 'la taille doit valoir au moins 1'),
        })
        .addBoolean('migrations', { description: 'Active les migrations', defaultValue: true })
        .build(),
    )
    .apiDoc('Données', 'Configure la base de données')
    .standalone()
    .tags('database')
    .factory((properties) => {
      const builder = moduleBuilder(properties).addScript('db:info', `echo ${properties.string('databaseName')}:${properties.number('poolSize')}`);
      return properties.boolean('migrations') ? builder.addScript('db:migrate', 'echo migrate').build() : builder.build();
    }),
  moduleResource()
    .slug('database-seed')
    .propertiesDefinition(ModulePropertiesDefinition.builder().addString('databaseName', { description: 'Nom de la base', mandatory: true }).build())
    .apiDoc('Données', 'Charge un jeu de données')
    .dependsOn('database')
    .tags('database')
    .factory((properties) => moduleBuilder(properties).addScript('db:seed', `echo seed ${properties.string('databaseName')}`).build()),
];
