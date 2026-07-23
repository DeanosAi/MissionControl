# Mission Control V3 - Architecture Baseline Alpha

This release is the official foundation for future Mission Control V3 development.

It combines:

- the source recovered from the live Mission Control V2 deployment;
- all V2 Ideas, AI Builds, Content, Projects, Automations, Workflows, integrations, local-model, and operational functionality;
- Sprint 1's Conversational Bridge, Orchestrate interface, project hierarchy, proposal workflow, UI concepts, approval boundary, model routing, and Journal integration.

## Canonical source rule

GitHub `main` is the canonical source. The local development checkout and the VPS deployment must resolve to the same Git commit. Direct source edits on the VPS are prohibited; emergency fixes must be committed back to GitHub before the incident is closed.

Environment files, database contents, generated builds, dependencies, and runtime data are deployment state and are not committed.

## Sprint boundary

The baseline can receive a conversational build request, retrieve context, create or reuse a project, generate a proposal and UI concept, record its reasoning, accept revisions, and record approval.

Approval does not create implementation tasks, change a repository, execute code, spend money, or deploy software.

## Required verification

Before a release is considered aligned:

1. TypeScript must pass.
2. The production Next.js build must pass.
3. Changed source must pass focused ESLint.
4. Database migrations must be applied successfully.
5. The authenticated Orchestrate, Projects, Journal, Ideas, and existing task workflows must be smoke tested.
6. GitHub, the local checkout, and the VPS checkout must report the same commit.

## Baseline tag

The annotated Git tag for this foundation is:

`mission-control-v3-architecture-baseline-alpha`

Every later sprint must identify this baseline and preserve the approval-first, model-agnostic architecture.
