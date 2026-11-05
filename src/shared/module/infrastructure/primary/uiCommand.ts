import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { ModulesApplicationService } from '../../application/ModulesApplicationService.js';
import { InvalidPropertyError } from '../../domain/errors.js';
import { isSystemError } from './systemErrors.js';
import { startWebServer } from './web/webServer.js';

export const DEFAULT_PORT = 4242;
const MAX_PORT = 65_535;
const TOKEN_BYTES = 24;

export const UI_USAGE = `Usage:
  crafttype ui [--port <number>] [--project-folder <folder>]

Starts the local interface's API on 127.0.0.1 (this machine only) and keeps it running until you stop it (Ctrl+C).
  --port <number>           port to listen on (default: ${DEFAULT_PORT}; 0 lets the system choose a free one)
  --project-folder <folder> project to describe (default: the current folder)`;

/** Primary adapter of the local interface: the server runs as long as the process, so there is no result to wait for. */
export const runUi = async (
  args: readonly string[],
  service: ModulesApplicationService,
  { out, err }: { readonly out: (line: string) => void; readonly err: (line: string) => void },
  start: typeof startWebServer = startWebServer,
): Promise<number> => {
  const { values } = parseArgs({
    args: [...args],
    allowPositionals: false,
    options: {
      port: { type: 'string' },
      'project-folder': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help === true) {
    out(UI_USAGE);
    return 0;
  }

  const port = parsePort(values.port);
  const projectFolder = resolve(values['project-folder'] ?? process.cwd());
  const token = randomBytes(TOKEN_BYTES).toString('base64url');

  const server = await start(service, {
    port,
    token,
    projectFolder,
    onError: (error) => err(`Error: the server reported a failure and keeps running: ${error.message}`),
  }).catch((error: unknown) => {
    throw explainPortInUse(error, port);
  });

  out(`CraftType API listening on ${server.origin} (read only, this machine only). Stop it with Ctrl+C.`);
  out(`Project folder: ${projectFolder}`);
  out(`Token: ${token}`);
  out(`Try: curl -H "Authorization: Bearer ${token}" ${server.origin}/api/modules`);
  out(
    'There is no page yet: opened in a browser, the address answers "missing or invalid token", since a browser cannot send the token. Use curl for now.',
  );
  return 0;
};

const parsePort = (text: string | undefined): number => {
  if (text === undefined) {
    return DEFAULT_PORT;
  }
  const port = Number(text);
  if (!/^\d+$/.test(text) || port > MAX_PORT) {
    throw new InvalidPropertyError('port', `an integer from 0 to ${MAX_PORT} is expected`);
  }
  return port;
};

/** The default port is easily taken (another `ui` is running): say what to do, since it is an option that changes it. */
const explainPortInUse = (error: unknown, port: number): unknown =>
  isSystemError(error) && error.syscall === 'listen' && error.code === 'EADDRINUSE'
    ? new InvalidPropertyError(
        'port',
        `port ${port} is already in use (choose another one, or 0 to let the system choose a free one)`,
      )
    : error;
