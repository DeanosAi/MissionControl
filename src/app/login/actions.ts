'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { verifyAdminCredentials } from '@/lib/auth/credentials';
import { createAdminSession } from '@/lib/auth/session';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export interface LoginFormState {
  error?: string;
}

export async function loginAction(_previousState: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Unable to sign in.' };
  }

  const isValid = await verifyAdminCredentials(parsed.data.email, parsed.data.password);
  if (!isValid) {
    return { error: 'Incorrect email or password.' };
  }

  await createAdminSession(parsed.data.email);
  redirect('/');
}
