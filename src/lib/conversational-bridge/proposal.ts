import type { ProjectRecord } from '@/lib/projects';
import {
  bridgeModelOutputSchema,
  type BridgeModelOutput,
  type ProjectClassification,
  type RequestIntent,
} from '@/lib/conversational-bridge/types';

interface ProposalPromptInput {
  request: string;
  intent: RequestIntent;
  project: ProjectRecord;
  classification: ProjectClassification;
  classificationRationale: string;
  projectJournalContext: string;
  memoryContext: string;
  revisionFeedback?: string;
  existingProposal?: BridgeModelOutput | null;
}

export function buildProposalMessages(input: ProposalPromptInput) {
  const revisionBlock = input.revisionFeedback
    ? [
        '',
        'This is a proposal revision.',
        `User feedback: ${input.revisionFeedback}`,
        `Existing proposal: ${JSON.stringify(input.existingProposal)}`,
        'Address the feedback while preserving useful decisions from the existing proposal.',
      ].join('\n')
    : '';

  const system = [
    'You are the product-planning capability inside Mission Control, an AI operating system.',
    'Think as a product designer, UX designer, software architect, engineer, and QA tester before proposing anything.',
    'Do not execute, write production code, create tasks, or claim implementation has started.',
    'Return one valid JSON object only. Do not wrap it in markdown fences.',
    'Use plain English. Make sensible product decisions instead of blindly repeating the request.',
    'Prefer the existing Mission Control architecture and modules. Do not duplicate project, task, journal, memory, workflow, automation, or model-routing features.',
    'If you recommend a new external service or tool, mark external=true and requiresApproval=true. Do not assume it will be adopted.',
  ].join('\n');

  const user = [
    `Original request: ${input.request}`,
    `Normalized intent: ${input.intent.normalizedIntent}`,
    `Project: ${input.project.title}`,
    `Project classification: ${input.classification}`,
    `Classification rationale: ${input.classificationRationale}`,
    `Known project journal context:\n${input.projectJournalContext}`,
    `Curated memory context:\n${input.memoryContext}`,
    revisionBlock,
    '',
    'Return JSON with exactly this shape:',
    JSON.stringify({
      proposal: {
        title: 'Short proposal title',
        summary: 'One paragraph overview',
        whatWillBeBuilt: ['Concrete outcome'],
        whyThisApproach: 'Decision rationale',
        userExperience: ['Step-by-step experience from the user perspective'],
        complexity: { level: 'low | medium | high', explanation: 'Plain-English explanation' },
        risks: [{ risk: 'Risk', mitigation: 'Mitigation' }],
        suggestedImprovements: ['Useful improvement'],
        technologyChoices: [{
          name: 'Technology or existing Mission Control module',
          purpose: 'What it does',
          reason: 'Why it fits',
          external: false,
          requiresApproval: false,
        }],
        acceptanceCriteria: ['Observable beta outcome'],
        outOfScope: ['Anything intentionally deferred'],
        approvalPrompt: 'A short approval question',
      },
      uiPreview: {
        format: 'wireframe',
        styleDirection: 'Visual and interaction direction',
        screens: [{
          name: 'Screen name',
          purpose: 'What the screen enables',
          regions: [{
            label: 'Region label',
            content: ['Visible item or control'],
            interaction: 'Optional interaction note',
          }],
        }],
      },
    }),
  ].filter(Boolean).join('\n');

  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ];
}

function extractJson(value: string): unknown {
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The planning model did not return a JSON proposal.');
  return JSON.parse(trimmed.slice(start, end + 1));
}

export function parseBridgeModelOutput(value: string): BridgeModelOutput {
  return bridgeModelOutputSchema.parse(extractJson(value));
}

export function buildFallbackProposal(input: {
  request: string;
  intent: RequestIntent;
  project: ProjectRecord;
}): BridgeModelOutput {
  const product = input.project.title;
  return {
    proposal: {
      title: `${product} product proposal`,
      summary: `Mission Control will shape ${product} into a focused first release based on this request: ${input.request}`,
      whatWillBeBuilt: [
        `A clear first version of ${product} centred on its main user goal.`,
        'A simple end-to-end flow covering setup, the primary action, and a useful result.',
        'A maintainable foundation that can grow without turning into one oversized project.',
      ],
      whyThisApproach: 'A narrow first release creates something useful quickly, reduces avoidable complexity, and gives real feedback before the product expands.',
      userExperience: [
        `Open ${product} and immediately understand its purpose.`,
        'Complete the main action with minimal setup and clear guidance.',
        'See progress, results, and the next useful action without navigating through unnecessary screens.',
      ],
      complexity: {
        level: 'medium',
        explanation: 'The product needs thoughtful data structure, responsive interface work, validation, and testing, but the first release can remain intentionally focused.',
      },
      risks: [
        { risk: 'The first version could grow beyond the core need.', mitigation: 'Lock the beta to the acceptance criteria and defer optional features.' },
        { risk: 'Important user assumptions may be wrong.', mitigation: 'Use the preview and approval step to confirm the flow before implementation.' },
      ],
      suggestedImprovements: [
        'Validate the main workflow with a small beta before adding advanced automation.',
        'Add analytics or integrations only after the core experience is proven.',
      ],
      technologyChoices: [
        {
          name: 'Existing Mission Control project, journal, and orchestration services',
          purpose: 'Keep planning, approval, and permanent context in one place.',
          reason: 'These modules already exist and should be extended rather than duplicated.',
          external: false,
          requiresApproval: false,
        },
      ],
      acceptanceCriteria: [
        'The primary user can complete the core workflow on desktop and mobile.',
        'The interface communicates status, errors, and the next action clearly.',
        'The beta is testable without any unapproved external service.',
      ],
      outOfScope: ['Autonomous implementation before approval.', 'Unapproved third-party tools and optional integrations.'],
      approvalPrompt: `Does this direction for ${product} look right, or would you like Mission Control to revise it?`,
    },
    uiPreview: {
      format: 'wireframe',
      styleDirection: 'A calm, mobile-first product surface with one obvious primary action, concise guidance, and visible progress.',
      screens: [
        {
          name: 'Home',
          purpose: `Start and understand the main ${product} workflow.`,
          regions: [
            { label: 'Header', content: [product, 'Current status or progress'] },
            { label: 'Primary action', content: ['One clear call to action', 'Short supporting explanation'], interaction: 'Starts the main workflow.' },
            { label: 'Recent activity', content: ['Latest items', 'Useful next action'] },
          ],
        },
        {
          name: 'Core workflow',
          purpose: 'Complete the main product action without distraction.',
          regions: [
            { label: 'Progress', content: ['Current step', 'What remains'] },
            { label: 'Workspace', content: ['Essential inputs', 'Inline guidance', 'Validation feedback'], interaction: 'Updates the result as the user progresses.' },
            { label: 'Outcome', content: ['Clear result', 'Save or continue action'] },
          ],
        },
      ],
    },
  };
}

export function formatProposalForJournal(output: BridgeModelOutput): string {
  const { proposal } = output;
  const risks = proposal.risks.map((item) => `- ${item.risk} Mitigation: ${item.mitigation}`).join('\n');
  return [
    proposal.summary,
    '',
    'What will be built:',
    ...proposal.whatWillBeBuilt.map((item) => `- ${item}`),
    '',
    `Why: ${proposal.whyThisApproach}`,
    '',
    `Complexity: ${proposal.complexity.level}. ${proposal.complexity.explanation}`,
    '',
    'Risks:',
    risks || '- No material risks identified.',
    '',
    'Approval state: waiting for user approval. No implementation has started.',
  ].join('\n');
}
