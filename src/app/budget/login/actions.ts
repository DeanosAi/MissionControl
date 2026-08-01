'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { verifyAdminCredentials } from '@/lib/auth/credentials';
import {
  clearLoginAttempts,
  canAttemptLogin,
  recordFailedLogin,
} from '@/lib/auth/login-rate-limit';
import {
  createAdminSession,
  createBudgetMemberSession,
} from '@/lib/auth/session';
import { verifyBudgetCredentials } from '@/lib/brady-budget/credentials';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export interface BudgetLoginFormState {
  error?: string;
}

export async function budgetLoginAction(
  _previousState: BudgetLoginFormState,
  formData: FormData,
): Promise<BudgetLoginFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Unable to sign in.' };
  }

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const attemptKey = `${forwardedFor}:${normalizedEmail}`;
  if (!canAttemptLogin(attemptKey)) {
    return { error: 'Too many sign-in attempts. Try again in 15 minutes.' };
  }

  if (await verifyAdminCredentials(normalizedEmail, parsed.data.password)) {
    clearLoginAttempts(attemptKey);
    await createAdminSession(normalizedEmail);
    redirect('/budget');
  }

  const budgetUser = await verifyBudgetCredentials(normalizedEmail, parsed.data.password);
  if (!budgetUser) {
    recordFailedLogin(attemptKey);
    return { error: 'Incorrect email or password.' };
  }

  clearLoginAttempts(attemptKey);
  await createBudgetMemberSession(budgetUser);
  redirect('/budget');
}

