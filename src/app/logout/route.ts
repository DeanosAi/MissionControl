import { NextResponse } from 'next/server';

import { clearAdminSession } from '@/lib/auth/session';

export async function POST() {
  await clearAdminSession();
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'));
}
