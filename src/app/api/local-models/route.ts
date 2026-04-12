import { requireAdminSession } from '@/lib/auth/session';
import { listLocalModels, createLocalModel, deleteLocalModel, toggleLocalModelStatus, detectLMStudio } from '@/lib/local-llm/client';

export async function GET(request: Request) {
  try { await requireAdminSession(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { searchParams } = new URL(request.url);

  if (searchParams.get('detect') === '1') {
    const result = await detectLMStudio();
    return Response.json(result);
  }

  const models = await listLocalModels();
  return Response.json(models);
}

export async function POST(request: Request) {
  try { await requireAdminSession(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

  const body = await request.json();
  const { action } = body;

  if (action === 'create') {
    const { name, endpoint, modelId, contextWindow } = body;
    if (!name || !endpoint || !modelId) return Response.json({ error: 'name, endpoint, modelId required' }, { status: 400 });
    const model = await createLocalModel({ name, endpoint, modelId, contextWindow });
    return Response.json(model);
  }

  if (action === 'delete') {
    await deleteLocalModel(body.id);
    return Response.json({ success: true });
  }

  if (action === 'toggle') {
    await toggleLocalModelStatus(body.id);
    return Response.json({ success: true });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
}
