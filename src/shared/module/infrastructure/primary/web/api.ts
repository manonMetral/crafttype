import { isAbsolute } from 'node:path';
import type { BasketStep, ModulesApplicationService } from '../../../application/ModulesApplicationService.js';
import { describeDecided, type ConflictPolicy } from '../../../domain/ChangePlan.js';
import type { PropertyValue } from '../../../domain/ModuleProperties.js';

export interface ApiResponse {
  readonly status: number;
  readonly body: unknown;
  /** More headers than the ones every answer has. */
  readonly headers?: Readonly<Record<string, string>>;
}

/** What a route receives: the target, and the body read as JSON by the server (`undefined` for a method without body). */
export interface ApiRequest {
  readonly url: URL;
  readonly body: unknown;
}

export interface ApiRoute {
  /** The methods the route answers to, for the server to refuse the others. */
  readonly methods: readonly string[];
  handle(request: ApiRequest): ApiResponse;
}

/**
 * Routes of the API, as plain data: no function of the domain (factory, validation, computed default) is sent, since
 * the page could not run it. `undefined` means that the route does not exist.
 */
export const apiRoute = (
  service: ModulesApplicationService,
  defaultProjectFolder: string,
  pathname: string,
): ApiRoute | undefined => {
  switch (pathname) {
    case '/api/modules':
      return { methods: ['GET'], handle: () => ({ status: 200, body: catalog(service) }) };
    case '/api/project':
      return {
        methods: ['GET'],
        handle: ({ url }) => project(service, url.searchParams.get('folder') ?? defaultProjectFolder),
      };
    case '/api/basket/preview':
      return { methods: ['POST'], handle: ({ body }) => preview(service, defaultProjectFolder, body) };
    default:
      return undefined;
  }
};

const ABSOLUTE_FOLDER = 'the folder must be an absolute path';

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
    return badRequest(ABSOLUTE_FOLDER);
  }
  const { projectFolder, applied, presets } = service.projectState(folder);
  return {
    status: 200,
    body: { projectFolder, applied: applied.map(({ slug, appliedAt }) => ({ slug, appliedAt })), presets },
  };
};

const POLICIES: readonly ConflictPolicy[] = ['fail', 'skip', 'overwrite'];

const badRequest = (error: string): ApiResponse => ({ status: 400, body: { error } });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPropertyValue = (value: unknown): value is PropertyValue =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

/** Plays the basket on a copy of the project: nothing is written, whatever the answer. */
const preview = (service: ModulesApplicationService, defaultProjectFolder: string, body: unknown): ApiResponse => {
  if (!isRecord(body)) {
    return badRequest('the body must be a JSON object');
  }
  const { modules, properties = {}, onConflict = 'fail', projectFolder = defaultProjectFolder } = body;
  if (!Array.isArray(modules) || modules.length === 0 || !modules.every((slug) => typeof slug === 'string')) {
    return badRequest('"modules" must be a non-empty list of module names');
  }
  if (!isRecord(properties) || !Object.values(properties).every(isPropertyValue)) {
    return badRequest('"properties" must be an object of texts, numbers and booleans');
  }
  if (!POLICIES.includes(onConflict as ConflictPolicy)) {
    return badRequest('"onConflict" must be "fail", "skip" or "overwrite"');
  }
  if (typeof projectFolder !== 'string' || !isAbsolute(projectFolder)) {
    return badRequest(ABSOLUTE_FOLDER);
  }

  const result = service.previewBasket({
    projectFolder,
    modules,
    properties: properties as Record<string, PropertyValue>,
    onConflict: onConflict as ConflictPolicy,
  });
  return { status: 200, body: { ...result, steps: result.steps.map(describeStep) } };
};

/** The decisions, not the content of the files: the page shows what changes, the files can be big. */
const describeStep = (step: BasketStep) =>
  step.outcome === 'ready' || step.outcome === 'conflict'
    ? {
        slug: step.slug,
        outcome: step.outcome,
        report: step.report,
        warnings: step.warnings,
        changes: step.changes.map((change) => ({
          kind: change.kind,
          target: change.target,
          decision: change.decision,
          description: describeDecided(change),
        })),
      }
    : step;
