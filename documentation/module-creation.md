# Creating a module

Same approach as Seed4J: a module is described by two objects.

- `CraftModule`: the changes made to the generated project (files, npm dependencies, scripts).
- `ModuleResource`: the module's place in the catalog (slug, requested properties, dependencies, tags).

Since a `CraftModule` depends on the chosen properties, a **factory** builds it from them.

Example: an `eslint` module.

## 1. The factory and its test (`src/generator/eslint/domain/`)

Write the test first. `assertThatModule` really applies the module to a temporary folder, and the result is immediate.

```ts
const module = factory.buildModule(propertiesFixture());
assertThatModule(module).hasFiles('eslint.config.js');
```

Then the factory:

```ts
const SOURCE = from('eslint'); // resources/generator/eslint/

export class EslintFactory {
  constructor(private readonly versions: NodePackagesVersionsReader) {}

  buildModule(properties: ModuleProperties): CraftModule {
    return moduleBuilder(properties)
      .addFile(SOURCE.template('eslint.config.js'), 'eslint.config.js') // rendered by mustache
      .addDevDependency('eslint', this.versions.get())
      .addScript('lint', 'eslint .')
      .build();
  }
}
```

- `SOURCE.template('x')` reads `x.mustache` and renders it with the properties. `SOURCE.file('x')` copies without rendering: use it whenever the file contains `{{ }}` (Vue templates).
- Destinations are checked when the module is applied, after normalization through the `PathNormalizer` port (`./src/a.txt`, `src//a.txt` and `src/x/../a.txt` all become `src/a.txt`). A destination must be a relative file path with `/` separators, inside the project folder: `../x.ts`, `/etc/x`, `C:/x.ts`, `src\a.ts` and `src/` are refused with an `InvalidDestinationError`. A file declared twice, even under two spellings, throws a `DuplicateDestinationError`; nothing is written in either case.
- A dependency with no version in `resources/generator/dependencies/` makes the build fail. This is intended.

## 2. The versions

Add the package to `resources/generator/dependencies/common/package.json`, or to `<framework>/package.json` for a framework-specific module.

## 3. The application service and the resource

- `application/EslintApplicationService.ts`: instantiates the factory and exposes `buildModule`. The primary adapter goes through it and never calls the domain directly, even when it only relays: this is where the orchestration of a richer module will go.
- `infrastructure/primary/eslintModuleResource.ts` describes the module's place in the catalog:

```ts
moduleResource()
  .slug('eslint')
  .propertiesDefinition(ModulePropertiesDefinition.builder().build())
  .apiDoc('Quality', 'Adds ESLint')
  .dependsOn('typescript')   // or .standalone()
  .tags('quality')
  .factory((properties) => modules.buildModule(properties)); // const modules = new EslintApplicationService(versions)
```

`apiDoc` (group and label) and `tags` are catalog metadata: `list` only prints the label, the rest is reserved for future filtering or an API.

The compiler enforces the order of the steps, as in Seed4J's builder.

### Properties

`propertiesDefinition` declares the properties the module accepts. An undeclared property is rejected. Two are ready to use (`addProjectName()`, `addServerPort()`); the others are described with `addString`, `addNumber` or `addBoolean`:

```ts
ModulePropertiesDefinition.builder()
  .addString('databaseName', { description: 'Database name', mandatory: true })
  .addNumber('poolSize', {
    description: 'Connection pool size',
    defaultValue: 10,
    validate: (size) => (Number(size) >= 1 ? undefined : 'the size must be at least 1'),
  })
  .addBoolean('migrations', { description: 'Enables migrations', defaultValue: true })
  .build();
```

