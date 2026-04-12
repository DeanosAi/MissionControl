import { requireAdminSession } from '@/lib/auth/session';
import { getTaskById } from '@/lib/tasks';
import { executeTask } from '@/lib/task-execution';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminSession();
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const task = await getTaskById(id);
  if (!task) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }

  if (!task.assignedAi) {
    return Response.json(
      { error: 'Task has no assigned AI. Assign a model before running.' },
      { status: 400 },
    );
  }

  try {
    const execution = await executeTask(task);
    return Response.json(execution);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Execution failed';
    return Response.json({ error: message }, { status: 500 });
  }
}
