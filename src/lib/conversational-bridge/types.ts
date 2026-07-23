import { z } from 'zod';

export const projectClassificationSchema = z.enum([
  'new-project',
  'child-project',
  'existing-project',
]);

export const orchestrationStatusSchema = z.enum([
  'received',
  'planning',
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

export type ProjectClassification = z.infer<typeof projectClassificationSchema>;
export type OrchestrationStatus = z.infer<typeof orchestrationStatusSchema>;
export type Proposal = z.infer<typeof proposalSchema>;
export type UiPreview = z.infer<typeof uiPreviewSchema>;
export type BridgeModelOutput = z.infer<typeof bridgeModelOutputSchema>;

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
  selectedModelId: string | null;
  selectedModelName: string | null;
  selectedModelProvider: string | null;
  revision: number;
  decisionNote: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
