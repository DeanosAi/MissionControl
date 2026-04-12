import 'server-only';

import { getDb } from '@/lib/db';

function isMissingRelationError(error: unknown) {
  return error instanceof Error && /usage_snapshots|relation .* does not exist/i.test(error.message);
}

export interface UsageSnapshotRecord {
  source: string;
  openai_window_left: string;
  openai_reset_in: string;
  openai_weekly_left: string;
  openai_weekly_reset_in: string;
  claude_status: string;
  claude_note: string;
  updated_at: string;
}

export async function getLatestUsageSnapshot(): Promise<UsageSnapshotRecord | null> {
  try {
    const sql = getDb();
    const [row] = await sql<{
      source: string;
      openai_window_left: string;
      openai_reset_in: string;
      openai_weekly_left: string;
      openai_weekly_reset_in: string;
      claude_status: string;
      claude_note: string;
      updated_at: Date;
    }[]>`
      SELECT source, openai_window_left, openai_reset_in, openai_weekly_left, openai_weekly_reset_in, claude_status, claude_note, updated_at
      FROM mission_control.usage_snapshots
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    if (!row) return null;

    return {
      ...row,
      updated_at: row.updated_at.toISOString(),
    };
  } catch (error) {
    if (isMissingRelationError(error)) {
      return null;
    }
    return null;
  }
}
