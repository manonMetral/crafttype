import { readdirSync } from 'node:fs';
import { describe, it } from 'vitest';
import { RelativePath } from 'arch-unit-ts/dist/arch-unit/core/domain/RelativePath.js';
import { TypeScriptProject } from 'arch-unit-ts/dist/arch-unit/core/domain/TypeScriptProject.js';
import { Architectures } from 'arch-unit-ts/dist/arch-unit/library/Architectures.js';
import { classes, noClasses } from 'arch-unit-ts/dist/main.js';

// Equivalent of the `HexagonalArchTest` of Seed4J and JHipster Lite, with arch-unit-ts.
//
// Contexts: the shared kernel (`shared.module`) and one context per generator (`generator.<slug>`).
// Package names start with `src.` because the analysis starts from `src/`.
//
// Outside the analyzed scope:
// - tests (`*.test.ts`) and test helpers (`shared/test`, `src/test`);
// - `composition.ts` and `generator/modules.ts`, which assemble the contexts and therefore know all of them;
// - `node:*` imports and library imports, which arch-unit-ts does not resolve. The domain imports `node:path`
//   (`posix.normalize` in `CraftModule.ts`): this is a deliberate exception, the function is pure. A dependency
//   on a third-party library, on the other hand, must go through a domain port (see `VersionComparator`); the rule below
//   only detects it if the library ships its types in `node_modules`, which is the case of `semver`.
const sources = new TypeScriptProject(RelativePath.of('src'), '**/*.test.ts', '**/shared/test/**', '**/src/test/**');

const SHARED_KERNEL = 'src.shared.module';
const generators = readdirSync('src/generator', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `src.generator.${entry.name}`);
const contexts = [SHARED_KERNEL, ...generators];

describe('hexagonal architecture', () => {
  // A rule that checks no class always passes. `arch-unit-ts.json` allows empty rules
  // (a layer missing from a context is normal): these two tests guarantee that the analysis does see the project.
  describe('analysis safeguards', () => {
    it.each(contexts)('%s: the analysis sees its domain', (context) => {
      classes()
        .that()
        .resideInAnyPackage(`${context}.domain..`)
        .should()
        .onlyDependOnClassesThat()
        .resideInAnyPackage('..domain..')
        .allowEmptyShould(false)
        .check(sources.allClasses());
    });

    it('resolves imports between files (the application depends on the domain)', () => {
      classes()
        .that()
        .resideInAPackage('..application..')
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage('..domain..')
        .allowEmptyShould(false)
        .check(sources.allClasses());
    });
  });

  describe('contexts', () => {
    it.each(contexts)('%s does not depend on any other generator', (context) => {
      const others = generators.filter((generator) => generator !== context).map((generator) => `${generator}..`);

      noClasses()
        .that()
        .resideInAnyPackage(`${context}..`)
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage(...others)
        .because('a context depends only on itself and on the shared kernel')
        .check(sources.allClasses());
    });

    it.each(generators)('%s depends on the kernel only through its domain', (context) => {
      noClasses()
        .that()
        .resideInAnyPackage(`${context}..`)
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage(`${SHARED_KERNEL}.application..`, `${SHARED_KERNEL}.infrastructure..`)
        .because('the kernel exposes its models and ports through its domain, never its application or its adapters')
        .check(sources.allClasses());
    });

    it('the kernel does not depend on any generator', () => {
      noClasses()
        .that()
        .resideInAnyPackage(`${SHARED_KERNEL}..`)
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage('src.generator..')
        .because('the kernel ignores the modules of the catalog')
        .check(sources.allClasses());
    });
  });

  describe('domain', () => {
    it('depends only on the domain', () => {
      classes()
        .that()
        .resideInAPackage('..domain..')
        .should()
        .onlyDependOnClassesThat()
        .resideInAnyPackage('..domain..')
        .because(
          'the domain knows neither the application nor the infrastructure, and goes through a port for any third-party library',
        )
        .check(sources.allClasses());
    });
  });

  describe('application', () => {
    it('does not depend on the infrastructure', () => {
      noClasses()
        .that()
        .resideInAPackage('..application..')
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage('..infrastructure..')
        .because('the application depends on the domain and its ports, not on their adapters')
        .check(sources.allClasses());
    });
  });

  describe('adapters', () => {
    it('primary adapters do not depend on secondary ones', () => {
      noClasses()
        .that()
        .resideInAPackage('..primary..')
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage('..secondary..')
        .because('both are assembled in composition.ts')
        .check(sources.allClasses());
    });

    it('secondary adapters do not depend on the application', () => {
      noClasses()
        .that()
        .resideInAPackage('..infrastructure.secondary..')
        .should()
        .dependOnClassesThat()
        .resideInAPackage('..application..')
        .because('a secondary adapter implements a domain port, it does not call the application')
        .check(sources.allClasses());
    });

    it.each(generators)(
      'primary adapters of %s go through the application and do not call the context domain',
      (context) => {
        noClasses()
          .that()
          .resideInAnyPackage(`${context}.infrastructure.primary..`)
          .should()
          .dependOnClassesThat()
          .resideInAnyPackage(`${context}.domain..`)
          .because('documentation/module-creation.md: the primary adapter goes through the application service')
          .check(sources.allClasses());
      },
    );
  });

  describe('layers', () => {
    it.each(contexts)('%s respects the hexagonal layers', (context) => {
      Architectures.layeredArchitecture()
        .consideringOnlyDependenciesInAnyPackage(`${context}..`)
        .withOptionalLayers(true)
        .layer('domain', `${context}.domain..`)
        .layer('application', `${context}.application..`)
        .layer('primary adapters', `${context}.infrastructure.primary..`)
        .layer('secondary adapters', `${context}.infrastructure.secondary..`)
        .whereLayer('application')
        .mayOnlyBeAccessedByLayers('primary adapters')
        .whereLayer('primary adapters')
        .mayNotBeAccessedByAnyLayer()
        .whereLayer('secondary adapters')
        .mayNotBeAccessedByAnyLayer()
        .because('each context is a hexagonal architecture')
        .check(sources.allClasses());
    });
  });
});
