import 'server-only';

import { getDb } from '@/lib/db';

export interface ChatMessageRecord {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

function mapMessage(row: {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: Date;
}): ChatMessageRecord {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listChatMessages(): Promise<ChatMessageRecord[]> {
  const sql = getDb();
  const rows = await sql<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at: Date;
  }[]>`
    SELECT id, role, content, created_at
    FROM mission_control.chat_messages
    ORDER BY created_at ASC
    LIMIT 100
  `;

  return rows.map(mapMessage);
}

export async function createChatMessage(role: 'user' | 'assistant' | 'system', content: string): Promise<ChatMessageRecord> {
  const sql = getDb();
  const [row] = await sql<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at: Date;
  }[]>`
    INSERT INTO mission_control.chat_messages (role, content)
    VALUES (${role}, ${content})
    RETURNING id, role, content, created_at
  `;

  return mapMessage(row);
}

export async function ensureInitialSystemMessage() {
  const sql = getDb();
  const [existing] = await sql<{ id: string }[]>`
    SELECT id
    FROM mission_control.chat_messages
    WHERE role = 'system'
    ORDER BY created_at ASC
    LIMIT 1
  `;

  if (existing) {
    return;
  }

  await createChatMessage(
    'system',
    'Mission Control Chat v1 is active. GPT/Codex integration is the next step; until that is wired, this thread acts as the in-app conversation scaffold and stores message history.',
  );
}
