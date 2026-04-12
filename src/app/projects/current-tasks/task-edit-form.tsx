'use client';

import { useActionState, useEffect, useRef, useTransition } from 'react';

import { aiTeamMembers } from '@/lib/ai-team';
import type { TaskRecord } from '@/lib/tasks';
import { deleteTaskAction, type CurrentTasksFormState, updateTaskAction } from './actions';

const initialState: CurrentTasksFormState = {};

export function TaskEditForm({
  task,
  onTaskUpdated,
  onTaskDeleted,
}: {
  task: TaskRecord;
  onTaskUpdated: (task: TaskRecord) => void;
  onTaskDeleted: (id: string) => void;
}) {
  const [state, formAction, pending] = useActionState(updateTaskAction, initialState);
  const [deletePending, startDeleteTransition] = useTransition();
  const dialogRef = useRef<HTMLDetailsElement>(null);
  const lastProcessedTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.task && state.task.updatedAt !== lastProcessedTaskIdRef.current) {
      lastProcessedTaskIdRef.current = state.task.updatedAt;
      onTaskUpdated(state.task);
      if (dialogRef.current) {
        dialogRef.current.open = false;
      }
    }
  }, [state, onTaskUpdated]);

  return (
    <details ref={dialogRef} className="task-edit-block details-summary-reset">
      <summary className="task-card-actions">
        <span className="move-task-button">Edit</span>
        <button
          type="button"
          className="move-task-button delete-task-button"
          disabled={deletePending}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            startDeleteTransition(async () => {
              await deleteTaskAction(task.id);
              onTaskDeleted(task.id);
              if (dialogRef.current) {
                dialogRef.current.open = false;
              }
            });
          }}
        >
          {deletePending ? 'Deleting…' : 'Delete'}
        </button>
      </summary>

      <form action={formAction} className="task-create-form task-edit-form">
        <input type="hidden" name="id" value={task.id} />
        <div className="task-form-grid">
          <label className="login-field">
            <span>Title</span>
            <input type="text" name="title" defaultValue={task.title} required />
          </label>

          <label className="login-field task-field-full">
            <span>Brief / description</span>
            <textarea name="description" rows={4} defaultValue={task.description} required />
          </label>

          <label className="login-field">
            <span>Priority</span>
            <select name="priority" defaultValue={task.priority}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>

          <label className="login-field">
            <span>Assigned AI</span>
            <select name="assignedAi" defaultValue={task.assignedAi ?? ''}>
              <option value="">Unassigned</option>
              {aiTeamMembers.map((member) => (
                <option key={member.id} value={member.label}>
                  {member.label}
                </option>
              ))}
            </select>
          </label>

          <label className="login-field">
            <span>Status</span>
            <select name="status" defaultValue={task.status}>
              <option value="backlog">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
              <option value="archived">Archived</option>
            </select>
          </label>

          <label className="login-field">
            <span>Recurring</span>
            <input type="text" name="recurring" defaultValue={task.recurring ?? ''} />
          </label>

          <label className="login-field task-field-full">
            <span>Notes</span>
            <textarea name="notes" rows={3} defaultValue={task.notes ?? ''} />
          </label>
        </div>

        {state.error ? <p className="login-error">{state.error}</p> : null}
        {state.success ? <p className="task-success">{state.success}</p> : null}

        <button type="submit" className="login-button task-submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </details>
  );
}
