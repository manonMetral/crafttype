# CraftType

Modular generator of **Node.js (Fastify)** and **Vue.js** projects, inspired by [Seed4J](https://github.com/seed4j/seed4j).
Each module adds one thing to a project (TypeScript, Vitest, a Fastify server, a Vue application...) and is applied on demand, in the order you want.

> Status: phase 2 (wider catalog) has started. The core and eleven modules work, the CLI is minimal. ESLint (blocked, see below) and npm publication are still to come.

## Usage

```bash
npm install
npm run cli -- list
npm run cli -- apply init --project-folder ../my-app --project-name my-app
npm run cli -- apply typescript --project-folder ../my-app
npm run cli -- apply vitest --project-folder ../my-app
npm run cli -- apply prettier --project-folder ../my-app
npm run cli -- apply fastify-server --project-folder ../my-app --server-port 3000
npm run cli -- apply config --project-folder ../my-app
npm run cli -- apply logs --project-folder ../my-app
npm run cli -- apply vue-app --project-folder ../my-app
npm run cli -- apply pinia --project-folder ../my-app
npm run cli -- apply vue-router --project-folder ../my-app
npm run cli -- apply github-actions --project-folder ../my-app
```

Applied modules are recorded in the generated project's `.crafttype/modules/history.json`, together with the properties they declare. A module refuses to apply if the modules it depends on are not in that history.
Options already given to a previous module (`--project-name` for `init`, `--server-port` for `fastify-server`) are reused by the following ones: `vue-app` proxies to the port chosen for the server.
Each module declares its own options: `npm run cli -- apply <module> --help` lists them.

**Server port.** The port is written when the files are generated: in `src/server/main.ts` (`fastify-server`) and in the dev proxy of `vite.config.ts` (`vue-app`). Nothing keeps them in sync afterwards:

- With the `config` module, the `PORT` environment variable overrides the port of `main.ts`. `webapp:dev` still proxies to the generated port: run both with the same port, or edit `server.proxy` in `vite.config.ts`.
- To change the port of an existing project, edit `src/server/main.ts` and the proxy in `vite.config.ts` by hand. Applying `vue-app` again with `--server-port` does not help: without an option it stops on the files that differ, `--skip-conflicts` keeps the old proxy (and still records the new port in the history, see above), and `--force` also replaces `src/webapp/main.ts` and `src/webapp/App.vue`, which loses the code that `pinia` and `vue-router` inserted.

A module never replaces a file or a `package.json` entry whose content differs: by default it lists the conflicts and stops, without writing anything. Three options change this behavior:

| Option | Effect |
|---|---|
| `--skip-conflicts` | applies the module, keeps the existing elements that differ, and lists them |
| `--force` | replaces the existing elements that differ |
| `--dry-run` | prints what the module would create, leave unchanged or find in conflict, without writing anything (exit code 1 if a conflict remains) |

`--force` and `--skip-conflicts` are mutually exclusive; `--dry-run` combines with either one to preview its effect.

A module applied with `--skip-conflicts` is recorded in the history with the properties you gave, including for the items it skipped. The history can then disagree with the files: `apply vue-app --server-port 4000 --skip-conflicts` records `serverPort: 4000` for `vue-app` while `vite.config.ts` keeps the old port, and `fastify-server` still records the first one. The following modules reuse the most recent value of a property, so check `.crafttype/modules/history.json` after skipping conflicts.

**Front-end typing.** `vue-app` adds `npm run webapp:typecheck` (`tsc` on `src/webapp`): it checks the `.ts` files (`main.ts`, `router.ts`...) but not the `<script>` of `.vue` files. `vue-tsc`, which would do it, does not work with TypeScript 7 yet (tested with version 3.3.13); it will replace this script as soon as it supports it. `vite build` does not check any type.

**Modules that complete a file.** `pinia` and `vue-router` (files of `vue-app`), `config` and `logs` (files of `fastify-server`) overwrite nothing: they insert their code into the file at needles (`// crafttype-needle-main-imports`...) that the owning module placed there, in the order you apply them. This is not a conflict, and the command prints the modified file. If a needle was removed by hand, the module fails and names it, without writing anything (see `documentation/module-creation.md`).

**CI.** `github-actions` adds `.github/workflows/ci.yml` to the generated project: it runs on pushes to `main` and on pull requests, on Node 22 and 24, with read-only permissions. It runs `typecheck` and `test`, and the scripts other modules may have added (`format:check`, `webapp:typecheck`, `server:build`, `webapp:build`) only if they exist (`npm run --if-present`), so modules applied later need no change. It uses `npm ci`: run `npm install` once in the generated project and commit `package-lock.json`.

**Failures.** Conflicts, missing needles, invalid destinations and missing dependencies are all detected before the first write: nothing is written or recorded. A failure of the file system during the writes (permission denied, disk full...) can leave the project partly written, and the CLI prints it on one line. Files are written through a temporary file and renamed, so none is left truncated. Fix the cause and run the same command again: it completes the project and records the module in the history.

**Dependency versions.** A dependency already present in `package.json` with a version equal to, newer than or compatible with the catalog one (`^5.0.0` for `5.12.7`) is not a conflict: it is kept, even with `--force`, so that a project updated by Renovate never goes backwards. An older version, a tag (`latest`), a URL or a workspace reference remains a conflict.

## Checking that it works

```bash
npm test               # unit and acceptance tests (CLI)
npm run ci:generate    # generates a complete application, then installs, compiles and tests it
```

## Code organization

Each module is a "hexagon", as in Seed4J (see `documentation/hexagonal-architecture.md` in their repository):

```
src/
  shared/module/            core: module model, application engine, adapters (files, mustache, CLI)
  generator/<module>/
    application/            orchestration service
    domain/                 factory: builds the CraftModule from the properties
    infrastructure/primary/ module resource (slug, properties, dependencies, tags)
  generator/modules.ts      module catalog
  composition.ts            composition root
resources/generator/
  <module>/                 templates (.mustache) and files copied as is
  dependencies/             npm package versions (common, vue), kept up to date by Renovate
```

These rules are checked by `src/test/architecture/HexagonalArch.test.ts` (arch-unit-ts): contexts are sealed from each other, the domain has no dependency on the application or infrastructure layers, and each context has its hexagonal layers.

Creating a module: see [documentation/module-creation.md](documentation/module-creation.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [code of conduct](CODE_OF_CONDUCT.md).

## License

Apache-2.0, see [LICENSE](LICENSE). CraftType is inspired by how Seed4J works (also Apache-2.0) without reusing its code.
