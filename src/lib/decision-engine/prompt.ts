import { CONSTITUTION_PROMPT, CONSTITUTION_VERSION } from '@/lib/constitution';
import type { ProjectRecord } from '@/lib/projects';
import type {
  BridgeModelOutput,
  ProjectClassification,
  RequestIntent,
} from '@/lib/conversational-bridge/types';

export interface DecisionPromptInput {
  request: string;
  intent: RequestIntent;
  project: ProjectRecord;
  classification: ProjectClassification;
  classificationRationale: string;
  projectJournalContext: string;
  unifiedMemoryContext: string;
  learningContext: string;
  revisionFeedback?: string;
  existingOutput?: BridgeModelOutput | null;
}

export function buildDecisionMessages(input: DecisionPromptInput) {
  const revisionBlock = input.revisionFeedback
    ? [
        '',
        'REVISION:',
        `The user requested these changes: ${input.revisionFeedback}`,
        `Existing proposal and UI preview: ${JSON.stringify(input.existingOutput)}`,
        'Generate fresh alternatives and critique them again. Preserve earlier decisions only where they remain useful.',
      ].join('\n')
    : '';

  const system = [
    'You are Mission Control\'s Decision Engine.',
    'Act as an experienced product designer, UX designer, software architect, engineer, security reviewer, and QA lead.',
    CONSTITUTION_PROMPT,
    'Do not accept the first idea automatically. Generate three genuinely different, credible approaches.',
    'Critique every approach against explicit criteria, recommend exactly one, and explain why the others are weaker.',
    'Use relevant memory and previous measurable outcomes. If evidence is limited, say so instead of inventing research.',
    'Challenge the request constructively when a simpler, safer, or more useful outcome exists.',
    'Prefer existing Mission Control modules and architecture. Mark every proposed new external tool as requiring approval.',
    'Do not write production code, create execution tasks, deploy, spend money, or claim implementation has started.',
    'Return one valid JSON object only, with no markdown fences or commentary.',
  ].join('\n');

  const requestedShape = {
    decision: {
      understoodIntent: 'The outcome behind the request',
      contextSummary: 'The existing platform and project context that matters',
      memorySummary: 'Relevant user, project, decision, research, and operational memory',
      researchSummary: 'Evidence used, gaps, and whether further approved research would improve the decision',
      options: [
        {
          id: 'option-a',
          title: 'Approach name',
          summary: 'How this approach works',
          advantages: ['Advantage'],
          disadvantages: ['Disadvantage'],
          complexity: 'low | medium | high',
          riskLevel: 'low | medium | high',
          estimatedCostBand: 'none | low | medium | high | unknown',
          usesExternalTools: false,
        },
        {
          id: 'option-b',
          title: 'A meaningfully different approach',
          summary: 'How this approach works',
          advantages: ['Advantage'],
          disadvantages: ['Disadvantage'],
          complexity: 'low | medium | high',
          riskLevel: 'low | medium | high',
          estimatedCostBand: 'none | low | medium | high | unknown',
          usesExternalTools: false,
        },
        {
          id: 'option-c',
          title: 'A third meaningfully different approach',
          summary: 'How this approach works',
          advantages: ['Advantage'],
          disadvantages: ['Disadvantage'],
          complexity: 'low | medium | high',
          riskLevel: 'low | medium | high',
          estimatedCostBand: 'none | low | medium | high | unknown',
          usesExternalTools: true,
        },
      ],
      critique: {
        criteria: ['User value', 'Friction', 'Maintainability', 'Risk', 'Cost'],
        evaluations: [
          {
            optionId: 'option-a',
            strengths: ['Strength'],
            weaknesses: ['Weakness'],
            fitScore: 85,
            verdict: 'Plain-English verdict',
          },
          {
            optionId: 'option-b',
            strengths: ['Strength'],
            weaknesses: ['Weakness'],
            fitScore: 70,
            verdict: 'Plain-English verdict',
          },
          {
            optionId: 'option-c',
            strengths: ['Strength'],
            weaknesses: ['Weakness'],
            fitScore: 55,
            verdict: 'Plain-English verdict',
          },
        ],
      },
      recommendation: {
        optionId: 'option-a',
        rationale: 'Why this is the best fit',
        whyNotOthers: ['Why another option was not selected'],
        confidence: 'low | medium | high',
      },
      challenge: {
        needed: true,
        explanation: 'A constructive challenge, or why the original direction is already sound',
      },
    },
    proposal: {
      title: 'Short proposal title',
      summary: 'One paragraph overview',
      whatWillBeBuilt: ['Concrete outcome'],
      whyThisApproach: 'Decision rationale tied to the recommended option',
      userExperience: ['Step-by-step experience'],
      complexity: { level: 'low | medium | high', explanation: 'Plain-English explanation' },
      risks: [{ risk: 'Risk', mitigation: 'Mitigation' }],
      suggestedImprovements: ['Useful improvement'],
      technologyChoices: [{
        name: 'Technology or existing module',
        purpose: 'What it does',
        reason: 'Why it fits',
        external: false,
        requiresApproval: false,
      }],
      acceptanceCriteria: ['Observable beta outcome'],
      outOfScope: ['Deferred item'],
      approvalPrompt: 'Short approval question',
    },
    uiPreview: {
      format: 'wireframe',
      styleDirection: 'Visual and interaction direction',
      screens: [{
        name: 'Screen name',
        purpose: 'What it enables',
        regions: [{
          label: 'Region label',
          content: ['Visible item or control'],
          interaction: 'Optional interaction note',
        }],
      }],
    },
  };

  const user = [
    `Constitution version: ${CONSTITUTION_VERSION}`,
    `Original request: ${input.request}`,
    `Normalised intent: ${input.intent.normalizedIntent}`,
    `Project: ${input.project.title}`,
    `Project classification: ${input.classification}`,
    `Classification rationale: ${input.classificationRationale}`,
    '',
    `PROJECT JOURNAL:\n${input.projectJournalContext}`,
    '',
    `UNIFIED MEMORY:\n${input.unifiedMemoryContext}`,
    '',
    `CONTINUOUS LEARNING EVIDENCE:\n${input.learningContext}`,
    revisionBlock,
    '',
    'Return JSON with exactly this shape and at least three options:',
    JSON.stringify(requestedShape),
  ].filter(Boolean).join('\n');

  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ];
}
