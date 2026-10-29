---
name: clean-context
description: Reduce irrelevant working context while preserving requirements, decisions, and current state. Use when a long task or conversation is becoming difficult to navigate.
---

# Clean context

Reduce noise without discarding information needed to continue safely.

## Before compressing

- Preserve the user’s exact goal, constraints, and unresolved questions.
- Record repository facts that were verified, including paths, commands, and test results.
- Distinguish observed facts from assumptions and proposals.
- Note files changed, actions completed, and the next concrete step.
- Keep errors and blockers, especially any failed validation or external side effect.

## Then

Remove repeated explanations, stale hypotheses, and details that can be cheaply rediscovered. Prefer durable repository artifacts for project decisions when the task calls for them; do not create planning files merely to shorten a conversation. Never discard security-relevant context, user approvals, or warnings about uncommitted changes.

## Resume check

After summarizing, verify that the remaining context is sufficient to continue without rereading everything. If a key fact is uncertain, label it and re-check the source before acting. Context cleanup must not imply that work was saved, committed, or verified when it was not.
