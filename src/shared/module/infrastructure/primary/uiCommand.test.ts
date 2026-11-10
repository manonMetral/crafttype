import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createModulesApplicationService } from '../../../../composition.js';
import { InvalidPropertyError } from '../../domain/errors.js';
import { tmpDirForTest } from '../../../test/ModuleAssertions.js';
import { DEFAULT_PORT, runUi, UI_USAGE, type UiDependencies } from './uiCommand.js';
import { startWebServer, type WebServer, type WebServerOptions } from './web/webServer.js';

describe('crafttype ui', () => {
  const service = createModulesApplicationService();
  const lines: string[] = [];
  const errors: string[] = [];
  const io = { out: (line: string) => lines.push(line), err: (line: string) => errors.push(line) };
  const output = () => lines.splice(0).join('\n');
  const opened: string[] = [];
  beforeEach(() => {
    lines.length = 0;
    errors.length = 0;
    opened.length = 0;
  });
  /** No page is built, and no browser is opened, unless a test says otherwise. */
  const deps = (overrides: UiDependencies = {}): UiDependencies => ({
    front: () => undefined,
    open: (url) => {
      opened.push(url);
    },
    ...overrides,
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

      const code = await runUi([], service, io, deps({ start }));

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
      await runUi([], service, io, deps({ start }));

      started[0]?.onError(new Error('accept EMFILE'));

      expect(errors).toEqual(['Error: the server reported a failure and keeps running: accept EMFILE']);
    });

    it('When it runs twice Then each run has its own token', async () => {
      const { started, start } = fakeStart();

      await runUi([], service, io, deps({ start }));
      await runUi([], service, io, deps({ start }));

      expect(started[0]?.token).not.toBe(started[1]?.token);
    });

    it('When it runs Then it tells where it listens, for which folder, and how to call it', async () => {
      const { started, start } = fakeStart();

      await runUi([], service, io, deps({ start }));

      const token = started[0]?.token;
      expect(output()).toBe(
        [
          'CraftType API listening on http://127.0.0.1:4242 (this machine only). Stop it with Ctrl+C.',
          `Project folder: ${process.cwd()}`,
          `Token: ${token}`,
          `Try: curl -H "Authorization: Bearer ${token}" http://127.0.0.1:4242/api/modules`,
          'The page is not built (from a clone: npm run web:build), so only the API answers. Opened in a browser, the address answers "missing or invalid token", since a browser cannot send the token.',
        ].join('\n'),
      );
    });
  });

  describe('Given the page is built', () => {
    const page = '/package/web/dist';
    const built = () => deps({ front: () => page });

    it('When it runs Then the server serves the page and the browser opens on an address that carries the token', async () => {
      const { started, start } = fakeStart();

      await runUi([], service, io, { ...built(), start });

      expect(started[0]).toMatchObject({ webRoot: page });
      expect(opened).toEqual([`http://127.0.0.1:4242/?token=${started[0]?.token}`]);
    });

    it('When it runs Then it prints the address to open, and no longer says that there is no page', async () => {
      const { started, start } = fakeStart();

      await runUi([], service, io, { ...built(), start });

      const token = started[0]?.token;
      expect(output()).toBe(
        [
          'CraftType API listening on http://127.0.0.1:4242 (this machine only). Stop it with Ctrl+C.',
          `Project folder: ${process.cwd()}`,
          `Open: http://127.0.0.1:4242/?token=${token}`,
          `Token: ${token}`,
          `Try: curl -H "Authorization: Bearer ${token}" http://127.0.0.1:4242/api/modules`,
        ].join('\n'),
      );
    });

    it('When --no-open is given Then the page is served and the address printed, but the browser is left alone', async () => {
      const { started, start } = fakeStart();

      await runUi(['--no-open'], service, io, { ...built(), start });

      expect(started[0]).toMatchObject({ webRoot: page });
      expect(opened).toEqual([]);
      expect(output()).toContain(`Open: http://127.0.0.1:4242/?token=${started[0]?.token}`);
    });

    it('When the server cannot start Then no browser is opened', async () => {
      const refusing = (async () => {
        throw new Error('boom');
      }) as typeof startWebServer;

      await expect(runUi([], service, io, { ...built(), start: refusing })).rejects.toThrow('boom');

      expect(opened).toEqual([]);
    });
  });

  describe('Given the page is not built', () => {
    it('When it runs Then only the API is served, no browser is opened, and the output says why', async () => {
      const { started, start } = fakeStart();

      await runUi([], service, io, deps({ start }));

      expect(started[0]).not.toHaveProperty('webRoot');
      expect(opened).toEqual([]);
      const text = output();
      expect(text).not.toContain('Open:');
      expect(text).toContain('The page is not built');
    });

    it('When --no-open is given Then it changes nothing', async () => {
      const { started, start } = fakeStart();

      await runUi(['--no-open'], service, io, deps({ start }));

      expect(started[0]).not.toHaveProperty('webRoot');
      expect(opened).toEqual([]);
    });
  });

  describe('Given options', () => {
    it('When a port and a folder are given Then they are used, the folder as an absolute path', async () => {
      const { started, start } = fakeStart();

      await runUi(['--port', '0', '--project-folder', 'some/folder'], service, io, deps({ start }));

      expect(started[0]).toMatchObject({ port: 0, projectFolder: resolve('some/folder') });
    });

    it.each(['abc', '1.5', '', '65536', '99999', '0x10', ' 80'])(
      'When the port is "%s" Then it is refused',
      async (port) => {
        const { started, start } = fakeStart();

        await expect(runUi(['--port', port], service, io, deps({ start }))).rejects.toThrow(InvalidPropertyError);
        await expect(runUi(['--port', port], service, io, deps({ start }))).rejects.toMatchObject({
          key: 'port',
          reason: 'an integer from 0 to 65535 is expected',
        });
        expect(started).toEqual([]);
      },
    );

    it.each(['0', '1', '65535'])('When the port is %s Then it is accepted', async (port) => {
      const { started, start } = fakeStart();

      await runUi(['--port', port], service, io, deps({ start }));

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

      await expect(runUi([], service, io, deps({ start: refusing }))).rejects.toMatchObject({
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

      await expect(runUi([], service, io, deps({ start: refusing }))).rejects.toBe(error);
    });

    it('When help is asked Then the usage is printed and nothing starts', async () => {
      const { started, start } = fakeStart();

      expect(await runUi(['--help'], service, io, deps({ start }))).toBe(0);
      expect(await runUi(['-h'], service, io, deps({ start }))).toBe(0);

      expect(started).toEqual([]);
      expect(output()).toBe(`${UI_USAGE}\n${UI_USAGE}`);
      expect(UI_USAGE).toContain('crafttype ui [--port <number>] [--project-folder <folder>] [--no-open]');
    });
  });

  describe('Given the real server', () => {
    it('When it runs Then what it printed is enough to read the catalog and the project', async () => {
      let server: WebServer | undefined;
      const projectFolder = tmpDirForTest();
      service.apply('init', { projectFolder, projectName: 'shop' });
      try {
        await runUi(
          ['--port', '0', '--project-folder', projectFolder],
          service,
          io,
          deps({
            start: async (...args) => {
              server = await startWebServer(...args);
              return server;
            },
          }),
        );
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
