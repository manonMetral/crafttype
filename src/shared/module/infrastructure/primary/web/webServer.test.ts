import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { request, Agent, type IncomingHttpHeaders } from 'node:http';
import { connect } from 'node:net';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createModulesApplicationService } from '../../../../../composition.js';
import type { ModulesApplicationService } from '../../../application/ModulesApplicationService.js';
import { tmpDirForTest } from '../../../../test/ModuleAssertions.js';
import { startWebServer, type WebServer } from './webServer.js';

// The servers created by `startWebServer`, to make one of them fail the way the system could.
const created = vi.hoisted(() => [] as import('node:http').Server[]);
vi.mock('node:http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:http')>();
  return {
    ...actual,
    createServer: (...args: Parameters<typeof actual.createServer>) => {
      const server = actual.createServer(...args);
      created.push(server);
      return server;
    },
  };
});

const TOKEN = 'a-secret-token';
const AUTHORIZED = { authorization: `Bearer ${TOKEN}` };

interface Reply {
  readonly status: number;
  readonly headers: IncomingHttpHeaders;
  readonly body: any;
}

/** A raw HTTP request: `fetch` would not let the test choose the `Host` and `Origin` headers. */
const send = (
  origin: string,
  path: string,
  { method = 'GET', headers = AUTHORIZED, setHost = true, agent, body, chunks }: RequestOptions = {},
): Promise<Reply> =>
  new Promise((resolve, reject) => {
    const { hostname, port } = new URL(origin);
    const call = request(
      { hostname, port, path, method, headers, setHost, ...(agent ? { agent } : {}) },
      (response) => {
        let text = '';
        response.on('data', (chunk) => (text += chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: text === '' ? undefined : JSON.parse(text),
          }),
        );
      },
    );
    call.on('error', reject);
    for (const chunk of chunks ?? []) call.write(chunk);
    call.end(body);
  });

/** What the server answers to text written as is on a socket: for requests the HTTP client would not send. */
const rawExchange = (port: number, text: string): Promise<string> =>
  new Promise((resolve, reject) => {
    let answer = '';
    const socket = connect(port, '127.0.0.1', () => socket.write(text));
    socket.on('data', (chunk) => (answer += chunk));
    socket.on('end', () => resolve(answer));
    socket.on('error', reject);
  });

interface RequestOptions {
  readonly method?: string;
  readonly headers?: Record<string, string>;
  readonly setHost?: boolean;
  readonly agent?: Agent;
  /** Sent as one piece, with its length. */
  readonly body?: string;
  /** Sent piece by piece, without a length (chunked). */
  readonly chunks?: readonly string[];
}

