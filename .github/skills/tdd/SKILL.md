---
name: tdd
description: Develop a behavior change with a failing test, a minimal implementation, and a cleanup pass. Use when the requirement can be expressed as an executable example.
---

# Test-driven development

Use a short feedback loop that ties each implementation decision to an observable requirement.

## Red

Choose one behavior and write the narrowest test that captures it. Run the test and confirm it fails for the expected reason. A compile error or broken fixture is not evidence that the behavioral test is meaningful.

## Green

Implement only what is needed to satisfy the failing test. Run it again, then run nearby tests to catch integration regressions. Do not weaken assertions merely to obtain a pass.

## Refactor

Improve names and structure without changing behavior. Keep the tests passing after each cleanup. Remove duplication only when the abstraction clarifies the rule.

Repeat for another case when it adds meaningful coverage. Include boundary and failure cases in proportion to risk. If the repository lacks a test harness or the behavior cannot be tested at this layer, explain the limitation and use the most reliable available verification instead of pretending to follow the loop.
