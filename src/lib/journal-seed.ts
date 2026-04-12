import 'server-only';

import { getDb } from '@/lib/db';
import { journalEntries } from '@/lib/data';

let seeded = false;

/**
 * Seeds the journal_entries table from the hardcoded data.ts entries
 * if the table is empty. Runs once per app lifecycle.
 * This is a migration aid - after the first run, all new entries
 * go directly into the DB via the UI or chat commands.
 */
export async function seedJournalFromData(): Promise<void> {
  if (seeded) return;

  try {
    const sql = getDb();

    // Check if table exists and has entries
    const [count] = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text as count FROM mission_control.journal_entries
    `;

    if (parseInt(count.count, 10) > 0) {
      seeded = true;
      return;
    }

    // Seed from hardcoded data
    for (const entry of journalEntries) {
      await sql`
        INSERT INTO mission_control.journal_entries (title, detail, entry_type, source, created_at)
        VALUES (
          ${entry.title},
          ${entry.detail},
          ${entry.type},
          'seed',
          ${entry.date + 'T12:00:00.000Z'}
        )
      `;
    }

    seeded = true;
  } catch (err) {
    // Table might not exist yet - that's OK, the migration needs to run first
    console.warn('Journal seed skipped (table may not exist yet):', err instanceof Error ? err.message : err);
  }
}
