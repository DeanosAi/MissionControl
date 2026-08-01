import { getBudgetAccess } from '@/lib/brady-budget/authorization';
import { subscribeToBudget, type BudgetRealtimeEvent } from '@/lib/brady-budget/realtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const encoder = new TextEncoder();

export async function GET(request: Request) {
  const access = await getBudgetAccess();
  if (!access) return new Response('Unauthorized', { status: 401 });

  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const unsubscribe = subscribeToBudget(access.household.id, (event: BudgetRealtimeEvent) => {
        send('budget-update', event);
      });
      const keepAlive = setInterval(() => send('keepalive', { at: Date.now() }), 20_000);
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepAlive);
        unsubscribe();
        try { controller.close(); } catch { /* already closed by the client */ }
      };
      cleanup = close;
      request.signal.addEventListener('abort', close, { once: true });
      send('connected', { revision: access.household.revision });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'private, no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

