import 'server-only';

import { getDb } from '@/lib/db';
import { type Capability } from '@/lib/capability-registry';
import { completeWithCapability } from '@/lib/conversational-bridge/model-router';
import { type TaskRecord, updateTaskStatus } from '@/lib/tasks';
import { journalTaskExecuted } from '@/lib/journal';

export type ExecutionStatus = 'running' | 'completed' | 'failed';

export interface TaskExecutionRecord {
  id: string;
  taskId: string;
  modelId: string;
  modelName: string;
  provider: string;
  status: ExecutionStatus;
  prompt: string;
  result: string | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

function mapExecutionRow(row: {
  id: string;
  task_id: string;
  model_id: string;
  model_name: string;
  provider: string;
  status: ExecutionStatus;
  prompt: string;
  result: string | null;
  error: string | null;
  started_at: Date;
  completed_at: Date | null;
  duration_ms: number | null;
}): TaskExecutionRecord {
  return {
    id: row.id,
    taskId: row.task_id,
    modelId: row.model_id,
    modelName: row.model_name,
    provider: row.provider,
    status: row.status,
    prompt: row.prompt,
    result: row.result,
    error: row.error,
    startedAt: row.started_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
    durationMs: row.duration_ms,
  };
}

/** Preserve old assignments while translating them into provider-agnostic capabilities. */
function resolveTaskCapability(task: TaskRecord): Capability {
  const assignment = task.assignedAi?.toLowerCase() ?? '';
  const text = `${task.title} ${task.description} ${assignment}`.toLowerCase();
  if (text.includes('research')) return 'research';
  if (text.includes('test') || text.includes('qa')) return 'testing';
  if (text.includes('security')) return 'security';
  if (text.includes('document')) return 'documentation';
  if (text.includes('database')) return 'database-design';
  if (text.includes('ui') || text.includes('design')) return 'ui-design';
  if (text.includes('code') || text.includes('build') || text.includes('codex')) return 'coding';
  if (text.includes('plan') || text.includes('architect')) return 'planning';
  return 'reasoning';
}

function buildTaskPrompt(task: TaskRecord): string {
  let prompt = `You are Scot, Mission Control's AI assistant. You have been assigned a task to execute.\n\n`;
  prompt += `## Task: ${task.title}\n\n`;
  prompt += `## Description / Brief:\n${task.description}\n\n`;
  if (task.notes) {
    prompt += `## Additional Notes:\n${task.notes}\n\n`;
  }
  prompt += `## Instructions:\nComplete this task thoroughly. Provide a clear, actionable result. If the task requires code, include the code. If it requires analysis, provide structured analysis. If it requires a plan, provide a step-by-step plan.\n\nBe direct and deliver the output the task asks for.`;
  return prompt;
}

/** Create an execution record in the DB */
async function createExecution(
  taskId: string,
  modelId: string,
  modelName: string,
  provider: string,
  prompt: string,
): Promise<TaskExecutionRecord> {
  const sql = getDb();
  const [row] = await sql<{
    id: string;
    task_id: string;
    model_id: string;
    model_name: string;
    provider: string;
    status: ExecutionStatus;
    prompt: string;
    result: string | null;
    error: string | null;
    started_at: Date;
    completed_at: Date | null;
    duration_ms: number | null;
  }[]>`
    INSERT INTO mission_control.task_executions (task_id, model_id, model_name, provider, status, prompt)
    VALUES (${taskId}, ${modelId}, ${modelName}, ${provider}, 'running', ${prompt})
    RETURNING id, task_id, model_id, model_name, provider, status, prompt, result, error, started_at, completed_at, duration_ms
  `;
  return mapExecutionRow(row);
}

/** Update execution with result or error */
async function completeExecution(
  executionId: string,
  status: 'completed' | 'failed',
  result: string | null,
  error: string | null,
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE mission_control.task_executions
    SET
      status = ${status},
      result = ${result},
      error = ${error},
      completed_at = NOW(),
      duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at))::integer * 1000
    WHERE id = ${executionId}
  `;
}

async function assignExecutionRoute(
  executionId: string,
  route: { id: string; name: string; provider: string },
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE mission_control.task_executions
    SET model_id = ${route.id},
        model_name = ${route.name},
        provider = ${route.provider}
    WHERE id = ${executionId}
  `;
}

