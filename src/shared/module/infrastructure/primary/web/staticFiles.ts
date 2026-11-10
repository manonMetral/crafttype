import { readFileSync, realpathSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { isSystemError } from '../systemErrors.js';
import type { ApiResponse } from './api.js';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/**
 * The page may load its own files and call its own server, nothing else: no inline script, no other site, no frame.
 * It reads a token from the address, so it also sends no `Referer`.
 */
const PAGE_HEADERS = {
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
};

/**
 * A file of the built page, for a path of the address. `undefined` if there is none: a file that does not exist, a
 * folder, or a path that leaves `webRoot` (`..`, an encoded slash, a link that points outside).
 */
export const serveStatic = (webRoot: string, pathname: string): ApiResponse | undefined => {
  const path = locate(webRoot, pathname);
  const content = path === undefined ? undefined : read(webRoot, path);
  if (path === undefined || content === undefined) {
    return undefined;
  }
  const extension = extname(path).toLowerCase();
  return {
    status: 200,
    body: content,
    headers: {
      'Content-Type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
      ...(extension === '.html' ? PAGE_HEADERS : {}),
    },
  };
};

/** Where the path leads under `webRoot`, before looking at the disk. */
const locate = (webRoot: string, pathname: string): string | undefined => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  if (decoded.includes('\0')) {
    return undefined;
  }
  const root = resolve(webRoot);
  const path = resolve(root, `.${decoded === '/' ? '/index.html' : decoded}`);
  return path.startsWith(root + sep) ? path : undefined;
};

/** The file, if it really is one inside `webRoot` once links are followed. */
const read = (webRoot: string, path: string): Buffer | undefined => {
  try {
    const real = realpathSync(path);
    if (!real.startsWith(realpathSync(webRoot) + sep) || !statSync(real).isFile()) {
      return undefined;
    }
    return readFileSync(real);
  } catch (error) {
    if (isSystemError(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      return undefined;
    }
    throw error;
  }
};
