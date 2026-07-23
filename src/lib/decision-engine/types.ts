import { z } from 'zod';

import { bridgeModelOutputSchema } from '@/lib/conversational-bridge/types';

export const solutionOptionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  advantages: z.array(z.string().min(1)).min(1),
  disadvantages: z.array(z.string().min(1)).min(1),
  complexity: z.enum(['low', 'medium', 'high']),
  riskLevel: z.enum(['low', 'medium', 'high']),
  estimatedCostBand: z.enum(['none', 'low', 'medium', 'high', 'unknown']),
  usesExternalTools: z.boolean(),
});

export const optionCritiqueSchema = z.object({
  optionId: z.string().min(1),
  strengths: z.array(z.string().min(1)).min(1),
  weaknesses: z.array(z.string().min(1)).min(1),
  fitScore: z.number().min(0).max(100),
  verdict: z.string().min(1),
});

export const decisionAnalysisSchema = z.object({
  understoodIntent: z.string().min(1),
  contextSummary: z.string().min(1),
  memorySummary: z.string().min(1),
  researchSummary: z.string().min(1),
  options: z.array(solutionOptionSchema).min(3).max(5),
  critique: z.object({
    criteria: z.array(z.string().min(1)).min(3),
    evaluations: z.array(optionCritiqueSchema).min(3),
  }),
  recommendation: z.object({
    optionId: z.string().min(1),
    rationale: z.string().min(1),
    whyNotOthers: z.array(z.string().min(1)).min(1),
    confidence: z.enum(['low', 'medium', 'high']),
  }),
  challenge: z.object({
    needed: z.boolean(),
    explanation: z.string().min(1),
  }),
});

export const decisionEngineOutputSchema = bridgeModelOutputSchema.extend({
  decision: decisionAnalysisSchema,
});

export type SolutionOption = z.infer<typeof solutionOptionSchema>;
export type DecisionAnalysis = z.infer<typeof decisionAnalysisSchema>;
export type DecisionEngineOutput = z.infer<typeof decisionEngineOutputSchema>;

export interface DecisionRunRecord {
  id: string;
  orchestrationRequestId: string;
  projectId: string;
  revision: number;
  status: 'running' | 'cost-approval-required' | 'completed' | 'failed';
  startedAt: string;
  completedAt: string | null;
}
