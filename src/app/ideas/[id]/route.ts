import { requireAdminSession } from '@/lib/auth/session';
import { getIdea, archiveIdea, deleteIdea } from '@/lib/ideas';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try { await requireAdminSession(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  const idea = await getIdea(id);
  if (!idea) return Response.json({ error: 'Idea not found' }, { status: 404 });

  return Response.json(idea);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try { await requireAdminSession(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  const { action } = await request.json();

  if (action === 'archive') {
    await archiveIdea(id);
    return Response.json({ success: true });
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try { await requireAdminSession(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  await deleteIdea(id);
  return Response.json({ success: true });
}
