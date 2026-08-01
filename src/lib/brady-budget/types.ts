import { z } from 'zod';

const looseRecord = z.record(z.string(), z.unknown());

const profileRecordSchema = looseRecord.and(z.object({
  id: z.string().min(1).max(160),
  name: z.string().min(1).max(80),
  profile: looseRecord,
  categories: z.array(looseRecord).max(200),
  transactions: z.array(looseRecord).max(20_000),
  bills: z.array(looseRecord).max(500),
  goals: z.array(looseRecord).max(500),
  accounts: z.array(looseRecord).max(100),
}));

export const budgetStateSchema = looseRecord.and(z.object({
  version: z.number().int().min(1).max(20),
  profile: looseRecord,
  currentMonth: z.string().regex(/^\d{4}-\d{2}$/),
  categories: z.array(looseRecord).max(200),
  transactions: z.array(looseRecord).max(20_000),
  bills: z.array(looseRecord).max(500),
  goals: z.array(looseRecord).max(500),
  accounts: z.array(looseRecord).max(100),
  household: looseRecord.and(z.object({
    activeProfileId: z.string().min(1).max(160),
    profiles: z.array(profileRecordSchema).min(1).max(2),
    shopping: looseRecord.and(z.object({
      budget: z.number().min(0).max(100_000_000),
      items: z.array(looseRecord).max(2_000),
    })),
  })),
})).refine(
  (state) => JSON.stringify(state).length <= 2_000_000,
  'The budget is too large to sync safely.',
);

export const saveBudgetStateSchema = z.object({
  state: budgetStateSchema,
  baseRevision: z.number().int().min(0),
  clientId: z.string().min(8).max(160),
});

export type BudgetState = z.infer<typeof budgetStateSchema>;

export interface BudgetSessionAccount {
  email: string;
  displayName: string;
  canManageAccess: boolean;
}

export interface BudgetStateResponse {
  state: BudgetState | null;
  revision: number;
  account: BudgetSessionAccount;
}

