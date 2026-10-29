---
name: development-standards
description: Apply the shared BDD, TDD, coverage, DDD, architecture, clean-code, and verification standards to every software development task.
---

# Development standards

Use these standards throughout every software change. First inspect the repository's instructions, architecture, test tooling, and existing conventions. Apply the project's established tools and patterns; do not assume a framework or command that is not present.

## Behavior-driven development

BDD defines expected business behavior through concrete examples; TDD guides its implementation. Use both without imposing a particular architecture or test framework.

- Before implementing a business behavior, define acceptance criteria and examples with the person responsible for the requirement. Resolve consequential ambiguity rather than inventing business rules.
- Use the bounded context's ubiquitous language. Keep scenarios free of framework, SQL, HTTP, or UI details unless those details are part of the observable contract.
- Structure scenarios as Given (initial context), When (one business action), and Then (observable consequences). Keep each scenario focused on one behavior.
- Cover meaningful successful outcomes, rejections, boundaries, and state transitions. Prefer representative examples over redundant permutations.
- Assert business results, invariants, and expected effects, not merely the absence of an error or a successful status.
- Automate each scenario at the lowest test level that can prove its contract: domain, integration, or end-to-end for critical user journeys. Do not route every scenario through the UI.
- Start with a failing acceptance scenario, then use the red-green-refactor loops needed to implement it. Avoid duplicating every assertion at every test level; each level should address its own contract or risk.
- Exercise real Value Objects and business objects. Do not mock the business rules that a scenario claims to verify; isolate external dependencies only where appropriate for the chosen test level.
- Apply the mutation-testing requirement below to every new integration test derived from a BDD scenario. BDD does not replace the 90% overall line-coverage gate.
- Maintain scenarios alongside changes to business behavior as living documentation, and run automated acceptance scenarios in CI.

Gherkin and Cucumber are optional. Given/When/Then may be expressed using the project's existing test tooling; do not introduce a new framework solely to adopt BDD. Report test-first exceptions under the TDD policy below.

## Test-driven development

For behavior changes, use the red-green-refactor loop:

1. Write the narrowest behavioral test for one requirement and run it. Confirm it fails for the expected reason.
2. Implement only enough to pass that test, then run it again.
3. Refactor names and structure without changing behavior; keep the tests green.

For bug fixes, write a regression test that reproduces the defect first. For refactors, add or confirm characterization tests before changing behavior. Include boundary and failure cases in proportion to risk; do not weaken assertions to make a test pass.

Test-first is the default, not an optional preference. If a change genuinely cannot be tested first (for example, documentation-only work or a missing test harness), state why, choose the most reliable proportionate alternative verification, and report the exception. Never present an untested change as test-verified.

## Test layers and coverage

- Use unit tests for isolated logic, integration tests at meaningful module or service boundaries, and end-to-end tests for critical user journeys.
- Require at least 90% overall line coverage. Configure the repository's CI to fail below this threshold; repositories currently below 90% must raise coverage until they meet the gate before changes can pass.
- Track branch coverage and improve it where meaningful, especially for conditionals, error handling, and boundary cases.
- Exclude only generated files, vendored dependencies, code the project does not own, and non-executable files. Keep every exclusion narrow and explicit; do not exclude difficult or uncovered application code merely to reach the threshold.
- For documentation-only and other non-code changes, use proportionate checks instead of inventing code tests. The repository's coverage gate remains a merge requirement.

## Mutation testing for integration tests

Every new integration test must undergo mutation testing before it is considered complete. Coverage alone does not demonstrate that assertions detect incorrect behavior.

1. Run the new test against the unchanged implementation and confirm it passes.
2. Introduce targeted mutations in the production behavior exercised across the integration boundary, such as bypassing validation, omitting a persistence operation, or returning an incorrect result. Select meaningful faults related to what the test claims to verify; do not mutate the test itself or only its mocks.
3. Run the new test against each mutation and confirm its assertions fail for the expected behavioral reason. A mutation killed only by another test does not prove the new test is effective. Build errors, broken fixtures, and timeouts are not evidence of effective assertions.
4. Investigate surviving mutants. Strengthen the test or its fixtures for meaningful undetected faults, then repeat. Document equivalent or out-of-contract mutants with a specific justification rather than treating them as proof of test effectiveness.
5. Remove all temporary mutations and rerun the test against the correct implementation. Record the mutations, observed failures, surviving-mutant dispositions, and final passing result.

Use the project's mutation-testing tool when available. If no suitable tool exists, perform controlled manual mutations in an isolated worktree or temporary copy. If neither approach is feasible, report the blocker explicitly; do not claim that the integration test has met this requirement.

## Domain-driven design

Apply these rules regardless of the surrounding architecture: layered, hexagonal, MVC, modular monolith, services, or another project-specific design.

- Isolate business objects and rules in an explicit `domain` module or package within the relevant bounded context. Keep it independent of UI, HTTP, persistence implementations, ORM models, and framework-specific types. External layers may depend on the domain; the domain must not depend on them.
- Use the business's ubiquitous language for types, operations, and boundaries. Keep each bounded context's model authoritative for its own rules rather than sharing a universal model across contexts.
- Represent domain concepts such as identifiers, money, quantities, and addresses with immutable Value Objects that validate their invariants at creation and compare by value. Prefer language-native value types where suitable; do not wrap technical values without domain meaning.
- Construct business entities and aggregates from validated Value Objects rather than raw strings or numbers for those concepts. Convert external primitives into Value Objects at the boundary before constructing the business object. Reject invalid input explicitly using the project's error conventions; do not silently coerce it or substitute defaults.
- Keep entities distinct from Value Objects: entities have stable identity and lifecycle, while Value Objects are defined by their values. Enforce cross-field invariants and allowed state transitions inside the entity or aggregate, not just in individual Value Objects. Expose meaningful business operations rather than unrestricted setters.
- Use constructors or named factories that cannot expose a partially initialized or invalid object. Persistence reconstitution must also preserve domain invariants; map storage and transport representations outside the domain rather than bypassing validation.
- Test Value Object validation, value equality, and immutability, as well as entity creation, aggregate invariants, and invalid transitions. Add dependency-boundary checks with the project's available tooling to prevent infrastructure imports into the domain.

For existing code, apply these boundaries to new or changed business behavior and migrate the affected model incrementally. Do not trigger an unrelated rewrite or change public contracts without agreement.

## Architecture and clean code

- Preserve the architecture and local conventions that already work. Trace the relevant code path and its tests before choosing where a change belongs.
- Adapt the surrounding architecture to the project while preserving the domain isolation and Value Object rules above. Explain consequential design choices and record durable decisions using the project's established ADR or documentation format.
- Use SOLID as a set of design heuristics. Apply a principle when it improves clarity, cohesion, or changeability; do not add indirection or abstractions just to satisfy a checklist.
- Prefer clear names, small cohesive units, explicit contracts and failures, low coupling, and the simplest design that meets the requirement. Avoid speculative generalization and unrelated refactoring.
- Keep public behavior and compatibility intact unless a deliberate change is part of the requirement.

## Verification and completion

Run the narrowest relevant test first, then the broader tests that cover affected boundaries. Run the project's relevant formatter, linter, type-checker, and build when available. Inspect failures and distinguish pre-existing issues from regressions.

Every repository must configure CI checks that enforce its coverage threshold and relevant validation commands, then require those checks before merge. The skill defines the policy; the project's workflow must implement it with tools suitable for that stack.

Before reporting completion, inspect the final diff, identify any exception and its alternative evidence, and state exactly which checks passed, failed, or were not run.
