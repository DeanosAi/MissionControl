import { requireAdminSession } from '@/lib/auth/session';
import { listIdeas, createIdea, searchIdeas } from '@/lib/ideas';

export async function GET(request: Request) {
  try { await requireAdminSession(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const status = searchParams.get('status');

  try {
    const ideas = query
      ? await searchIdeas(query)
      : await listIdeas(status as any || undefined);
    return Response.json(ideas);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try { await requireAdminSession(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { title, description } = await request.json();
  if (!title) return Response.json({ error: 'Title required' }, { status: 400 });

  try {
    const idea = await createIdea(title, description);
    return Response.json(idea);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
