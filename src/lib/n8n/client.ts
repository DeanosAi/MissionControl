import 'server-only';

import { getDb } from '@/lib/db';

const getN8nUrl = () => process.env.N8N_API_URL || 'http://localhost:5678';
const getN8nKey = () => process.env.N8N_API_KEY || '';

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt?: string;
}

export interface N8nRunRecord {
  id: string;
  workflowId: string;
  workflowName: string | null;
  executionId: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  inputData: Record<string, unknown> | null;
  outputData: Record<string, unknown> | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

async function n8nFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  const key = getN8nKey();
  if (key) headers['X-N8N-API-KEY'] = key;

  return fetch(`${getN8nUrl()}${endpoint}`, {
    ...options,
    headers,
    signal: AbortSignal.timeout(15000),
  });
}

export async function testN8nConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    const res = await n8nFetch('/api/v1/workflows?limit=1');
    return { connected: res.ok };
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : 'Connection failed' };
  }
}

export async function listN8nWorkflows(): Promise<N8nWorkflow[]> {
  const res = await n8nFetch('/api/v1/workflows');
  if (!res.ok) throw new Error(`N8N error: ${res.status}`);
  const data = await res.json();
  return (data.data || []).map((w: { id: string; name: string; active: boolean; createdAt?: string }) => ({
    id: w.id,
    name: w.name,
    active: w.active,
    createdAt: w.createdAt,
  }));
}

export async function executeN8nWorkflow(
  workflowId: string,
  workflowName: string,
  inputData?: Record<string, unknown>,
): Promise<N8nRunRecord> {
  const sql = getDb();

  // Record the run
  const [run] = await sql<{
    id: string; workflow_id: string; workflow_name: string | null; execution_id: string | null;
    status: string; input_data: unknown; output_data: unknown; error: string | null;
    started_at: Date; completed_at: Date | null;
  }[]>`
    INSERT INTO mission_control.n8n_workflow_runs (workflow_id, workflow_name, status, input_data)
    VALUES (${workflowId}, ${workflowName}, 'running', ${JSON.stringify(inputData || {})}::jsonb)
    RETURNING *
  `;

  try {
    const res = await n8nFetch(`/api/v1/workflows/${workflowId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ data: inputData || {} }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`N8N execution failed: ${res.status} ${text}`);
    }

    const result = await res.json();
    const executionId = result.data?.executionId || result.executionId || null;

    await sql`
      UPDATE mission_control.n8n_workflow_runs
      SET status = 'completed', execution_id = ${executionId},
          output_data = ${JSON.stringify(result)}::jsonb, completed_at = NOW()
      WHERE id = ${run.id}
    `;

    return {
      id: run.id, workflowId, workflowName, executionId,
      status: 'completed', inputData: inputData || null, outputData: result,
      error: null, startedAt: run.started_at.toISOString(), completedAt: new Date().toISOString(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await sql`
      UPDATE mission_control.n8n_workflow_runs
      SET status = 'failed', error = ${msg}, completed_at = NOW()
      WHERE id = ${run.id}
    `;
    return {
      id: run.id, workflowId, workflowName, executionId: null,
      status: 'failed', inputData: inputData || null, outputData: null,
      error: msg, startedAt: run.started_at.toISOString(), completedAt: new Date().toISOString(),
    };
  }
}

export async function listN8nRuns(limit = 20): Promise<N8nRunRecord[]> {
  const sql = getDb();
  const rows = await sql<{
    id: string; workflow_id: string; workflow_name: string | null; execution_id: string | null;
    status: 'pending' | 'running' | 'completed' | 'failed';
    input_data: Record<string, unknown> | null; output_data: Record<string, unknown> | null;
    error: string | null; started_at: Date; completed_at: Date | null;
  }[]>`
    SELECT * FROM mission_control.n8n_workflow_runs ORDER BY started_at DESC LIMIT ${limit}
  `;
  return rows.map(r => ({
    id: r.id, workflowId: r.workflow_id, workflowName: r.workflow_name,
    executionId: r.execution_id, status: r.status, inputData: r.input_data,
    outputData: r.output_data, error: r.error,
    startedAt: r.started_at.toISOString(), completedAt: r.completed_at?.toISOString() ?? null,
  }));
}
