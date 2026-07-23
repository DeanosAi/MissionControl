import { requireAdminSession } from '@/lib/auth/session';
import {
  archiveIdea,
  createIdea,
  listIdeas,
  searchIdeas,
  type IdeaStatus,
} from '@/lib/ideas';

const IDEA_STATUSES: IdeaStatus[] = [
  'submitted',
  'researching',
  'researched',
  'building',
  'built',
  'archived',
];

export async function GET(request: Request) {
  try { await requireAdminSession(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const status = searchParams.get('status');

  try {
    const ideaStatus = IDEA_STATUSES.find((value) => value === status);
    const ideas = query
      ? await searchIdeas(query)
      : await listIdeas(ideaStatus);
    return Response.json(ideas);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try { await requireAdminSession(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

  try {
    const { title, description } = await request.json();
    if (!title) return Response.json({ error: 'Title required' }, { status: 400 });
    const idea = await createIdea(title, description);
    return Response.json(idea);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try { await requireAdminSession(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

  try {
    const { id, action } = await request.json();
    if (action === 'archive' && id) {
      await archiveIdea(id);
      return Response.json({ success: true });
    }
    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
