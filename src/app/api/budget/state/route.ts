import { getBudgetAccess } from '@/lib/brady-budget/authorization';
import { publishBudgetUpdate } from '@/lib/brady-budget/realtime';
import { saveBudgetHouseholdState } from '@/lib/brady-budget/repository';
import { isSameOriginMutation } from '@/lib/brady-budget/request-security';
import { saveBudgetStateSchema } from '@/lib/brady-budget/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStoreHeaders = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET() {
  const access = await getBudgetAccess();
  if (!access) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  }

  return Response.json({
    state: access.household.state,
    revision: access.household.revision,
    account: access.account,
  }, { headers: noStoreHeaders });
}

export async function PUT(request: Request) {
  if (!isSameOriginMutation(request)) {
    return Response.json({ error: 'Invalid request origin.' }, { status: 403, headers: noStoreHeaders });
  }
  const access = await getBudgetAccess();
  if (!access) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400, headers: noStoreHeaders });
  }
  const parsed = saveBudgetStateSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({
      error: parsed.error.issues[0]?.message ?? 'Invalid budget state.',
    }, { status: 400, headers: noStoreHeaders });
  }

  const result = await saveBudgetHouseholdState(
    access.household.id,
    parsed.data.state,
    parsed.data.baseRevision,
  );
  if (!result.saved) {
    return Response.json({
      error: 'The household budget changed on another device.',
      state: result.snapshot.state,
      revision: result.snapshot.revision,
      account: access.account,
    }, { status: 409, headers: noStoreHeaders });
  }

  publishBudgetUpdate(access.household.id, {
    revision: result.snapshot.revision,
    clientId: parsed.data.clientId,
  });
  return Response.json({
    state: result.snapshot.state,
    revision: result.snapshot.revision,
    account: access.account,
  }, { headers: noStoreHeaders });
}

