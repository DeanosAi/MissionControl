import { getOAuth2Client, saveTokens } from '@/lib/google/auth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return Response.redirect('/systems?google_auth=denied');
  }

  if (!code) {
    return Response.json({ error: 'No authorization code provided' }, { status: 400 });
  }

  try {
    const client = await getOAuth2Client();
    const { tokens } = await client.getToken(code);
    await saveTokens(tokens);
    return Response.redirect('/systems?google_auth=success');
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return Response.redirect('/systems?google_auth=error');
  }
}
