import { parseArgs } from 'node:util';
import type { ApplyResult, ModulesApplicationService } from '../../application/ModulesApplicationService.js';
import { describeConflict, describeChange, type ConflictPolicy, type DecidedChange } from '../../domain/ChangePlan.js';
import { CraftTypeError, InvalidPropertyError, MissingPropertyError, ModuleConflictError } from '../../domain/errors.js';
import type { ModulePropertiesDefinition, PropertyDefinition, PropertyValue } from '../../domain/ModuleProperties.js';

const USAGE = `Usage :
  crafttype list
  crafttype apply <module> --project-folder <dossier> [--<propriété> <valeur> ...]
                  [--force | --skip-conflicts] [--dry-run]
  crafttype apply <module> --help

Le module vient juste après « apply ». Les propriétés qu'il accepte (nom du projet, port...) sont listées par --help.

Un module ne remplace jamais un fichier ou une entrée du package.json dont le contenu diffère : par défaut il refuse.
  --force           remplace les éléments existants qui diffèrent
  --skip-conflicts  applique le module en gardant les éléments existants qui diffèrent
  --dry-run         affiche ce que le module ferait, sans rien écrire`;

/** Adaptateur primaire : traduit la ligne de commande en appels au service d'application. */
export const runCli = (argv: readonly string[], service: ModulesApplicationService, out: (line: string) => void): number => {
  const [command, ...rest] = argv;

  try {
    switch (command) {
      case 'list':
        for (const { slug, apiDoc, dependsOn } of service.list()) {
          const requires = dependsOn.length > 0 ? ` (après : ${dependsOn.join(', ')})` : '';
          out(`${slug.padEnd(16)} ${apiDoc.operation}${requires}`);
        }
        return 0;
      case 'apply':
        return apply(rest, service, out);
      default:
        out(USAGE);
        return command === undefined || command === 'help' ? 0 : 1;
    }
  } catch (error) {
    if (error instanceof CraftTypeError) {
      out(`Erreur : ${describe(error)}`);
      return 1;
    }
    if (isUsageError(error)) {
      out(`Erreur : ${describeUsageError(error)}`);
      out(USAGE);
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
  help: { type: 'boolean' },
} as const;

const apply = (args: readonly string[], service: ModulesApplicationService, out: (line: string) => void): number => {
  const [slug, ...options] = args;
  if (slug === undefined || slug.startsWith('-')) {
    out(USAGE);
    return 1;
  }

  const definition = service.find(slug).propertiesDefinition;
  const { values } = parseArgs({
    args: options,
    allowPositionals: false,
    allowNegative: true,
    options: { ...COMMON_OPTIONS, ...Object.fromEntries(definition.custom.map(({ key, type }) => [toOption(key), { type: type === 'boolean' ? 'boolean' : 'string' } as const])) },
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
    out('Erreur : --force et --skip-conflicts sont incompatibles');
    out(USAGE);
    return 1;
  }
  const onConflict: ConflictPolicy = values.force === true ? 'overwrite' : values['skip-conflicts'] === true ? 'skip' : 'fail';

  const result = service.apply(slug, raw, { onConflict, dryRun: values['dry-run'] === true });
  return report(result, String(raw['projectFolder']), out);
};

const describeModule = (slug: string, service: ModulesApplicationService, definition: ModulePropertiesDefinition, out: (line: string) => void): void => {
  out(`Module ${slug} : ${service.find(slug).apiDoc.operation}`);
  out('Options :');
  const lines = definition.properties.map((property) => [`--${toOption(property.key)} ${valueHint(property)}`.trimEnd(), summary(property)] as const);
  const width = Math.max(...lines.map(([flag]) => flag.length));
  for (const [flag, text] of lines) {
    out(`  ${flag.padEnd(width)}  ${text}`);
  }
};

const valueHint = ({ type }: PropertyDefinition): string => (type === 'boolean' ? '' : type === 'number' ? '<nombre>' : '<texte>');

const summary = ({ mandatory, defaultValue, description }: PropertyDefinition): string => {
  const constraint = mandatory ? '(obligatoire) ' : typeof defaultValue === 'function' || defaultValue === undefined ? '' : `(défaut : ${String(defaultValue)}) `;
  return `${constraint}${description}`;
};

const LABELS: Record<DecidedChange['decision'], string> = {
  create: 'créer',
  unchanged: 'inchangé',
  keep: 'conserver',
  overwrite: 'remplacer',
  skip: 'ignorer',
  conflict: 'conflit',
};

const report = (result: ApplyResult, projectFolder: string, out: (line: string) => void): number => {
  const { slug, dryRun, changes, report: counts } = result;
  const kept = counts.kept > 0 ? `, versions conservées : ${counts.kept}` : '';
  const summary = `créés : ${counts.created}, remplacés : ${counts.replaced}, inchangés : ${counts.unchanged}, ignorés : ${counts.skipped}${kept}`;

  if (dryRun) {
    out(`Simulation du module ${slug} dans ${projectFolder} (rien n'est écrit) :`);
    for (const change of changes) {
      out(`  ${LABELS[change.decision].padEnd(10)} ${hasConflictingContent(change) ? describeConflict(change) : describeChange(change)}`);
    }
    out(counts.conflicts > 0 ? `${summary}, conflits : ${counts.conflicts}\n${CONFLICT_HINT}` : summary);
    return counts.conflicts > 0 ? 1 : 0;
  }

  out(`Module ${slug} appliqué dans ${projectFolder} (${summary})`);
  for (const change of changes.filter(({ decision }) => decision === 'overwrite' || decision === 'skip')) {
    out(`  ${change.decision === 'overwrite' ? 'remplacé' : 'ignoré'} : ${describeConflict(change)}`);
  }
  return 0;
};

const hasConflictingContent = ({ decision }: DecidedChange): boolean => decision === 'conflict' || decision === 'overwrite' || decision === 'skip' || decision === 'keep';

const CONFLICT_HINT = 'Relancez avec --skip-conflicts pour garder les éléments existants ou --force pour les remplacer.';

/** Nomme les erreurs métier avec les options de la ligne de commande plutôt qu'avec les clés internes. */
const describe = (error: CraftTypeError): string => {
  if (error instanceof MissingPropertyError) {
    return `Option obligatoire manquante : ${toFlag(error.key)}`;
  }
  if (error instanceof InvalidPropertyError) {
    return `Option ${toFlag(error.key)} invalide : ${error.reason}`;
  }
  if (error instanceof ModuleConflictError) {
    return `${error.message}\n${CONFLICT_HINT}`;
  }
  return error.message;
};

const toOption = (key: string): string => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const toFlag = (key: string): string => `--${toOption(key)}`;

/** Erreurs de `parseArgs` : option inconnue, valeur manquante... */
const isUsageError = (error: unknown): error is TypeError & { code: string } =>
  error instanceof TypeError && 'code' in error && typeof error.code === 'string' && error.code.startsWith('ERR_PARSE_ARGS_');

const describeUsageError = (error: TypeError & { code: string }): string => {
  const option = /'(--?[^']+)'/.exec(error.message)?.[1];
  switch (error.code) {
    case 'ERR_PARSE_ARGS_UNKNOWN_OPTION':
      return `option inconnue : ${option ?? '?'}`;
    case 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE':
      return `valeur manquante ou invalide pour l'option ${option ?? '?'}`;
    default:
      return error.message.split('\n')[0] ?? error.message;
  }
};
