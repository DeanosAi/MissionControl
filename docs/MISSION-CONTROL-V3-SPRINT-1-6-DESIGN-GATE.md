# Mission Control V3 – Sprint 1.6 Design Gate

## Human-Centred Workspace, AI Provider Management & Digital Persona

Baseline: `mission-control-v3-architecture-baseline-alpha`  
Constitution: `docs/MISSION-CONTROL-CONSTITUTION.md`, version 1.0.0  
Status: Interactive concepts ready for review; production UI not yet replaced

## Why this gate exists

Sprint 1.6 explicitly requires three interactive concepts and review of the preferred direction before production UI implementation. The concept route is therefore isolated from existing Mission Control screens and does not change the Decision Engine, Conversational Bridge, approvals, memory, provider calls, tasks, or production data.

The protected review route is:

`/design/sprint-1-6`

## Product-design challenge

The brief describes valuable ingredients, but applying every persistent panel at once would create the cognitive load the sprint is meant to remove. The concepts therefore distinguish between:

- **orientation**, which should remain visible;
- **decision content**, which should be progressively disclosed;
- **supporting context**, which should stay one touch away;
- **system internals**, which should be translated into capability progress;
- **approval**, which must remain visible without dominating the experience.

The design also treats mobile as the primary constraint rather than a compressed desktop layout.

## Concept One – Command Centre

### Design philosophy

A calm morning dashboard leads with the next decision, current work, and a universal command field. Conversation is one mode inside a broader operating centre.

### Strengths

- Best daily orientation.
- Strong overview of projects, approvals, research, and running work.
- Familiar transition from the existing dashboard.
- Excellent for scanning.

### Weaknesses

- Conversation feels less central.
- Complex proposals need a separate focused view.
- More navigation is required during a long decision.

### Why it suits Mission Control

It is the safest evolutionary step and makes the existing modules easier to understand without hiding them.

## Concept Two – Conversation Workspace

### Design philosophy

One focused workspace combines a persistent project header, structured proposal cards, live context, capability contributions, and a sticky approval rail. Message history becomes supporting evidence rather than the main interface.

### Strengths

- Best balance of conversation, context, and decision-making.
- Large proposals become scannable.
- Approval remains visible.
- Capability activity is transparent without exposing provider mechanics.
- Desktop and mobile can share the same information hierarchy.

### Weaknesses

- Requires the most careful responsive implementation.
- Context can become noisy if relevance ranking is weak.
- Represents a larger change from the current chat screen.

### Why it suits Mission Control

The product is evolving from chat into an operating system for decisions. This concept gives the Decision Engine a native interface instead of squeezing structured work into message bubbles.

## Concept Three – Voice-first Assistant

### Design philosophy

A listening surface and concise response sheet make the persona the primary point of contact. Visual controls confirm what Mission Control heard, what it is doing, and what needs approval.

### Strengths

- Strongest mobile and future voice experience.
- Lowest visual load.
- Makes the digital persona feel coherent.
- Very fast for status questions and short approvals.

### Weaknesses

- Dense proposals require a secondary visual workspace.
- Voice is not implemented in Sprint 1.6.
- Less efficient for comparing detailed alternatives.
- Risks making the persona more prominent than the work.

### Why it suits Mission Control

It validates the long-term destination and ensures current components will not block future voice interaction.

## Recommendation

Adopt **Concept Two – Conversation Workspace** as the production foundation.

Borrow:

- the calm daily-priority landing view and universal command field from Command Centre;
- the persona states, listening affordance, and compact mobile approval sheet from Voice-first Assistant.

This hybrid is not a fourth concept. It is Concept Two with proven supporting patterns from the other explorations.

## Proposed production sequence after approval

1. Establish the shared workspace shell, mobile navigation, structured proposal components, and persona-state component.
2. Connect real project, memory, decision, research, task, automation, and routing data through existing services.
3. Redesign the dashboard around in-progress work, approvals, research, and recent learning.
4. Implement the provider repository, secure credential boundary, adapter registry, database migration, and Provider Management page.
5. Migrate legacy Ideas and Tasks routing behind capability selection.
6. Consolidate provider-specific health, usage, AI Team, and Local Models surfaces.
7. Remove verified dead provider routes and obsolete configuration.
8. Run accessibility, mobile, migration, security, regression, and production-parity validation.

No step adds autonomous code execution. Proposal approval remains a recorded decision boundary and does not execute a build.

