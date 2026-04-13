import { requireAdminSession } from '@/lib/auth/session';
import { createTask, listTasks } from '@/lib/tasks';

export async function GET() {
  try {
    await requireAdminSession();
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tasks = await listTasks();
  return Response.json(tasks);
}

export async function POST(request: Request) {
  try {
    await requireAdminSession();
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const task = await createTask({
      title: body.title,
      description: body.description || '',
      status: body.status || 'backlog',
      priority: body.priority || 'medium',
      assignedAi: body.assignedAi || null,
      notes: body.notes || null,
      recurring: body.recurring || null,
    });

    return Response.json(task);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to create task' },
      { status: 500 },
    );
  }
}
