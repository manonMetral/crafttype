# CraftType

Modular generator of **Node.js (Fastify)** and **Vue.js** projects, inspired by [Seed4J](https://github.com/seed4j/seed4j).
Each module adds one thing to a project (TypeScript, Vitest, a Fastify server, a Vue application...) and is applied on demand, in the order you want.

> Status: phase 2 (wider catalog) has started. The core and eleven modules work, the CLI is minimal. ESLint (blocked, see below) is not available yet, and the npm publication is pending: until the package is published, the `npx` commands below do not work, see [CONTRIBUTING.md](CONTRIBUTING.md) to run CraftType from a clone.

## Usage with npx

Requirements: Node.js 22.12 or newer.

Run the commands from the folder of the project to generate or extend (an empty folder to start a new project):

```bash
npx crafttype list
npx crafttype apply init --project-folder . --project-name my-app
npx crafttype apply typescript --project-folder .
npx crafttype apply vitest --project-folder .
npx crafttype apply prettier --project-folder .
npx crafttype apply fastify-server --project-folder . --server-port 3000
npx crafttype apply config --project-folder .
npx crafttype apply logs --project-folder .
npx crafttype apply vue-app --project-folder .
npx crafttype apply pinia --project-folder .
npx crafttype apply vue-router --project-folder .
npx crafttype apply github-actions --project-folder .
```

A module only works after the modules it depends on: apply them in the order shown (`npx crafttype list` shows each module's prerequisites). Then run `npm install` in the project.

| Module | What it adds | Needs first |
|---|---|---|
| `init` | `package.json`, `.gitignore`, `.editorconfig`, README | |
| `typescript` | TypeScript and its configuration | `init` |
| `vitest` | Vitest | `typescript` |
| `prettier` | Prettier | `init` |
| `fastify-server` | a Fastify server with a health endpoint | `typescript`, `vitest` |
| `config` | server configuration from the environment, validated (`PORT`, `HOST`) | `fastify-server` |
| `logs` | structured logs (level from `LOG_LEVEL`, validated request id) | `fastify-server` |
| `vue-app` | a Vue.js application with Vite | `typescript` |
| `pinia` | Pinia, for shared state in the Vue application | `vue-app` |
| `vue-router` | Vue Router in the Vue application | `vue-app` |
| `github-actions` | a GitHub Actions workflow (format, typecheck, tests, builds) | `typescript`, `vitest` |

Applied modules are recorded in the generated project's `.crafttype/modules/history.json`, together with the properties they declare. A module refuses to apply if the modules it depends on are not in that history.
Options already given to a previous module (`--project-name` for `init`, `--server-port` for `fastify-server`) are reused by the following ones: `vue-app` proxies to the port chosen for the server.
Each module declares its own options: `npx crafttype apply <module> --help` lists them.

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

**Dependency versions.** A dependency already present in `package.json` with a version equal to, newer than or compatible with the catalog one (`^5.0.0` for `5.12.7`) is not a conflict: it is kept, even with `--force`, so that a project updated by Renovate never goes backwards. An older version, a tag (`latest`), a URL or a workspace reference remains a conflict.

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
