import 'server-only';

import bcrypt from 'bcryptjs';

import { getAuthEnv } from '@/lib/auth/env';

export async function verifyAdminCredentials(email: string, password: string) {
  const authEnv = getAuthEnv();
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail !== authEnv.ADMIN_EMAIL.trim().toLowerCase()) {
    return false;
  }

  return bcrypt.compare(password, authEnv.ADMIN_PASSWORD_HASH);
}

export function getAdminIdentity() {
  return { email: getAuthEnv().ADMIN_EMAIL };
}
