import { z } from 'zod';

export const projectClassificationSchema = z.enum([
  'new-project',
  'child-project',
  'existing-project',
]);

export const orchestrationStatusSchema = z.enum([
  'received',
  'planning',
  'cost-approval-required',
  'proposal-ready',
  'changes-requested',
  'approved',
  'rejected',
  'failed',
]);

export const proposalSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  whatWillBeBuilt: z.array(z.string().min(1)).min(1),
  whyThisApproach: z.string().min(1),
  userExperience: z.array(z.string().min(1)).min(1),
  complexity: z.object({
    level: z.enum(['low', 'medium', 'high']),
    explanation: z.string().min(1),
  }),
  risks: z.array(z.object({
    risk: z.string().min(1),
    mitigation: z.string().min(1),
  })),
  suggestedImprovements: z.array(z.string().min(1)),
  technologyChoices: z.array(z.object({
    name: z.string().min(1),
    purpose: z.string().min(1),
    reason: z.string().min(1),
    external: z.boolean(),
    requiresApproval: z.boolean(),
  })),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
  outOfScope: z.array(z.string().min(1)),
  approvalPrompt: z.string().min(1),
});

export const uiPreviewSchema = z.object({
  format: z.literal('wireframe'),
  styleDirection: z.string().min(1),
  screens: z.array(z.object({
    name: z.string().min(1),
    purpose: z.string().min(1),
    regions: z.array(z.object({
      label: z.string().min(1),
      content: z.array(z.string().min(1)).min(1),
      interaction: z.string().optional(),
    })).min(1),
  })).min(1),
});

export const bridgeModelOutputSchema = z.object({
  proposal: proposalSchema,
  uiPreview: uiPreviewSchema,
});

export const routingCandidateSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  estimatedCostUsd: z.number().nullable(),
  score: z.number(),
  contextWindow: z.number().nullable(),
  isLocal: z.boolean(),
  selectionReason: z.string(),
});

export const routingDecisionSummarySchema = z.object({
  capability: z.string(),
  selected: routingCandidateSummarySchema,
  alternatives: z.array(routingCandidateSummarySchema),
  costThresholdUsd: z.number(),
  requiresCostApproval: z.boolean(),
  estimatedInputTokens: z.number().int().nonnegative(),
  estimatedOutputTokens: z.number().int().nonnegative(),
  consideredFactors: z.array(z.string()),
});

export type ProjectClassification = z.infer<typeof projectClassificationSchema>;
export type OrchestrationStatus = z.infer<typeof orchestrationStatusSchema>;
export type Proposal = z.infer<typeof proposalSchema>;
export type UiPreview = z.infer<typeof uiPreviewSchema>;
export type BridgeModelOutput = z.infer<typeof bridgeModelOutputSchema>;
export type RoutingDecisionSummary = z.infer<typeof routingDecisionSummarySchema>;

export interface RequestIntent {
  category: 'build' | 'improve' | 'automate' | 'research' | 'other';
  projectTitle: string;
  normalizedIntent: string;
}

export interface OrchestrationRequestRecord {
  id: string;
  projectId: string;
  projectTitle: string;
  parentProjectId: string | null;
  parentProjectTitle: string | null;
  originalRequest: string;
  normalizedIntent: string;
  classification: ProjectClassification;
  status: OrchestrationStatus;
  proposal: Proposal | null;
  uiPreview: UiPreview | null;
  decisionAnalysis: import('@/lib/decision-engine/types').DecisionAnalysis | null;
  routingDecision: RoutingDecisionSummary | null;
  selectedModelId: string | null;
  selectedModelName: string | null;
  selectedModelProvider: string | null;
  estimatedPlanningCostUsd: number | null;
  costThresholdUsd: number | null;
  costApprovedAt: string | null;
  constitutionVersion: string;
  revision: number;
  decisionNote: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
