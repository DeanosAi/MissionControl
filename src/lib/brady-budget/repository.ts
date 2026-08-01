import 'server-only';

import { getDb } from '@/lib/db';
import type { BudgetState } from './types';

export const DEFAULT_BUDGET_HOUSEHOLD_SLUG = 'brady-household';

interface HouseholdRow {
  id: string;
  slug: string;
  name: string;
  state: BudgetState | string | null;
  revision: number | string;
  updated_at: Date;
}

interface BudgetUserRow {
  id: string;
  household_id: string;
  email: string;
  display_name: string;
  password_hash: string;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface BudgetUserIdentity {
  id: string;
  householdId: string;
  email: string;
  displayName: string;
}

export interface BudgetUserSummary extends BudgetUserIdentity {
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface BudgetHouseholdSnapshot {
  id: string;
  slug: string;
  name: string;
  state: BudgetState | null;
  revision: number;
  updatedAt: string;
}

function parseState(state: HouseholdRow['state']): BudgetState | null {
  if (!state) return null;
  if (typeof state === 'string') {
    return JSON.parse(state) as BudgetState;
  }
  return state;
}

function mapHousehold(row: HouseholdRow): BudgetHouseholdSnapshot {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    state: parseState(row.state),
    revision: Number(row.revision),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapUser(row: BudgetUserRow): BudgetUserSummary {
  return {
    id: row.id,
    householdId: row.household_id,
    email: row.email,
    displayName: row.display_name,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function getDefaultBudgetHousehold(): Promise<BudgetHouseholdSnapshot> {
  const sql = getDb();
  const [row] = await sql<HouseholdRow[]>`
    SELECT id, slug, name, state, revision, updated_at
    FROM mission_control.budget_households
    WHERE slug = ${DEFAULT_BUDGET_HOUSEHOLD_SLUG}
    LIMIT 1
  `;
  if (!row) throw new Error('Brady Budget household is not configured.');
  return mapHousehold(row);
}

export async function getBudgetHousehold(id: string): Promise<BudgetHouseholdSnapshot | null> {
  const sql = getDb();
  const [row] = await sql<HouseholdRow[]>`
    SELECT id, slug, name, state, revision, updated_at
    FROM mission_control.budget_households
    WHERE id = ${id}
    LIMIT 1
  `;
  return row ? mapHousehold(row) : null;
}

export async function saveBudgetHouseholdState(
  householdId: string,
  state: BudgetState,
  baseRevision: number,
): Promise<{ saved: true; snapshot: BudgetHouseholdSnapshot } | { saved: false; snapshot: BudgetHouseholdSnapshot }> {
  const sql = getDb();
  return sql.begin(async (transaction) => {
    const [current] = await transaction<HouseholdRow[]>`
      SELECT id, slug, name, state, revision, updated_at
      FROM mission_control.budget_households
      WHERE id = ${householdId}
      FOR UPDATE
    `;
    if (!current) throw new Error('Brady Budget household was not found.');
    if (Number(current.revision) !== baseRevision) {
      return { saved: false as const, snapshot: mapHousehold(current) };
    }

    const [updated] = await transaction<HouseholdRow[]>`
      UPDATE mission_control.budget_households
      SET state = ${JSON.stringify(state)}::jsonb,
          revision = revision + 1,
          updated_at = NOW()
      WHERE id = ${householdId}
      RETURNING id, slug, name, state, revision, updated_at
    `;
    return { saved: true as const, snapshot: mapHousehold(updated) };
  });
}

export async function findBudgetUserForLogin(email: string): Promise<BudgetUserRow | null> {
  const sql = getDb();
  const [row] = await sql<BudgetUserRow[]>`
    SELECT id, household_id, email, display_name, password_hash, is_active,
           last_login_at, created_at, updated_at
    FROM mission_control.budget_users
    WHERE LOWER(email) = LOWER(${email})
      AND is_active = TRUE
    LIMIT 1
  `;
  return row ?? null;
}

export async function getActiveBudgetUser(id: string): Promise<BudgetUserIdentity | null> {
  const sql = getDb();
  const [row] = await sql<BudgetUserRow[]>`
    SELECT id, household_id, email, display_name, password_hash, is_active,
           last_login_at, created_at, updated_at
    FROM mission_control.budget_users
    WHERE id = ${id} AND is_active = TRUE
    LIMIT 1
  `;
  return row ? toBudgetUserIdentity(row) : null;
}

export async function markBudgetUserLogin(id: string): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE mission_control.budget_users
    SET last_login_at = NOW(), updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function listBudgetUsers(householdId: string): Promise<BudgetUserSummary[]> {
  const sql = getDb();
  const rows = await sql<BudgetUserRow[]>`
    SELECT id, household_id, email, display_name, password_hash, is_active,
           last_login_at, created_at, updated_at
    FROM mission_control.budget_users
    WHERE household_id = ${householdId}
    ORDER BY created_at
  `;
  return rows.map(mapUser);
}

export async function upsertBudgetUser(input: {
  householdId: string;
  email: string;
  displayName: string;
  passwordHash: string;
}): Promise<BudgetUserSummary> {
  const sql = getDb();
  const [row] = await sql<BudgetUserRow[]>`
    INSERT INTO mission_control.budget_users (
      household_id,
      email,
      display_name,
      password_hash
    )
    VALUES (
      ${input.householdId},
      ${input.email.trim().toLowerCase()},
      ${input.displayName.trim()},
      ${input.passwordHash}
    )
    ON CONFLICT ((LOWER(email))) DO UPDATE SET
      household_id = EXCLUDED.household_id,
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      password_hash = EXCLUDED.password_hash,
      is_active = TRUE,
      updated_at = NOW()
    RETURNING id, household_id, email, display_name, password_hash, is_active,
              last_login_at, created_at, updated_at
  `;
  return mapUser(row);
}

export async function setBudgetUserActive(id: string, householdId: string, active: boolean): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    UPDATE mission_control.budget_users
    SET is_active = ${active}, updated_at = NOW()
    WHERE id = ${id} AND household_id = ${householdId}
    RETURNING id
  `;
  return rows.length > 0;
}

export function toBudgetUserIdentity(row: BudgetUserRow): BudgetUserIdentity {
  return {
    id: row.id,
    householdId: row.household_id,
    email: row.email,
    displayName: row.display_name,
  };
}
