'use client';

import {
  closestCorners,
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useState, useTransition } from 'react';

import type { TaskRecord, TaskStatus } from '@/lib/tasks';
import { executeTaskAction, moveTaskQuickAction, type ExecuteTaskResult } from './actions';
import { TaskEditForm } from './task-edit-form';

const columns: { key: TaskStatus; label: string; className: string }[] = [
  { key: 'backlog', label: 'To Do', className: 'kanban-todo' },
  { key: 'in-progress', label: 'In Progress', className: 'kanban-progress' },
  { key: 'review', label: 'Review', className: 'kanban-review' },
  { key: 'done', label: 'Done', className: 'kanban-done' },
  { key: 'archived', label: 'Archived', className: 'kanban-archived' },
];

function TaskCard({
  task,
  dragOverlay = false,
  onTaskUpdated,
  onTaskDeleted,
}: {
  task: TaskRecord;
  dragOverlay?: boolean;
  onTaskUpdated?: (task: TaskRecord) => void;
  onTaskDeleted?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { status: task.status } });
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<ExecuteTaskResult | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const [loadingExecution, setLoadingExecution] = useState(false);

  // Load the most recent execution for this task on mount
  useEffect(() => {
    async function loadLastExecution() {
      if (execResult || loadingExecution) return; // Already loaded or loading
      
      setLoadingExecution(true);
      try {
        const response = await fetch(`/api/tasks/${task.id}/executions`);
        if (response.ok) {
          const executions = await response.json();
          if (executions && executions.length > 0) {
            const lastExec = executions[0];
            setExecResult({
              success: lastExec.status === 'completed',
              status: lastExec.status,
              result: lastExec.result,
              error: lastExec.error,
              modelName: lastExec.model_name,
            });
          }
        }
      } catch (error) {
        console.error('Failed to load execution:', error);
      } finally {
        setLoadingExecution(false);
      }
    }
    
    loadLastExecution();
  }, [task.id]); // Only run when task.id changes

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  async function handleRunTask() {
    setExecuting(true);
    setExecResult(null);
    setShowOutput(true);
    try {
      const result = await executeTaskAction(task.id);
      setExecResult(result);
      // If status changed, reflect it locally
      if (result.success && onTaskUpdated) {
        onTaskUpdated({ ...task, status: 'review' });
      } else if (result.status === 'failed' && onTaskUpdated) {
        onTaskUpdated({ ...task, status: 'in-progress' });
      }
    } catch {
      setExecResult({ error: 'Unexpected error executing task.' });
    } finally {
      setExecuting(false);
    }
  }

  const canRun = !!task.assignedAi && !executing && task.status !== 'done' && task.status !== 'archived';

  return (
    <div ref={setNodeRef} style={style} className="kanban-card drag-task-card">
      <div className="task-drag-header">
        <div className="pill-row left task-pill-row">
          <span className="pill">{task.priority}</span>
          {task.assignedAi ? <span className="pill ghost">{task.assignedAi}</span> : null}
        </div>
        {!dragOverlay ? (
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="drag-handle"
            aria-label={`Drag ${task.title}`}
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>
        ) : null}
      </div>
      <h4>{task.title}</h4>
      <p>{task.description}</p>
      <div className="task-meta-list">
        <p className="micro-copy">Assigned AI: {task.assignedAi ?? 'Unassigned'}</p>
        {task.notes ? <p className="micro-copy">Notes: {task.notes}</p> : null}
        {task.recurring ? <p className="micro-copy">Recurring: {task.recurring}</p> : null}
      </div>

      {/* Run Task button (Milestone D) */}
      {!dragOverlay && (
        <div className="task-execution-controls">
          <button
            type="button"
            className={`run-task-button ${executing ? 'run-task-running' : ''}`}
            disabled={!canRun}
            onClick={handleRunTask}
            title={!task.assignedAi ? 'Assign an AI model first' : executing ? 'Running…' : `Run task with ${task.assignedAi}`}
          >
            {executing ? '⟳ Running…' : '▶ Run Task'}
          </button>
          {execResult && (
            <button
              type="button"
              className="move-task-button"
              onClick={() => setShowOutput(!showOutput)}
            >
              {showOutput ? 'Hide Output' : 'Show Output'}
            </button>
          )}
        </div>
      )}

      {/* Execution output (Milestone D) */}
      {!dragOverlay && showOutput && execResult && (
        <div className={`task-execution-output ${execResult.success ? 'exec-success' : 'exec-error'}`}>
          <div className="exec-output-header">
            <span className={`pill ${execResult.success ? '' : 'ghost'}`}>
              {execResult.status === 'completed' ? '✓ Completed' : execResult.status === 'failed' ? '✗ Failed' : 'Running'}
            </span>
            {execResult.modelName && (
              <span className="micro-copy">via {execResult.modelName}</span>
            )}
          </div>
          {execResult.result && (
            <pre className="exec-output-body">{execResult.result}</pre>
          )}
          {execResult.error && (
            <p className="exec-output-error">{execResult.error}</p>
          )}
        </div>
      )}

      {!dragOverlay && onTaskUpdated && onTaskDeleted ? (
        <TaskEditForm task={task} onTaskUpdated={onTaskUpdated} onTaskDeleted={onTaskDeleted} />
      ) : null}
    </div>
  );
}

