import 'server-only';

import { getDb } from '@/lib/db';

export type MemoryCategory = 'context' | 'preference' | 'fact' | 'instruction';

export interface MemoryNoteRecord {
  id: string;
  key: string;
  content: string;
  category: MemoryCategory;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemoryInput {
  key: string;
  content: string;
  category?: MemoryCategory;
  pinned?: boolean;
}

type MemoryRow = {
  id: string;
  key: string;
  content: string;
  category: MemoryCategory;
  pinned: boolean;
  created_at: Date;
  updated_at: Date;
};

function mapRow(row: MemoryRow): MemoryNoteRecord {
  return {
    id: row.id,
    key: row.key,
    content: row.content,
    category: row.category,
    pinned: row.pinned,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** List all memory notes, pinned first */
export async function listMemoryNotes(): Promise<MemoryNoteRecord[]> {
  const sql = getDb();
  const rows = await sql<MemoryRow[]>`
    SELECT id, key, content, category, pinned, created_at, updated_at
    FROM mission_control.memory_notes
    ORDER BY pinned DESC, updated_at DESC
  `;
  return rows.map(mapRow);
}

/** Get a memory note by key */
export async function getMemoryByKey(key: string): Promise<MemoryNoteRecord | null> {
  const sql = getDb();
  const [row] = await sql<MemoryRow[]>`
    SELECT id, key, content, category, pinned, created_at, updated_at
    FROM mission_control.memory_notes
    WHERE key = ${key}
    LIMIT 1
  `;
  return row ? mapRow(row) : null;
}

/** Create or update a memory note (upsert by key) */
export async function upsertMemoryNote(input: CreateMemoryInput): Promise<MemoryNoteRecord> {
  const sql = getDb();
  const category = input.category ?? 'context';
  const pinned = input.pinned ?? false;
  const [row] = await sql<MemoryRow[]>`
    INSERT INTO mission_control.memory_notes (key, content, category, pinned)
    VALUES (${input.key}, ${input.content}, ${category}, ${pinned})
    ON CONFLICT (key) DO UPDATE SET
      content = EXCLUDED.content,
      category = EXCLUDED.category,
      pinned = EXCLUDED.pinned,
      updated_at = NOW()
    RETURNING id, key, content, category, pinned, created_at, updated_at
  `;
  return mapRow(row);
}

/** Delete a memory note */
export async function deleteMemoryNote(id: string): Promise<void> {
  const sql = getDb();
  await sql`
    DELETE FROM mission_control.memory_notes
    WHERE id = ${id}
  `;
}

/** Toggle pin status */
export async function toggleMemoryPin(id: string): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE mission_control.memory_notes
    SET pinned = NOT pinned, updated_at = NOW()
    WHERE id = ${id}
  `;
}

/** Build AI-readable memory context from all notes */
export async function getMemoryContext(): Promise<string> {
  const notes = await listMemoryNotes();
  if (notes.length === 0) return '';

  const pinned = notes.filter(n => n.pinned);
  const other = notes.filter(n => !n.pinned);

  let ctx = 'Curated memory notes:\n';
  if (pinned.length > 0) {
    ctx += 'PINNED:\n';
    for (const n of pinned) {
      ctx += `- [${n.key}] ${n.content}\n`;
    }
  }
  if (other.length > 0) {
    for (const n of other.slice(0, 10)) {
      ctx += `- [${n.key}] ${n.content}\n`;
    }
  }
  return ctx;
}
