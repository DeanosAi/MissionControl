import 'server-only';

import { getDb } from '@/lib/db';

export type IdeaStatus = 'submitted' | 'researching' | 'researched' | 'building' | 'built' | 'archived';

export interface IdeaConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface IdeaResearchData {
  market?: { summary: string; viability: string; notes: string };
  technical?: { feasibility: string; stack: string; complexity: string };
  competition?: { competitors: string[]; differentiation: string };
  estimate?: { cost: string; time: string; resources: string };
}

export interface IdeaRecord {
  id: string;
  title: string;
  description: string | null;
  status: IdeaStatus;
  researchData: IdeaResearchData | null;
  conversationHistory: IdeaConversationMessage[];
  mvpCode: string | null;
  codexPrompt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface IdeaRow {
  id: string;
  title: string;
  description: string | null;
  status: IdeaStatus;
  research_data: IdeaResearchData | string | null;
  conversation_history: IdeaConversationMessage[] | string | null;
  mvp_code: string | null;
  codex_prompt: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Safely parse a JSONB value that might arrive as a string, object, or null */
function safeJsonParse<T>(val: T | string | null, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val as T;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return fallback; }
  }
  return fallback;
}

function mapRow(row: IdeaRow): IdeaRecord {
  const convo = safeJsonParse<IdeaConversationMessage[]>(row.conversation_history, []);
  const research = safeJsonParse<IdeaResearchData | null>(row.research_data, null);

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    researchData: research,
    conversationHistory: Array.isArray(convo) ? convo : [],
    mvpCode: row.mvp_code,
    codexPrompt: row.codex_prompt,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listIdeas(statusFilter?: IdeaStatus): Promise<IdeaRecord[]> {
  const sql = getDb();
  if (statusFilter) {
    const rows = await sql<IdeaRow[]>`
      SELECT * FROM mission_control.ideas WHERE status = ${statusFilter} ORDER BY created_at DESC
    `;
    return rows.map(mapRow);
  }
  const rows = await sql<IdeaRow[]>`
    SELECT * FROM mission_control.ideas WHERE status != 'archived' ORDER BY created_at DESC
  `;
  return rows.map(mapRow);
}

export async function getIdea(id: string): Promise<IdeaRecord | null> {
  const sql = getDb();
  const [row] = await sql<IdeaRow[]>`
    SELECT * FROM mission_control.ideas WHERE id = ${id} LIMIT 1
  `;
  return row ? mapRow(row) : null;
}

export async function createIdea(title: string, description?: string): Promise<IdeaRecord> {
  const sql = getDb();
  const [row] = await sql<IdeaRow[]>`
    INSERT INTO mission_control.ideas (title, description, conversation_history)
    VALUES (${title}, ${description ?? null}, '[]'::jsonb)
    RETURNING *
  `;
  return mapRow(row);
}

export async function updateIdeaStatus(id: string, status: IdeaStatus): Promise<void> {
  const sql = getDb();
  await sql`UPDATE mission_control.ideas SET status = ${status}, updated_at = NOW() WHERE id = ${id}`;
}

export async function appendConversation(id: string, message: IdeaConversationMessage): Promise<void> {
  const sql = getDb();
  // Use sql.json() for the array element to avoid double-encoding.
  // The || operator concatenates two JSONB values.
  await sql`
    UPDATE mission_control.ideas
    SET conversation_history = COALESCE(conversation_history, '[]'::jsonb) || ${sql.json([message] as any)},
        updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function saveResearchData(id: string, data: IdeaResearchData): Promise<void> {
  const sql = getDb();
  // CRITICAL: Use sql.json() to avoid double-encoding.
  // JSON.stringify + ::jsonb was causing data to be stored as a JSONB string
  // instead of a JSONB object, which is the root cause of the "malformed" bug.
  await sql`
    UPDATE mission_control.ideas
    SET research_data = ${sql.json(data as any)}, status = 'researched', updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function saveMvpCode(id: string, code: string): Promise<void> {
  const sql = getDb();
  await sql`UPDATE mission_control.ideas SET mvp_code = ${code}, updated_at = NOW() WHERE id = ${id}`;
}

export async function saveCodexPrompt(id: string, prompt: string): Promise<void> {
  const sql = getDb();
  await sql`UPDATE mission_control.ideas SET codex_prompt = ${prompt}, updated_at = NOW() WHERE id = ${id}`;
}

export async function archiveIdea(id: string): Promise<void> {
  const sql = getDb();
  await sql`UPDATE mission_control.ideas SET status = 'archived', updated_at = NOW() WHERE id = ${id}`;
}

export async function deleteIdea(id: string): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM mission_control.ideas WHERE id = ${id}`;
}

export async function searchIdeas(query: string): Promise<IdeaRecord[]> {
  const sql = getDb();
  const pattern = `%${query}%`;
  const rows = await sql<IdeaRow[]>`
    SELECT * FROM mission_control.ideas
    WHERE (title ILIKE ${pattern} OR description ILIKE ${pattern}) AND status != 'archived'
    ORDER BY created_at DESC
  `;
  return rows.map(mapRow);
}
