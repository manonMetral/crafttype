import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ModulesApplicationService } from '../../../application/ModulesApplicationService.js';
import { classify } from '../failures.js';
import { handleApi, type ApiResponse } from './api.js';

/** The interface writes to the disk (soon): it listens on this machine only, never on the network. */
const LOOPBACK = '127.0.0.1';
const LOCAL_HOST = /^(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/;

export interface WebServerOptions {
  /** `0` lets the system choose a free port. */
  readonly port: number;
  /** Secret the page must send as `Authorization: Bearer <token>`. */
  readonly token: string;
  /** Folder described when the request names none. */
  readonly projectFolder: string;
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
  { port, token, projectFolder, onError }: WebServerOptions,
): Promise<WebServer> =>
  new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const { status, body } = answer(request, service, token, projectFolder);
      send(response, status, body, status === 405 ? { Allow: 'GET' } : {});
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

const answer = (
  request: IncomingMessage,
  service: ModulesApplicationService,
  token: string,
  projectFolder: string,
): ApiResponse => {
  const { host, origin, authorization } = request.headers;
  if (host === undefined || !LOCAL_HOST.test(host)) {
    return refusal(403, 'unexpected Host header');
  }
  if (origin !== undefined && origin !== `http://${host}`) {
    return refusal(403, 'unexpected Origin header');
  }
  if (!hasToken(authorization, token)) {
    return refusal(401, 'missing or invalid token');
  }
  if (request.method !== 'GET') {
    return refusal(405, 'method not allowed');
  }

  // `request.url` is always set for a request received by a server.
  const target = parseTarget(request.url as string, host);
  if (target === undefined) {
    return refusal(400, 'invalid request target');
  }

  try {
    return handleApi(service, projectFolder, target) ?? refusal(404, 'not found');
  } catch (error) {
    return failure(error);
  }
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

const refusal = (status: number, error: string): ApiResponse => ({ status, body: { error } });

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

const send = (response: ServerResponse, status: number, body: unknown, headers: Record<string, string>): void => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(JSON.stringify(body));
};