- The key is in camelCase. The command line derives the option from it: `databaseName` gives `--database-name`, and a boolean property is enabled with `--migrations` and disabled with `--no-migrations`. `crafttype apply <module> --help` lists the module's options.
- `defaultValue` is a fixed value, or a function of the project folder (this is how `projectName` derives its name). Without a default value, a non-mandatory property stays absent.
- `validate` receives the value already converted to the right type and returns the reason for the refusal, or `undefined`. The text appears in the invalid option error for `--pool-size` (for example `Invalid option --pool-size: ...`).
- The factory reads the values with `properties.string('databaseName')`, `properties.number('poolSize')` and `properties.boolean('migrations')`. Reading a property the module does not declare, or with the wrong type, throws `PropertyAccessError`.
- The declared values are also available in the mustache templates (`{{databaseName}}`).
- **Mustache escapes nothing** (`MustacheTemplateRenderer`): `{{databaseName}}` is inserted as is, whether the file is TypeScript, JSON or HTML. A free-text property must therefore be restricted with `validate` to the format of the files where it will be rendered (for example by rejecting `"`, `<` and `\` for a JSON or HTML file), or be read only in a factory (`properties.string(...)`) for a value that the engine serializes itself, such as a `package.json` entry. `projectName` is safe because it is limited to an npm package name, and `serverPort` because it is an integer.
- The keys `projectFolder`, `force`, `skipConflicts`, `dryRun` and `help` are reserved, and a key cannot be declared twice.

For each property, the explicit value wins, then the value that the project's history already recorded for a previous module (through a property with the same key), then the default value. A mandatory property already set by a previous module is therefore not asked for again.
This is how `vue-app` reads back the port set by `fastify-server` and the name set by `init`. The history only keeps the properties declared by each module.

### Existing files

A module never replaces a file or a `package.json` entry (field, script, version) whose content differs: it fails by listing the conflicts, without writing anything. Reapplying a module identically changes nothing, and leaves `history.json` as it is (the entry keeps its place and its date) when the properties are the same too.

**Failures.** Everything the engine can check is checked before the first write: conflicts, needles, destinations, missing dependencies. These errors write nothing and record nothing. A failure of the file system during the writes (permission denied, disk full, a path that is not a folder) is different: the files already written stay, and the module is not recorded in the history, so the project is partly written. The CLI prints one line (`Error: cannot write <path>: permission denied (EACCES)`). Each file is written to a temporary file and renamed, so a file is never left truncated. Fix the cause and run the same command again: the engine is idempotent, so it completes the missing files and records the module (checked by a test that compares the result with a project that never failed).

The engine first computes a plan (`ChangePlan`): each file or `package.json` entry is created, unchanged or in conflict. A policy then settles the conflicts:

- `fail` (default): the module is refused, nothing is written or recorded in the history;
- `overwrite` (`--force`): the existing element is replaced;
- `skip` (`--skip-conflicts`): the existing element is kept, the rest is applied.

Special case of dependency versions: if the project already has the dependency in a version equal to, newer than or compatible with the catalog one (`semver` comparison, behind the `VersionComparator` port), the plan marks it `keep`. This is not a conflict and no policy replaces it, so that a module never sets back a version bumped by Renovate. An older or non-comparable version (tag, URL, workspace) remains a conflict.

`--dry-run` prints the plan without writing anything. A module has nothing to do to benefit from it: everything goes through `moduleBuilder`.

### Modifying a file created by another module

A module that completes an existing file (Pinia in `main.ts`, a Fastify plugin in `app.ts`) overwrites nothing: it inserts its code at a **needle**, a line that the module owning the file placed there.

1. The module that creates the file places the needles, in the comment syntax of its language. The name follows `crafttype-needle-<name>`:

```ts
// resources/generator/vue-app/main.ts
import App from './App.vue';
// crafttype-needle-main-imports

const app = createApp(App);
// crafttype-needle-main-plugins
app.mount('#app');
```

2. The module that completes the file declares its insertions in its factory and depends on the owning module:

```ts
moduleBuilder(properties)
  .addDependency('pinia', this.versions.get('vue'))
  .insertAtNeedle('src/webapp/main.ts', 'main-imports', "import { createPinia } from 'pinia';")
  .insertAtNeedle('src/webapp/main.ts', 'main-plugins', 'app.use(createPinia());')
  .build();
```

The contract between the two modules is the file path and the needle names: the owner's factory test checks that its needles are in the generated file (see `VueAppFactory.test.ts`).

Engine behavior:
- The block is inserted just before the needle line, with that line's indentation. The needle stays in place for the following modules, which insert after the previous ones.
- Idempotent: if the block's lines are already in the file (ignoring indentation), nothing is changed. Code added by the team is never touched.
- This is not a conflict: no policy (`--force`, `--skip-conflicts`) comes into play. The plan marks the file `edit` (shown as `modify` in a dry run, and listed as modified files in the report).
- If the file cannot be found, or if the needle is missing or appears several times, the module fails with a `NeedleError` that names the file and the needle, without writing or recording anything, including with `--dry-run`. The team edited the file by hand: the engine does not guess where to insert. The fix is to put the needle line back where it belongs.
- A module cannot both create (`addFile`) and modify (`insertAtNeedle`) the same file.

Needles placed by the catalog today:

| File | Needle | Use |
|---|---|---|
| `src/webapp/main.ts` | `main-imports` | entry point imports (Pinia, router...) |
| `src/webapp/main.ts` | `main-plugins` | `app.use(...)` before `app.mount` |
| `src/webapp/App.vue` | `app-template` | content of the application's `<main>` (`<RouterView />`...) |
| `src/server/app.ts` | `app-imports` | imports of `buildApp` |
| `src/server/app.ts` | `app-server-options` | completes `serverOptions` before `Fastify(serverOptions)` (logger, request id generation...) |
| `src/server/app.ts` | `app-plugins` | hooks and plugins, right after the application is created |
| `src/server/main.ts` | `main-imports` | entry point imports |
| `src/server/main.ts` | `main-settings` | start of the startup `try`: code that adjusts `settings` (port, address) or prepares the server. Its errors are printed as a message, without a stack trace |

Needles are comments that stay in the generated code. The engine does not parse the code (no AST): it suits additions at places planned in advance, not the rewriting of arbitrary code.

**Routes of the server.** The routes of `buildApp` are declared inside a plugin (`app.register(async (routes) => { ... })`) placed after the `app-plugins` needle, not directly on `app`. `buildApp` is synchronous, and Fastify adds a route declared on `app` immediately, before the plugins registered just above are loaded: a plugin that watches the routes (`openapi` does) would never see it. A module that adds routes does the same, in its own plugin.

## 4. The catalog

Add the module to `src/generator/modules.ts`, after the modules it depends on (a test checks this).

## 5. Acceptance test and CI

- An acceptance test does not duplicate the factory test: it only checks that the module can be reached through the CLI (`src/test/acceptance/`).
- Nothing to do in `tests-ci/generate.sh`: the script applies all the modules of `crafttype list`, in catalog order. If the module has a mandatory option, add it to that script.
