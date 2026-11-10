import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(join(import.meta.dirname, '..', 'index.html'), 'utf8');

describe('page shell', () => {
  it('declares an icon of its own, so that the browser does not ask the server for /favicon.ico (a 404 in the console)', () => {
    expect(html).toMatch(/<link\s+rel="icon"\s+href="data:,"\s*\/?>/);
  });

  it('loads its script and nothing inline, as the policy that serves it requires', () => {
    expect(html).toContain('<script type="module" src="/src/main.ts"></script>');
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>[^<]/);
    expect(html).not.toMatch(/\sstyle="/);
  });
});
