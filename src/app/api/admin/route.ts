import { requireAdminSession } from '@/lib/auth/session';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  try {
    await requireAdminSession();
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action;

  const sql = getDb();

  try {
    switch (action) {
      case 'clear-chat': {
        const result = await sql`DELETE FROM mission_control.chat_messages`;
        return Response.json({ success: true, message: `Chat history cleared. ${result.count} messages removed.` });
      }

      case 'clear-old-executions': {
        const days = body.days ?? 30;
        const result = await sql`
          DELETE FROM mission_control.task_executions
          WHERE started_at < NOW() - INTERVAL '1 day' * ${days}
        `;
        return Response.json({ success: true, message: `Removed ${result.count} executions older than ${days} days.` });
      }

      case 'vacuum': {
        await sql`VACUUM ANALYZE`;
        return Response.json({ success: true, message: 'Database vacuumed and analyzed.' });
      }

      case 'db-stats': {
        const [stats] = await sql<{
          db_size: string;
          tasks: string;
          journals: string;
          memories: string;
          chats: string;
          executions: string;
        }[]>`
          SELECT
            pg_size_pretty(pg_database_size(current_database())) as db_size,
            (SELECT COUNT(*)::text FROM mission_control.tasks) as tasks,
            (SELECT COUNT(*)::text FROM mission_control.journal_entries) as journals,
            (SELECT COUNT(*)::text FROM mission_control.memory_notes) as memories,
            (SELECT COUNT(*)::text FROM mission_control.chat_messages) as chats,
            (SELECT COUNT(*)::text FROM mission_control.task_executions) as executions
        `;
        return Response.json({ success: true, stats });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Admin action failed';
    return Response.json({ error: message }, { status: 500 });
  }
}
