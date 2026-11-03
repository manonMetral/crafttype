import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createModulesApplicationService } from '../../../../composition.js';
import { InvalidPropertyError } from '../../domain/errors.js';
import { tmpDirForTest } from '../../../test/ModuleAssertions.js';
import { DEFAULT_PORT, runUi, UI_USAGE } from './uiCommand.js';
import { startWebServer, type WebServer, type WebServerOptions } from './web/webServer.js';

describe('crafttype ui', () => {
  const service = createModulesApplicationService();
  const lines: string[] = [];
  const errors: string[] = [];
  const io = { out: (line: string) => lines.push(line), err: (line: string) => errors.push(line) };
  const output = () => lines.splice(0).join('\n');
  beforeEach(() => {
    lines.length = 0;
    errors.length = 0;
  });

  /** Stands in for the server: records how it was started, listens on nothing. */
  const fakeStart = () => {
    const started: WebServerOptions[] = [];
    const start = async (_service: unknown, options: WebServerOptions): Promise<WebServer> => {
      started.push(options);
      return { origin: 'http://127.0.0.1:4242', close: async () => {} };
    };
    return { started, start: start as typeof startWebServer };
  };

  describe('Given nothing is specified', () => {
    it('When it runs Then the server starts on the default port, for the current folder, with a secret token', async () => {
      const { started, start } = fakeStart();

      const code = await runUi([], service, io, start);

      expect(code).toBe(0);
      expect(started).toEqual([
        {
          port: DEFAULT_PORT,
          projectFolder: process.cwd(),
          token: expect.stringMatching(/^[\w-]{32,}$/),
          onError: expect.any(Function),
        },
      ]);
      expect(DEFAULT_PORT).toBe(4242);
    });

    it('When the server fails while it runs Then the failure is shown and nothing stops', async () => {
      const { started, start } = fakeStart();
      await runUi([], service, io, start);

      started[0]?.onError(new Error('accept EMFILE'));

      expect(errors).toEqual(['Error: the server reported a failure and keeps running: accept EMFILE']);
    });

    it('When it runs twice Then each run has its own token', async () => {
      const { started, start } = fakeStart();

      await runUi([], service, io, start);
      await runUi([], service, io, start);

      expect(started[0]?.token).not.toBe(started[1]?.token);
    });

    it('When it runs Then it tells where it listens, for which folder, and how to call it', async () => {
      const { started, start } = fakeStart();

      await runUi([], service, io, start);

      const token = started[0]?.token;
      expect(output()).toBe(
        [
          'CraftType API listening on http://127.0.0.1:4242 (read only, this machine only). Stop it with Ctrl+C.',
          `Project folder: ${process.cwd()}`,
          `Token: ${token}`,
          `Try: curl -H "Authorization: Bearer ${token}" http://127.0.0.1:4242/api/modules`,
        ].join('\n'),
      );
    });
  });

  describe('Given options', () => {
    it('When a port and a folder are given Then they are used, the folder as an absolute path', async () => {
      const { started, start } = fakeStart();

      await runUi(['--port', '0', '--project-folder', 'some/folder'], service, io, start);

      expect(started[0]).toMatchObject({ port: 0, projectFolder: resolve('some/folder') });
    });

    it.each(['abc', '1.5', '', '65536', '99999', '0x10', ' 80'])(
      'When the port is "%s" Then it is refused',
      async (port) => {
        const { started, start } = fakeStart();

        await expect(runUi(['--port', port], service, io, start)).rejects.toThrow(InvalidPropertyError);
        await expect(runUi(['--port', port], service, io, start)).rejects.toMatchObject({
          key: 'port',
          reason: 'an integer from 0 to 65535 is expected',
        });
        expect(started).toEqual([]);
      },
    );

    it.each(['0', '1', '65535'])('When the port is %s Then it is accepted', async (port) => {
      const { started, start } = fakeStart();

      await runUi(['--port', port], service, io, start);

      expect(started[0]?.port).toBe(Number(port));
    });

    it('When the port is already taken Then the error says how to choose another one', async () => {
      const taken = Object.assign(new Error('listen EADDRINUSE'), {
        code: 'EADDRINUSE',
        syscall: 'listen',
        port: 4242,
      });
      const refusing = (async () => {
        throw taken;
      }) as typeof startWebServer;

      await expect(runUi([], service, io, refusing)).rejects.toMatchObject({
        key: 'port',
        reason: 'port 4242 is already in use (choose another one, or 0 to let the system choose a free one)',
      });
    });

    it.each([
      ['a port the user may not use', Object.assign(new Error('listen EACCES'), { code: 'EACCES', syscall: 'listen' })],
      [
        "an address already in use that is not the server's own",
        Object.assign(new Error('connect EADDRINUSE'), { code: 'EADDRINUSE', syscall: 'connect' }),
      ],
      ['a bug', new TypeError('bug')],
    ])('When the server cannot start because of %s Then the error is left as it is', async (_case, error) => {
      const refusing = (async () => {
        throw error;
      }) as typeof startWebServer;

      await expect(runUi([], service, io, refusing)).rejects.toBe(error);
    });

    it('When help is asked Then the usage is printed and nothing starts', async () => {
      const { started, start } = fakeStart();

      expect(await runUi(['--help'], service, io, start)).toBe(0);
      expect(await runUi(['-h'], service, io, start)).toBe(0);

      expect(started).toEqual([]);
      expect(output()).toBe(`${UI_USAGE}\n${UI_USAGE}`);
      expect(UI_USAGE).toContain('crafttype ui [--port <number>] [--project-folder <folder>]');
    });
  });

  describe('Given the real server', () => {
    it('When it runs Then what it printed is enough to read the catalog and the project', async () => {
      let server: WebServer | undefined;
      const projectFolder = tmpDirForTest();
      service.apply('init', { projectFolder, projectName: 'shop' });
      try {
        await runUi(['--port', '0', '--project-folder', projectFolder], service, io, async (...args) => {
          server = await startWebServer(...args);
          return server;
        });
        const text = output();
        const origin = /listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(text)?.[1] as string;
        const token = /^Token: (.+)$/m.exec(text)?.[1] as string;
        const get = (path: string, authorization = `Bearer ${token}`) =>
          fetch(`${origin}${path}`, { headers: { authorization } });

        const project = await get('/api/project');
        const catalog = await get('/api/modules');
        const refused = await get('/api/modules', 'Bearer wrong');

        expect(await project.json()).toMatchObject({ projectFolder, applied: [{ slug: 'init' }] });
        expect((await catalog.json()).modules.length).toBeGreaterThan(10);
        expect(refused.status).toBe(401);
      } finally {
        await server?.close();
      }
    });
  });
});
