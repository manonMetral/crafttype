import { allModuleResources } from './generator/modules.js';
import type { ModuleResource } from './shared/module/domain/ModuleResource.js';
import { ModulesApplicationService } from './shared/module/application/ModulesApplicationService.js';
import { FileSystemModulesHistory } from './shared/module/infrastructure/secondary/FileSystemModulesHistory.js';
import { FileSystemModuleResourcesReader } from './shared/module/infrastructure/secondary/FileSystemModuleResourcesReader.js';
import { FileSystemNodePackagesVersionsReader } from './shared/module/infrastructure/secondary/FileSystemNodePackagesVersionsReader.js';
import { FileSystemProjectFiles } from './shared/module/infrastructure/secondary/FileSystemProjectFiles.js';
import { NodePathNormalizer } from './shared/module/infrastructure/secondary/NodePathNormalizer.js';
import { MustacheTemplateRenderer } from './shared/module/infrastructure/secondary/MustacheTemplateRenderer.js';
import { SemverVersionComparator } from './shared/module/infrastructure/secondary/SemverVersionComparator.js';
import { resourcesRoot } from './shared/module/infrastructure/secondary/resourcesRoot.js';

/**
 * Composition root: the only place that knows both the domain and the adapters.
 * `extraResources` adds modules to the catalog (extensions, tests).
 */
export const createModulesApplicationService = (
  options: { clock?: () => Date; extraResources?: readonly ModuleResource[] } = {},
): ModulesApplicationService => {
  const root = resourcesRoot();
  const files = new FileSystemProjectFiles();

  return new ModulesApplicationService({
    resources: [
      ...allModuleResources(new FileSystemNodePackagesVersionsReader(root)),
      ...(options.extraResources ?? []),
    ],
    files,
    resourcesReader: new FileSystemModuleResourcesReader(root),
    renderer: new MustacheTemplateRenderer(),
    history: new FileSystemModulesHistory(files),
    versions: new SemverVersionComparator(),
    paths: new NodePathNormalizer(),
    clock: options.clock ?? (() => new Date()),
  });
};
