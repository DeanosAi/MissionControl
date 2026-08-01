import { getBudgetAccess } from '@/lib/brady-budget/authorization';
import { subscribeToBudget, type BudgetRealtimeEvent } from '@/lib/brady-budget/realtime';
import { getBudgetHousehold } from '@/lib/brady-budget/repository';

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
      let polling = false;
      let lastRevision = access.household.revision;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const unsubscribe = subscribeToBudget(access.household.id, (event: BudgetRealtimeEvent) => {
        lastRevision = Math.max(lastRevision, event.revision);
        send('budget-update', event);
      });
      const revisionWatch = setInterval(async () => {
        if (closed || polling) return;
        polling = true;
        try {
          const household = await getBudgetHousehold(access.household.id);
          if (household && household.revision > lastRevision) {
            lastRevision = household.revision;
            send('budget-update', { revision: household.revision, clientId: 'database-watch' });
          }
        } catch {
          // The client-side poll remains available if this lightweight watcher is interrupted.
        } finally {
          polling = false;
        }
      }, 1_000);
      const keepAlive = setInterval(() => send('keepalive', { at: Date.now() }), 20_000);
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(revisionWatch);
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
