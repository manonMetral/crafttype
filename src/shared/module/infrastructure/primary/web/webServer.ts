import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ModulesApplicationService } from '../../../application/ModulesApplicationService.js';
import { classify } from '../failures.js';
import { apiRoute, type ApiResponse } from './api.js';
import { serveStatic } from './staticFiles.js';

/** The interface writes to the disk (soon): it listens on this machine only, never on the network. */
const LOOPBACK = '127.0.0.1';
/** A basket of modules with their properties is a few hundred bytes: this leaves room, and stops a page that floods. */
const MAX_BODY_BYTES = 64 * 1024;
const JSON_CONTENT_TYPE = /^application\/json\s*(?:;.*)?$/i;
const LOCAL_HOST = /^(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/;

export interface WebServerOptions {
  /** `0` lets the system choose a free port. */
  readonly port: number;
  /** Secret the page must send as `Authorization: Bearer <token>`. */
  readonly token: string;
  /** Folder described when the request names none. */
  readonly projectFolder: string;
  /** Folder of the built page: served without the token, which the page itself needs. Without it, there is no page. */
  readonly webRoot?: string;
  /** Failures of the server once it runs (the system refuses a connection...): reported, they do not stop it. */
  readonly onError: (error: Error) => void;
}

export interface WebServer {
  /** `http://127.0.0.1:<port>`, with the port the system chose if `0` was asked. */
  readonly origin: string;
  close(): Promise<void>;
}

/**
 * Primary adapter: translates HTTP requests into calls to the application service.
 *
 * Any web page open in the browser can send requests to `127.0.0.1`. Three checks keep them out, in this order:
 * the `Host` header (a page served under an attacker's name that resolves to 127.0.0.1 is refused, which is the
 * DNS rebinding attack), the `Origin` header (a page of another site is refused), then the token that only the
 * person who launched the interface knows.
 */
export const startWebServer = (
  service: ModulesApplicationService,
  { port, token, projectFolder, webRoot, onError }: WebServerOptions,
): Promise<WebServer> =>
  new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      // `answer` always settles with a response: whatever fails inside is turned into one.
      void answer(request, { service, token, projectFolder, webRoot }).then(({ status, body, headers }) =>
        send(response, status, body, headers),
      );
    });
    server.once('error', reject);
    server.listen(port, LOOPBACK, () => {
      // Without a listener, a failure of the running server would be thrown and stop the whole process.
      server.off('error', reject);
      server.on('error', onError);
      const { port: actual } = server.address() as AddressInfo;
      resolve({
        origin: `http://${LOOPBACK}:${actual}`,
        close: () =>
          new Promise((done) => {
            server.close(() => done());
            // Without this, a browser that keeps its connection open would keep the server running.
            server.closeAllConnections();
          }),
      });
    });
  });

interface Context {
  readonly service: ModulesApplicationService;
  readonly token: string;
  readonly projectFolder: string;
  readonly webRoot: string | undefined;
}

const answer = async (
  request: IncomingMessage,
  { service, token, projectFolder, webRoot }: Context,
): Promise<ApiResponse> => {
  const { host, origin, authorization } = request.headers;
  if (host === undefined || !LOCAL_HOST.test(host)) {
    return refusal(403, 'unexpected Host header');
  }
  if (origin !== undefined && origin !== `http://${host}`) {
    return refusal(403, 'unexpected Origin header');
  }

  // `request.url` is always set for a request received by a server.
  const target = parseTarget(request.url as string, host);
  if (target === undefined) {
    return refusal(400, 'invalid request target');
  }

  // The page is read without the token: it holds no secret, and it is what reads the token from the address.
  if (webRoot !== undefined && request.method === 'GET' && !target.pathname.startsWith('/api/')) {
    try {
      return serveStatic(webRoot, target.pathname) ?? refusal(404, 'not found');
    } catch (error) {
      return failure(error);
    }
  }

  if (!hasToken(authorization, token)) {
    return refusal(401, 'missing or invalid token', TOKEN_HINT);
  }

  const route = apiRoute(service, projectFolder, target.pathname);
  if (route === undefined) {
    return refusal(404, 'not found');
  }
  if (!route.methods.includes(String(request.method))) {
    return refusal(405, 'method not allowed', undefined, { Allow: route.methods.join(', ') });
  }

  try {
    // The body is read once the route is known and the caller is trusted: before that, nothing it sends is looked at.
    const read = request.method === 'POST' ? await readJson(request) : NO_BODY;
    return read.ok ? route.handle({ url: target, body: read.json }) : read.refusal;
  } catch (error) {
    return failure(error);
  }
};

type BodyRead = { readonly ok: true; readonly json: unknown } | { readonly ok: false; readonly refusal: ApiResponse };

const NO_BODY: BodyRead = { ok: true, json: undefined };

const readJson = async (request: IncomingMessage): Promise<BodyRead> => {
  if (!JSON_CONTENT_TYPE.test(request.headers['content-type'] ?? '')) {
    return unreadable(415, 'the content type must be application/json');
  }
  const text = await readText(request);
  if (text === undefined) {
    return unreadable(413, 'the body is too large');
  }
  try {
    return { ok: true, json: JSON.parse(text) };
  } catch {
    return unreadable(400, 'the body is not valid JSON');
  }
};

const unreadable = (status: number, error: string): BodyRead => ({
  ok: false,
  refusal: refusal(status, error, undefined, status === 413 ? { Connection: 'close' } : {}),
});

/** The body as text, or `undefined` once it is past the limit. The connection is kept, to answer on it. */
const readText = async (request: IncomingMessage): Promise<string | undefined> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) {
      return undefined;
    }
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
};

/** The target as a URL, if it is a path of this server: `//other-host/path` and the address of another host are not. */
const parseTarget = (target: string, host: string): URL | undefined => {
  const server = new URL(`http://${host}`);
  try {
    const url = new URL(target, server);
    return url.origin === server.origin ? url : undefined;
  } catch {
    return undefined;
  }
};

const refusal = (
  status: number,
  error: string,
  hint?: string,
  headers: Readonly<Record<string, string>> = {},
): ApiResponse => ({
  status,
  body: hint === undefined ? { error } : { error, hint },
  headers,
});

/** What someone who typed the address in a browser needs to read: the page does not exist yet, and cannot send a header. */
const TOKEN_HINT =
  'send the token printed by crafttype ui as "Authorization: Bearer <token>" (a browser address bar cannot, and there is no page yet)';

/** Compares digests, so that the comparison takes the same time whatever the length of what was sent. */
const hasToken = (authorization: string | undefined, token: string): boolean =>
  authorization?.startsWith('Bearer ') === true &&
  timingSafeEqual(digest(authorization.slice('Bearer '.length)), digest(token));

const digest = (text: string): Buffer => createHash('sha256').update(text).digest();

const failure = (error: unknown): ApiResponse => {
  const classified = classify(error);
  switch (classified.kind) {
    case 'domain':
      return refusal(422, classified.error.message);
    case 'system':
      // Every route reads the project folder the request names: if the system refuses, the request cannot be processed.
      return refusal(422, classified.message);
    case 'unexpected':
      return refusal(500, classified.error instanceof Error ? classified.error.message : String(classified.error));
  }
};

const send = (
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {},
): void => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
