import 'server-only';

import { createTask, listTasks, getTaskById, updateTaskStatus, type TaskRecord, type CreateTaskInput, type TaskStatus } from '@/lib/tasks';
import { executeTask } from '@/lib/task-execution';
import { journalTaskCreated, journalTaskStatusChanged } from '@/lib/journal';
import {
  detectTaskIntent,
  type TaskCommand,
} from '@/lib/task-command-intent';

export { detectTaskIntent };

interface TaskResolution {
  task: TaskRecord | null;
  ambiguous: TaskRecord[];
}

function normalizedTaskWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1);
}

/** Find a task safely, refusing to mutate when a reference is ambiguous. */
async function resolveTask(ref: string): Promise<TaskResolution> {
  // Try exact UUID first
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) {
    return { task: await getTaskById(ref), ambiguous: [] };
  }

  const tasks = await listTasks();
  const lowerRef = ref.toLowerCase().trim();

  const exact = tasks.find(t => t.title.toLowerCase() === lowerRef);
  if (exact) return { task: exact, ambiguous: [] };

  const partial = tasks.filter(t => t.title.toLowerCase().includes(lowerRef));
  if (partial.length === 1) return { task: partial[0], ambiguous: [] };
  if (partial.length > 1) return { task: null, ambiguous: partial.slice(0, 5) };

  const refWords = normalizedTaskWords(lowerRef);
  if (refWords.length === 0) return { task: null, ambiguous: [] };
  const scored = tasks
    .map((task) => {
      const titleWords = new Set(normalizedTaskWords(task.title));
      const overlap = refWords.filter((word) => titleWords.has(word)).length;
      return { task, score: overlap / refWords.length };
    })
    .filter((candidate) => candidate.score >= 0.6)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { task: null, ambiguous: [] };
  const bestMatches = scored.filter((candidate) => candidate.score === scored[0].score);
  if (bestMatches.length > 1) {
    return { task: null, ambiguous: bestMatches.slice(0, 5).map((candidate) => candidate.task) };
  }
  return { task: scored[0].task, ambiguous: [] };
}

function unresolvedTaskResponse(ref: string, resolution: TaskResolution): string {
  if (resolution.ambiguous.length > 0) {
    const choices = resolution.ambiguous.map((task) => `- ${task.title}`).join('\n');
    return `More than one task matches "${ref}". Please use a more specific title:\n${choices}`;
  }
  return `Could not find a task matching "${ref}". Try "list tasks" to see available tasks.`;
}

/** Format a single task record for display in chat */
function formatTask(task: TaskRecord): string {
  let out = `**${task.title}**\n`;
  out += `Status: ${task.status} · Priority: ${task.priority}`;
  if (task.assignedAi) out += ` · AI: ${task.assignedAi}`;
  out += `\n${task.description}`;
  if (task.notes) out += `\nNotes: ${task.notes}`;
  return out;
}

/** Format the full task list grouped by status */
function formatTaskList(tasks: TaskRecord[]): string {
  if (tasks.length === 0) return 'No tasks found in Mission Control.';

  const groups: Record<string, TaskRecord[]> = {};
  for (const t of tasks) {
    (groups[t.status] ??= []).push(t);
  }

  const statusOrder: TaskStatus[] = ['in-progress', 'backlog', 'review', 'done', 'archived'];
  const statusLabels: Record<string, string> = {
    'backlog': '📋 To Do', 'in-progress': '🔄 In Progress', 'review': '👁 Review', 'done': '✅ Done', 'archived': '📦 Archived',
  };

  let out = `**Current Tasks** (${tasks.length} total)\n\n`;
  for (const status of statusOrder) {
    const items = groups[status];
    if (!items?.length) continue;
    out += `${statusLabels[status] ?? status} (${items.length})\n`;
    for (const t of items) {
      out += `  • ${t.title}`;
      if (t.assignedAi) out += ` [${t.assignedAi}]`;
      out += ` — ${t.priority}\n`;
    }
    out += '\n';
  }

  return out.trim();
}

