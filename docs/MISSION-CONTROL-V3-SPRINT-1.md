# Mission Control V3 - Sprint 1

## Conversational Orchestration Layer

Sprint 1 adds a `Conversational Bridge` above the existing Mission Control modules. It does not replace or duplicate Projects, Tasks, Journal, Memory, Automations, Workflows, or model providers.

The user-facing flow is:

1. The user describes an outcome in `/chat`, such as `Build me a grocery tracker.`
2. Mission Control detects a product or significant-change request.
3. The Bridge searches existing Projects and classifies the request as:
   - a new project;
   - a child project; or
   - a continuation of an existing project.
4. The existing Projects module creates or reuses the project record.
5. Project journal history and curated Memory are loaded as planning context.
6. The model router chooses an available planning capability. The user does not choose a provider.
7. The Bridge produces a structured product proposal and UI wireframe preview.
8. The proposal, decision rationale, model recovery events, and project relationship are written to the existing Journal.
9. The user can approve the proposal or request a revision.
10. Approval is journaled and the project moves to `planning`.

Sprint 1 stops here. Approval does not create tasks, run a model as an execution agent, modify a codebase, or deploy anything.

## New reusable modules

- `src/lib/projects.ts` - database-backed Projects hierarchy.
- `src/lib/conversational-bridge/intent.ts` - request detection and project classification.
- `src/lib/conversational-bridge/model-router.ts` - capability-based, provider-neutral model selection and recovery.
- `src/lib/conversational-bridge/proposal.ts` - proposal contract, prompts, parsing, journal formatting, and internal fallback plan.
- `src/lib/conversational-bridge/repository.ts` - orchestration request persistence and approval state.
- `src/lib/conversational-bridge/service.ts` - the end-to-end Bridge workflow.

The existing `chat_messages`, `journal_entries`, and `tasks` tables gain optional project and orchestration links. Existing records remain valid.

## State boundary

An orchestration request moves through:

`received -> planning -> proposal-ready -> approved`

Optional paths are:

- `proposal-ready -> changes-requested -> proposal-ready`
- any planning failure -> `failed`

There is deliberately no `building`, `executing`, or `deployed` orchestration state in Sprint 1.

## External tools

Proposal technology choices declare whether they are external and whether they require approval. If any choice requires approval, the UI requires a separate explicit confirmation before the overall proposal can be approved. The server enforces the same rule.

## Database migration

Existing deployments must apply:

```bash
docker exec -i mission-control-postgres \
  psql -U mission_control -d mission_control \
  < database/migrations/004_conversational_bridge.sql
```

Fresh database installations receive the same schema from `database/init/003_conversational_bridge.sql`.

Apply the migration before starting the V3 application image because the Chat, Projects, and Journal queries use the new relationships.

## Deployment safety

Before production deployment, reconcile the repository with the latest VPS-only V2 changes documented in `MISSION-CONTROL-WORK-SUMMARY.md`. The current repository history does not contain every source patch described as deployed on April 13-14, 2026.

## Verification

- `npx tsc --noEmit`
- targeted ESLint over all Sprint 1 files
- `npm run build`
- intent and project-classification checks for new, existing, and non-build messages
- migration and browser workflow verification against a Postgres-backed environment before production deployment
