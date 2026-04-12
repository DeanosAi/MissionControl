import { getSystemHealth } from '@/lib/system-health';

export async function GET() {
  const health = await getSystemHealth();

  const status = health.database.connected ? 200 : 503;

  return Response.json(health, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
