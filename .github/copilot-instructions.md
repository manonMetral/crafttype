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
