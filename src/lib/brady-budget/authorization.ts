import 'server-only';

import { getBudgetSession } from '@/lib/auth/session';
import {
  getActiveBudgetUser,
  getBudgetHousehold,
  getDefaultBudgetHousehold,
  type BudgetHouseholdSnapshot,
} from './repository';

export interface BudgetAccess {
  household: BudgetHouseholdSnapshot;
  account: {
    email: string;
    displayName: string;
    canManageAccess: boolean;
  };
}

export async function getBudgetAccess(): Promise<BudgetAccess | null> {
  const session = await getBudgetSession();
  if (!session) return null;

  if (session.role === 'admin') {
    return {
      household: await getDefaultBudgetHousehold(),
      account: {
        email: session.email,
        displayName: session.displayName,
        canManageAccess: true,
      },
    };
  }

  const activeUser = await getActiveBudgetUser(session.userId);
  if (!activeUser || activeUser.householdId !== session.householdId) return null;
  const household = await getBudgetHousehold(activeUser.householdId);
  if (!household) return null;

  return {
    household,
    account: {
      email: activeUser.email,
      displayName: activeUser.displayName,
      canManageAccess: false,
    },
  };
}

export async function requireBudgetAccess(): Promise<BudgetAccess> {
  const access = await getBudgetAccess();
  if (!access) throw new Error('Unauthorized');
  return access;
}

