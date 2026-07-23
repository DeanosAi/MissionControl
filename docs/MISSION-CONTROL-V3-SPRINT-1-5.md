# Mission Control V3 – Sprint 1.5

## Decision Engine & Intelligence Layer

Baseline: `mission-control-v3-architecture-baseline-alpha`  
Constitution: `docs/MISSION-CONTROL-CONSTITUTION.md`, version 1.0.0

Sprint 1.5 extends the deployed Conversational Bridge, Projects, Tasks, Journal, Memory, AI Infrastructure, Automations, database, and UI. It is not a rewrite and it does not add autonomous code execution.

## Request lifecycle

Every Chat request enters the Decision Engine intake. Existing explicit task and memory commands keep their established handlers and are recorded as deliberate routes. A product or significant-change request continues through the complete intelligence pipeline:

1. Receive and record the request.
2. Understand intent.
3. Create, reuse, or nest the project through the existing Projects module.
4. Retrieve project context and Journal history.
5. Search User, Project, Decision, Research, and Operational Memory through unified retrieval.
6. Retrieve measurable decision and routing outcomes.
7. Select a product-planning capability by value, not provider priority.
8. Generate at least three credible approaches.
9. Critique every approach against explicit criteria.
10. Recommend one approach and explain why the others were not selected.
11. Constructively challenge the request where appropriate.
12. Produce the proposal and UI wireframe.
13. Persist the decision, alternatives, routing record, and proposal.
14. Wait for approval.

Approval still does not create a task, modify code, deploy, or execute a build.

## Decision Engine

The central service lives under `src/lib/decision-engine`.

- `intake.ts` records the Decision Engine entry point for every Chat request.
- `prompt.ts` defines the multi-option, critique-first reasoning contract.
- `output.ts` validates model output and supplies a safe internal three-option fallback.
- `repository.ts` stores decision runs and measurable outcomes.
- `service.ts` assembles context, invokes capability routing, handles cost pauses, and returns a structured recommendation.

Decision analysis is stored on the orchestration request for the current UI and in `decision_runs` for revision history.

## Specialised memory

Durable memory now has five domains:

- User Memory;
- Project Memory;
- Decision Memory;
- Research Memory;
- Operational Memory.

`src/lib/memory-domains/retrieval.ts` provides the unified interface. It searches current and archived records together, ranks relevance, scopes project information, and marks retrieved records as accessed. The existing Memory page and chat commands remain compatible through `src/lib/memory.ts`, which now writes curated notes into User Memory.

The lifecycle service archives older, lower-importance records after the configured retention period. Archive status is invisible to the user during retrieval.

## Capability and cost routing

`src/lib/capability-registry.ts` evaluates available models for:

- capability fit;
- cost;
- speed;
- reliability;
- availability;
- context window;
- recent performance;
- local availability;
- privacy.

The router estimates tokens and cost before a call. It prefers an affordable suitable route. If the best suitable route exceeds the policy threshold or has unknown cost, the orchestration status becomes `cost-approval-required`. The UI explains the estimate and alternative routes. Approval is scoped to Decision Engine analysis and does not approve implementation.

Provider adapters remain replaceable. Existing model names are registry entries, not workflow roles.

## Weekly Research Engine

The existing Automations scheduler now supports a `research` run type and seeds one weekly technology research schedule.

The Research Engine:

- collects controlled HTTPS snapshots from configured first-party or authoritative sources;
- evaluates meaningful changes instead of listing news;
- uses previous Research Memory and measured outcomes;
- writes reports containing all required advantages, disadvantages, impact, migration, cost, and rationale fields;
- ends each report as Recommended, Optional, or Not Recommended;
- leaves every report in `pending-review`;
- never adopts a technology automatically.

If no configured evaluation model is available, the engine records a safe partial run and makes no unsupported recommendation. If estimated evaluation cost exceeds the threshold, it pauses before the model call.

## Continuous learning

Learning is evidence-based and explainable. It is not self-modifying code.

Mission Control records:

- routing attempts and recoveries;
- estimated cost;
- latency and success;
- user approvals;
- requested revisions;
- selected options;
- research recommendation changes.

Capability routing consumes recent success rates. Decision and research prompts receive outcome context. Changed research recommendations must explain what evidence changed.

## Constitution

`docs/MISSION-CONTROL-CONSTITUTION.md` is the permanent architecture document. Its version is stored with decision runs and orchestration requests, and registered in `constitution_versions`.

Future sprints must cite the active Constitution and the Architecture Baseline Alpha. Amendments require a proposal, rationale, approval, version change, database record, and Journal entry.

## Database migration

Existing deployments apply:

```bash
docker exec -i mission-control-postgres \
  psql -U mission_control -d mission_control \
  < database/migrations/005_decision_engine.sql
```

The migration includes the canonical fresh-install schema in `database/init/004_decision_engine.sql`.

It preserves all existing tables and records, migrates existing curated notes into User Memory, adds Decision Engine state, adds capability/routing evidence, extends Automations for research, and registers Constitution version 1.0.0.

## Verification boundary

Sprint 1.5 is not complete until:

- TypeScript, ESLint, and the production build pass;
- the migration is tested against a clean database and the production backup;
- fallback, cost-pause, revision, approval, archive retrieval, routing, and research paths are checked;
- authenticated desktop/mobile pages are smoke tested;
- existing Ideas, Tasks, Projects, Journal, Automations, local model, and Chat features remain intact;
- GitHub, the canonical local clone, and the VPS resolve to the same release commit.