describe('local web server', () => {
  const started: WebServer[] = [];
  const reported: Error[] = [];
  afterEach(async () => {
    reported.length = 0;
    created.length = 0;
    await Promise.all(started.splice(0).map((server) => server.close()));
  });

  const clock = () => new Date('2026-10-20T10:00:00Z');
  const launch = async (
    service: ModulesApplicationService = createModulesApplicationService({ clock }),
    projectFolder = tmpDirForTest(),
    port = 0,
  ) => {
    const server = await startWebServer(service, {
      port,
      token: TOKEN,
      projectFolder,
      onError: (error) => reported.push(error),
    });
    started.push(server);
    return { server, projectFolder, service };
  };
  const failingWith = (thrown: unknown) =>
    ({
      list: () => {
        throw thrown;
      },
    }) as unknown as ModulesApplicationService;

  describe('Given the interface is launched on a project', () => {
    it('When the catalog is asked with the token Then the modules are sent as JSON that is not cached', async () => {
      const { server } = await launch();

      const reply = await send(server.origin, '/api/modules');

      expect(reply.status).toBe(200);
      expect(reply.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(reply.headers['cache-control']).toBe('no-store');
      expect(reply.headers['x-content-type-options']).toBe('nosniff');
      expect(reply.body.modules.map(({ slug }: { slug: string }) => slug)).toContain('fastify-server');
    });

    it('When the project is asked Then the applied modules and the proposed values are sent', async () => {
      const service = createModulesApplicationService({ clock });
      const projectFolder = tmpDirForTest();
      service.apply('init', { projectFolder, projectName: 'shop' });
      const { server } = await launch(service, projectFolder);

      const reply = await send(server.origin, '/api/project');

      expect(reply.status).toBe(200);
      expect(reply.body.projectFolder).toBe(projectFolder);
      expect(reply.body.applied).toEqual([{ slug: 'init', appliedAt: '2026-10-20T10:00:00.000Z' }]);
      expect(reply.body.presets.init).toEqual({ projectName: 'shop' });
    });

    it('When another folder is asked Then it is described instead', async () => {
      const service = createModulesApplicationService({ clock });
      const other = tmpDirForTest();
      service.apply('init', { projectFolder: other });
      const { server } = await launch(service);

      const reply = await send(server.origin, `/api/project?folder=${encodeURIComponent(other)}`);

      expect(reply.body.projectFolder).toBe(other);
      expect(reply.body.applied).toHaveLength(1);
    });

    it('When the folder is not an absolute path Then it is a bad request', async () => {
      const { server } = await launch();

      const reply = await send(server.origin, '/api/project?folder=..%2F..');

      expect(reply).toMatchObject({ status: 400, body: { error: 'the folder must be an absolute path' } });
    });

    it('When the route does not exist Then it is not found', async () => {
      const { server } = await launch();

      expect(await send(server.origin, '/api/unknown')).toMatchObject({ status: 404, body: { error: 'not found' } });
      expect(await send(server.origin, '/')).toMatchObject({ status: 404 });
    });

    it.each(['//', '//evil.example/api/modules', 'http://evil.example/api/modules'])(
      'When the request target is "%s" Then it is a bad request, not a server fault nor the API',
      async (target) => {
        const { server } = await launch();

        const reply = await send(server.origin, target);

        expect(reply).toMatchObject({ status: 400, body: { error: 'invalid request target' } });
      },
    );

    it('When the target is written as the full address of this server Then it is understood', async () => {
      const { server } = await launch();

      const reply = await send(server.origin, `${server.origin}/api/modules`);

      expect(reply.status).toBe(200);
    });

    it.each(['POST', 'PUT', 'DELETE'])('When %s is used Then it is refused: the API only reads', async (method) => {
      const { server } = await launch();

      const reply = await send(server.origin, '/api/project', { method });

      expect(reply).toMatchObject({ status: 405, body: { error: 'method not allowed' } });
      expect(reply.headers['allow']).toBe('GET');
    });
  });

  describe('Given a basket to preview', () => {
    const JSON_HEADERS = { ...AUTHORIZED, 'content-type': 'application/json' };
    const preview = (origin: string, body: unknown, headers: Record<string, string> = JSON_HEADERS) =>
      send(origin, '/api/basket/preview', { method: 'POST', headers, body: JSON.stringify(body) });

    it('When it is posted as JSON Then each module is described, and nothing is written', async () => {
      const projectFolder = tmpDirForTest();
      const { server } = await launch(undefined, projectFolder);

      const reply = await preview(server.origin, { modules: ['init', 'typescript', 'vitest'] });

      expect(reply.status).toBe(200);
      expect(reply.body.canApply).toBe(true);
      expect(
        reply.body.steps.map(({ slug, outcome }: { slug: string; outcome: string }) => `${slug}:${outcome}`),
      ).toEqual(['init:ready', 'typescript:ready', 'vitest:ready']);
      expect(readdirSync(projectFolder)).toEqual([]);
    });

    it.each(['application/json', 'application/json; charset=utf-8', 'Application/JSON;charset=UTF-8'])(
      'When the content type is %s Then it is accepted',
      async (contentType) => {
        const { server } = await launch();

        const reply = await preview(
          server.origin,
          { modules: ['init'] },
          { ...AUTHORIZED, 'content-type': contentType },
        );

        expect(reply.status).toBe(200);
      },
    );

    it.each([
      ['text/plain', { ...AUTHORIZED, 'content-type': 'text/plain' }],
      ['a form', { ...AUTHORIZED, 'content-type': 'application/x-www-form-urlencoded' }],
      ['a type that only starts like JSON', { ...AUTHORIZED, 'content-type': 'application/jsonp' }],
      ['no content type', AUTHORIZED],
    ])('When the body is %s Then it is refused: only JSON is read', async (_case, headers) => {
      const { server } = await launch();

      const reply = await preview(server.origin, { modules: ['init'] }, headers);

      expect(reply).toMatchObject({ status: 415, body: { error: 'the content type must be application/json' } });
    });

    it.each(['', '{', 'not json', '{"modules": ["init"]} trailing'])(
      'When the body is %j Then it is not valid JSON',
      async (body) => {
        const { server } = await launch();

        const reply = await send(server.origin, '/api/basket/preview', { method: 'POST', headers: JSON_HEADERS, body });

        expect(reply).toMatchObject({ status: 400, body: { error: 'the body is not valid JSON' } });
      },
    );

    it('When the body is valid JSON but not what is expected Then the route says what is wrong', async () => {
      const { server } = await launch();

      const reply = await preview(server.origin, { modules: [] });

      expect(reply).toMatchObject({
        status: 400,
        body: { error: '"modules" must be a non-empty list of module names' },
      });
    });

    it('When a module is unknown Then it is an unprocessable request, naming it', async () => {
      const { server } = await launch();

      const reply = await preview(server.origin, { modules: ['nope'] });

      expect(reply).toMatchObject({ status: 422, body: { error: 'Unknown module: nope' } });
    });

    it('When the body, sent in one piece, is larger than the limit Then it is refused, and the connection is closed', async () => {
      const { server } = await launch();

      const reply = await send(server.origin, '/api/basket/preview', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ modules: ['init'], padding: 'x'.repeat(70_000) }),
      });

      expect(reply).toMatchObject({ status: 413, body: { error: 'the body is too large' } });
      expect(reply.headers['connection']).toBe('close');
    });

    it('When a body without announced length grows past the limit Then it is refused too, and the connection is closed', async () => {
      const { server } = await launch();
      const piece = 'x'.repeat(10_000);

      const reply = await send(server.origin, '/api/basket/preview', {
        method: 'POST',
        headers: JSON_HEADERS,
        chunks: ['{"modules":["init"],"padding":"', ...Array(8).fill(piece), '"}'],
      });

      expect(reply).toMatchObject({ status: 413, body: { error: 'the body is too large' } });
    });

    describe('at the limit', () => {
      const LIMIT = 64 * 1024;
      /** A valid JSON document of exactly `bytes` bytes. */
      const document = (bytes: number) => {
        const frame = '{"modules":["init"],"padding":""}';
        return `{"modules":["init"],"padding":"${'x'.repeat(bytes - frame.length)}"}`;
      };
      const chunked = (origin: string, text: string) =>
        send(origin, '/api/basket/preview', {
          method: 'POST',
          headers: JSON_HEADERS,
          chunks: [text.slice(0, 1_000), text.slice(1_000)],
        });

      it('When the body is exactly as large as the limit Then it is read', async () => {
        const { server } = await launch();

        expect((await chunked(server.origin, document(LIMIT))).status).toBe(200);
      });

      it('When the body is one byte larger than the limit Then it is refused', async () => {
        const { server } = await launch();

        expect((await chunked(server.origin, document(LIMIT + 1))).status).toBe(413);
      });
    });

    it('When GET is used on the route Then the method that is allowed is told', async () => {
      const { server } = await launch();

      const reply = await send(server.origin, '/api/basket/preview');

      expect(reply).toMatchObject({ status: 405, body: { error: 'method not allowed' } });
      expect(reply.headers['allow']).toBe('POST');
    });

    it('When POST is used on a route that reads Then it is refused before its body is looked at', async () => {
      const { server } = await launch();

      const reply = await send(server.origin, '/api/modules', {
        method: 'POST',
        headers: { ...AUTHORIZED, 'content-type': 'text/plain' },
        body: 'whatever',
      });

      expect(reply.status).toBe(405);
      expect(reply.headers['allow']).toBe('GET');
    });

    it('When POST is used on a route that does not exist Then it is not found', async () => {
      const { server } = await launch();

      const reply = await send(server.origin, '/api/basket/apply', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: '{}',
      });

      expect(reply.status).toBe(404);
    });

    it('When the token is missing Then the body is not even looked at', async () => {
      const { server } = await launch();

      const reply = await preview(server.origin, { modules: ['nope'] }, { 'content-type': 'application/json' });

      expect(reply.status).toBe(401);
    });

    it('When another site posts it Then it is refused, with the right token', async () => {
      const { server } = await launch();

      const reply = await preview(
        server.origin,
        { modules: ['init'] },
        { ...JSON_HEADERS, origin: 'https://evil.example' },
      );

      expect(reply).toMatchObject({ status: 403, body: { error: 'unexpected Origin header' } });
    });
  });

  describe('Given another web page tries to use the interface', () => {
    it.each([
      ['no token', {}],
      ['a wrong token', { authorization: 'Bearer nope' }],
      ['a token that is a prefix of the right one', { authorization: `Bearer ${TOKEN.slice(0, 4)}` }],
      ['the right token under another scheme', { authorization: `Basic ${TOKEN}` }],
      ['the right token under another scheme of the same length as Bearer', { authorization: `Basics ${TOKEN}` }],
      ['the token alone', { authorization: TOKEN }],
    ])('When it comes with %s Then it is refused', async (_case, headers) => {
      const { server } = await launch();

      const reply = await send(server.origin, '/api/modules', { headers });

      expect(reply).toMatchObject({ status: 401, body: { error: 'missing or invalid token' } });
    });

    it('When the address is typed in a browser Then the refusal says how to send the token', async () => {
      const { server } = await launch();

      const reply = await send(server.origin, '/api/modules', { headers: { accept: 'text/html' } });

      expect(reply.status).toBe(401);
      expect(reply.body).toEqual({
        error: 'missing or invalid token',
        hint: 'send the token printed by crafttype ui as "Authorization: Bearer <token>" (a browser address bar cannot, and there is no page yet)',
      });
    });

    it('When the host is refused Then there is no hint about the token', async () => {
      const { server } = await launch();

      const reply = await send(server.origin, '/api/modules', { headers: { host: 'evil.example' } });

      expect(reply.body).toEqual({ error: 'unexpected Host header' });
    });

    it('When the page is served under another host name (DNS rebinding) Then it is refused, with the right token', async () => {
      const { server } = await launch();

      const reply = await send(server.origin, '/api/modules', { headers: { ...AUTHORIZED, host: 'evil.example' } });

      expect(reply).toMatchObject({ status: 403, body: { error: 'unexpected Host header' } });
    });

    it('When the request has no Host header (HTTP/1.0) Then it is refused', async () => {
      const { server } = await launch();
      const { port } = new URL(server.origin);

      const text = await rawExchange(
        Number(port),
        `GET /api/modules HTTP/1.0\r\nAuthorization: Bearer ${TOKEN}\r\n\r\n`,
      );

      expect(text).toMatch(/^HTTP\/1\.1 403 /);
      expect(text).toContain('unexpected Host header');
    });

    it('When the host is wrong and there is no token Then it says nothing about the token', async () => {
      const { server } = await launch();

      const reply = await send(server.origin, '/api/modules', { headers: { host: 'evil.example' } });

      expect(reply.status).toBe(403);
    });

    it('When the request comes from another origin Then it is refused, with the right token', async () => {
      const { server } = await launch();

      for (const origin of ['https://evil.example', 'null', 'http://localhost:1']) {
        const reply = await send(server.origin, '/api/modules', { headers: { ...AUTHORIZED, origin } });

        expect(reply).toMatchObject({ status: 403, body: { error: 'unexpected Origin header' } });
      }
    });

    it('When the request comes from the page the server itself serves Then it is accepted', async () => {
      const { server } = await launch();

      const reply = await send(server.origin, '/api/modules', { headers: { ...AUTHORIZED, origin: server.origin } });

      expect(reply.status).toBe(200);
    });

    it('When the host is written localhost Then it is accepted', async () => {
      const { server } = await launch();
      const { port } = new URL(server.origin);

      const reply = await send(server.origin, '/api/modules', {
        headers: { ...AUTHORIZED, host: `localhost:${port}` },
      });

      expect(reply.status).toBe(200);
    });
  });

  describe('Given the machine has other network interfaces', () => {
    const external = Object.values(networkInterfaces())
      .flat()
      .find((address) => address?.family === 'IPv4' && !address.internal)?.address;

    it.skipIf(external === undefined)('When it is reached through them Then nobody answers', async () => {
      const { server } = await launch();
      const { port } = new URL(server.origin);

      await expect(send(`http://${external}:${port}`, '/api/modules')).rejects.toMatchObject({ code: 'ECONNREFUSED' });
    });
  });

  describe('Given the project cannot be read', () => {
    it('When its history is invalid Then the reason is sent as an unprocessable request', async () => {
      const projectFolder = tmpDirForTest();
      mkdirSync(join(projectFolder, '.crafttype/modules'), { recursive: true });
      writeFileSync(join(projectFolder, '.crafttype/modules/history.json'), '{"modules": 3}');
      const { server } = await launch(undefined, projectFolder);

      const reply = await send(server.origin, '/api/project');

      expect(reply.status).toBe(422);
      expect(reply.body.error).toContain('history.json');
    });

    it.each([
      ['a file instead of a folder', (folder: string) => writeFileSync(join(folder, 'file'), ''), 'file'],
      [
        'a history that is a directory',
        (folder: string) => mkdirSync(join(folder, '.crafttype/modules/history.json'), { recursive: true }),
        '',
      ],
    ])(
      'When the folder asked is %s Then the failure is described, as a request that cannot be processed',
      async (_case, prepare, child) => {
        const base = tmpDirForTest();
        prepare(base);
        const { server } = await launch();

        const reply = await send(server.origin, `/api/project?folder=${encodeURIComponent(join(base, child))}`);

        expect(reply.status).toBe(422);
        expect(reply.body.error).toMatch(/^cannot access.*: (not a directory \(ENOTDIR\)|is a directory \(EISDIR\))$/);
      },
    );

    it('When something unexpected happens Then the message is sent and the server keeps answering', async () => {
      const { server } = await launch(failingWith(new Error('boom')));

      expect(await send(server.origin, '/api/modules')).toMatchObject({ status: 500, body: { error: 'boom' } });
      expect(await send(server.origin, '/api/unknown')).toMatchObject({ status: 404 });
    });

    it('When what is thrown is not an error Then it is sent as text', async () => {
      const { server } = await launch(failingWith('just a string'));

      expect(await send(server.origin, '/api/modules')).toMatchObject({
        status: 500,
        body: { error: 'just a string' },
      });
    });
  });

  describe('Given the server runs', () => {
    it('When a port is asked Then it listens on loopback only, on that port', async () => {
      const { server: probe } = await launch();
      const { port } = new URL(probe.origin);
      await probe.close();

      const { server } = await launch(undefined, undefined, Number(port));

      expect(server.origin).toBe(`http://127.0.0.1:${port}`);
    });

    it('When the system fails later, while it runs Then the failure is reported and the server keeps answering', async () => {
      const { server } = await launch();
      const failure = Object.assign(new Error('accept EMFILE'), { code: 'EMFILE', syscall: 'accept' });

      expect(() => created.at(-1)?.emit('error', failure)).not.toThrow();

      expect(reported).toEqual([failure]);
      expect((await send(server.origin, '/api/modules')).status).toBe(200);
    });

    it('When the port is already taken Then the start fails with the reason', async () => {
      const { server } = await launch();
      const { port } = new URL(server.origin);

      await expect(launch(undefined, undefined, Number(port))).rejects.toMatchObject({ code: 'EADDRINUSE' });
    });

    it('When it is closed while a request is only half sent Then it stops anyway', async () => {
      const { server } = await launch();
      const { port } = new URL(server.origin);
      const socket = connect(Number(port), '127.0.0.1');
      socket.on('error', () => {});
      await new Promise((connected) => socket.once('connect', connected));
      socket.write(`GET /api/modules HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\n`);
      const gaveUp = new Promise((resolve) => setTimeout(resolve, 1_000, 'still running'));

      const outcome = await Promise.race([server.close().then(() => 'stopped'), gaveUp]);

      expect(outcome).toBe('stopped');
      socket.destroy();
    });

    it('When it is closed with a browser still connected Then it stops, and nothing answers any more', async () => {
      const { server } = await launch();
      const agent = new Agent({ keepAlive: true });
      await send(server.origin, '/api/modules', { agent });

      await server.close();

      await expect(send(server.origin, '/api/modules')).rejects.toMatchObject({ code: 'ECONNREFUSED' });
      agent.destroy();
    });
  });
});
