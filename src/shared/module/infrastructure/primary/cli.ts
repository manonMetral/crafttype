import { parseArgs } from 'node:util';
import type { ApplyResult, ModulesApplicationService } from '../../application/ModulesApplicationService.js';
import { describeConflict, describeChange, type ConflictPolicy, type DecidedChange } from '../../domain/ChangePlan.js';
import {
  CraftTypeError,
  InvalidPropertyError,
  MissingPropertyError,
  ModuleConflictError,
} from '../../domain/errors.js';
import type { ModulePropertiesDefinition, PropertyDefinition, PropertyValue } from '../../domain/ModuleProperties.js';
import { describeSystemError, isSystemError } from './systemErrors.js';

const USAGE = `Usage:
  crafttype list
  crafttype apply <module> --project-folder <folder> [--<property> <value> ...]
                  [--force | --skip-conflicts] [--dry-run]
  crafttype apply <module> --help
  crafttype --help

The module comes right after "apply". The properties it accepts (project name, port...) are listed by --help.

A module never replaces a file or a package.json entry whose content differs: by default it refuses.
  --force           replaces the existing items that differ
  --skip-conflicts  applies the module and keeps the existing items that differ
  --dry-run         prints what the module would do, without writing anything`;

/** Primary adapter: translates the command line into calls to the application service. */
export const runCli = (
  argv: readonly string[],
  service: ModulesApplicationService,
  out: (line: string) => void,
): number => {
  const [command, ...rest] = argv;

  try {
    switch (command) {
      case 'list':
        for (const { slug, apiDoc, dependsOn } of service.list()) {
          const requires = dependsOn.length > 0 ? ` (after: ${dependsOn.join(', ')})` : '';
          out(`${slug.padEnd(16)} ${apiDoc.operation}${requires}`);
        }
        return 0;
      case 'apply':
        return apply(rest, service, out);
      case undefined:
      case 'help':
      case '--help':
      case '-h':
        out(USAGE);
        return 0;
      default:
        out(USAGE);
        return 1;
    }
  } catch (error) {
    if (error instanceof CraftTypeError) {
      out(`Error: ${describe(error)}`);
      return 1;
    }
    if (isUsageError(error)) {
      out(`Error: ${describeUsageError(error)}`);
      out(USAGE);
      return 1;
    }
    if (isSystemError(error)) {
      out(`Error: ${describeSystemError(error)}`);
      return 1;
    }
    throw error;
  }
};

