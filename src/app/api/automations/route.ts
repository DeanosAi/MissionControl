import { requireAdminSession } from '@/lib/auth/session';
import { listAutomations, createAutomation, updateAutomationStatus, deleteAutomation, listAutomationRuns, getNextRunTimes, describeCron } from '@/lib/automations';

export async function GET(request: Request) {
  try { await requireAdminSession(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { searchParams } = new URL(request.url);
  const automationId = searchParams.get('runs_for');
  const previewCron = searchParams.get('preview');

  if (automationId) {
    const runs = await listAutomationRuns(automationId);
    return Response.json(runs);
  }

  if (previewCron) {
    const times = getNextRunTimes(previewCron, 5);
    const description = describeCron(previewCron);
    return Response.json({ description, nextRuns: times.map(t => t.toISOString()) });
  }

  const automations = await listAutomations();
  return Response.json(automations);
}

export async function POST(request: Request) {
  try { await requireAdminSession(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

  const body = await request.json();
  const { action } = body;

  if (action === 'create') {
    const { title, description, cronSchedule, capability, automationType } = body;
    if (!title || !cronSchedule) return Response.json({ error: 'title and cronSchedule required' }, { status: 400 });
    const automation = await createAutomation({
      title,
      description,
      cronSchedule,
      capability: capability || 'reasoning',
      automationType: automationType === 'research' ? 'research' : 'task',
    });
    return Response.json(automation);
  }

  if (action === 'pause' || action === 'resume') {
    await updateAutomationStatus(body.id, action === 'pause' ? 'paused' : 'active');
    return Response.json({ success: true });
  }

  if (action === 'delete') {
    await deleteAutomation(body.id);
    return Response.json({ success: true });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
}
