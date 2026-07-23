import Link from 'next/link';

import { DashboardShell } from '@/components/dashboard-shell';
import { SectionHeader } from '@/components/section-header';
import { listOrchestrationRequests } from '@/lib/conversational-bridge/repository';
import { listProjects } from '@/lib/projects';
import { listTasks } from '@/lib/tasks';

const columns = [
  { key: 'backlog', label: 'To Do', className: 'kanban-todo' },
  { key: 'in-progress', label: 'In Progress', className: 'kanban-progress' },
  { key: 'review', label: 'Review', className: 'kanban-review' },
  { key: 'done', label: 'Done', className: 'kanban-done' },
] as const;

export default async function ProjectsPage() {
  const [projects, tasks, orchestrationRequests] = await Promise.all([
    listProjects(),
    listTasks(),
    listOrchestrationRequests(100),
  ]);

  const grouped = columns.map((column) => ({
    ...column,
    tasks: tasks.filter((task) => task.status === column.key),
  }));
  const latestRequestByProject = new Map<string, (typeof orchestrationRequests)[number]>();
  for (const request of orchestrationRequests) {
    if (!latestRequestByProject.has(request.projectId)) {
      latestRequestByProject.set(request.projectId, request);
    }
  }

  return (
    <DashboardShell
      active="projects"
      title="Projects"
      subtitle="Every conversational request lands in the existing project system, with child projects keeping the work modular."
    >
      <section className="metric-grid metric-grid-spread">
        {grouped.map((column) => (
          <div
            className={`metric-card ${
              column.key === 'backlog'
                ? 'accent-yellow'
                : column.key === 'in-progress'
                  ? 'accent-blue'
                  : column.key === 'review'
                    ? 'accent-orange'
                    : 'accent-blue-light'
            }`}
            key={column.key}
          >
            <span>{column.label}</span>
            <strong>{column.tasks.length}</strong>
          </div>
        ))}
      </section>

      <section className="card">
        <SectionHeader
          title="Task Board"
          subtitle="A live mirror of Current Tasks. Proposal-only projects do not create tasks until a later approved sprint."
        />
        <div className="kanban-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          {grouped.map((column) => (
            <div key={column.key} className={`kanban-column ${column.className}`}>
              <div className="kanban-header">
                <h3>{column.label}</h3>
                <span className="pill ghost">{column.tasks.length}</span>
              </div>
              <div className="stack">
                {column.tasks.length === 0 ? (
                  <div className="kanban-card" style={{ opacity: 0.5 }}>
                    <p className="micro-copy">No tasks</p>
                  </div>
                ) : (
                  column.tasks.map((task) => (
                    <Link key={task.id} href="/projects/current-tasks" className="kanban-card project-task-preview">
                      <div className="pill-row left">
                        <span className="pill">{task.priority}</span>
                        {task.assignedAi ? <span className="pill ghost">{task.assignedAi}</span> : null}
                      </div>
                      <h4>{task.title}</h4>
                      <p className="micro-copy project-task-description">{task.description}</p>
                      {task.notes?.includes('Created from Ideas') ? (
                        <span className="pill ghost project-task-origin">from Ideas</span>
                      ) : null}
                    </Link>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="project-board-footer">
          <p>Use Current Tasks for editing, drag-and-drop, assignment, and manual execution.</p>
          <Link href="/projects/current-tasks" className="logout-button project-link-button">
            Open Current Tasks →
          </Link>
        </div>
      </section>

      <section className="card project-overview-card">
        <SectionHeader title="Project Overview" subtitle="Top-level and child projects share one durable source of truth." />
        <div className="project-record-grid">
          {projects.map((project) => {
            const request = latestRequestByProject.get(project.id);
            return (
              <article key={project.id} className="project-record">
                <div className="project-record-topline">
                  <div>
                    {project.parentProjectTitle ? (
                      <span className="micro-copy">Child of {project.parentProjectTitle}</span>
                    ) : (
                      <span className="micro-copy">Top-level project</span>
                    )}
                    <h3>{project.title}</h3>
                  </div>
                  <span className="pill highlight">{project.status}</span>
                </div>
                <p>{project.summary}</p>
                <div className="project-record-meta">
                  <span>Owner: {project.owner}</span>
                  {request ? (
                    <Link href={`/chat#proposal-${request.id}`} className="project-proposal-link">
                      Proposal {request.revision} · {request.status.replace('-', ' ')}
                    </Link>
                  ) : (
                    <span>No conversational proposal</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </DashboardShell>
  );
}
