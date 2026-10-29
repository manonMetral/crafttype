---
name: agentic-tests
description: Design bounded, observable tests for AI-assisted software changes. Use when planning or reviewing automated tests involving agents, tools, generated output, or non-deterministic behavior.
---

# Agentic tests

Build tests that demonstrate the intended contract while keeping agent behavior observable and bounded.

## Procedure

1. Identify the behavior under test and the observable result that proves it. Prefer stable outputs and state transitions over judging an agent's prose.
2. Separate deterministic logic from model-dependent behavior. Unit-test deterministic helpers directly; reserve integration tests for the actual boundary that needs coverage.
3. Provide the test with the minimum fixture and permissions needed. Stub external services unless the test specifically validates that integration.
4. Bound loops, retries, tool calls, output size, and elapsed time. Make each limit explicit and ensure a limit breach fails visibly rather than appearing successful.
5. Cover success, malformed or incomplete output, tool failure, and cancellation where applicable. Include a regression case for the reported defect.
6. Record relevant inputs, tool calls, and final assertions so a failure can be diagnosed without exposing secrets or unnecessary user data.
7. Run the narrow test first, then the smallest broader suite that covers the changed boundary.

## Quality bar

A test should fail for the defect it is meant to prevent, pass for the correct behavior, and avoid dependence on timing, remote state, or wording that is not part of the contract. Do not claim deterministic coverage of probabilistic behavior; describe the boundary and residual uncertainty.
