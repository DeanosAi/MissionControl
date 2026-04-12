import { requireAdminSession } from '@/lib/auth/session';
import { testLocalModelConnection } from '@/lib/local-llm/client';

export async function POST(request: Request) {
  try { await requireAdminSession(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { endpoint, modelId } = await request.json();
  if (!endpoint || !modelId) return Response.json({ error: 'endpoint and modelId required' }, { status: 400 });

  const result = await testLocalModelConnection(endpoint, modelId);
  return Response.json(result);
}
