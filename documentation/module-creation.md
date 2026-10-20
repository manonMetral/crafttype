# Créer un module

Même démarche que Seed4J : un module se décrit par deux objets.

- `CraftModule` : les modifications apportées au projet généré (fichiers, dépendances npm, scripts).
- `ModuleResource` : la place du module dans le catalogue (slug, propriétés demandées, dépendances, tags).

Comme un `CraftModule` dépend des propriétés choisies, une **fabrique** le construit à partir d'elles.

Exemple : un module `eslint`.

## 1. La fabrique et son test (`src/generator/eslint/domain/`)

Écrire d'abord le test. `assertThatModule` applique réellement le module sur un dossier temporaire, le retour est immédiat.

```ts
const module = factory.buildModule(propertiesFixture());
assertThatModule(module).hasFiles('eslint.config.js');
```

Puis la fabrique :

```ts
const SOURCE = from('eslint'); // resources/generator/eslint/

export class EslintFactory {
  constructor(private readonly versions: NodePackagesVersionsReader) {}

  buildModule(properties: ModuleProperties): CraftModule {
    return moduleBuilder(properties)
      .addFile(SOURCE.template('eslint.config.js'), 'eslint.config.js') // rendu par mustache
      .addDevDependency('eslint', this.versions.get())
      .addScript('lint', 'eslint .')
      .build();
  }
}
```

- `SOURCE.template('x')` lit `x.mustache` et le rend avec les propriétés. `SOURCE.file('x')` copie sans rendre : à utiliser dès que le fichier contient des `{{ }}` (templates Vue).
- Une dépendance sans version dans `resources/generator/dependencies/` fait échouer la construction. C'est voulu.

## 2. Les versions

Ajouter le paquet dans `resources/generator/dependencies/common/package.json`, ou dans `<framework>/package.json` pour un module propre à un framework.

## 3. Le service d'application et la ressource

- `application/EslintApplicationService.ts` : instancie la fabrique et expose `buildModule`.
- `infrastructure/primary/eslintModuleResource.ts` :

```ts
moduleResource()
  .slug('eslint')
  .propertiesDefinition(ModulePropertiesDefinition.builder().build())
  .apiDoc('Qualité', 'Ajoute ESLint')
  .dependsOn('typescript')   // ou .standalone()
  .tags('quality')
  .factory((properties) => modules.buildModule(properties));
```

Les étapes sont ordonnées par le compilateur, comme dans le builder de Seed4J.

## 4. Le catalogue

Ajouter le module dans `src/generator/modules.ts`, après les modules dont il dépend (un test le vérifie).

## 5. Test d'acceptation et CI

- Un test d'acceptation ne duplique pas le test de fabrique : il vérifie seulement que le module est joignable par la CLI (`src/test/acceptance/`).
- Ajouter le slug dans la boucle de `tests-ci/generate.sh`, pour que l'application complète qui l'inclut soit installée, compilée et testée.
