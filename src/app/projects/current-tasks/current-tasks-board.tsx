'use client';

import { useState } from 'react';

import type { TaskRecord } from '@/lib/tasks';
import { DragBoard } from './drag-board';
import { TaskCreateForm } from './task-create-form';

export function CurrentTasksBoard({ tasks }: { tasks: TaskRecord[] }) {
  const [localTasks, setLocalTasks] = useState(tasks);

  return (
    <>
      <section className="card page-projects-accent">
        <div className="task-board-section-header">
          <div>
            <div className="eyebrow">Create Task</div>
            <h2>Create Task</h2>
          </div>
          <p>Brief a new task directly into Mission Control, assign the AI lane, add notes, and set recurring behavior when needed.</p>
        </div>
        <TaskCreateForm onTaskCreated={(task) => setLocalTasks((prev) => [...prev, task])} />
      </section>

      <section className="card">
        <div className="task-board-section-header">
          <div>
            <div className="eyebrow">Current Tasks</div>
            <h2>Current Tasks</h2>
          </div>
          <p>Task records are loaded from Postgres and can now be moved with drag-and-drop between board columns.</p>
        </div>
        <DragBoard tasks={localTasks} onTasksChange={setLocalTasks} />
      </section>
    </>
  );
}
