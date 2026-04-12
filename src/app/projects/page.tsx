import { DashboardShell } from '@/components/dashboard-shell';
import { SectionHeader } from '@/components/section-header';
import { projectTasks, projects } from '@/lib/data';

const columns = [
  { key: 'backlog', label: 'To Do', className: 'kanban-todo' },
  { key: 'in-progress', label: 'In Progress', className: 'kanban-progress' },
  { key: 'review', label: 'Review', className: 'kanban-review' },
  { key: 'done', label: 'Done', className: 'kanban-done' },
  { key: 'archived', label: 'Archived', className: 'kanban-archived' },
] as const;

export default function ProjectsPage() {
  return (
    <DashboardShell
      active="projects"
      title="Projects need their own room to breathe."
      subtitle="The board leads the page now so the active work is the first thing you see."
    >
      <section className="card">
        <SectionHeader title="Kanban Board" subtitle="A clearer hosted version of the old task-board shape, now with status color cues for faster scanning." />
        <div className="kanban-grid kanban-grid-five">
          {columns.map((column) => (
            <div key={column.key} className={`kanban-column ${column.className}`}>
              <div className="kanban-header">
                <h3>{column.label}</h3>
                <span className="pill ghost">
                  {
                    column.key === 'archived'
                      ? projectTasks.filter((task) => task.status === 'done').length
                      : projectTasks.filter((task) => task.status === column.key).length
                  }
                </span>
              </div>
              <div className="stack">
                {(column.key === 'archived'
                  ? projectTasks.filter((task) => task.status === 'done')
                  : projectTasks.filter((task) => task.status === column.key)
                ).map((task) => (
                  <div key={`${column.key}-${task.id}`} className="kanban-card">
                    <div className="pill-row left">
                      <span className="pill">{task.priority}</span>
                    </div>
                    <h4>{task.title}</h4>
                    <p>{task.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <SectionHeader title="Project Overview" subtitle="Context for the broader project list still lives here, just below the active board." />
        <div className="list-row project-inline-link">
          <div>
            <h3>Current Tasks</h3>
            <p>Open the database-backed task board scaffold for the live operational work queue.</p>
          </div>
          <a href="/projects/current-tasks" className="logout-button project-link-button">Open Current Tasks</a>
        </div>
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
