---
name: triage
description: Assess and prioritize a reported defect or operational problem using impact, reproducibility, and evidence. Use when deciding what to investigate or fix first.
---

# Triage

Separate what is known from what is suspected before assigning urgency.

1. Capture the affected capability, user impact, start time, scope, and any workaround.
2. Gather a minimal reproducible example, relevant logs, and environment/version details. Redact credentials and personal data.
3. Classify impact by breadth, severity, data integrity, security, and availability. Do not equate loudness with urgency.
4. Check for recent changes and existing reports. Reproduce safely without modifying production state.
5. Assign a priority with a short rationale and confidence level. Mark missing evidence explicitly.
6. Choose the next action: mitigate, investigate, fix, monitor, or close as not reproducible. State an owner only when assigned.

Escalate immediately when there is credible risk to sensitive data, safety, or widespread service availability. Preserve evidence and follow the project’s incident process. Do not promise a resolution time without an authorized estimate.
