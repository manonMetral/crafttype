import { describe, expect, it } from 'vitest';
import { openBrowser } from './openBrowser.js';

describe('opening the browser', () => {
  /** A process that was started: what it was asked, and what was done with it. */
  const fakeSpawn = () => {
    const started: { command: string; args: readonly string[]; options: object }[] = [];
    const listeners: Record<string, (error: Error) => void> = {};
    let detached = false;
    const spawn = (command: string, args: readonly string[], options: object) => {
      started.push({ command, args, options });
      return {
        on: (event: string, listener: (error: Error) => void) => {
          listeners[event] = listener;
        },
        unref: () => {
          detached = true;
        },
      };
    };
    return { spawn, started, listeners, isDetached: () => detached };
  };

  it.each([
    ['linux', 'xdg-open', ['http://127.0.0.1:4242/?token=abc']],
    ['freebsd', 'xdg-open', ['http://127.0.0.1:4242/?token=abc']],
    ['darwin', 'open', ['http://127.0.0.1:4242/?token=abc']],
    ['win32', 'rundll32', ['url.dll,FileProtocolHandler', 'http://127.0.0.1:4242/?token=abc']],
  ] as const)('uses the command of %s', (platform, command, args) => {
    const { spawn, started } = fakeSpawn();

    openBrowser('http://127.0.0.1:4242/?token=abc', platform, spawn);

    expect(started).toEqual([{ command, args, options: expect.anything() }]);
  });

  it('gives the address as one argument, never through a shell', () => {
    const { spawn, started } = fakeSpawn();

    openBrowser('http://127.0.0.1:4242/?a=1&b=$(rm -rf ~)', 'linux', spawn);

    expect(started[0]?.args).toEqual(['http://127.0.0.1:4242/?a=1&b=$(rm -rf ~)']);
    expect(started[0]?.options).not.toHaveProperty('shell', true);
  });

  it('leaves the browser on its own: it does not keep the process alive, and says nothing', () => {
    const { spawn, started, isDetached } = fakeSpawn();

    openBrowser('http://127.0.0.1:4242/', 'linux', spawn);

    expect(started[0]?.options).toMatchObject({ detached: true, stdio: 'ignore' });
    expect(isDetached()).toBe(true);
  });

  it('does not fail when there is no browser to open: the address is printed anyway', () => {
    const { spawn, listeners } = fakeSpawn();

    openBrowser('http://127.0.0.1:4242/', 'linux', spawn);

    expect(() => listeners['error']?.(new Error('spawn xdg-open ENOENT'))).not.toThrow();
    expect(listeners['error']).toBeDefined();
  });
});
