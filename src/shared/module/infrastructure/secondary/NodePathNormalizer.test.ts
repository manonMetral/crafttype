import { describe, expect, it } from 'vitest';
import { NodePathNormalizer } from './NodePathNormalizer.js';

describe('NodePathNormalizer', () => {
  const normalizer = new NodePathNormalizer();

  it.each([
    ['src/a.ts', 'src/a.ts'],
    ['./src/a.ts', 'src/a.ts'],
    ['src//a.ts', 'src/a.ts'],
    ['src/x/../a.ts', 'src/a.ts'],
  ])('normalizes %j to %j', (path, expected) => {
    expect(normalizer.normalize(path)).toBe(expected);
  });
});
