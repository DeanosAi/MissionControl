'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireAdminSession } from '@/lib/auth/session';
import {
  createTask,
  deleteTask,
  getTaskById,
  updateTask,
  updateTaskStatus,
  type TaskPriority,
  type TaskRecord,
  type TaskStatus,
} from '@/lib/tasks';

const createTaskSchema = z.object({
  title: z.string().min(1, 'Enter a task title.'),
  description: z.string().min(1, 'Enter a task brief.'),
  priority: z.enum(['low', 'medium', 'high']),
  assignedAi: z.string().trim().optional().transform((value) => value || null),
  notes: z.string().trim().optional().transform((value) => value || null),
  recurring: z.string().trim().optional().transform((value) => value || null),
  status: z.enum(['backlog', 'in-progress', 'review', 'done', 'archived']).default('backlog'),
});

export interface CurrentTasksFormState {
  error?: string;
  success?: string;
  task?: TaskRecord;
}

export async function createTaskAction(_prev: CurrentTasksFormState, formData: FormData): Promise<CurrentTasksFormState> {
  await requireAdminSession();

  const parsed = createTaskSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    priority: formData.get('priority'),
    assignedAi: formData.get('assignedAi'),
    notes: formData.get('notes'),
    recurring: formData.get('recurring'),
    status: formData.get('status'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Unable to create task.' };
  }

  const task = await createTask({
    title: parsed.data.title,
    description: parsed.data.description,
    priority: parsed.data.priority as TaskPriority,
    assignedAi: parsed.data.assignedAi,
    notes: parsed.data.notes,
    recurring: parsed.data.recurring,
    status: parsed.data.status as TaskStatus,
  });

  revalidatePath('/projects/current-tasks');
  revalidatePath('/projects');
  return { success: 'Task created.', task };
}

export async function moveTaskAction(_prevState: null, formData: FormData): Promise<null> {
  await requireAdminSession();

  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '') as TaskStatus;

  if (!id || !['backlog', 'in-progress', 'review', 'done', 'archived'].includes(status)) {
    return null;
  }

  await updateTaskStatus(id, status);
  revalidatePath('/projects/current-tasks');
  revalidatePath('/projects');
  return null;
}

export async function moveTaskQuickAction(id: string, status: TaskStatus): Promise<void> {
  await requireAdminSession();

  if (!id || !['backlog', 'in-progress', 'review', 'done', 'archived'].includes(status)) {
    return;
  }

  await updateTaskStatus(id, status);
  revalidatePath('/projects/current-tasks');
  revalidatePath('/projects');
}

export async function updateTaskAction(_prev: CurrentTasksFormState, formData: FormData): Promise<CurrentTasksFormState> {
  await requireAdminSession();

  const id = String(formData.get('id') ?? '');
  const parsed = createTaskSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    priority: formData.get('priority'),
    assignedAi: formData.get('assignedAi'),
    notes: formData.get('notes'),
    recurring: formData.get('recurring'),
    status: formData.get('status'),
  });

  if (!id || !parsed.success) {
    return { error: parsed.success ? 'Missing task id.' : parsed.error.issues[0]?.message ?? 'Unable to update task.' };
  }

  await updateTask(id, {
    title: parsed.data.title,
    description: parsed.data.description,
    priority: parsed.data.priority as TaskPriority,
    assignedAi: parsed.data.assignedAi,
    notes: parsed.data.notes,
    recurring: parsed.data.recurring,
    status: parsed.data.status as TaskStatus,
  });

  const task = await getTaskById(id);

  revalidatePath('/projects/current-tasks');
  revalidatePath('/projects');
  return {
    success: 'Task updated.',
    task: task ?? undefined,
  };
}

export async function deleteTaskAction(id: string): Promise<void> {
  await requireAdminSession();
  if (!id) return;
  await deleteTask(id);
  revalidatePath('/projects/current-tasks');
  revalidatePath('/projects');
}

export interface ExecuteTaskResult {
  success?: boolean;
  error?: string;
  executionId?: string;
  status?: string;
  result?: string | null;
  modelName?: string;
}

export async function executeTaskAction(id: string): Promise<ExecuteTaskResult> {
  await requireAdminSession();
  if (!id) return { error: 'Missing task ID.' };

  const task = await getTaskById(id);
  if (!task) return { error: 'Task not found.' };
  if (!task.assignedAi) return { error: 'No AI assigned. Assign a model before running this task.' };

  try {
    const { executeTask } = await import('@/lib/task-execution');
    const execution = await executeTask(task);

    revalidatePath('/projects/current-tasks');
    revalidatePath('/projects');

    return {
      success: execution.status === 'completed',
      executionId: execution.id,
      status: execution.status,
      result: execution.result,
      error: execution.error ?? undefined,
      modelName: execution.modelName,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Execution failed.';
    return { error: message };
  }
}