function Column({
  status,
  tasks,
  onTaskUpdated,
  onTaskDeleted,
}: {
  status: (typeof columns)[number];
  tasks: TaskRecord[];
  onTaskUpdated: (task: TaskRecord) => void;
  onTaskDeleted: (id: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: status.key });

  return (
    <div ref={setNodeRef} className={`kanban-column ${status.className}`}>
      <div className="kanban-header">
        <h3>{status.label}</h3>
        <span className="pill ghost">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="stack min-column-space">
          {tasks.length === 0 ? (
            <div className="kanban-card empty-column-card">
              <p>Drop tasks here.</p>
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onTaskUpdated={onTaskUpdated}
                onTaskDeleted={onTaskDeleted}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function DragBoard({
  tasks,
  onTasksChange,
}: {
  tasks: TaskRecord[];
  onTasksChange: React.Dispatch<React.SetStateAction<TaskRecord[]>>;
}) {
  const [activeTask, setActiveTask] = useState<TaskRecord | null>(null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor));

  const grouped = useMemo(
    () =>
      columns.map((column) => ({
        ...column,
        tasks: tasks.filter((task) => task.status === column.key),
      })),
    [tasks],
  );

  function resolveStatus(overId: string | null): TaskStatus | null {
    if (!overId) return null;
    if (columns.some((column) => column.key === overId)) return overId as TaskStatus;
    const targetTask = tasks.find((task) => task.id === overId);
    return targetTask?.status ?? null;
  }

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((item) => item.id === String(event.active.id)) ?? null;
    setActiveTask(task);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);

    const taskId = String(event.active.id);
    const nextStatus = resolveStatus(event.over ? String(event.over.id) : null);
    if (!nextStatus) return;

    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask || currentTask.status === nextStatus) return;

    onTasksChange((prev) => prev.map((task) => (task.id === taskId ? { ...task, status: nextStatus } : task)));

    startTransition(async () => {
      await moveTaskQuickAction(taskId, nextStatus);
    });
  }

  function handleTaskUpdated(updatedTask: TaskRecord) {
    onTasksChange((prev) => prev.map((task) => (task.id === updatedTask.id ? updatedTask : task)));
  }

  function handleTaskDeleted(id: string) {
    onTasksChange((prev) => prev.filter((task) => task.id !== id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="kanban-grid kanban-grid-five">
        {grouped.map((column) => (
          <Column
            key={column.key}
            status={column}
            tasks={column.tasks}
            onTaskUpdated={handleTaskUpdated}
            onTaskDeleted={handleTaskDeleted}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} dragOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
