import 'server-only';

import bcrypt from 'bcryptjs';

import {
  findBudgetUserForLogin,
  markBudgetUserLogin,
  toBudgetUserIdentity,
  type BudgetUserIdentity,
} from './repository';

export async function verifyBudgetCredentials(email: string, password: string): Promise<BudgetUserIdentity | null> {
  const user = await findBudgetUserForLogin(email.trim().toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return null;
  }
  await markBudgetUserLogin(user.id);
  return toBudgetUserIdentity(user);
}

