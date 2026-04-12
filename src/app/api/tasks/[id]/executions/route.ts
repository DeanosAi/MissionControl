import { requireAdminSession } from '@/lib/auth/session';
import { listTaskExecutions, getLatestExecution } from '@/lib/task-execution';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminSession();
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const url = new URL(request.url);
  const latestOnly = url.searchParams.get('latest') === '1';

  try {
    if (latestOnly) {
      const execution = await getLatestExecution(id);
      return Response.json({ execution }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }

    const executions = await listTaskExecutions(id);
    return Response.json({ executions }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch executions';
    return Response.json({ error: message }, { status: 500 });
  }
}
