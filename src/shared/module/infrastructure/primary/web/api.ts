import { isAbsolute } from 'node:path';
import type { ModulesApplicationService } from '../../../application/ModulesApplicationService.js';

export interface ApiResponse {
  readonly status: number;
  readonly body: unknown;
}

/**
 * Routes of the read-only API, as plain data: no function of the domain (factory, validation, computed default) is
 * sent, since the page could not run it. `undefined` means that the route does not exist.
 */
export const handleApi = (
  service: ModulesApplicationService,
  defaultProjectFolder: string,
  { pathname, searchParams }: URL,
): ApiResponse | undefined => {
  switch (pathname) {
    case '/api/modules':
      return { status: 200, body: catalog(service) };
    case '/api/project':
      return project(service, searchParams.get('folder') ?? defaultProjectFolder);
    default:
      return undefined;
  }
};

const catalog = (service: ModulesApplicationService) => ({
  modules: service.list().map(({ slug, apiDoc, dependsOn, tags, propertiesDefinition }) => ({
    slug,
    group: apiDoc.group,
    description: apiDoc.operation,
    dependsOn,
    tags,
    properties: propertiesDefinition.custom.map(({ key, type, mandatory, description }) => ({
      key,
      type,
      mandatory,
      description,
    })),
  })),
});

const project = (service: ModulesApplicationService, folder: string): ApiResponse => {
  if (!isAbsolute(folder)) {
    return { status: 400, body: { error: 'the folder must be an absolute path' } };
  }
  const { projectFolder, applied, presets } = service.projectState(folder);
  return {
    status: 200,
    body: { projectFolder, applied: applied.map(({ slug, appliedAt }) => ({ slug, appliedAt })), presets },
  };
};
