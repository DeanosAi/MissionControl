# Mission Control V3 – AI Provider Legacy Audit

Date: 24 July 2026  
Sprint: 1.6 – Human-Centred Workspace, AI Provider Management & Digital Persona  
Baseline: `mission-control-v3-architecture-baseline-alpha`  
Constitution: version 1.0.0  
Status: Design-gate audit complete; production clean-up intentionally deferred until concept approval

## Scope and safety

This audit covers tracked application code, routes, scripts, database definitions, documentation, deployment configuration, and environment-variable references.

No live secret value was read into this report. The tracked repository was scanned for common API-key, private-key, and token signatures. No plaintext API key, private key, or JWT-like token was detected.

One tracked password hash is present in `.env.example`. Although a password hash is not a plaintext credential, a real-looking account hash should not be distributed as example configuration. It should be replaced with a neutral placeholder during the implementation phase.

## Current provider architecture

Mission Control currently has two overlapping provider systems.

### Sprint 1.5 capability architecture

- `src/lib/capability-registry.ts` ranks model candidates by capability, cost, speed, reliability, context window, privacy, availability, and recent performance.
- `src/lib/conversational-bridge/model-router.ts` invokes the chosen provider adapter and records routing outcomes.
- `mission_control.capability_registry` stores model capability and pricing profiles.
- `mission_control.routing_policies` stores cost and selection policy.
- `mission_control.model_routing_events` stores measurable outcomes.
- OpenAI, Anthropic, Moonshot, and local-model adapters are replaceable behind the conversational routing contract.

This is the correct architectural direction and should become the single source of truth.

### Legacy provider paths

Several older modules still select vendors or models directly:

1. Ideas chat and research call the Moonshot adapter directly.
   - `src/app/api/ideas/[id]/chat/route.ts`
   - `src/app/api/ideas/[id]/research/route.ts`
2. Duplicate, unused non-API Ideas route handlers also call Moonshot directly.
   - `src/app/ideas/[id]/chat/route.ts`
   - `src/app/ideas/[id]/research/route.ts`
3. Task execution maps labels such as GPT, Codex, Claude, and Kimi directly to hard-coded model IDs.
   - `src/lib/task-execution.ts`
4. Task create/edit forms still assign named AI team members rather than capabilities.
   - `src/lib/ai-team.ts`
   - `src/app/projects/current-tasks/task-create-form.tsx`
   - `src/app/projects/current-tasks/task-edit-form.tsx`
5. Dashboard usage, Systems health, Usage, Team, Ideas, and static data modules contain provider-first language.
6. OpenAI OAuth tunnel health is exposed through a provider-specific route and UI.
   - `src/app/api/gpt-status/route.ts`
   - `src/lib/ai/gpt-oauth-status.ts`
   - `src/app/systems/health-panel.tsx`
7. Local models have a separate management page and data path instead of appearing as a provider type in one provider-management experience.

These paths do not invalidate Sprint 1.5, but they prevent the capability registry from being the complete provider-management boundary.

## Environment and deployment findings

Provider-related environment variables currently include:

- `OPENAI_OAUTH_ENDPOINT`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `MOONSHOT_API_KEY`

Related integration variables include Google Workspace, N8N, research sources, and the automation tick token.

Findings:

- `.env.example` includes a real-looking administrator password hash and should use a placeholder.
- `N8N_WEBHOOK_SECRET` is referenced by the webhook route but is absent from `.env.example` and `docker-compose.yml`.
- OpenAI OAuth support has accumulated numerous overlapping setup, start, update, disable, and tunnel scripts. Their current operational status must be verified before deletion.
- Provider availability is inferred directly from environment variables. The future provider service should own this logic.
- API keys must never be returned to the browser, written to the Journal, included in prompts, or shown after save.

## Dead and duplicate code candidates

The following handlers have no in-repository callers and duplicate the active `/api/ideas/...` handlers:

- `src/app/ideas/[id]/chat/route.ts`
- `src/app/ideas/[id]/research/route.ts`

They are strong removal candidates after a route-access check against production logs.

The OpenAI OAuth script collection contains overlapping generations of the same workflow. It requires an operational inventory before consolidation because the live VPS may still depend on one of these scripts outside the repository.

## Safe clean-up plan

Production clean-up should happen after the Sprint 1.6 design direction is approved.

1. Add a provider repository and adapter registry as the single management boundary.
2. Migrate existing environment-backed OpenAI, Anthropic, Moonshot, and local configurations into provider records without copying secret values into logs or migrations.
3. Keep environment variables as a backward-compatible credential source during migration.
4. Route Ideas chat and research through capability selection.
5. Route task execution through capabilities while preserving existing task records and approval boundaries.
6. Replace named-model task assignments with capability assignments; retain a compatibility mapper for old records.
7. Fold Local Models into AI Providers as a local-provider type and redirect the old page.
8. Replace provider-specific health and usage widgets with provider-service summaries.
9. Verify production access logs, then remove the duplicate non-API Ideas handlers.
10. Consolidate OAuth/tunnel scripts only after identifying the live entry point.
11. Replace the example administrator hash with a placeholder and add the missing webhook-secret variable.
12. Journal the migration, compatibility fallbacks, removals, and deployment outcome.

## Recommended provider data boundary

The Provider Management implementation should separate:

- provider identity and enablement;
- credentials and credential source;
- models and capabilities;
- pricing and review date;
- routing priority and preferred usage;
- health checks and last successful call;
- privacy notes, strengths, weaknesses, and recommendation rationale.

Credentials should be write-only in the UI. Mission Control should display only `configured`, `not configured`, or a short non-sensitive fingerprint. A local encrypted credential store can be implemented with an environment-held encryption key, while continuing to support environment-variable credentials. Adopting an external secret manager would require a separate recommendation and approval.

## Audit conclusion

The Sprint 1.5 capability registry is the correct foundation. Sprint 1.6 should not add another parallel provider system. It should place a secure management service and human-readable UI above the registry, then migrate legacy callers behind that boundary.

