import { readdirSync } from 'node:fs';
import { describe, it } from 'vitest';
import { RelativePath } from 'arch-unit-ts/dist/arch-unit/core/domain/RelativePath.js';
import { TypeScriptProject } from 'arch-unit-ts/dist/arch-unit/core/domain/TypeScriptProject.js';
import { Architectures } from 'arch-unit-ts/dist/arch-unit/library/Architectures.js';
import { classes, noClasses } from 'arch-unit-ts/dist/main.js';

// Équivalent du `HexagonalArchTest` de Seed4J et de JHipster Lite, avec arch-unit-ts.
//
// Contextes : le noyau partagé (`shared.module`) et un contexte par générateur (`generator.<slug>`).
// Les noms de package commencent par `src.` car l'analyse part de `src/`.
//
// Hors du périmètre analysé :
// - les tests (`*.test.ts`) et les aides de test (`shared/test`, `src/test`) ;
// - `composition.ts` et `generator/modules.ts`, qui assemblent les contextes et les connaissent donc tous ;
// - les imports `node:*` et ceux des bibliothèques, que arch-unit-ts ne résout pas. Le domaine importe `node:path`
//   (`posix.normalize` dans `CraftModule.ts`) : c'est une exception assumée, la fonction est pure. Une dépendance
//   à une bibliothèque tierce, elle, doit passer par un port du domaine (voir `VersionComparator`) ; la règle ci-dessous
//   ne la détecte que si la bibliothèque fournit ses types dans `node_modules`, ce qui est le cas de `semver`.
const sources = new TypeScriptProject(RelativePath.of('src'), '**/*.test.ts', '**/shared/test/**', '**/src/test/**');

const SHARED_KERNEL = 'src.shared.module';
const generators = readdirSync('src/generator', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `src.generator.${entry.name}`);
const contexts = [SHARED_KERNEL, ...generators];

describe('architecture hexagonale', () => {
  // Une règle qui ne contrôle aucune classe passe toujours. `arch-unit-ts.json` autorise les règles à vide
  // (une couche absente d'un contexte est normale) : ces deux tests garantissent que l'analyse voit bien le projet.
  describe('garde-fous de l’analyse', () => {
    it.each(contexts)('%s : l’analyse voit son domaine', (context) => {
      classes()
        .that()
        .resideInAnyPackage(`${context}.domain..`)
        .should()
        .onlyDependOnClassesThat()
        .resideInAnyPackage('..domain..')
        .allowEmptyShould(false)
        .check(sources.allClasses());
    });

    it('résout les imports entre fichiers (l’application dépend du domaine)', () => {
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

  describe('contextes', () => {
    it.each(contexts)('%s ne dépend d’aucun autre générateur', (context) => {
      const others = generators.filter((generator) => generator !== context).map((generator) => `${generator}..`);

      noClasses()
        .that()
        .resideInAnyPackage(`${context}..`)
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage(...others)
        .because('un contexte ne dépend que de lui-même et du noyau partagé')
        .check(sources.allClasses());
    });

    it.each(generators)('%s ne dépend du noyau que par son domaine', (context) => {
      noClasses()
        .that()
        .resideInAnyPackage(`${context}..`)
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage(`${SHARED_KERNEL}.application..`, `${SHARED_KERNEL}.infrastructure..`)
        .because('le noyau expose ses modèles et ses ports par son domaine, jamais son application ni ses adaptateurs')
        .check(sources.allClasses());
    });

    it('le noyau ne dépend d’aucun générateur', () => {
      noClasses()
        .that()
        .resideInAnyPackage(`${SHARED_KERNEL}..`)
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage('src.generator..')
        .because('le noyau ignore les modules du catalogue')
        .check(sources.allClasses());
    });
  });

  describe('domaine', () => {
    it('ne dépend que du domaine', () => {
      classes()
        .that()
        .resideInAPackage('..domain..')
        .should()
        .onlyDependOnClassesThat()
        .resideInAnyPackage('..domain..')
        .because(
          'le domaine ne connaît ni l’application ni l’infrastructure, et passe par un port pour toute bibliothèque tierce',
        )
        .check(sources.allClasses());
    });
  });

  describe('application', () => {
    it('ne dépend pas de l’infrastructure', () => {
      noClasses()
        .that()
        .resideInAPackage('..application..')
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage('..infrastructure..')
        .because('l’application dépend du domaine et de ses ports, pas de leurs adaptateurs')
        .check(sources.allClasses());
    });
  });

  describe('adaptateurs', () => {
    it('primaires ne dépendent pas des secondaires', () => {
      noClasses()
        .that()
        .resideInAPackage('..primary..')
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage('..secondary..')
        .because('l’assemblage des deux se fait dans composition.ts')
        .check(sources.allClasses());
    });

    it('secondaires ne dépendent pas de l’application', () => {
      noClasses()
        .that()
        .resideInAPackage('..infrastructure.secondary..')
        .should()
        .dependOnClassesThat()
        .resideInAPackage('..application..')
        .because('un adaptateur secondaire implémente un port du domaine, il n’appelle pas l’application')
        .check(sources.allClasses());
    });

    it.each(generators)(
      'primaires de %s passent par l’application et n’appellent pas le domaine du contexte',
      (context) => {
        noClasses()
          .that()
          .resideInAnyPackage(`${context}.infrastructure.primary..`)
          .should()
          .dependOnClassesThat()
          .resideInAnyPackage(`${context}.domain..`)
          .because('documentation/module-creation.md : l’adaptateur primaire passe par le service d’application')
          .check(sources.allClasses());
      },
    );
  });

  describe('couches', () => {
    it.each(contexts)('%s respecte les couches hexagonales', (context) => {
      Architectures.layeredArchitecture()
        .consideringOnlyDependenciesInAnyPackage(`${context}..`)
        .withOptionalLayers(true)
        .layer('domaine', `${context}.domain..`)
        .layer('application', `${context}.application..`)
        .layer('adaptateurs primaires', `${context}.infrastructure.primary..`)
        .layer('adaptateurs secondaires', `${context}.infrastructure.secondary..`)
        .whereLayer('application')
        .mayOnlyBeAccessedByLayers('adaptateurs primaires')
        .whereLayer('adaptateurs primaires')
        .mayNotBeAccessedByAnyLayer()
        .whereLayer('adaptateurs secondaires')
        .mayNotBeAccessedByAnyLayer()
        .because('chaque contexte est une architecture hexagonale')
        .check(sources.allClasses());
    });
  });
});