/** Run an explicitly initiated task through capability selection. */
export async function executeTask(task: TaskRecord): Promise<TaskExecutionRecord> {
  const capability = resolveTaskCapability(task);
  const prompt = buildTaskPrompt(task);

  const execution = await createExecution(
    task.id,
    `capability:${capability}`,
    `Automatic ${capability} route`,
    'automatic',
    prompt,
  );

  // Move task to in-progress
  await updateTaskStatus(task.id, 'in-progress');

  let selectedRoute = {
    id: execution.modelId,
    name: execution.modelName,
    provider: execution.provider,
  };
  try {
    const timeoutMs = 180000; // 3 minute timeout for task execution
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Task execution timed out after ${timeoutMs / 1000}s`)), timeoutMs),
    );
    const completion = await Promise.race([
      completeWithCapability(
        capability,
        (selection) => [
          {
            role: 'system',
            content: `You are Mission Control's ${capability} capability. Complete the explicitly initiated task fully. Mission Control selected ${selection.name}, but you remain one part of Mission Control rather than a separate assistant.`,
          },
          { role: 'user', content: prompt },
        ],
        4000,
      ),
      timeoutPromise,
    ]);
    const result = completion.content;
    selectedRoute = {
      id: completion.selection.id,
      name: completion.selection.name,
      provider: completion.selection.provider,
    };
    await assignExecutionRoute(execution.id, selectedRoute);

    // Mark execution as completed
    await completeExecution(execution.id, 'completed', result, null);

    // Move task to review
    await updateTaskStatus(task.id, 'review');

    // Auto-journal the execution (Milestone F)
    try { await journalTaskExecuted(task.title, selectedRoute.name, true); } catch { /* non-critical */ }

    return {
      ...execution,
      modelId: selectedRoute.id,
      modelName: selectedRoute.name,
      provider: selectedRoute.provider,
      status: 'completed',
      result,
      completedAt: new Date().toISOString(),
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown execution error';
    await completeExecution(execution.id, 'failed', null, errorMessage);

    // Auto-journal the failure (Milestone F)
    try { await journalTaskExecuted(task.title, selectedRoute.name, false); } catch { /* non-critical */ }

    // Leave task in-progress so user can retry or inspect
    return {
      ...execution,
      status: 'failed',
      error: errorMessage,
      completedAt: new Date().toISOString(),
    };
  }
}

/** Get executions for a specific task */
export async function listTaskExecutions(taskId: string): Promise<TaskExecutionRecord[]> {
  const sql = getDb();
  const rows = await sql<{
    id: string;
    task_id: string;
    model_id: string;
    model_name: string;
    provider: string;
    status: ExecutionStatus;
    prompt: string;
    result: string | null;
    error: string | null;
    started_at: Date;
    completed_at: Date | null;
    duration_ms: number | null;
  }[]>`
    SELECT id, task_id, model_id, model_name, provider, status, prompt, result, error, started_at, completed_at, duration_ms
    FROM mission_control.task_executions
    WHERE task_id = ${taskId}
    ORDER BY started_at DESC
    LIMIT 20
  `;
  return rows.map(mapExecutionRow);
}

/** Get the latest execution for a task */
export async function getLatestExecution(taskId: string): Promise<TaskExecutionRecord | null> {
  const sql = getDb();
  const [row] = await sql<{
    id: string;
    task_id: string;
    model_id: string;
    model_name: string;
    provider: string;
    status: ExecutionStatus;
    prompt: string;
    result: string | null;
    error: string | null;
    started_at: Date;
    completed_at: Date | null;
    duration_ms: number | null;
  }[]>`
    SELECT id, task_id, model_id, model_name, provider, status, prompt, result, error, started_at, completed_at, duration_ms
    FROM mission_control.task_executions
    WHERE task_id = ${taskId}
    ORDER BY started_at DESC
    LIMIT 1
  `;
  return row ? mapExecutionRow(row) : null;
}
