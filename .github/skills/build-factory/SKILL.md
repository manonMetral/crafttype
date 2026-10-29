---
name: build-factory
description: Shape a product or engineering goal into a repeatable, staged delivery workflow. Use when coordinating discovery, design, implementation, and verification across a larger initiative.
---

# Build factory

Treat delivery as a sequence of evidence-producing stages, not as a promise that a large task will succeed in one pass.

## Workflow

1. Define the outcome, intended users, constraints, and observable acceptance conditions.
2. Inspect the current product and repository before choosing an architecture or workflow. Reuse existing conventions where they satisfy the need.
3. Separate discovery, specification, implementation, and verification. State which decisions are settled and which remain open.
4. Break work into vertical slices. Each slice should produce a reviewable result and have its own validation.
5. Track dependencies explicitly; keep independent work independent. Assign clear inputs and expected outputs to each work item.
6. Put quality gates at boundaries: requirement review before implementation, targeted tests after changes, and final integration checks before release.
7. Capture decisions and failures in the project’s existing records. Update the process when evidence shows a repeated bottleneck.

## Guardrails

Keep approvals with the user for scope changes, data migrations, releases, and irreversible actions. Do not automate a stage whose inputs or success criteria are still ambiguous. Prefer a small working path over building a generic platform before a concrete need exists.
