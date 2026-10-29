---
name: codebase-design
description: Choose or evolve a design that fits an existing codebase. Use when a task spans modules, introduces a shared abstraction, or has several viable implementation shapes.
---

# Codebase design

Design for the repository that exists, not for an imagined greenfield system.

## Steps

1. Trace the relevant feature through entry points, core logic, persistence or network boundaries, and tests.
2. Identify established patterns and constraints. Prefer a working local precedent over introducing a new framework or abstraction.
3. State the smallest design that satisfies the requirement, including its public contract and failure behavior.
4. Consider ownership, data lifetime, validation, compatibility, and how the behavior will be tested.
5. Compare alternatives only when they materially change cost, risk, or future flexibility. Explain the trade-off in concrete terms.
6. Implement behind existing seams where possible. Add a new shared layer only when multiple real consumers justify it.
7. Validate the design at its narrowest boundary and revise if the code becomes harder to reason about than the problem.

Document durable architectural decisions using the repository’s established format. Do not write an architecture document for a routine localized change. Preserve existing behavior unless a deliberate behavior change is part of the requirement.
