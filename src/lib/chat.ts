import 'server-only';

import { getDb } from '@/lib/db';

export interface ChatMessageRecord {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  projectId: string | null;
  orchestrationRequestId: string | null;
  createdAt: string;
}

function mapMessage(row: {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  project_id: string | null;
  orchestration_request_id: string | null;
  created_at: Date;
}): ChatMessageRecord {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    projectId: row.project_id,
    orchestrationRequestId: row.orchestration_request_id,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listChatMessages(): Promise<ChatMessageRecord[]> {
  const sql = getDb();
  const rows = await sql<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    project_id: string | null;
    orchestration_request_id: string | null;
    created_at: Date;
  }[]>`
    SELECT id, role, content, project_id, orchestration_request_id, created_at
    FROM mission_control.chat_messages
    ORDER BY created_at ASC
    LIMIT 100
  `;

  return rows.map(mapMessage);
}

export async function createChatMessage(
  role: 'user' | 'assistant' | 'system',
  content: string,
  context: { projectId?: string | null; orchestrationRequestId?: string | null } = {},
): Promise<ChatMessageRecord> {
  const sql = getDb();
  const [row] = await sql<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    project_id: string | null;
    orchestration_request_id: string | null;
    created_at: Date;
  }[]>`
    INSERT INTO mission_control.chat_messages (role, content, project_id, orchestration_request_id)
    VALUES (${role}, ${content}, ${context.projectId ?? null}, ${context.orchestrationRequestId ?? null})
    RETURNING id, role, content, project_id, orchestration_request_id, created_at
  `;

  return mapMessage(row);
}

export async function linkChatMessageToOrchestration(
  messageId: string,
  projectId: string,
  orchestrationRequestId: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE mission_control.chat_messages
    SET project_id = ${projectId}, orchestration_request_id = ${orchestrationRequestId}
    WHERE id = ${messageId}
  `;
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
    'Mission Control V3 Conversational Bridge is active. Describe what you want to build or improve and Mission Control will create a project, proposal, and UI concept for approval before any implementation begins.',
  );
}
