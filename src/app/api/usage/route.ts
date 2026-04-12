import { getUsageSnapshot } from '@/lib/usage';

export async function GET() {
  const snapshot = await getUsageSnapshot();
  return Response.json(snapshot, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
