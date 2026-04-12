import { DashboardShell } from '@/components/dashboard-shell';
import { listTasks } from '@/lib/tasks';

import { CurrentTasksBoard } from './current-tasks-board';

export default async function CurrentTasksPage() {
  const tasks = await listTasks();

  return (
    <DashboardShell
      active="projects"
      title="Current Tasks"
      subtitle="This is now the real operational board: tasks can be created, edited, deleted, assigned, scheduled, and moved with drag-and-drop."
    >
      <CurrentTasksBoard tasks={tasks} />
    </DashboardShell>
  );
}
