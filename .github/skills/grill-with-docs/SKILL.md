---
name: grill-with-docs
description: Answer technical questions by grounding decisions in authoritative documentation. Use when API behavior, compatibility, or a framework detail must be verified.
---

# Verify with documentation

Use documentation to resolve specific technical uncertainty, not as a substitute for understanding the task.

1. Formulate the exact question, including library and version when relevant.
2. Prefer official documentation, release notes, and source references for the version in use. Treat tutorials and forum posts as secondary evidence.
3. Read the narrow section that addresses the question and check examples against the project’s installed version.
4. Compare the documented behavior with local code and configuration. Note when the project is on a different version or uses a wrapper.
5. State the conclusion and cite the source URL or repository path. Distinguish documented fact from inference.
6. If sources conflict or the answer is not documented, say what remains uncertain and propose a safe local experiment.

Do not invent API parameters or assume that a current web page describes an older dependency. Avoid broad research when a focused check answers the question.
