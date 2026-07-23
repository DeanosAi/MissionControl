import 'server-only';

import { createTask, listTasks, getTaskById, updateTaskStatus, type TaskRecord, type CreateTaskInput, type TaskStatus } from '@/lib/tasks';
import { executeTask } from '@/lib/task-execution';
import { journalTaskCreated, journalTaskStatusChanged } from '@/lib/journal';

/**
 * Detects whether a user message contains a task-related command intent.
 * Returns a structured command if detected, null otherwise.
 */
export type TaskCommandType = 'create' | 'list' | 'run' | 'assign' | 'status' | 'show';

export interface TaskCommand {
  type: TaskCommandType;
  /** For create: title */
  title?: string;
  /** For create: description */
  description?: string;
  /** For create/assign: priority */
  priority?: string;
  /** For create/assign: assigned AI label */
  assignedAi?: string;
  /** For run/assign/status/show: task identifier (title fragment or id) */
  taskRef?: string;
  /** For status: new status */
  newStatus?: string;
}

/** Lightweight intent detection — looks for explicit keywords without needing an LLM call */
export function detectTaskIntent(message: string): TaskCommand | null {
  const lower = message.toLowerCase().trim();

  // --- CREATE ---
  // "create task: <title>" or "new task: <title>" or "add task: <title>"
  const createMatch = lower.match(/^(?:create|new|add)\s+(?:a\s+)?task[:\s]+(.+)/i);
  if (createMatch) {
    const rest = message.slice(message.toLowerCase().indexOf(createMatch[1].substring(0, 10)));
    return { type: 'create', title: rest.trim() };
  }

  // --- LIST ---
  if (/^(?:list|show|get|view)\s+(?:all\s+)?(?:tasks|my tasks|current tasks)/i.test(lower)) {
    return { type: 'list' };
  }
  if (lower === 'tasks' || lower === 'my tasks' || lower === 'current tasks') {
    return { type: 'list' };
  }

  // --- RUN ---
  // "run task: <ref>" or "execute task: <ref>"
  const runMatch = lower.match(/^(?:run|execute|start)\s+(?:task[:\s]+)?(.+)/i);
  if (runMatch && !runMatch[1].match(/^(?:a\s+)?new|task[:\s]/)) {
    return { type: 'run', taskRef: runMatch[1].trim() };
  }

  // --- STATUS ---
  // "move task <ref> to <status>"
  const statusMatch = lower.match(/^(?:move|set|change|update)\s+task\s+["""]?(.+?)["""]?\s+(?:to|status)\s+(.+)/i);
  if (statusMatch) {
    return { type: 'status', taskRef: statusMatch[1].trim(), newStatus: statusMatch[2].trim() };
  }

  // --- SHOW (single task) ---
  // Requiring "task" prevents general questions and "show memory" from
  // being intercepted by the task command bridge.
  const showMatch = lower.match(/^(?:(?:show|describe)\s+(?:the\s+)?task|details?\s+(?:of|for)\s+(?:the\s+)?task|what(?:'s| is)\s+(?:the\s+)?status\s+of\s+(?:the\s+)?task)\s+["""]?(.+?)["""]?\s*\??$/i);
  if (showMatch && showMatch[1].length > 2) {
    return { type: 'show', taskRef: showMatch[1].trim() };
  }

  return null;
}

/** Find a task by fuzzy title matching or exact UUID */
async function resolveTask(ref: string): Promise<TaskRecord | null> {
  // Try exact UUID first
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) {
    return getTaskById(ref);
  }

  // Fuzzy title match
  const tasks = await listTasks();
  const lowerRef = ref.toLowerCase();

  // Exact title match
  const exact = tasks.find(t => t.title.toLowerCase() === lowerRef);
  if (exact) return exact;

  // Contains match
  const partial = tasks.filter(t => t.title.toLowerCase().includes(lowerRef));
  if (partial.length === 1) return partial[0];

  // Word overlap match
  const refWords = lowerRef.split(/\s+/);
  let bestTask: TaskRecord | null = null;
  let bestScore = 0;
  for (const task of tasks) {
    const titleWords = task.title.toLowerCase().split(/\s+/);
    const score = refWords.filter(w => titleWords.some(tw => tw.includes(w))).length;
    if (score > bestScore && score >= Math.ceil(refWords.length * 0.5)) {
      bestScore = score;
      bestTask = task;
    }
  }

  return bestTask;
}

/** Map user-friendly status strings to TaskStatus */
function parseStatus(s: string): TaskStatus | null {
  const lower = s.toLowerCase().trim();
  const map: Record<string, TaskStatus> = {
    'backlog': 'backlog', 'to do': 'backlog', 'todo': 'backlog',
    'in-progress': 'in-progress', 'in progress': 'in-progress', 'started': 'in-progress', 'working': 'in-progress',
    'review': 'review', 'reviewing': 'review',
    'done': 'done', 'complete': 'done', 'completed': 'done', 'finished': 'done',
    'archived': 'archived', 'archive': 'archived',
  };
  return map[lower] ?? null;
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
      const task = await resolveTask(cmd.taskRef);
      if (!task) return { response: `Could not find a task matching "${cmd.taskRef}". Try "list tasks" to see available tasks.`, mutated: false };
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
      const task = await resolveTask(cmd.taskRef);
      if (!task) return { response: `Could not find a task matching "${cmd.taskRef}".`, mutated: false };
      const status = parseStatus(cmd.newStatus);
      if (!status) return { response: `"${cmd.newStatus}" is not a valid status. Valid options: to do, in progress, review, done, archived.`, mutated: false };
      await updateTaskStatus(task.id, status);
      try { await journalTaskStatusChanged(task.title, task.status, status, 'chat'); } catch { /* non-critical */ }
      return {
        response: `✅ Task "${task.title}" moved to **${status}**.`,
        mutated: true,
      };
    }

    case 'show': {
      if (!cmd.taskRef) return { response: 'Which task? Provide the title or part of it.', mutated: false };
      const task = await resolveTask(cmd.taskRef);
      if (!task) return { response: `Could not find a task matching "${cmd.taskRef}". Try "list tasks" to see available tasks.`, mutated: false };
      return { response: formatTask(task), mutated: false };
    }

    default:
      return { response: 'I didn\'t understand that task command.', mutated: false };
  }
}
