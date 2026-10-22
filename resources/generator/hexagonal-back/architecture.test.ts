import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RelativePath } from 'arch-unit-ts/dist/arch-unit/core/domain/RelativePath.js';
import { TypeScriptProject } from 'arch-unit-ts/dist/arch-unit/core/domain/TypeScriptProject.js';
import { classes, noClasses } from 'arch-unit-ts/dist/main.js';

// Layers of src/server, see ARCHITECTURE.md. A context is a folder with a
// `domain` folder. The files at the root of src/server (app.ts, main.ts,
// composition.ts...) are outside the contexts: they assemble the server.
// Package names start with `src.server.` because the analysis starts there.
const ROOT = 'src/server';
const sources = new TypeScriptProject(RelativePath.of(ROOT), '**/*.test.ts');

const contexts = readdirSync(ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => readdirSync(`${ROOT}/${name}`).includes('domain'));

const filesOf = (folder: string): string[] =>
  readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = `${folder}/${entry.name}`;
    return entry.isDirectory() ? filesOf(path) : [path];
  });

const sourcesOf = (layer: 'domain' | 'application'): string[] =>
  contexts
    .flatMap((context) => filesOf(`${ROOT}/${context}/${layer}`))
    .filter((path) => path.endsWith('.ts') && !path.endsWith('.test.ts'));

describe('hexagonal architecture of src/server', () => {
  // A rule that checks no class always passes: these tests make sure the
  // analysis sees the project.
  describe('safeguards', () => {
    it('finds at least one context', () => {
      expect(contexts.length).toBeGreaterThan(0);
    });

    it.each(contexts)('%s: the analysis sees its domain', (context) => {
      classes()
        .that()
        .resideInAnyPackage(`src.server.${context}.domain..`)
        .should()
        .onlyDependOnClassesThat()
        .resideInAnyPackage('..domain..')
        .allowEmptyShould(false)
        .check(sources.allClasses());
    });

    it.each(contexts)(
      '%s: the analysis resolves imports between files',
      (context) => {
        classes()
          .that()
          .resideInAnyPackage(`src.server.${context}.application..`)
          .should()
          .dependOnClassesThat()
          .resideInAnyPackage('..domain..')
          .allowEmptyShould(false)
          .check(sources.allClasses());
      },
    );
  });

  describe('contexts', () => {
    it.each(contexts)('%s does not depend on another context', (context) => {
      const others = contexts
        .filter((other) => other !== context)
        .map((other) => `src.server.${other}..`);
      if (others.length === 0) {
        return; // a single context: nothing to compare yet
      }

      noClasses()
        .that()
        .resideInAnyPackage(`src.server.${context}..`)
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage(...others)
        .because('contexts talk through the composition root, not directly')
        .check(sources.allClasses());
    });
  });

  describe('layers', () => {
    it('the domain depends only on the domain', () => {
      classes()
        .that()
        .resideInAPackage('..domain..')
        .should()
        .onlyDependOnClassesThat()
        .resideInAnyPackage('..domain..')
        .because('the domain knows neither the application nor the adapters')
        .check(sources.allClasses());
    });

    it('the application depends only on the domain and on itself', () => {
      classes()
        .that()
        .resideInAPackage('..application..')
        .should()
        .onlyDependOnClassesThat()
        .resideInAnyPackage('..domain..', '..application..')
        .because('the application uses the domain through its ports')
        .check(sources.allClasses());
    });

    it('primary adapters go through the application, not the domain', () => {
      noClasses()
        .that()
        .resideInAPackage('..primary..')
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage('..domain..', '..secondary..')
        .because('they call the application, the composition root assembles')
        .check(sources.allClasses());
    });

    it('secondary adapters implement domain ports, nothing more', () => {
      classes()
        .that()
        .resideInAPackage('..secondary..')
        .should()
        .onlyDependOnClassesThat()
        .resideInAnyPackage('..domain..', '..secondary..')
        .because('an adapter depends on the port it implements')
        .check(sources.allClasses());
    });
  });

  // arch-unit-ts does not resolve `node:` modules nor libraries without types:
  // anything external goes through a port of the domain.
  describe('imports that the analysis does not see', () => {
    const external = /from\s+['"](?!\.)/;

    it.each(['domain', 'application'] as const)(
      'the %s imports no node: module and no library',
      (layer) => {
        const files = sourcesOf(layer);
        expect(files.length).toBeGreaterThan(0);

        const offenders = files.filter((path) =>
          external.test(readFileSync(path, 'utf8')),
        );

        expect(offenders).toEqual([]);
      },
    );
  });
});
