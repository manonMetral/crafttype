---
name: to-spec
description: Convert an informal problem or feature request into concise, testable requirements. Use before implementation when expected behavior is unclear or spans several cases.
---

# Write a specification

Describe outcomes and constraints without prescribing code prematurely.

## Capture

- Who needs the behavior and what problem it addresses.
- The current behavior and the desired change.
- Inputs, outputs, state transitions, and relevant permissions.
- Success conditions and important rejection or failure cases.
- Constraints such as compatibility, performance, privacy, and rollout.

## Validate

Write acceptance criteria as observable statements that can be checked manually or automatically. Use concrete examples for ambiguous cases. Separate required behavior from optional follow-up work. Call out assumptions and questions that could change scope.

Keep the spec proportional: a small bug may need only a few criteria; a cross-system feature needs explicit boundaries and failure handling. Ask for confirmation only where unresolved choices materially change behavior. Do not smuggle an architectural decision into a requirement unless it is a genuine constraint.
