import {
  decisionEngineOutputSchema,
  type DecisionEngineOutput,
} from '@/lib/decision-engine/types';
import { buildFallbackProposal } from '@/lib/conversational-bridge/proposal';
import type { ProjectRecord } from '@/lib/projects';
import type { RequestIntent } from '@/lib/conversational-bridge/types';

function extractJson(value: string): unknown {
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The Decision Engine did not return structured JSON.');
  return JSON.parse(trimmed.slice(start, end + 1));
}

export function parseDecisionEngineOutput(value: string): DecisionEngineOutput {
  const parsed = decisionEngineOutputSchema.parse(extractJson(value));
  const optionIds = new Set(parsed.decision.options.map((option) => option.id));
  if (!optionIds.has(parsed.decision.recommendation.optionId)) {
    throw new Error('The recommended option does not match a generated solution.');
  }
  for (const evaluation of parsed.decision.critique.evaluations) {
    if (!optionIds.has(evaluation.optionId)) {
      throw new Error('The critique refers to an option that was not generated.');
    }
  }
  return parsed;
}

export function buildFallbackDecisionOutput(input: {
  request: string;
  intent: RequestIntent;
  project: ProjectRecord;
  memorySummary?: string;
}): DecisionEngineOutput {
  const base = buildFallbackProposal(input);
  const focusedTitle = `Focused ${input.project.title} beta`;
  return {
    decision: {
      understoodIntent: input.intent.normalizedIntent,
      contextSummary: `${input.project.title} should be shaped as one maintainable project that extends the existing Mission Control planning, approval, journal, and memory services.`,
      memorySummary: input.memorySummary || 'Mission Control searched unified memory. No stronger prior constraint changed the safe default.',
      researchSummary: 'Available project and research memory was considered. External technology research should be proposed only if the approved beta genuinely needs it.',
      options: [
        {
          id: 'focused-existing',
          title: focusedTitle,
          summary: 'Use existing Mission Control modules and deliver the smallest coherent end-to-end product flow.',
          advantages: ['Lowest integration risk.', 'Fastest path to useful feedback.', 'Keeps permanent context and approvals in Mission Control.'],
          disadvantages: ['Advanced integrations are deliberately deferred.'],
          complexity: 'medium',
          riskLevel: 'low',
          estimatedCostBand: 'none',
          usesExternalTools: false,
        },
        {
          id: 'workflow-first',
          title: 'Workflow-first prototype',
          summary: 'Prove the core data and workflow with a very light interface before investing in a complete product surface.',
          advantages: ['Tests the operating logic early.', 'Reduces UI rework if assumptions change.'],
          disadvantages: ['Feels less complete to test.', 'May under-test the intended user experience.'],
          complexity: 'low',
          riskLevel: 'medium',
          estimatedCostBand: 'none',
          usesExternalTools: false,
        },
        {
          id: 'integration-rich',
          title: 'Integration-rich first release',
          summary: 'Include external services and advanced automation in the first release.',
          advantages: ['Can demonstrate a broader long-term vision.', 'May reduce later manual steps.'],
          disadvantages: ['Introduces approval, cost, reliability, privacy, and maintenance dependencies before the core need is proven.'],
          complexity: 'high',
          riskLevel: 'high',
          estimatedCostBand: 'unknown',
          usesExternalTools: true,
        },
      ],
      critique: {
        criteria: ['Immediate user value', 'Friction', 'Reuse of existing architecture', 'Delivery risk', 'Cost and external dependency'],
        evaluations: [
          {
            optionId: 'focused-existing',
            strengths: ['Best balance of useful scope, design quality, and low architectural risk.'],
            weaknesses: ['Defers optional automation and integrations.'],
            fitScore: 90,
            verdict: 'The strongest first release because it proves the real experience without creating unnecessary dependencies.',
          },
          {
            optionId: 'workflow-first',
            strengths: ['Very economical way to validate data and rules.'],
            weaknesses: ['Does not fully validate the seamless interface the user values.'],
            fitScore: 72,
            verdict: 'Useful when requirements are highly uncertain, but weaker for validating the complete experience.',
          },
          {
            optionId: 'integration-rich',
            strengths: ['Broadest initial feature set.'],
            weaknesses: ['Highest cost, complexity, and chance of solving the wrong problem.'],
            fitScore: 48,
            verdict: 'Better treated as a later expansion after the core product has earned it.',
          },
        ],
      },
      recommendation: {
        optionId: 'focused-existing',
        rationale: 'It delivers a testable, designed experience while respecting the existing architecture, approval boundary, and preference for low friction.',
        whyNotOthers: [
          'The workflow-only option does not test enough of the intended experience.',
          'The integration-rich option adds cost and risk before the core workflow is proven.',
        ],
        confidence: 'high',
      },
      challenge: {
        needed: true,
        explanation: 'Mission Control recommends proving the smallest complete user outcome before adding automation or external integrations, even if the original idea could support them.',
      },
    },
    proposal: {
      ...base.proposal,
      title: `${input.project.title}: recommended focused beta`,
      whyThisApproach: 'Mission Control compared a focused existing-module beta, a workflow-only prototype, and an integration-rich release. The focused beta is recommended because it gives the best user-value, friction, cost, and maintainability balance.',
    },
    uiPreview: base.uiPreview,
  };
}

export function formatDecisionForJournal(output: DecisionEngineOutput): string {
  const optionLines = output.decision.options.map((option) => (
    `- ${option.title}: ${option.summary} Advantages: ${option.advantages.join('; ')} Disadvantages: ${option.disadvantages.join('; ')}`
  ));
  return [
    `Understood intent: ${output.decision.understoodIntent}`,
    '',
    'Options considered:',
    ...optionLines,
    '',
    `Recommended: ${output.decision.recommendation.optionId}. ${output.decision.recommendation.rationale}`,
    `Why not the others: ${output.decision.recommendation.whyNotOthers.join(' ')}`,
    `Constructive challenge: ${output.decision.challenge.explanation}`,
    '',
    'No implementation or autonomous execution started.',
  ].join('\n');
}
