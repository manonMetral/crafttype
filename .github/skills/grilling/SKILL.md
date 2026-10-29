---
name: grilling
description: Clarify a software request before implementation when key behavior or scope is ambiguous. Use when multiple plausible interpretations would lead to materially different outcomes.
---

# Clarify the request

Ask only questions that change the implementation or its acceptance criteria.

1. Restate the desired outcome internally as observable behavior.
2. Inspect the existing product and repository to resolve questions already answered by code or conventions.
3. Identify the highest-impact remaining ambiguity: scope, user behavior, data handling, or a design choice with lasting consequences.
4. Ask one focused question at a time. Offer a small set of plausible choices when that makes answering easier, and mark a recommended choice only when evidence supports it.
5. Record the answer and continue. Do not ask the user to decide low-impact implementation details that can be resolved from project conventions.
6. If the user delegates judgment, choose the simplest reversible option and state the assumption.

Stop clarifying when the expected behavior is testable. Do not turn routine implementation into an interview.
