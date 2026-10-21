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
  describe('lecture', () => {
    it('traite un fichier absent comme un document vide', () => {
      expect(PackageJsonDocument.parse(undefined).serialize()).toBe('{}\n');
    });

    it.each(['{', '[]', '"texte"', 'null'])('refuse %j', (raw) => {
      expect(() => PackageJsonDocument.parse(raw)).toThrow(InvalidProjectFileError);
    });

    it('donne la valeur actuelle de chaque sorte d’entrée, sérialisée en JSON', () => {
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

    it('renvoie undefined pour une entrée absente, même quand sa section est absente ou n’est pas un objet', () => {
      const document = PackageJsonDocument.parse('{"scripts":"cassé"}');

      expect(document.entry('script', 'test')).toBeUndefined();
      expect(document.entry('dependency', 'vue')).toBeUndefined();
      expect(document.entry('field', 'name')).toBeUndefined();
    });
  });

  describe('entrées voulues par un module', () => {
    it('suivent l’ordre champs, scripts, dépendances, dépendances de développement', () => {
      expect(PackageJsonDocument.wantedBy(changes)).toEqual([
        { kind: 'field', target: 'name', value: '"shop"' },
        { kind: 'script', target: 'test', value: '"vitest run"' },
        { kind: 'dependency', target: 'vue', value: '"3.5.44"' },
        { kind: 'devDependency', target: 'vite', value: '"8.3.5"' },
      ]);
    });

    it('sont vides quand le module ne touche pas au package.json', () => {
      expect(PackageJsonDocument.wantedBy({ fields: {}, scripts: {}, dependencies: {}, devDependencies: {} })).toEqual(
        [],
      );
    });
  });

  describe('écriture', () => {
    it('pose chaque sorte d’entrée dans sa section et garde le reste', () => {
      const document = PackageJsonDocument.parse('{"name":"vieux","private":true,"scripts":{"lint":"x"}}');

      const result = JSON.parse(document.with(PackageJsonDocument.wantedBy(changes)).serialize());

      expect(result).toEqual({
        name: 'shop',
        private: true,
        scripts: { lint: 'x', test: 'vitest run' },
        dependencies: { vue: '3.5.44' },
        devDependencies: { vite: '8.3.5' },
      });
    });

    it('ne modifie pas le document d’origine', () => {
      const document = PackageJsonDocument.parse('{"scripts":{"a":"1"}}');

      document.with(PackageJsonDocument.wantedBy(changes));

      expect(document.serialize()).toBe('{\n  "scripts": {\n    "a": "1"\n  }\n}\n');
    });

    it('trie les dépendances touchées, et seulement elles', () => {
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

    // La locale par défaut de la machine ne doit pas jouer : en tchèque, « ch » se range après « h ».
    it('trie avec une locale fixe, donc de la même façon sur toutes les machines', () => {
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

    it('remplace une section qui n’est pas un objet', () => {
      const document = PackageJsonDocument.parse('{"scripts":"cassé"}');

      const result = JSON.parse(document.with([{ kind: 'script', target: 'test', value: '"vitest run"' }]).serialize());

      expect(result.scripts).toEqual({ test: 'vitest run' });
    });

    it('termine le fichier par un retour à la ligne, indenté de deux espaces', () => {
      expect(
        PackageJsonDocument.parse('{}')
          .with([{ kind: 'field', target: 'type', value: '"module"' }])
          .serialize(),
      ).toBe('{\n  "type": "module"\n}\n');
    });
  });

  it('nomme une entrée avec sa section', () => {
    expect(describePackageJsonEntry('field', 'name')).toBe('package.json : name');
    expect(describePackageJsonEntry('script', 'test')).toBe('package.json : scripts.test');
    expect(describePackageJsonEntry('dependency', 'vue')).toBe('package.json : dependencies.vue');
    expect(describePackageJsonEntry('devDependency', 'vite')).toBe('package.json : devDependencies.vite');
  });
});
