import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import { LogsApplicationService } from '../../application/LogsApplicationService.js';

export const logsSlug = 'logs';

export const createLogsModuleResource = (): ModuleResource => {
  const modules = new LogsApplicationService();

  return moduleResource()
    .slug(logsSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().build())
    .apiDoc('Server', 'Adds structured logs (level from LOG_LEVEL, validated request id)')
    .dependsOn('fastify-server')
    .tags('server', 'logging')
    .factory((properties) => modules.buildModule(properties));
};
