import { parseArgs } from 'node:util';
import type { ModulesApplicationService } from '../../application/ModulesApplicationService.js';
import { CraftTypeError } from '../../domain/errors.js';
import type { RawProperties } from '../../domain/ModuleProperties.js';

const USAGE = `Usage :
  crafttype list
  crafttype apply <module> --project-folder <dossier> [--project-name <nom>] [--server-port <port>]`;

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
      out(`Erreur : ${error.message}`);
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

  const applied = service.apply(slug, raw);
  out(`Module ${applied.slug} appliqué dans ${raw.projectFolder}`);
  return 0;
};
