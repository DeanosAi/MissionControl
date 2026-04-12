'use client';

import { useState, useEffect, DragEvent } from 'react';
import { Plus, GripVertical, Archive, CheckCircle2, Clock3 } from 'lucide-react';
import type { Task, TaskStatus } from '@/lib/tasks';

const columns = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
  { id: 'archived', label: 'Archived' },
] as const satisfies ReadonlyArray<{ id: TaskStatus; label: string }>;

function todayString() {
  return new Date().toISOString().split('T')[0];
}

function sortColumnTasks(columnId: TaskStatus, taskList: Task[]) {
  if (columnId === 'done' || columnId === 'archived') {
    return [...taskList].sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
  }

  return taskList;
}

export default function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', project: '' });

  useEffect(() => {
    fetch('/api/tasks').then((r) => r.json()).then(setTasks);
  }, []);

  function handleDragStart(e: DragEvent, taskId: string) {
    e.dataTransfer.setData('text/plain', taskId);
  }

  function handleDragOver(e: DragEvent, colId: TaskStatus) {
    e.preventDefault();
    setDragOverCol(colId);
  }

  function handleDragLeave() {
    setDragOverCol(null);
  }

  async function handleDrop(e: DragEvent, colId: TaskStatus) {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData('text/plain');
    const updated = tasks.map((task) => {
      if (task.id !== taskId) {
        return task;
      }

      if (colId === 'done' || colId === 'archived') {
        return { ...task, status: colId, completedAt: task.completedAt || todayString() };
      }

      const reopened = { ...task, status: colId };
      delete reopened.completedAt;
      return reopened;
    });

    setTasks(updated);
    await fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  }

  async function handleAddTask() {
    if (!newTask.title.trim()) return;

    const task: Task = {
      id: `task-${Date.now()}`,
      title: newTask.title,
      description: newTask.description,
      status: 'backlog',
      priority: newTask.priority,
      project: newTask.project || 'General',
      createdAt: todayString(),
    };

    const updated = [...tasks, task];
    setTasks(updated);
    setNewTask({ title: '', description: '', priority: 'medium', project: '' });
    setShowAdd(false);

    await fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Task Board</h1>
          <p style={{ color: 'var(--muted)' }} className="text-sm">
            Drag tasks between columns to update status. Done items move to Archived after 7 days.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <Plus size={16} /> Add Task
        </button>
      </div>

      {showAdd && (
        <div className="card mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              placeholder="Task title"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--background)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
            />
            <input
              placeholder="Project"
              value={newTask.project}
              onChange={(e) => setNewTask({ ...newTask, project: e.target.value })}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--background)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
            />
            <input
              placeholder="Description"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--background)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
            />
            <select
              value={newTask.priority}
              onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--background)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
          </div>
          <button
            onClick={handleAddTask}
            className="mt-4 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Create Task
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {columns.map((col) => {
          const colTasks = sortColumnTasks(
            col.id,
            tasks.filter((task) => task.status === col.id),
          );

          return (
            <div
              key={col.id}
              className={`kanban-column p-4 ${dragOverCol === col.id ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {col.id === 'archived' ? (
                    <Archive size={14} style={{ color: 'var(--muted)' }} />
                  ) : col.id === 'done' ? (
                    <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                  ) : (
                    <Clock3 size={14} style={{ color: 'var(--accent)' }} />
                  )}
                  <h3 className="text-sm font-semibold">{col.label}</h3>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent)' }}
                >
                  {colTasks.length}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    className="card cursor-grab active:cursor-grabbing"
                    style={{ padding: '0.75rem' }}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical size={14} style={{ color: 'var(--muted)', marginTop: 2 }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium mb-1">{task.title}</div>
                        {task.description && (
                          <div className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
                            {task.description}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className={`text-xs priority-${task.priority}`}>
                            {'\u2022'} {task.priority}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>
                            {task.project}
                          </span>
                        </div>
                        {task.completedAt && (col.id === 'done' || col.id === 'archived') && (
                          <div className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                            Completed {task.completedAt}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
