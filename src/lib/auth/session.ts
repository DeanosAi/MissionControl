import 'server-only';

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getAuthEnv } from '@/lib/auth/env';
import type { BudgetUserIdentity } from '@/lib/brady-budget/repository';

const SESSION_COOKIE = 'mission-control-session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface AdminSession {
  email: string;
  role: 'admin';
  displayName: string;
}

export interface BudgetMemberSession {
  email: string;
  role: 'budget';
  displayName: string;
  userId: string;
  householdId: string;
}

export type AppSession = AdminSession | BudgetMemberSession;

function getSessionSecret(): Uint8Array {
  return new TextEncoder().encode(getAuthEnv().SESSION_SECRET);
}

async function createSession(session: AppSession) {
  const payload = session.role === 'budget'
    ? {
        email: session.email,
        role: session.role,
        displayName: session.displayName,
        userId: session.userId,
        householdId: session.householdId,
      }
    : {
        email: session.email,
        role: session.role,
        displayName: session.displayName,
      };
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSessionSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function createAdminSession(email: string) {
  await createSession({ email, role: 'admin', displayName: 'Dean' });
}

export async function createBudgetMemberSession(user: BudgetUserIdentity) {
  await createSession({
    email: user.email,
    role: 'budget',
    displayName: user.displayName,
    userId: user.id,
    householdId: user.householdId,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export const clearSession = clearAdminSession;

export async function getSession(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    if (typeof payload.email !== 'string') return null;
    if (
      payload.role === 'budget'
      && typeof payload.displayName === 'string'
      && typeof payload.userId === 'string'
      && typeof payload.householdId === 'string'
    ) {
      return {
        email: payload.email,
        role: 'budget',
        displayName: payload.displayName,
        userId: payload.userId,
        householdId: payload.householdId,
      };
    }

    const adminEmail = getAuthEnv().ADMIN_EMAIL.trim().toLowerCase();
    if (payload.email.trim().toLowerCase() !== adminEmail) return null;
    return {
      email: payload.email,
      role: 'admin',
      displayName: typeof payload.displayName === 'string' ? payload.displayName : 'Dean',
    };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const session = await getSession();
  return session?.role === 'admin' ? session : null;
}

export async function getBudgetSession(): Promise<AppSession | null> {
  return getSession();
}

export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session) {
    redirect('/login');
  }
  return session;
}

export async function requireBudgetSession() {
  const session = await getBudgetSession();
  if (!session) {
    redirect('/budget/login');
  }
  return session;
}
