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

## 3. La ressource

`infrastructure/primary/eslintModuleResource.ts` instancie la fabrique et décrit la place du module dans le catalogue :

```ts
moduleResource()
  .slug('eslint')
  .propertiesDefinition(ModulePropertiesDefinition.builder().build())
  .apiDoc('Qualité', 'Ajoute ESLint')
  .dependsOn('typescript')   // ou .standalone()
  .tags('quality')
  .factory((properties) => factory.buildModule(properties)); // const factory = new EslintFactory(versions)
```

`apiDoc` (groupe et libellé) et `tags` sont des métadonnées de catalogue : `list` n'affiche que le libellé, le reste est réservé à un futur filtrage ou à une API.

Les étapes sont ordonnées par le compilateur, comme dans le builder de Seed4J.

### Propriétés

`propertiesDefinition` déclare les options que le module accepte (`addProjectName()`, `addServerPort()`). Une option non déclarée est refusée.
Pour chaque propriété, la valeur explicite l'emporte, puis la valeur que l'historique du projet a déjà enregistrée pour un module précédent, puis la valeur par défaut.
Ainsi `vue-app` relit le port posé par `fastify-server` et le nom posé par `init`. L'historique ne garde que les propriétés déclarées par chaque module.
Les valeurs sont validées dans `ModulePropertiesDefinition.resolve` (nom de paquet npm, port de 1 à 65535) : une nouvelle propriété y ajoute sa validation.

### Fichiers existants

Un module ne remplace jamais un fichier ou une entrée du `package.json` (champ, script, version) dont le contenu diffère : il échoue en listant les conflits, sans rien écrire. `--force` les remplace. Réappliquer un module à l'identique ne change rien.

## 4. Le catalogue

Ajouter le module dans `src/generator/modules.ts`, après les modules dont il dépend (un test le vérifie).

## 5. Test d'acceptation et CI

- Un test d'acceptation ne duplique pas le test de fabrique : il vérifie seulement que le module est joignable par la CLI (`src/test/acceptance/`).
- Rien à faire dans `tests-ci/generate.sh` : le script applique tous les modules de `crafttype list`, dans l'ordre du catalogue. Si le module a une option obligatoire, ajoutez-la dans ce script.
