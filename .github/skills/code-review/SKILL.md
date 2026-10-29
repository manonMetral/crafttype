---
name: code-review
description: Review a patch for concrete correctness, reliability, and maintainability defects. Use when asked to review changes rather than implement them.
---

# Code review

Review the diff against the intended behavior. Report only actionable findings supported by the code.

## Method

1. Read the change and enough surrounding code to understand its callers, data flow, and existing conventions.
2. Check behavior at boundaries: invalid input, empty values, errors, concurrency, persistence, and compatibility where relevant.
3. Follow changed logic into affected call sites and tests. Do not infer a defect solely from naming or style.
4. For each finding, identify the exact location, the triggering condition, the user-visible or operational consequence, and a concise fix direction.
5. Rank by impact and likelihood. Separate definite defects from questions or optional improvements.
6. If no actionable issue is evident, say so plainly and note any important coverage gap.

Do not rewrite the code during a review unless asked. Avoid speculative findings, broad redesign requests, and style comments that do not affect correctness or established project rules. Never claim tests were run unless you ran them.
