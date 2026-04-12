import { getOAuth2Client, getAuthUrl } from '@/lib/google/auth';

export async function GET() {
  try {
    const client = await getOAuth2Client();
    const url = getAuthUrl(client);
    return Response.redirect(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Google OAuth setup error';
    return Response.json({ error: msg }, { status: 500 });
  }
}
