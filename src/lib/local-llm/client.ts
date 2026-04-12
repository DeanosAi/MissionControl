import 'server-only';

import { getDb } from '@/lib/db';

export interface LocalModelRecord {
  id: string;
  name: string;
  endpoint: string;
  modelId: string;
  contextWindow: number;
  status: 'active' | 'inactive';
  createdAt: string;
}

interface LocalModelRow {
  id: string;
  name: string;
  endpoint: string;
  model_id: string;
  context_window: number;
  status: 'active' | 'inactive';
  created_at: Date;
}

function mapRow(row: LocalModelRow): LocalModelRecord {
  return {
    id: row.id,
    name: row.name,
    endpoint: row.endpoint,
    modelId: row.model_id,
    contextWindow: row.context_window,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listLocalModels(): Promise<LocalModelRecord[]> {
  const sql = getDb();
  const rows = await sql<LocalModelRow[]>`
    SELECT id, name, endpoint, model_id, context_window, status, created_at
    FROM mission_control.local_models
    ORDER BY created_at DESC
  `;
  return rows.map(mapRow);
}

export async function listActiveLocalModels(): Promise<LocalModelRecord[]> {
  const sql = getDb();
  const rows = await sql<LocalModelRow[]>`
    SELECT id, name, endpoint, model_id, context_window, status, created_at
    FROM mission_control.local_models
    WHERE status = 'active'
    ORDER BY created_at DESC
  `;
  return rows.map(mapRow);
}

export async function createLocalModel(input: {
  name: string;
  endpoint: string;
  modelId: string;
  contextWindow?: number;
}): Promise<LocalModelRecord> {
  const sql = getDb();
  const [row] = await sql<LocalModelRow[]>`
    INSERT INTO mission_control.local_models (name, endpoint, model_id, context_window)
    VALUES (${input.name}, ${input.endpoint}, ${input.modelId}, ${input.contextWindow ?? 4096})
    RETURNING id, name, endpoint, model_id, context_window, status, created_at
  `;
  return mapRow(row);
}

export async function deleteLocalModel(id: string): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM mission_control.local_models WHERE id = ${id}`;
}

export async function toggleLocalModelStatus(id: string): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE mission_control.local_models
    SET status = CASE WHEN status = 'active' THEN 'inactive' ELSE 'active' END
    WHERE id = ${id}
  `;
}

export async function testLocalModelConnection(
  endpoint: string,
  modelId: string,
): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now();
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { success: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Connection failed' };
  }
}

export async function generateLocalCompletion(
  endpoint: string,
  modelId: string,
  messages: { role: string; content: string }[],
  maxTokens = 4096,
): Promise<string> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelId,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Local LLM error (${response.status}): ${text || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content returned from local model');
  return content.trim();
}

/** Auto-detect LM Studio models at localhost:1234 */
export async function detectLMStudio(): Promise<{ found: boolean; models: string[] }> {
  try {
    const response = await fetch('http://localhost:1234/v1/models', {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return { found: false, models: [] };
    const data = await response.json();
    const models = (data.data || []).map((m: { id: string }) => m.id);
    return { found: true, models };
  } catch {
    return { found: false, models: [] };
  }
}
