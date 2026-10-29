---
name: verify-factory
description: Verify a software change through explicit, proportionate checks. Use before reporting completion, merging, or releasing a change.
---

# Verify the change

Build confidence from checks that directly cover the changed behavior.

1. Map each requirement to a test, static check, or explicit manual inspection.
2. Start with the narrowest relevant check; expand to integration or full-suite validation when risk or coupling warrants it.
3. Confirm the command completed successfully and inspect failures rather than relying only on its exit status.
4. Review the diff for unintended changes, missing error handling, and accidental configuration or generated-file updates.
5. Check migrations, compatibility, and documentation when the change affects them.
6. Report exact commands and results. Distinguish checks that passed, failed, were skipped, or could not run.

A successful build is not proof of correct behavior. Do not state that something is verified when only a proxy check ran. If a failure predates the change, provide evidence and keep it separate from regressions caused by the patch.
