# Contributing to CraftType

Thank you for your interest. Contributions are welcome: fixes, new modules, documentation, feedback from real use.
By participating, you agree to the [code of conduct](CODE_OF_CONDUCT.md). Your contributions are published under the [Apache-2.0 license](LICENSE), like the rest of the project.

## Reporting a problem or suggesting an idea

Open an [issue](https://github.com/manonMetral/crafttype/issues). For a bug, give the command you ran, the Node version, the expected result and the actual result.
For a new module, describe what it adds to the generated project and which modules it depends on before writing code: this avoids work that would not fit in the catalog.

## Setting up your machine

Requirements: Node.js 22.12 or newer, and npm.

```bash
git clone git@github.com:manonMetral/crafttype.git
cd crafttype
npm ci
```

## Running the CLI from your clone

```bash
npm run cli -- list
npm run cli -- apply init --project-folder ../my-app --project-name my-app
npm run cli -- apply typescript --project-folder ../my-app
```

`npm run cli --` is the equivalent of `npx crafttype` for the sources (it runs `tsx` on `src/`). The modules and their order are in the [README](README.md#usage-with-npx).

## Checking your changes

```bash
npm run format        # formats the code (Prettier); format:check verifies it, and so does the CI
npm run lint:types    # typecheck
npm test              # unit and acceptance tests
npm run test:coverage # same tests with coverage; the CI requires 100% of statements, branches, functions and lines
npm run build         # compilation to dist/
npm run ci:generate   # generates a complete application with all the modules, then installs, type-checks, tests and compiles it
                      # (CRAFTTYPE_DOCKER=1 also builds its Docker image and checks the container; needs Docker and curl)
```

The GitHub CI runs the same commands on Node 22.12.0 and 24.11.0. A pull request must be green to be merged.

## Node compatibility policy

CraftType itself and generated projects do not have the same minimum Node version.

| Scope | Declared minimum | Where |
|---|---|---|
| CraftType repository | `>=22.12` | `package.json` (`engines.node`) |
| Generated projects | `^22.18.0 || >=24.11.0` | generated `package.json` (`init` module) |
| Repository CI | `22.12.0` and `24.11.0` | `.github/workflows/ci.yml` |
| Generated project CI template | `22.18.0` and `24.11.0` | `resources/generator/github-actions/ci.yml` |

When changing this policy, update all four places in the same pull request.

**Coverage at 100 %.** Every new statement, branch, function and line needs a test, error paths included. A defensive fallback that no test can reach (`?? ''` after a presence check) is dead code: remove it, or change the type so that the compiler knows (a non-empty tuple, for instance), rather than ignoring it. The count of branches comes from the JavaScript that the transpiler produces, so an update of Vitest, TypeScript or Vite can move it: the pull request that carries the update fails, and the fix is a test or a rewrite, not a lower threshold. Renovate updates `vitest` and `@vitest/coverage-v8` together, because the latter pins the exact version of the former.

## Adding or changing a module

Follow [documentation/module-creation.md](documentation/module-creation.md). In short:

1. Write the factory test first, with `assertThatModule`.
2. Write the factory, the templates in `resources/generator/<module>/` and, if needed, the versions in `resources/generator/dependencies/`.
3. Declare the module resource, then add it to `src/generator/modules.ts` after the modules it depends on. `tests-ci/generate.sh` then includes it automatically in the complete application.

Respect the repository's hexagonal architecture: the domain depends on no adapter, and disk and mustache access stay in `infrastructure/secondary`. A third-party library used by the domain goes through a port (see `VersionComparator` and its adapter `SemverVersionComparator`). `src/test/architecture/HexagonalArch.test.ts` ([arch-unit-ts](https://github.com/arch-unit-ts/arch-unit-ts)) checks these rules in `npm test`: a new module that breaks them fails the tests and names the offending file.

## Dependency versions

The versions injected into generated projects live in `resources/generator/dependencies/`. They are exact (no `^`) and updated by Renovate, in a single grouped pull request. Edit them by hand only to add a package.

## Submitting a pull request

- Start from `main`, with one branch per topic.
- One commit = one coherent change, with a message of the form `type: description` (`feat`, `fix`, `docs`, `test`, `chore`, `refactor`), as in the history.
- Add or adapt the tests, and the documentation if the behavior changes.
- In the pull request, describe what changes and how you verified it.
- `main` is protected: the CI must be green and a person listed in [`.github/CODEOWNERS`](.github/CODEOWNERS) must approve the pull request before it is merged.
