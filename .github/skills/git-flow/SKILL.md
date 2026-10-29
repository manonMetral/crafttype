---
name: git-flow
description: Move a change safely through branches, commits, and pull requests. Use when preparing or publishing repository changes with Git.
---

# Git flow

Preserve the user’s work and make each published change understandable.

## Before changing history

1. Check the current branch and working-tree status. Identify edits that predate the task.
2. Keep unrelated user changes intact. Do not reset, discard, amend, or force-push unless the user explicitly requests that exact action.
3. Use the repository’s branch and commit conventions. Keep commits focused and messages descriptive.
4. Review the staged diff before committing; stage only intended files.
5. Run relevant checks and report what did and did not pass.

## Pull requests

Use the repository’s PR template if one exists. Explain the problem, implementation, and validation; call out behavior changes and migration needs. Link relevant work items when available. Do not claim approval or merge readiness without evidence. If authentication or repository scope blocks a write, report the precise boundary rather than implying the user lacks permission.
