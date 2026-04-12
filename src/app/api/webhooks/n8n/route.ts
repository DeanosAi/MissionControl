import { createTask } from '@/lib/tasks';
import { createJournalEntry } from '@/lib/journal';

export async function POST(request: Request) {
  // Webhooks don't require session auth - they use a shared secret or are open
  // Optionally verify with a webhook secret header
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
  if (webhookSecret) {
    const provided = request.headers.get('x-webhook-secret');
    if (provided !== webhookSecret) {
      return Response.json({ error: 'Invalid webhook secret' }, { status: 401 });
    }
  }

  const body = await request.json();

  if (body.action === 'create_task') {
    try {
      const task = await createTask({
        title: body.title || 'Task from N8N',
        description: body.description || '',
        status: body.status || 'backlog',
        priority: body.priority || 'medium',
        assignedAi: body.assignedAi || null,
        notes: body.notes ? `${body.notes}\n[Created by N8N webhook]` : '[Created by N8N webhook]',
      });

      try {
        await createJournalEntry({
          title: `N8N created task: ${task.title}`,
          detail: `Task created via N8N webhook.`,
          entryType: 'auto',
          source: 'n8n-webhook',
        });
      } catch { /* non-critical */ }

      return Response.json({ success: true, taskId: task.id });
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
    }
  }

  return Response.json({ error: 'Unknown action. Supported: create_task' }, { status: 400 });
}
