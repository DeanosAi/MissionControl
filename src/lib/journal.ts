import 'server-only';

import { getDb } from '@/lib/db';

export type JournalType = 'milestone' | 'ops' | 'decision' | 'auto' | 'note';

export interface JournalEntryRecord {
  id: string;
  title: string;
  detail: string;
  entryType: JournalType;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJournalInput {
  title: string;
  detail: string;
  entryType?: JournalType;
  source?: string;
}

function mapRow(row: {
  id: string;
  title: string;
  detail: string;
  entry_type: JournalType;
  source: string;
  created_at: Date;
  updated_at: Date;
}): JournalEntryRecord {
  return {
    id: row.id,
    title: row.title,
    detail: row.detail,
    entryType: row.entry_type,
    source: row.source,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

type JournalRow = {
  id: string;
  title: string;
  detail: string;
  entry_type: JournalType;
  source: string;
  created_at: Date;
  updated_at: Date;
};

/** List journal entries, newest first */
export async function listJournalEntries(limit = 50): Promise<JournalEntryRecord[]> {
  const sql = getDb();
  const rows = await sql<JournalRow[]>`
    SELECT id, title, detail, entry_type, source, created_at, updated_at
    FROM mission_control.journal_entries
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(mapRow);
}

/** Get a single journal entry */
export async function getJournalEntry(id: string): Promise<JournalEntryRecord | null> {
  const sql = getDb();
  const [row] = await sql<JournalRow[]>`
    SELECT id, title, detail, entry_type, source, created_at, updated_at
    FROM mission_control.journal_entries
    WHERE id = ${id}
    LIMIT 1
  `;
  return row ? mapRow(row) : null;
}

/** Create a journal entry */
export async function createJournalEntry(input: CreateJournalInput): Promise<JournalEntryRecord> {
  const sql = getDb();
  const entryType = input.entryType ?? 'note';
  const source = input.source ?? 'manual';
  const [row] = await sql<JournalRow[]>`
    INSERT INTO mission_control.journal_entries (title, detail, entry_type, source)
    VALUES (${input.title}, ${input.detail}, ${entryType}, ${source})
    RETURNING id, title, detail, entry_type, source, created_at, updated_at
  `;
  return mapRow(row);
}

/** Update a journal entry */
export async function updateJournalEntry(id: string, input: { title: string; detail: string; entryType: JournalType }): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE mission_control.journal_entries
    SET title = ${input.title}, detail = ${input.detail}, entry_type = ${input.entryType}, updated_at = NOW()
    WHERE id = ${id}
  `;
}

/** Delete a journal entry */
export async function deleteJournalEntry(id: string): Promise<void> {
  const sql = getDb();
  await sql`
    DELETE FROM mission_control.journal_entries
    WHERE id = ${id}
  `;
}

// ── Auto-journaling: create entries automatically when things happen ──

/** Record a task creation in the journal */
export async function journalTaskCreated(taskTitle: string, source: string): Promise<void> {
  await createJournalEntry({
    title: `Task created: ${taskTitle}`,
    detail: `A new task "${taskTitle}" was created in Mission Control.`,
    entryType: 'auto',
    source,
  });
}

/** Record a task execution in the journal */
export async function journalTaskExecuted(taskTitle: string, modelName: string, success: boolean): Promise<void> {
  await createJournalEntry({
    title: `Task ${success ? 'completed' : 'failed'}: ${taskTitle}`,
    detail: `Task "${taskTitle}" was executed via ${modelName} and ${success ? 'completed successfully' : 'failed'}.`,
    entryType: 'auto',
    source: `task-execution/${modelName}`,
  });
}

/** Record a task status change in the journal */
export async function journalTaskStatusChanged(taskTitle: string, oldStatus: string, newStatus: string, source: string): Promise<void> {
  if (newStatus === 'done') {
    await createJournalEntry({
      title: `Task done: ${taskTitle}`,
      detail: `Task "${taskTitle}" was marked as done (was ${oldStatus}).`,
      entryType: 'auto',
      source,
    });
  }
}

/** Get recent journal entries for AI context (compact format) */
export async function getJournalContext(limit = 15): Promise<string> {
  const entries = await listJournalEntries(limit);
  if (entries.length === 0) return 'No journal entries yet.';

  let ctx = `Recent journal entries (${entries.length}):\n`;
  for (const e of entries) {
    const date = e.createdAt.split('T')[0];
    ctx += `- [${date}] [${e.entryType}] ${e.title}\n`;
  }
  return ctx;
}
