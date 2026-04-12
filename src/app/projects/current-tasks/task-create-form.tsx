'use client';

import { useActionState, useEffect, useRef } from 'react';

import { aiTeamMembers } from '@/lib/ai-team';
import type { TaskRecord } from '@/lib/tasks';
import { createTaskAction, type CurrentTasksFormState } from './actions';

const initialState: CurrentTasksFormState = {};

export function TaskCreateForm({ onTaskCreated }: { onTaskCreated: (task: TaskRecord) => void }) {
  const [state, formAction, pending] = useActionState(createTaskAction, initialState);
  const lastTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.task && state.task.id !== lastTaskIdRef.current) {
      lastTaskIdRef.current = state.task.id;
      onTaskCreated(state.task);
    }
  }, [state, onTaskCreated]);

  return (
    <form action={formAction} className="task-create-form">
      <div className="task-form-grid">
        <label className="login-field">
          <span>Title</span>
          <input type="text" name="title" required />
        </label>

        <label className="login-field task-field-full">
          <span>Brief / description</span>
          <textarea name="description" rows={4} required />
        </label>

        <label className="login-field">
          <span>Priority</span>
          <select name="priority" defaultValue="medium">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>

        <label className="login-field">
          <span>Assigned AI</span>
          <select name="assignedAi" defaultValue="">
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
          <select name="status" defaultValue="backlog">
            <option value="backlog">To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
            <option value="archived">Archived</option>
          </select>
        </label>

        <label className="login-field">
          <span>Recurring (optional)</span>
          <input type="text" name="recurring" placeholder="Daily / Weekdays / Weekly / Monthly" />
        </label>

        <label className="login-field task-field-full">
          <span>Notes (optional)</span>
          <textarea name="notes" rows={3} />
        </label>
      </div>

      {state.error ? <p className="login-error">{state.error}</p> : null}
      {state.success ? <p className="task-success">{state.success}</p> : null}

      <button type="submit" className="login-button task-submit" disabled={pending}>
        {pending ? 'Creating task…' : 'Create task'}
      </button>
    </form>
  );
}
