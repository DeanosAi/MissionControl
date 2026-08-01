import { clearSession } from '@/lib/auth/session';

export async function GET(request: Request) {
  await clearSession();
  return Response.redirect(new URL('/budget/login', request.url));
}

