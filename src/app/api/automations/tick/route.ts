import { timingSafeEqual } from 'node:crypto';

import { requireAdminSession } from '@/lib/auth/session';
import { tickAutomations } from '@/lib/automations';

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length
    && timingSafeEqual(leftBuffer, rightBuffer);
}

async function isAuthorised(request: Request): Promise<boolean> {
  const configuredToken = process.env.AUTOMATION_TICK_TOKEN?.trim();
  const authorization = request.headers.get('authorization');
  const suppliedToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
  if (configuredToken && suppliedToken && secureEqual(configuredToken, suppliedToken)) {
    return true;
  }
  try {
    await requireAdminSession();
    return true;
  } catch {
    return false;
  }
}

async function handleTick(request: Request) {
  if (!await isAuthorised(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await tickAutomations();
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Tick failed' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handleTick(request);
}

export async function GET(request: Request) {
  return handleTick(request);
}
