import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import type { NodePackagesVersionsReader } from '../../../../shared/module/domain/PackageVersions.js';
import { DatabaseSqlApplicationService } from '../../application/DatabaseSqlApplicationService.js';

export const databaseSqlSlug = 'database-sql';

export const createDatabaseSqlModuleResource = (versions: NodePackagesVersionsReader): ModuleResource => {
  const modules = new DatabaseSqlApplicationService(versions);

  return moduleResource()
    .slug(databaseSqlSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().build())
    .apiDoc('Data', 'Adds SQL connection helpers and an example PostgreSQL repository')
    .dependsOn('persistence', 'vitest')
    .tags('backend', 'database', 'sql')
    .factory((properties) => modules.buildModule(properties));
};
