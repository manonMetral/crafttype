import { moduleBuilder } from '../module/domain/CraftModule.js';
import { ModulePropertiesDefinition } from '../module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../module/domain/ModuleResource.js';

/** Test modules that carry their own properties, without touching the real catalog. */
export const databaseModuleResources: readonly ModuleResource[] = [
  moduleResource()
    .slug('database')
    .propertiesDefinition(
      ModulePropertiesDefinition.builder()
        .addString('databaseName', { description: 'Database name', mandatory: true })
        .addNumber('poolSize', {
          description: 'Connection pool size',
          defaultValue: 10,
          validate: (size) => (Number(size) >= 1 ? undefined : 'the size must be at least 1'),
        })
        .addBoolean('migrations', { description: 'Enables migrations', defaultValue: true })
        .build(),
    )
    .apiDoc('Data', 'Configures the database')
    .standalone()
    .tags('database')
    .factory((properties) => {
      const builder = moduleBuilder(properties).addScript(
        'db:info',
        `echo ${properties.string('databaseName')}:${properties.number('poolSize')}`,
      );
      return properties.boolean('migrations')
        ? builder.addScript('db:migrate', 'echo migrate').build()
        : builder.build();
    }),
  moduleResource()
    .slug('database-seed')
    .propertiesDefinition(
      ModulePropertiesDefinition.builder()
        .addString('databaseName', { description: 'Database name', mandatory: true })
        .build(),
    )
    .apiDoc('Data', 'Loads a dataset')
    .dependsOn('database')
    .tags('database')
    .factory((properties) =>
      moduleBuilder(properties)
        .addScript('db:seed', `echo seed ${properties.string('databaseName')}`)
        .build(),
    ),
];
