# Mission Control V3 — Sprint 1.6

## Human-Centred Workspace, AI Provider Management & Digital Persona

Date: 24 July 2026  
Baseline: `mission-control-v3-architecture-baseline-alpha`  
Constitution: version 1.0.0  
Design approval: Concept Two foundation with selected Concept One and Concept Three patterns

## Product outcome

Sprint 1.6 moves Mission Control from a growing chat interface toward a calm operating workspace.

The production direction combines:

- the structured Conversation Workspace from Concept Two;
- the daily orientation and universal command surface from Concept One;
- the persona states, mobile approval sheet, and future voice foundations from Concept Three.

Voice capture is intentionally not implemented. The composer, microphone location, responsive layout, persona states, and interaction boundaries are in place so speech input can be attached later without redesigning the product.

## Conversation Workspace

The Orchestrate screen now centres work rather than message history.

It includes:

- a persistent project header with phase, progress, approval status, estimated planning cost, weekly research status, and contributing capabilities;
- structured proposal cards with an always-visible executive summary and recommendation;
- expandable alternatives, trade-offs, safeguards, reasoning, memory use, project impact, and UI previews;
- a live context panel for projects, memory, decisions, research, tasks, automations, and recent learning;
- a sticky approval surface on desktop and a compact fixed approval sheet on mobile;
- approve, request changes, reject, view proposal, and compare options controls;
- conversation history as supporting evidence rather than the primary layout;
- an approval boundary that records decisions but never starts implementation.

Reject is now a complete decision outcome. It writes to Decision Memory, decision outcomes, and the Journal.

## Dashboard

The dashboard is now a daily Command Centre rather than a collection of general metrics.

It surfaces:

- approvals requiring attention;
- running work;
- active projects;
- weekly technology research;
- recently learned information;
- active automations;
- the approval boundary;
- a universal command entry into the Conversation Workspace.

The hierarchy is designed for scanning on a phone, with progressive detail rather than walls of text.

## Digital Persona

A reusable Digital Persona component supports:

- greeting;
- thinking;
- listening;
- celebrating;
- warning;
- waiting.

This is a framework, not final mascot artwork. Motion respects reduced-motion preferences.

## AI Provider Management

`/ai-providers` is now the single management location for hosted and local AI services.

It includes:

- provider enablement and connection state;
- write-only encrypted API credential management;
- capabilities and registered model counts;
- pricing guidance;
- health state and last successful call;
- preferred usage and routing priority;
- connection testing;
- strengths, weaknesses, privacy implications, and recommendation rationale;
- the existing Local Models management interface.

The former `/local-models` page redirects into AI Providers.

## Provider security

Stored credentials use AES-256-GCM.

- `PROVIDER_CREDENTIALS_KEY` must be a base64-encoded 32-byte key.
- API keys are never returned to the browser after save.
- API keys are never written to the Journal.
- API keys are never added to model prompts.
- The UI shows only configuration state and a short fingerprint.
- Existing environment variables remain a backward-compatible credential source.

No external secret-management service was introduced.

## Capability routing

Ideas, conversational planning, research, and explicit task execution now use capabilities rather than asking the user to choose a vendor.

Routing continues to consider:

- capability;
- cost;
- speed;
- reliability;
- availability;
- context window;
- recent performance;
- local availability;
- privacy;
- provider priority.

Historical tasks with provider names remain compatible through a translation layer.

## Legacy remediation

Sprint 1.6 removed:

- duplicate unused Ideas chat and research handlers;
- direct provider selection from active Ideas chat and research;
- named-provider build choices in Ideas;
- provider-specific GPT health API and Systems card;
- the legacy static AI model map.

OAuth/tunnel scripts remain until the live VPS entry point can be inventoried safely.

## Database changes

The additive provider migration creates:

- `mission_control.ai_providers`;
- `mission_control.ai_provider_credentials`;
- `mission_control.ai_provider_connection_tests`.

It seeds OpenAI, Anthropic, Moonshot, and Local Models without copying secret values.

## Validation

- ESLint passes.
- TypeScript passes.
- The optimized Next.js production build passes.
- Conversational intent regression tests pass: 11 cases.
- `npm audit` reports zero known vulnerabilities.
- Clean database initialization passes.
- The provider migration passes against a temporary clone of the live production database.
- The provider summary query returns all four provider records and registered capability data.
- The temporary validation database was removed after testing.

## Preserved boundaries

- Existing modules are extended, not rewritten.
- The Decision Engine remains central.
- Specialised memory and unified retrieval remain intact.
- Mission Control remains provider agnostic.
- Significant decisions are journaled.
- No autonomous coding or deployment was introduced.
- Proposal approval remains a decision record, not an execution trigger.
