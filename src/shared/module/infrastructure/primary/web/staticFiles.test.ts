import { chmodSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tmpDirForTest } from '../../../../test/ModuleAssertions.js';
import { serveStatic } from './staticFiles.js';

const canRestrictPermissions = process.platform !== 'win32' && process.getuid?.() !== 0;
const canLink = process.platform !== 'win32';

describe('static files of the page', () => {
  /** A folder with a built page, and a secret next to it that must never be served. */
  const site = () => {
    const base = tmpDirForTest();
    const root = join(base, 'dist');
    mkdirSync(join(root, 'assets'), { recursive: true });
    writeFileSync(join(root, 'index.html'), '<!doctype html><title>CraftType</title>');
    writeFileSync(join(root, 'assets', 'app.js'), 'console.log(1)');
    writeFileSync(join(root, 'assets', 'app.css'), 'body{}');
    writeFileSync(join(base, 'secret.txt'), 'secret');
    // A folder next to the site whose name starts like the site's: a check on the beginning of the path lets it through.
    mkdirSync(join(base, 'dist-private'));
    writeFileSync(join(base, 'dist-private', 'secret.txt'), 'secret');
    return { base, root };
  };
  const text = (response: ReturnType<typeof serveStatic>) => (response?.body as Buffer).toString('utf8');

  it('serves the page for the root of the site', () => {
    const { root } = site();

    const response = serveStatic(root, '/');

    expect(response?.status).toBe(200);
    expect(text(response)).toContain('<title>CraftType</title>');
    expect(response?.headers?.['Content-Type']).toBe('text/html; charset=utf-8');
  });

  it('serves the page with a policy that lets it load nothing but its own files, and keeps the token to itself', () => {
    const { root } = site();

    const headers = serveStatic(root, '/index.html')?.headers ?? {};

    expect(headers['Content-Security-Policy']).toBe(
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    expect(headers['Referrer-Policy']).toBe('no-referrer');
  });

  it.each([
    ['/assets/app.js', 'text/javascript; charset=utf-8'],
    ['/assets/app.css', 'text/css; charset=utf-8'],
  ])('serves %s as %s', (path, type) => {
    const { root } = site();

    const response = serveStatic(root, path);

    expect(response?.status).toBe(200);
    expect(response?.headers?.['Content-Type']).toBe(type);
    expect(response?.headers?.['Content-Security-Policy']).toBeUndefined();
  });

  it.each([
    ['page.html', 'text/html; charset=utf-8'],
    ['a.mjs', 'text/javascript; charset=utf-8'],
    ['a.json', 'application/json; charset=utf-8'],
    ['a.map', 'application/json; charset=utf-8'],
    ['a.svg', 'image/svg+xml'],
    ['a.png', 'image/png'],
    ['a.ico', 'image/x-icon'],
    ['a.woff2', 'font/woff2'],
    ['a.txt', 'text/plain; charset=utf-8'],
    ['a.xyz', 'application/octet-stream'],
    ['noextension', 'application/octet-stream'],
  ])('tells %s apart as %s', (name, type) => {
    const { root } = site();
    writeFileSync(join(root, name), 'x');

    expect(serveStatic(root, `/${name}`)?.headers?.['Content-Type']).toBe(type);
  });

  it('tells the type of a file whatever the case of its extension', () => {
    const { root } = site();
    writeFileSync(join(root, 'UPPER.HTML'), '<html></html>');

    const headers = serveStatic(root, '/UPPER.HTML')?.headers;

    expect(headers?.['Content-Type']).toBe('text/html; charset=utf-8');
    expect(headers?.['Content-Security-Policy']).toBeDefined();
  });

  it('does not know a file that does not exist, nor a folder', () => {
    const { root } = site();

    expect(serveStatic(root, '/missing.js')).toBeUndefined();
    expect(serveStatic(root, '/assets')).toBeUndefined();
    expect(serveStatic(root, '/assets/')).toBeUndefined();
    expect(serveStatic(join(root, 'no-such-folder'), '/')).toBeUndefined();
  });

  it('does not know a path below a file', () => {
    const { root } = site();

    expect(serveStatic(root, '/index.html/more')).toBeUndefined();
  });

  describe('Given a path that tries to leave the site', () => {
    it.each([
      ['dots', '/../secret.txt'],
      ['dots behind a folder', '/assets/../../secret.txt'],
      ['an encoded slash', '/..%2Fsecret.txt'],
      ['an encoded dot and slash', '/%2e%2e%2fsecret.txt'],
      ['an encoded backslash', '/..%5Csecret.txt'],
      ['an absolute path', '//etc/passwd'],
      ["a folder whose name starts like the site's", '/..%2Fdist-private%2Fsecret.txt'],
    ])('When it uses %s Then nothing is served', (_case, path) => {
      const { root } = site();

      expect(serveStatic(root, path)).toBeUndefined();
    });

    it.each([
      ['a null byte', '/index.html%00.js'],
      ['an encoding that is not valid', '/%E0%A4%A'],
    ])('When it has %s Then nothing is served, and nothing fails', (_case, path) => {
      const { root } = site();

      expect(serveStatic(root, path)).toBeUndefined();
    });

    it.skipIf(!canLink)('When a link inside the site points outside Then nothing is served', () => {
      const { base, root } = site();
      symlinkSync(join(base, 'secret.txt'), join(root, 'link.txt'));
      symlinkSync(base, join(root, 'out'));

      expect(serveStatic(root, '/link.txt')).toBeUndefined();
      expect(serveStatic(root, '/out/secret.txt')).toBeUndefined();
    });

    it.skipIf(!canLink)(
      "When a link points to a folder whose name starts like the site's Then nothing is served",
      () => {
        const { base, root } = site();
        symlinkSync(join(base, 'dist-private'), join(root, 'out2'));

        expect(serveStatic(root, '/out2/secret.txt')).toBeUndefined();
      },
    );

    it.skipIf(!canLink)('When a link inside the site points inside Then it is served', () => {
      const { root } = site();
      symlinkSync(join(root, 'index.html'), join(root, 'home.html'));

      expect(serveStatic(root, '/home.html')?.status).toBe(200);
    });
  });

  it.skipIf(!canRestrictPermissions)('lets a file the system refuses to read reach the caller as an error', () => {
    const { root } = site();
    chmodSync(join(root, 'assets', 'app.js'), 0o000);

    expect(() => serveStatic(root, '/assets/app.js')).toThrow(/EACCES/);
  });
});
