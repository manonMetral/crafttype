import { isAbsolute } from 'node:path';
import type {
  ApplyResult,
  BasketPreview,
  BasketRequest,
  BasketStep,
  ModulesApplicationService,
} from '../../../application/ModulesApplicationService.js';
import { describeDecided, type ConflictPolicy, type DecidedChange } from '../../../domain/ChangePlan.js';
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
    case '/api/basket/apply':
      return { methods: ['POST'], handle: ({ body }) => apply(service, defaultProjectFolder, body) };
    default:
      return undefined;
  }
};

const ABSOLUTE_FOLDER = 'the folder must be an absolute path';

const catalog = (service: ModulesApplicationService) => ({
  modules: service.list().map(({ slug, apiDoc, dependsOn, requires, provides, tags, propertiesDefinition }) => ({
    slug,
    group: apiDoc.group,
    description: apiDoc.operation,
    dependsOn,
    requires,
    provides,
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

type BasketRead =
  { readonly ok: true; readonly basket: BasketRequest } | { readonly ok: false; readonly response: ApiResponse };

/** The basket the body describes, or the answer that says what is wrong with it. */
const readBasket = (defaultProjectFolder: string, body: unknown): BasketRead => {
  const refuse = (error: string): BasketRead => ({ ok: false, response: badRequest(error) });
  if (!isRecord(body)) {
    return refuse('the body must be a JSON object');
  }
  const { modules, properties = {}, onConflict = 'fail', projectFolder = defaultProjectFolder } = body;
  if (!Array.isArray(modules) || modules.length === 0 || !modules.every((slug) => typeof slug === 'string')) {
    return refuse('"modules" must be a non-empty list of module names');
  }
  if (!isRecord(properties) || !Object.values(properties).every(isPropertyValue)) {
    return refuse('"properties" must be an object of texts, numbers and booleans');
  }
  if (!POLICIES.includes(onConflict as ConflictPolicy)) {
    return refuse('"onConflict" must be "fail", "skip" or "overwrite"');
  }
  if (typeof projectFolder !== 'string' || !isAbsolute(projectFolder)) {
    return refuse(ABSOLUTE_FOLDER);
  }
  return {
    ok: true,
    basket: {
      projectFolder,
      modules,
      properties: properties as Record<string, PropertyValue>,
      onConflict: onConflict as ConflictPolicy,
    },
  };
};

/** Plays the basket on a copy of the project: nothing is written, whatever the answer. */
const preview = (service: ModulesApplicationService, defaultProjectFolder: string, body: unknown): ApiResponse => {
  const read = readBasket(defaultProjectFolder, body);
  return read.ok ? { status: 200, body: describePreview(service.previewBasket(read.basket)) } : read.response;
};

/**
 * Writes the basket to the project. A basket that cannot apply is not an error of the request: it is answered like
 * the preview, with `outcome: "refused"`, and nothing is written.
 */
const apply = (service: ModulesApplicationService, defaultProjectFolder: string, body: unknown): ApiResponse => {
  const read = readBasket(defaultProjectFolder, body);
  if (!read.ok) {
    return read.response;
  }
  const result = service.applyBasket(read.basket);
  return {
    status: 200,
    body:
      result.outcome === 'applied'
        ? { outcome: result.outcome, projectFolder: result.projectFolder, steps: result.steps.map(describeApplied) }
        : { outcome: result.outcome, preview: describePreview(result.preview) },
  };
};

const describePreview = (preview: BasketPreview) => ({ ...preview, steps: preview.steps.map(describeStep) });

/** The decisions, not the content of the files: the page shows what changes, the files can be big. */
const describeStep = (step: BasketStep) =>
  step.outcome === 'ready' || step.outcome === 'conflict'
    ? {
        slug: step.slug,
        outcome: step.outcome,
        report: step.report,
        warnings: step.warnings,
        changes: describeChanges(step.changes),
      }
    : step;

const describeApplied = ({ slug, report, warnings, changes }: ApplyResult) => ({
  slug,
  report,
  warnings,
  changes: describeChanges(changes),
});

const describeChanges = (changes: readonly DecidedChange[]) =>
  changes.map((change) => ({
    kind: change.kind,
    target: change.target,
    decision: change.decision,
    description: describeDecided(change),
  }));
