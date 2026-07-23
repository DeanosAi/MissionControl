import { z } from 'zod';

export const technologyRecommendationSchema = z.enum([
  'recommended',
  'optional',
  'not-recommended',
]);

export const researchReportInputSchema = z.object({
  category: z.string().min(1),
  technology: z.string().min(1),
  title: z.string().min(1),
  whatChanged: z.string().min(1),
  whyItMatters: z.string().min(1),
  advantages: z.array(z.string().min(1)).min(1),
  disadvantages: z.array(z.string().min(1)).min(1),
  expectedImpact: z.string().min(1),
  migrationDifficulty: z.string().min(1),
  costImplications: z.string().min(1),
  recommendation: technologyRecommendationSchema,
  recommendationRationale: z.string().min(1),
  changeExplanation: z.string().nullable().optional(),
  sourceLinks: z.array(z.string().url()).min(1),
});

export const researchEngineOutputSchema = z.object({
  summary: z.string().min(1),
  reports: z.array(researchReportInputSchema).max(8),
});

export type TechnologyRecommendation = z.infer<typeof technologyRecommendationSchema>;
export type ResearchReportInput = z.infer<typeof researchReportInputSchema>;
export type ResearchEngineOutput = z.infer<typeof researchEngineOutputSchema>;

export interface ResearchSignal {
  url: string;
  title: string;
  excerpt: string;
  fetchedAt: string;
  lastModified: string | null;
  status: 'available' | 'unavailable';
  error?: string;
}

export interface ResearchReportRecord extends ResearchReportInput {
  id: string;
  researchRunId: string;
  adoptionStatus: 'pending-review' | 'approved' | 'rejected' | 'superseded';
  createdAt: string;
  reviewedAt: string | null;
}
