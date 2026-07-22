import { DashboardShell } from '@/components/dashboard-shell';
import { SectionHeader } from '@/components/section-header';
import { listTasks } from '@/lib/tasks';
import { projects } from '@/lib/data';

const columns = [
  { key: 'backlog', label: 'To Do', className: 'kanban-todo' },
  { key: 'in-progress', label: 'In Progress', className: 'kanban-progress' },
  { key: 'review', label: 'Review', className: 'kanban-review' },
  { key: 'done', label: 'Done', className: 'kanban-done' },
] as const;

export default async function ProjectsPage() {
  const tasks = await listTasks().catch(() => []);

  const grouped = columns.map(col => ({
    ...col,
    tasks: tasks.filter(t => t.status === col.key),
  }));

  const activeTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'archived');
  const completedTasks = tasks.filter(t => t.status === 'done');

  return (
    <DashboardShell
      active="projects"
      title="Projects"
      subtitle="At-a-glance view of all tasks across the board. Open Current Tasks to manage and execute."
    >
      {/* Stats row */}
      <section className="metric-grid metric-grid-spread">
        <div className="metric-card accent-yellow">
          <span>To Do</span>
          <strong>{grouped[0].tasks.length}</strong>
        </div>
        <div className="metric-card accent-blue">
          <span>In Progress</span>
          <strong>{grouped[1].tasks.length}</strong>
        </div>
        <div className="metric-card accent-orange">
          <span>Review</span>
          <strong>{grouped[2].tasks.length}</strong>
        </div>
        <div className="metric-card accent-blue-light">
          <span>Done</span>
          <strong>{grouped[3].tasks.length}</strong>
        </div>
      </section>

      {/* Kanban mirror — read-only view of real DB tasks */}
      <section className="card">
        <SectionHeader title="Task Board" subtitle="Live mirror of Current Tasks. Click a task to manage it in Current Tasks." />
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
                    <div key={task.id} className="kanban-card">
                      <div className="pill-row left">
                        <span className="pill">{task.priority}</span>
                        {task.assignedAi && <span className="pill ghost">{task.assignedAi}</span>}
                      </div>
                      <h4>{task.title}</h4>
                      <p className="micro-copy" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {task.description}
                      </p>
                      {task.notes && task.notes.includes('Created from Ideas') && (
                        <span className="pill ghost" style={{ marginTop: '0.35rem', fontSize: '0.68rem' }}>from Ideas</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Link to Current Tasks for full management */}
      <section className="card">
        <div className="list-row project-inline-link">
          <div>
            <h3>Manage Tasks</h3>
            <p>Open Current Tasks to create, edit, drag, execute, and manage tasks with full controls.</p>
          </div>
          <a href="/projects/current-tasks" className="logout-button project-link-button">Open Current Tasks →</a>
        </div>
      </section>

      {/* Project overview */}
      <section className="card">
        <SectionHeader title="Project Overview" subtitle="Broader projects that encompass the work above." />
        <div className="stack">
          {projects.map((project) => (
            <div key={project.id} className="list-row">
              <div>
                <h3>{project.title}</h3>
                <p>{project.summary}</p>
                <span className="micro-copy">Owner: {project.owner}</span>
              </div>
              <span className="pill highlight">{project.status}</span>
            </div>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
