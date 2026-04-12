import { requireAdminSession } from '@/lib/auth/session';
import { testN8nConnection, listN8nWorkflows, executeN8nWorkflow, listN8nRuns } from '@/lib/n8n/client';

export async function GET(request: Request) {
  try { await requireAdminSession(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { searchParams } = new URL(request.url);

  if (searchParams.get('test') === '1') {
    const status = await testN8nConnection();
    return Response.json(status);
  }

  if (searchParams.get('runs') === '1') {
    const runs = await listN8nRuns();
    return Response.json(runs);
  }

  try {
    const workflows = await listN8nWorkflows();
    return Response.json(workflows);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to list workflows' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try { await requireAdminSession(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { workflowId, workflowName, inputData } = await request.json();
  if (!workflowId) return Response.json({ error: 'workflowId required' }, { status: 400 });

  try {
    const result = await executeN8nWorkflow(workflowId, workflowName || 'Unknown', inputData);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Execution failed' }, { status: 500 });
  }
}
