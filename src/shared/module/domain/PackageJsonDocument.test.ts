import { describe, expect, it } from 'vitest';
import { InvalidProjectFileError } from './errors.js';
import { describePackageJsonEntry, PackageJsonDocument } from './PackageJsonDocument.js';

const changes = {
  fields: { name: 'shop' },
  scripts: { test: 'vitest run' },
  dependencies: { vue: '3.5.44' },
  devDependencies: { vite: '8.3.5' },
};

describe('PackageJsonDocument', () => {
  describe('reading', () => {
    it('treats a missing file as an empty document', () => {
      expect(PackageJsonDocument.parse(undefined).serialize()).toBe('{}\n');
    });

    it.each(['{', '[]', '"text"', 'null'])('rejects %j', (raw) => {
      expect(() => PackageJsonDocument.parse(raw)).toThrow(InvalidProjectFileError);
    });

    it('gives the current value of each kind of entry, serialized as JSON', () => {
      const document = PackageJsonDocument.parse(
        JSON.stringify({
          name: 'shop',
          engines: { node: '>=22' },
          scripts: { test: 'jest' },
          dependencies: { vue: '3.5.0' },
          devDependencies: { vite: '8.0.0' },
        }),
      );

      expect(document.entry('field', 'name')).toBe('"shop"');
      expect(document.entry('field', 'engines')).toBe('{"node":">=22"}');
      expect(document.entry('script', 'test')).toBe('"jest"');
      expect(document.entry('dependency', 'vue')).toBe('"3.5.0"');
      expect(document.entry('devDependency', 'vite')).toBe('"8.0.0"');
    });

    it('returns undefined for a missing entry, even when its section is missing or is not an object', () => {
      const document = PackageJsonDocument.parse('{"scripts":"broken"}');

      expect(document.entry('script', 'test')).toBeUndefined();
      expect(document.entry('dependency', 'vue')).toBeUndefined();
      expect(document.entry('field', 'name')).toBeUndefined();
    });
  });

  describe('entries wanted by a module', () => {
    it('follow the order fields, scripts, dependencies, development dependencies', () => {
      expect(PackageJsonDocument.wantedBy(changes)).toEqual([
        { kind: 'field', target: 'name', value: '"shop"' },
        { kind: 'script', target: 'test', value: '"vitest run"' },
        { kind: 'dependency', target: 'vue', value: '"3.5.44"' },
        { kind: 'devDependency', target: 'vite', value: '"8.3.5"' },
      ]);
    });

    it('are empty when the module does not touch the package.json', () => {
      expect(PackageJsonDocument.wantedBy({ fields: {}, scripts: {}, dependencies: {}, devDependencies: {} })).toEqual(
        [],
      );
    });
  });

  describe('writing', () => {
    it('puts each kind of entry in its section and keeps the rest', () => {
      const document = PackageJsonDocument.parse('{"name":"old","private":true,"scripts":{"lint":"x"}}');

      const result = JSON.parse(document.with(PackageJsonDocument.wantedBy(changes)).serialize());

      expect(result).toEqual({
        name: 'shop',
        private: true,
        scripts: { lint: 'x', test: 'vitest run' },
        dependencies: { vue: '3.5.44' },
        devDependencies: { vite: '8.3.5' },
      });
    });

    it('does not modify the original document', () => {
      const document = PackageJsonDocument.parse('{"scripts":{"a":"1"}}');

      document.with(PackageJsonDocument.wantedBy(changes));

      expect(document.serialize()).toBe('{\n  "scripts": {\n    "a": "1"\n  }\n}\n');
    });

    it('sorts the touched dependencies, and only them', () => {
      const document = PackageJsonDocument.parse(
        '{"scripts":{"z":"1","a":"2"},"devDependencies":{"vite":"1","@types/node":"2"}}',
      );

      const result = JSON.parse(
        document
          .with([
            { kind: 'dependency', target: 'vue', value: '"3"' },
            { kind: 'dependency', target: 'axios', value: '"1"' },
          ])
          .serialize(),
      );

      expect(Object.keys(result.dependencies)).toEqual(['axios', 'vue']);
      expect(Object.keys(result.scripts)).toEqual(['z', 'a']);
      expect(Object.keys(result.devDependencies)).toEqual(['vite', '@types/node']);
    });

    // The default locale of the machine must not matter: in Czech, "ch" sorts after "h".
    it('sorts with a fixed locale, hence the same way on every machine', () => {
      const names = ['vue', '@vitejs/plugin-vue', 'hono', 'chalk', '@types/node', 'vue-router'];
      const entries = names.map((target) => ({ kind: 'dependency' as const, target, value: '"1"' }));

      const result = JSON.parse(PackageJsonDocument.parse('{}').with(entries).serialize());

      expect(Object.keys(result.dependencies)).toEqual([
        '@types/node',
        '@vitejs/plugin-vue',
        'chalk',
        'hono',
        'vue',
        'vue-router',
      ]);
    });

    it('replaces a section that is not an object', () => {
      const document = PackageJsonDocument.parse('{"scripts":"broken"}');

      const result = JSON.parse(document.with([{ kind: 'script', target: 'test', value: '"vitest run"' }]).serialize());

      expect(result.scripts).toEqual({ test: 'vitest run' });
    });

    it('ends the file with a line break, indented with two spaces', () => {
      expect(
        PackageJsonDocument.parse('{}')
          .with([{ kind: 'field', target: 'type', value: '"module"' }])
          .serialize(),
      ).toBe('{\n  "type": "module"\n}\n');
    });
  });

  it('names an entry with its section', () => {
    expect(describePackageJsonEntry('field', 'name')).toBe('package.json: name');
    expect(describePackageJsonEntry('script', 'test')).toBe('package.json: scripts.test');
    expect(describePackageJsonEntry('dependency', 'vue')).toBe('package.json: dependencies.vue');
    expect(describePackageJsonEntry('devDependency', 'vite')).toBe('package.json: devDependencies.vite');
  });
});
