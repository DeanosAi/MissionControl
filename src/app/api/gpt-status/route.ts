import { checkGptOAuthAvailability } from '@/lib/ai/gpt-oauth-status';

export async function GET() {
  const status = await checkGptOAuthAvailability();
  return Response.json(status, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
