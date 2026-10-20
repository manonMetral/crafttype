import { parseArgs } from 'node:util';
import type { ModulesApplicationService } from '../../application/ModulesApplicationService.js';
import { CraftTypeError, InvalidPropertyError, MissingPropertyError, ModuleConflictError } from '../../domain/errors.js';
import type { RawProperties } from '../../domain/ModuleProperties.js';

const USAGE = `Usage :
  crafttype list
  crafttype apply <module> --project-folder <dossier> [--project-name <nom>] [--server-port <port>] [--force]

  --force  remplace les fichiers et les entrées du package.json existants qui diffèrent (refusé par défaut)`;

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

const apply = (args: readonly string[], service: ModulesApplicationService, out: (line: string) => void): number => {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      'project-folder': { type: 'string' },
      'project-name': { type: 'string' },
      'server-port': { type: 'string' },
      force: { type: 'boolean' },
    },
  });

  const [slug] = positionals;
  if (slug === undefined) {
    out(USAGE);
    return 1;
  }

  const raw: RawProperties = {};
  if (values['project-folder'] !== undefined) raw.projectFolder = values['project-folder'];
  if (values['project-name'] !== undefined) raw.projectName = values['project-name'];
  if (values['server-port'] !== undefined) raw.serverPort = values['server-port'];

  const applied = service.apply(slug, raw, { force: values.force === true });
  out(`Module ${applied.slug} appliqué dans ${raw.projectFolder}`);
  return 0;
};

/** Nomme les erreurs métier avec les options de la ligne de commande plutôt qu'avec les clés internes. */
const describe = (error: CraftTypeError): string => {
  if (error instanceof MissingPropertyError) {
    return `Option obligatoire manquante : ${toFlag(error.key)}`;
  }
  if (error instanceof InvalidPropertyError) {
    return `Option ${toFlag(error.key)} invalide : ${error.reason}`;
  }
  if (error instanceof ModuleConflictError) {
    return `${error.message}\nRelancez avec --force pour les remplacer.`;
  }
  return error.message;
};

const toFlag = (key: string): string => `--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

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
