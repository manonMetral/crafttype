import { spawn as spawnProcess } from 'node:child_process';

/** What `openBrowser` needs of a started process. */
interface Started {
  on(event: 'error', listener: (error: Error) => void): unknown;
  unref(): void;
}
type Spawn = (command: string, args: readonly string[], options: { detached: true; stdio: 'ignore' }) => Started;

/**
 * Opens the address in the default browser. The address is one argument of the command, never part of a shell
 * line: it carries the token, and nothing in it may be read as a command.
 */
export const openBrowser = (
  url: string,
  platform: NodeJS.Platform = process.platform,
  spawn: Spawn = spawnProcess,
): void => {
  const [command, args] = launcher(platform, url);
  const started = spawn(command, args, { detached: true, stdio: 'ignore' });
  // No browser to open (a server, a container): the address is printed anyway.
  started.on('error', () => {});
  started.unref();
};

const launcher = (platform: NodeJS.Platform, url: string): readonly [string, readonly string[]] => {
  switch (platform) {
    case 'darwin':
      return ['open', [url]];
    case 'win32':
      return ['rundll32', ['url.dll,FileProtocolHandler', url]];
    default:
      return ['xdg-open', [url]];
  }
};
