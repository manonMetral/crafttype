import { describe, expect, it } from 'vitest';
import { from, moduleBuilder } from './CraftModule.js';
import { normalizeDestinations } from './destinations.js';
import { DuplicateDestinationError } from './errors.js';
import { ModulePropertiesDefinition } from './ModuleProperties.js';
import type { PathNormalizer } from './ports.js';

describe('normalizeDestinations', () => {
  const properties = ModulePropertiesDefinition.builder().build().resolve({ projectFolder: 'app' });
  // Fake of the port: only drops a leading `./`, which is enough to tell a normalized path from a raw one.
  const paths: PathNormalizer = { normalize: (path) => path.replace(/^\.\//, '') };
  const demo = () => moduleBuilder(properties);

  it('gives the destinations of the files and of the insertions their normal form', () => {
    const module = demo()
      .addFile(from('demo').file('a.txt'), './src/a.txt')
      .insertAtNeedle('./src/main.ts', 'imports', 'import a from "a";')
      .build();

    const normalized = normalizeDestinations(module, paths);

    expect(normalized.files.map((file) => file.destination)).toEqual(['src/a.txt']);
    expect(normalized.edits.map((edit) => edit.path)).toEqual(['src/main.ts']);
  });

  it('keeps several insertions in the same file, in order', () => {
    const module = demo()
      .insertAtNeedle('./src/main.ts', 'imports', 'import a from "a";')
      .insertAtNeedle('src/main.ts', 'plugins', 'use(a);')
      .build();

    const { edits } = normalizeDestinations(module, paths);

    expect(edits.map(({ path, needle }) => [path, needle])).toEqual([
      ['src/main.ts', 'imports'],
      ['src/main.ts', 'plugins'],
    ]);
  });

  it('is idempotent', () => {
    const once = normalizeDestinations(demo().addFile(from('demo').file('a.txt'), './a.txt').build(), paths);

    expect(normalizeDestinations(once, paths)).toEqual(once);
  });

  it('rejects the same destination declared twice, even under two spellings', () => {
    const module = demo()
      .addFile(from('demo').file('a.txt'), 'src/a.txt')
      .addFile(from('demo').file('b.txt'), './src/a.txt')
      .build();

    expect(() => normalizeDestinations(module, paths)).toThrow(DuplicateDestinationError);
    expect(() => normalizeDestinations(module, paths)).toThrow('The module declares the file src/a.txt twice');
  });

  it('also rejects the same source copied twice to the same place', () => {
    const module = demo().addFile(from('demo').file('a.txt'), 'a.txt').addFile(from('demo').file('a.txt'), 'a.txt');

    expect(() => normalizeDestinations(module.build(), paths)).toThrow(DuplicateDestinationError);
  });

  it('refuses to modify a file the same module creates, in either order', () => {
    const created = demo().addFile(from('demo').file('a.txt'), 'src/a.txt').insertAtNeedle('./src/a.txt', 'x', 'y');
    const edited = demo().insertAtNeedle('src/a.txt', 'x', 'y').addFile(from('demo').file('a.txt'), './src/a.txt');

    expect(() => normalizeDestinations(created.build(), paths)).toThrow(DuplicateDestinationError);
    expect(() => normalizeDestinations(edited.build(), paths)).toThrow(DuplicateDestinationError);
  });
});
