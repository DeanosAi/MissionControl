import 'server-only';

import { getDb } from '@/lib/db';

export type TaskStatus = 'backlog' | 'in-progress' | 'review' | 'done' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface TaskRecord {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedAi: string | null;
  notes: string | null;
  recurring: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedAi?: string | null;
  notes?: string | null;
  recurring?: string | null;
  projectId?: string | null;
}

export interface UpdateTaskInput {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedAi?: string | null;
  notes?: string | null;
  recurring?: string | null;
  projectId?: string | null;
}

function mapTaskRow(row: {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_ai: string | null;
  notes: string | null;
  recurring: string | null;
  project_id: string | null;
  created_at: Date;
  updated_at: Date;
}): TaskRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assignedAi: row.assigned_ai,
    notes: row.notes,
    recurring: row.recurring,
    projectId: row.project_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listTasks(): Promise<TaskRecord[]> {
  const sql = getDb();
  const rows = await sql<{
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    assigned_ai: string | null;
    notes: string | null;
    recurring: string | null;
    project_id: string | null;
    created_at: Date;
    updated_at: Date;
  }[]>`
    SELECT id, title, description, status, priority, assigned_ai, notes, recurring, project_id, created_at, updated_at
    FROM mission_control.tasks
    ORDER BY created_at ASC
  `;

  return rows.map(mapTaskRow);
}

export async function createTask(input: CreateTaskInput): Promise<TaskRecord> {
  const sql = getDb();
  const [row] = await sql<{
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    assigned_ai: string | null;
    notes: string | null;
    recurring: string | null;
    project_id: string | null;
    created_at: Date;
    updated_at: Date;
  }[]>`
    INSERT INTO mission_control.tasks (title, description, status, priority, assigned_ai, notes, recurring, project_id)
    VALUES (${input.title}, ${input.description}, ${input.status}, ${input.priority}, ${input.assignedAi ?? null}, ${input.notes ?? null}, ${input.recurring ?? null}, ${input.projectId ?? null})
    RETURNING id, title, description, status, priority, assigned_ai, notes, recurring, project_id, created_at, updated_at
  `;

  return mapTaskRow(row);
}

export async function getTaskById(id: string): Promise<TaskRecord | null> {
  const sql = getDb();
  const [row] = await sql<{
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    assigned_ai: string | null;
    notes: string | null;
    recurring: string | null;
    project_id: string | null;
    created_at: Date;
    updated_at: Date;
  }[]>`
    SELECT id, title, description, status, priority, assigned_ai, notes, recurring, project_id, created_at, updated_at
    FROM mission_control.tasks
    WHERE id = ${id}
    LIMIT 1
  `;

  return row ? mapTaskRow(row) : null;
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE mission_control.tasks
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE mission_control.tasks
    SET
      title = ${input.title},
      description = ${input.description},
      status = ${input.status},
      priority = ${input.priority},
      assigned_ai = ${input.assignedAi ?? null},
      notes = ${input.notes ?? null},
      recurring = ${input.recurring ?? null},
      project_id = COALESCE(${input.projectId ?? null}, project_id),
      updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function deleteTask(id: string): Promise<void> {
  const sql = getDb();
  await sql`
    DELETE FROM mission_control.tasks
    WHERE id = ${id}
  `;
}
