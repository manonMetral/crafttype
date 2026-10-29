---
name: implement
description: Deliver a focused implementation from an agreed requirement. Use when the request calls for implementation rather than explanation or planning alone.
---

# Implement

Deliver the requested behavior with the smallest complete change that fits the codebase.

1. Inspect the relevant implementation, tests, and local instructions before editing.
2. Turn the request into concrete expected behavior. Resolve consequential ambiguity before coding.
3. Follow existing patterns and reuse established helpers. Avoid unrelated cleanup and unnecessary dependencies.
4. Make a coherent edit that handles expected errors and boundary conditions explicitly.
5. Add or adjust tests for the requirement and any regression. Keep tests focused on observable behavior.
6. Run the smallest relevant formatter, test, or type-check command. Fix failures caused by the change; distinguish pre-existing failures.
7. Review the final diff for accidental edits and summarize the change and actual validation.

Preserve uncommitted work. Do not commit or publish unless asked. If blocked by missing access, configuration, or an unresolved decision, report the blocker and the work that remains.