const COMMON_OPTIONS = {
  'project-folder': { type: 'string' },
  force: { type: 'boolean' },
  'skip-conflicts': { type: 'boolean' },
  'dry-run': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const;

const apply = (args: readonly string[], service: ModulesApplicationService, out: (line: string) => void): number => {
  const [slug, ...options] = args;
  if (slug === '--help' || slug === '-h') {
    out(USAGE);
    return 0;
  }
  if (slug === undefined || slug.startsWith('-')) {
    out(USAGE);
    return 1;
  }

  const definition = service.find(slug).propertiesDefinition;
  const { values } = parseArgs({
    args: options,
    allowPositionals: false,
    allowNegative: true,
    options: {
      ...COMMON_OPTIONS,
      ...Object.fromEntries(
        definition.custom.map(({ key, type }) => [
          toOption(key),
          { type: type === 'boolean' ? 'boolean' : 'string' } as const,
        ]),
      ),
    },
  });

  if (values.help === true) {
    describeModule(slug, service, definition, out);
    return 0;
  }

  const parsed: Readonly<Record<string, string | boolean | undefined>> = values;
  const raw: Record<string, PropertyValue> = {};
  if (values['project-folder'] !== undefined) raw['projectFolder'] = values['project-folder'];
  for (const { key } of definition.custom) {
    const value = parsed[toOption(key)];
    if (value !== undefined) raw[key] = value;
  }

  if (values.force === true && values['skip-conflicts'] === true) {
    out('Error: --force and --skip-conflicts are incompatible');
    out(USAGE);
    return 1;
  }
  const onConflict: ConflictPolicy =
    values.force === true ? 'overwrite' : values['skip-conflicts'] === true ? 'skip' : 'fail';

  const result = service.apply(slug, raw, { onConflict, dryRun: values['dry-run'] === true });
  return report(result, String(raw['projectFolder']), out);
};

const describeModule = (
  slug: string,
  service: ModulesApplicationService,
  definition: ModulePropertiesDefinition,
  out: (line: string) => void,
): void => {
  out(`Module ${slug}: ${service.find(slug).apiDoc.operation}`);
  out('Options:');
  const lines = definition.properties.map(
    (property) => [`--${toOption(property.key)} ${valueHint(property)}`.trimEnd(), summary(property)] as const,
  );
  const width = Math.max(...lines.map(([flag]) => flag.length));
  for (const [flag, text] of lines) {
    out(`  ${flag.padEnd(width)}  ${text}`);
  }
};

const valueHint = ({ type }: PropertyDefinition): string =>
  type === 'boolean' ? '' : type === 'number' ? '<number>' : '<text>';

const summary = ({ mandatory, defaultValue, description }: PropertyDefinition): string => {
  const constraint = mandatory
    ? '(required) '
    : typeof defaultValue === 'function' || defaultValue === undefined
      ? ''
      : `(default: ${String(defaultValue)}) `;
  return `${constraint}${description}`;
};

const LABELS: Record<DecidedChange['decision'], string> = {
  create: 'create',
  edit: 'modify',
  unchanged: 'unchanged',
  keep: 'keep',
  overwrite: 'replace',
  skip: 'skip',
  conflict: 'conflict',
};

const report = (result: ApplyResult, projectFolder: string, out: (line: string) => void): number => {
  const { slug, dryRun, changes, report: counts } = result;
  const kept = counts.kept > 0 ? `, kept versions: ${counts.kept}` : '';
  const edited = counts.edited > 0 ? `, modified: ${counts.edited}` : '';
  const summary =
    `created: ${counts.created}${edited}, replaced: ${counts.replaced}, ` +
    `unchanged: ${counts.unchanged}, skipped: ${counts.skipped}${kept}`;

  if (dryRun) {
    out(`Dry run of module ${slug} in ${projectFolder} (nothing is written):`);
    for (const change of changes) {
      out(
        `  ${LABELS[change.decision].padEnd(10)} ${hasConflictingContent(change) ? describeConflict(change) : describeChange(change)}`,
      );
    }
    out(counts.conflicts > 0 ? `${summary}, conflicts: ${counts.conflicts}\n${CONFLICT_HINT}` : summary);
    return counts.conflicts > 0 ? 1 : 0;
  }

  out(`Module ${slug} applied in ${projectFolder} (${summary})`);
  for (const change of changes.filter(
    ({ decision }) => decision === 'edit' || decision === 'overwrite' || decision === 'skip',
  )) {
    const label = { edit: 'modified', overwrite: 'replaced', skip: 'skipped' }[
      change.decision as 'edit' | 'overwrite' | 'skip'
    ];
    out(`  ${label}: ${describeConflict(change)}`);
  }
  return 0;
};

const hasConflictingContent = ({ decision }: DecidedChange): boolean =>
  decision === 'conflict' || decision === 'overwrite' || decision === 'skip' || decision === 'keep';

const CONFLICT_HINT = 'Run again with --skip-conflicts to keep the existing items or --force to replace them.';

/** Names business errors with command line options rather than internal keys. */
const describe = (error: CraftTypeError): string => {
  if (error instanceof MissingPropertyError) {
    return `Missing required option: ${toFlag(error.key)}`;
  }
  if (error instanceof InvalidPropertyError) {
    return `Invalid option ${toFlag(error.key)}: ${error.reason}`;
  }
  if (error instanceof ModuleConflictError) {
    return `${error.message}\n${CONFLICT_HINT}`;
  }
  return error.message;
};

const toOption = (key: string): string => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const toFlag = (key: string): string => `--${toOption(key)}`;

/** `parseArgs` errors: unknown option, missing value... */
const isUsageError = (error: unknown): error is TypeError & { code: string } =>
  error instanceof TypeError &&
  'code' in error &&
  typeof error.code === 'string' &&
  error.code.startsWith('ERR_PARSE_ARGS_');

const describeUsageError = (error: TypeError & { code: string }): string => {
  const option = /'(--?[^']+)'/.exec(error.message)?.[1];
  switch (error.code) {
    case 'ERR_PARSE_ARGS_UNKNOWN_OPTION':
      return `unknown option: ${option ?? '?'}`;
    case 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE':
      return `missing or invalid value for option ${option ?? '?'}`;
    default:
      return error.message.split('\n')[0] ?? error.message;
  }
};