/** Build a summary of current tasks for injection into the system prompt */
export async function buildTaskContext(): Promise<string> {
  const tasks = await listTasks();
  if (tasks.length === 0) return 'There are currently no tasks in Mission Control.';

  const active = tasks.filter(t => t.status !== 'done' && t.status !== 'archived');
  if (active.length === 0) return 'All tasks in Mission Control are done or archived.';

  let ctx = `Current active tasks in Mission Control (${active.length}):\n`;
  for (const t of active) {
    ctx += `- "${t.title}" [${t.status}] priority:${t.priority}`;
    if (t.assignedAi) ctx += ` assigned:${t.assignedAi}`;
    ctx += '\n';
  }
  return ctx;
}

export interface TaskCommandResult {
  /** The response text to show in chat */
  response: string;
  /** Whether a task was modified/created (triggers revalidation) */
  mutated: boolean;
}

/** Execute a detected task command and return a chat-friendly response */
export async function executeTaskCommand(cmd: TaskCommand): Promise<TaskCommandResult> {
  switch (cmd.type) {
    case 'list': {
      const tasks = await listTasks();
      return { response: formatTaskList(tasks), mutated: false };
    }

    case 'create': {
      if (!cmd.title) return { response: 'I need a title to create a task. Try: "create task: Your task title here"', mutated: false };
      if (cmd.title.length > 200) {
        return { response: 'That task title is too long. Keep the title under 200 characters and place extra context in the task description.', mutated: false };
      }

      const input: CreateTaskInput = {
        title: cmd.title,
        description: cmd.description || cmd.title,
        status: 'backlog',
        priority: (cmd.priority as 'low' | 'medium' | 'high') || 'medium',
        assignedAi: cmd.assignedAi || null,
      };
      const task = await createTask(input);
      try { await journalTaskCreated(task.title, 'chat'); } catch { /* non-critical */ }
      return {
        response: `✅ Task created and added to backlog:\n\n${formatTask(task)}`,
        mutated: true,
      };
    }

    case 'run': {
      if (!cmd.taskRef) return { response: 'Which task should I run? Provide the task title or part of it.', mutated: false };
      const resolution = await resolveTask(cmd.taskRef);
      const task = resolution.task;
      if (!task) return { response: unresolvedTaskResponse(cmd.taskRef, resolution), mutated: false };
      if (!task.assignedAi) return { response: `Task "${task.title}" has no AI assigned. Assign a model first before running.`, mutated: false };
      if (task.status === 'done' || task.status === 'archived') return { response: `Task "${task.title}" is already ${task.status}. No need to run it.`, mutated: false };

      const execution = await executeTask(task);
      if (execution.status === 'completed') {
        return {
          response: `✅ Task "${task.title}" executed successfully via ${execution.modelName}.\n\n**Result:**\n${execution.result}`,
          mutated: true,
        };
      } else {
        return {
          response: `❌ Task "${task.title}" execution failed via ${execution.modelName}.\n\nError: ${execution.error}`,
          mutated: true,
        };
      }
    }

    case 'status': {
      if (!cmd.taskRef || !cmd.newStatus) return { response: 'I need a task name and a status. Try: "move task <name> to <status>"', mutated: false };
      const resolution = await resolveTask(cmd.taskRef);
      const task = resolution.task;
      if (!task) return { response: unresolvedTaskResponse(cmd.taskRef, resolution), mutated: false };
      const status = cmd.newStatus as TaskStatus;
      await updateTaskStatus(task.id, status);
      try { await journalTaskStatusChanged(task.title, task.status, status, 'chat'); } catch { /* non-critical */ }
      return {
        response: `✅ Task "${task.title}" moved to **${status}**.`,
        mutated: true,
      };
    }

    case 'show': {
      if (!cmd.taskRef) return { response: 'Which task? Provide the title or part of it.', mutated: false };
      const resolution = await resolveTask(cmd.taskRef);
      const task = resolution.task;
      if (!task) return { response: unresolvedTaskResponse(cmd.taskRef, resolution), mutated: false };
      return { response: formatTask(task), mutated: false };
    }

    default:
      return { response: 'I didn\'t understand that task command.', mutated: false };
  }
}
