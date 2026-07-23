import 'server-only';

import { getDb } from '@/lib/db';
import { generateChatCompletion as generateAnthropicCompletion } from '@/lib/ai/anthropic';
import { getModel } from '@/lib/ai/models';
import { generateChatCompletion as generateMoonshotCompletion } from '@/lib/ai/moonshot';
import { generateChatCompletion as generateOpenAICompletion } from '@/lib/ai/openai';
import { isGptAvailable } from '@/lib/ai/gpt-oauth-status';
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

/** Map a task's assignedAi label to the closest chat model ID */
function resolveModelId(assignedAi: string | null): string {
  if (!assignedAi) return 'gpt-5.4'; // default to GPT
  const lower = assignedAi.toLowerCase();
  if (lower.includes('gpt') || lower.includes('codex')) return 'gpt-5.4';
  if (lower.includes('opus')) return 'claude-opus-4-6';
  if (lower.includes('sonnet')) return 'claude-sonnet-4-5';
  if (lower.includes('kimi')) return 'kimi-k2.5';
  return 'gpt-5.4';
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

/** Run a task against its assigned model */
export async function executeTask(task: TaskRecord): Promise<TaskExecutionRecord> {
  let modelId = resolveModelId(task.assignedAi);
  let model = getModel(modelId);

  if (!model) {
    throw new Error(`Could not resolve model for assignedAi="${task.assignedAi}". Model ID "${modelId}" not found.`);
  }

  // GPT OAuth fallback: if GPT is selected but proxy is down, use fallback model
  if (model.requiresOAuth) {
    const gptUp = await isGptAvailable();
    if (!gptUp && model.fallbackModelId) {
      const fallback = getModel(model.fallbackModelId);
      if (fallback) {
        model = fallback;
        modelId = fallback.id;
      }
    }
  }

  const prompt = buildTaskPrompt(task);

  // Create execution record
  const execution = await createExecution(task.id, model.id, model.name, model.provider, prompt);

  // Move task to in-progress
  await updateTaskStatus(task.id, 'in-progress');

  try {
    const providerLabel = model.provider === 'anthropic' ? 'Anthropic' : model.provider === 'moonshot' ? 'Moonshot' : 'OpenAI';
    const systemPrompt = `You are Scot, Mission Control's AI task execution agent. You execute tasks assigned to you by Dean through Mission Control. You are currently running as ${model.name} from ${providerLabel}. Complete the task fully and return the result.`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt },
    ];

    let result: string;

    const timeoutMs = 180000; // 3 minute timeout for task execution
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Task execution timed out after ${timeoutMs / 1000}s`)), timeoutMs),
    );

    if (model.provider === 'openai') {
      result = await Promise.race([
        generateOpenAICompletion(messages, { model: model.id, maxTokens: 4000 }),
        timeoutPromise,
      ]);
    } else if (model.provider === 'anthropic') {
      result = await Promise.race([
        generateAnthropicCompletion(messages, { model: model.id, maxTokens: 4000 }),
        timeoutPromise,
      ]);
    } else if (model.provider === 'moonshot') {
      result = await Promise.race([
        generateMoonshotCompletion(messages, { model: model.id, maxTokens: 4000 }),
        timeoutPromise,
      ]);
    } else {
      throw new Error(`Provider "${model.provider}" is not currently available for task execution.`);
    }

    // Mark execution as completed
    await completeExecution(execution.id, 'completed', result, null);

    // Move task to review
    await updateTaskStatus(task.id, 'review');

    // Auto-journal the execution (Milestone F)
    try { await journalTaskExecuted(task.title, model.name, true); } catch { /* non-critical */ }

    return {
      ...execution,
      status: 'completed',
      result,
      completedAt: new Date().toISOString(),
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown execution error';
    await completeExecution(execution.id, 'failed', null, errorMessage);

    // Auto-journal the failure (Milestone F)
    try { await journalTaskExecuted(task.title, model.name, false); } catch { /* non-critical */ }

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
