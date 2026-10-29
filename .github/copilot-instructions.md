# Development standards

Apply these standards to every software change in this repository. Read and follow `.github/skills/development-standards/SKILL.md` for the complete workflow.

- Define business acceptance scenarios before implementation using Given/When/Then and the domain's ubiquitous language. Assert meaningful outcomes with real business objects, automate at the lowest suitable test level, and maintain scenarios in CI as living documentation. Gherkin and Cucumber are optional.
- Use test-driven development: write a failing behavioral test first, implement the smallest change, then refactor while keeping tests green. For bug fixes, begin with a failing regression test. If test-first is not feasible, record why and the alternative verification used.
- Require at least 90% overall line coverage. Track branch coverage as well. Exclude only generated, vendored, unowned, or non-executable code, and keep exclusions explicit. Configure CI to block changes below the line-coverage threshold, including in repositories that have not reached it yet.
- Add unit tests for logic, integration tests at relevant boundaries, and end-to-end tests for critical user journeys. Scale checks proportionately for documentation-only or other non-code changes.
- Mutation-test every new integration test: prove that its assertions detect deliberate, relevant faults in the integrated behavior. Strengthen tests when meaningful mutants survive, and record the evidence before considering the test complete.
- Apply domain-driven design regardless of the project's architecture. Isolate business objects and rules in a `domain` module independent of UI, transport, persistence, and frameworks. Construct business objects from validated, immutable Value Objects for domain concepts rather than raw primitives; keep entity identity and aggregate invariants explicit.
- Preserve the architecture and conventions already established by the project. Apply SOLID as design guidance, not as a checklist that justifies unnecessary abstractions. Keep responsibilities cohesive, coupling low, and changes as simple as the requirement allows.
- Before completion, run the focused tests and relevant broader checks (such as linting, type-checking, and builds). Report actual commands and results; never imply that an unrun check passed.

Project-specific instructions should provide the relevant commands, test tooling, and architecture context without silently weakening these standards. Any exception must be explicit and justified.

## CraftType project-specific instructions

### Architecture context

- Keep the existing hexagonal structure and context boundaries:
  - `src/shared/module/*` for the core module model, orchestration, and adapters.
  - `src/generator/<module>/*` for each generator module (`application`, `domain`, `infrastructure`).
  - `resources/generator/<module>/*` for templates and static files applied by modules.
- Preserve dependency direction enforced by `src/test/architecture/HexagonalArch.test.ts`:
  - contexts stay isolated from each other;
  - domain does not depend on application or infrastructure;
  - each context keeps its hexagonal layering.
- For domain changes, express business concepts with explicit domain types and invariants in the relevant `domain` package before touching adapters.

### Commands and checks

- Install dependencies with `npm ci`.
- Run focused tests first, then run repository checks impacted by the change:
  - `npm run format:check`
  - `npm run lint:types`
  - `npm run test:coverage`
  - `npm run build`
- When a change affects generation behavior, module catalog wiring, or templates under `resources/generator`, also run:
  - `npm run ci:generate`
- Do not claim a check passed if it was not run successfully.

### Test tooling expectations

- Unit/integration tests use Vitest (`src/**/*.test.ts`).
- Coverage is enforced by Vitest thresholds in `vitest.config.ts` (currently stricter than 90%).
- Keep architecture constraints green (`HexagonalArch.test.ts`) and update tests with behavior changes.
