---
name: to-tickets
description: Split an agreed specification into actionable, reviewable work items. Use when a feature has multiple components or dependencies that need tracking.
---

# Create work items

Turn requirements into slices that can be understood and verified independently.

For each ticket, include a concise outcome, context, acceptance criteria, and any relevant links. Make the smallest useful slice end-to-end where possible; avoid tickets that are only vague phases such as “do backend.” Identify dependencies only when one task truly requires another’s output. Keep independent work parallelizable.

Check that:

- Every required acceptance criterion has an owner ticket.
- Each ticket has a clear completion signal and a reasonable review size.
- Shared contracts or migrations are sequenced before their consumers.
- Optional scope is labeled separately from required delivery.
- Existing issues are searched before creating duplicates.

Do not invent estimates, owners, milestones, or priorities without evidence. Keep implementation details flexible unless they are needed to prevent incompatible work.
