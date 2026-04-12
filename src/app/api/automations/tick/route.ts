import { tickAutomations } from '@/lib/automations';

export async function POST() {
  try {
    const result = await tickAutomations();
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Tick failed' }, { status: 500 });
  }
}

// Also allow GET so it can be triggered by a simple curl/cron
export async function GET() {
  try {
    const result = await tickAutomations();
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Tick failed' }, { status: 500 });
  }
}
