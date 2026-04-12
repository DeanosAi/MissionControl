'use client';

import { useActionState } from 'react';

import { moveTaskAction } from './actions';
import type { TaskRecord, TaskStatus } from '@/lib/tasks';

const statuses: { value: TaskStatus; label: string }[] = [
  { value: 'backlog', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
  { value: 'archived', label: 'Archived' },
];

export function MoveTaskForm({ task }: { task: TaskRecord }) {
  const [, formAction, pending] = useActionState(moveTaskAction, null);

  return (
    <form action={formAction} className="move-task-form">
      <input type="hidden" name="id" value={task.id} />
      <select name="status" defaultValue={task.status} className="move-task-select">
        {statuses.map((status) => (
          <option key={status.value} value={status.value}>
            {status.label}
          </option>
        ))}
      </select>
      <button type="submit" className="move-task-button" disabled={pending}>{pending ? 'Moving…' : 'Move'}</button>
    </form>
  );
}
