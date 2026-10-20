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
- Un même fichier de destination ne peut être déclaré qu'une fois : un second `addFile` vers le même chemin (`./src/a.txt` et `src/a.txt` comptent pour le même) lève `DuplicateDestinationError` dès la construction du module.
- Une dépendance sans version dans `resources/generator/dependencies/` fait échouer la construction. C'est voulu.

## 2. Les versions

Ajouter le paquet dans `resources/generator/dependencies/common/package.json`, ou dans `<framework>/package.json` pour un module propre à un framework.

## 3. Le service d'application et la ressource

- `application/EslintApplicationService.ts` : instancie la fabrique et expose `buildModule`. L'adaptateur primaire passe par lui et n'appelle jamais le domaine directement, même quand il ne fait que relayer : c'est là que viendra l'orchestration d'un module plus riche.
- `infrastructure/primary/eslintModuleResource.ts` décrit la place du module dans le catalogue :

```ts
moduleResource()
  .slug('eslint')
  .propertiesDefinition(ModulePropertiesDefinition.builder().build())
  .apiDoc('Qualité', 'Ajoute ESLint')
  .dependsOn('typescript')   // ou .standalone()
  .tags('quality')
  .factory((properties) => modules.buildModule(properties)); // const modules = new EslintApplicationService(versions)
```

`apiDoc` (groupe et libellé) et `tags` sont des métadonnées de catalogue : `list` n'affiche que le libellé, le reste est réservé à un futur filtrage ou à une API.

Les étapes sont ordonnées par le compilateur, comme dans le builder de Seed4J.

### Propriétés

`propertiesDefinition` déclare les propriétés que le module accepte. Une propriété non déclarée est refusée. Deux sont prêtes à l'emploi (`addProjectName()`, `addServerPort()`) ; pour les autres, on les décrit avec `addString`, `addNumber` ou `addBoolean` :

```ts
ModulePropertiesDefinition.builder()
  .addString('databaseName', { description: 'Nom de la base', mandatory: true })
  .addNumber('poolSize', {
    description: 'Taille du pool de connexions',
    defaultValue: 10,
    validate: (size) => (Number(size) >= 1 ? undefined : 'la taille doit valoir au moins 1'),
  })
  .addBoolean('migrations', { description: 'Active les migrations', defaultValue: true })
  .build();
```

- La clé est en camelCase. La ligne de commande en tire l'option : `databaseName` donne `--database-name`, et une propriété booléenne s'active avec `--migrations` et se coupe avec `--no-migrations`. `crafttype apply <module> --help` liste les options du module.
- `defaultValue` est une valeur fixe, ou une fonction du dossier du projet (c'est ainsi que `projectName` en dérive son nom). Sans valeur par défaut, une propriété non obligatoire reste absente.
- `validate` reçoit la valeur déjà convertie au bon type et renvoie le motif du refus, ou `undefined`. Le texte apparaît dans `Option --pool-size invalide : ...`.
- La fabrique lit les valeurs avec `properties.string('databaseName')`, `properties.number('poolSize')` et `properties.boolean('migrations')`. Lire une propriété que le module ne déclare pas, ou avec le mauvais type, lève `PropertyAccessError`.
- Les valeurs déclarées sont aussi disponibles dans les templates mustache (`{{databaseName}}`).
- Les clés `projectFolder`, `force`, `skipConflicts`, `dryRun` et `help` sont réservées, et une clé ne peut pas être déclarée deux fois.

Pour chaque propriété, la valeur explicite l'emporte, puis la valeur que l'historique du projet a déjà enregistrée pour un module précédent (par une propriété de même clé), puis la valeur par défaut. Une propriété obligatoire déjà posée par un module précédent n'est donc pas redemandée.
Ainsi `vue-app` relit le port posé par `fastify-server` et le nom posé par `init`. L'historique ne garde que les propriétés déclarées par chaque module.

### Fichiers existants

Un module ne remplace jamais un fichier ou une entrée du `package.json` (champ, script, version) dont le contenu diffère : il échoue en listant les conflits, sans rien écrire. Réappliquer un module à l'identique ne change rien.

Le moteur calcule d'abord un plan (`ChangePlan`) : chaque fichier ou entrée du `package.json` est créé, inchangé ou en conflit. Une politique tranche ensuite les conflits :

- `fail` (défaut) : le module est refusé, rien n'est écrit ni enregistré dans l'historique ;
- `overwrite` (`--force`) : l'existant est remplacé ;
- `skip` (`--skip-conflicts`) : l'existant est gardé, le reste est appliqué.

Cas particulier des versions de dépendances : si le projet a déjà la dépendance dans une version égale, plus récente ou compatible avec celle du catalogue (comparaison `semver`, voir `domain/versions.ts`), le plan la marque `keep`. Ce n'est pas un conflit et aucune politique ne la remplace, pour qu'un module ne fasse jamais reculer une version montée par Renovate. Une version plus ancienne ou non comparable (tag, URL, workspace) reste un conflit.

`--dry-run` affiche le plan sans rien écrire. Un module n'a rien à faire pour en profiter : tout passe par `moduleBuilder`.

## 4. Le catalogue

Ajouter le module dans `src/generator/modules.ts`, après les modules dont il dépend (un test le vérifie).

## 5. Test d'acceptation et CI

- Un test d'acceptation ne duplique pas le test de fabrique : il vérifie seulement que le module est joignable par la CLI (`src/test/acceptance/`).
- Rien à faire dans `tests-ci/generate.sh` : le script applique tous les modules de `crafttype list`, dans l'ordre du catalogue. Si le module a une option obligatoire, ajoutez-la dans ce script.
