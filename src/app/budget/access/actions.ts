'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireAdminSession } from '@/lib/auth/session';
import {
  getDefaultBudgetHousehold,
  setBudgetUserActive,
  upsertBudgetUser,
} from '@/lib/brady-budget/repository';

const memberSchema = z.object({
  displayName: z.string().trim().min(1, 'Enter a name.').max(80),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(10, 'Use at least 10 characters.').max(200),
});

export interface AccessFormState {
  error?: string;
  success?: string;
}

export async function saveBudgetMemberAction(
  _previousState: AccessFormState,
  formData: FormData,
): Promise<AccessFormState> {
  await requireAdminSession();
  const parsed = memberSchema.safeParse({
    displayName: formData.get('displayName'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Could not save this login.' };
  }

  const household = await getDefaultBudgetHousehold();
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await upsertBudgetUser({
    householdId: household.id,
    email: parsed.data.email,
    displayName: parsed.data.displayName,
    passwordHash,
  });
  revalidatePath('/budget/access');
  return { success: `${parsed.data.displayName} can now sign in to Brady Budget.` };
}

export async function setBudgetMemberActiveAction(formData: FormData) {
  await requireAdminSession();
  const household = await getDefaultBudgetHousehold();
  const id = z.string().uuid().parse(formData.get('id'));
  const active = formData.get('active') === 'true';
  await setBudgetUserActive(id, household.id, active);
  revalidatePath('/budget/access');
}

