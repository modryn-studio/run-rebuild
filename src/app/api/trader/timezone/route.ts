import { createRouteLogger } from '@/lib/route-logger';
import { getTrader, setDisplayTimezone } from '@/lib/trader';
import { z } from 'zod';

const log = createRouteLogger('trader-timezone');

// `detected` is the browser reporting `Intl.DateTimeFormat().resolvedOptions().timeZone`, and it
// LOSES to a stored choice. `chosen` is a human picking one, and it wins permanently. The client
// does not get to say which trader it is talking about — that comes from the session — so the
// only thing this body carries is the zone and which kind of claim it is.
const bodySchema = z.object({
  zone: z.string().min(1).max(64),
  source: z.enum(['detected', 'chosen']),
});

export async function POST(req: Request): Promise<Response> {
  const ctx = log.begin();
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return log.end(ctx, Response.json({ error: 'Invalid request' }, { status: 400 }));
    }

    // Identity from the session cookie, never from the body. There is no trader id in the
    // request shape above, and that absence is the point.
    const trader = await getTrader();
    if (!trader) {
      return log.end(ctx, Response.json({ error: 'Not signed in' }, { status: 401 }));
    }

    const { zone, source } = parsed.data;
    const result = await setDisplayTimezone(trader.id, zone, source === 'chosen');

    // An unresolvable zone is a 400 rather than a silent no-op: a client sending one is broken,
    // and swallowing it would leave the trader looking at the wrong clock with nothing to see.
    if (result === 'unknown-zone') {
      log.warn(ctx.reqId, 'unknown timezone rejected', { zone });
      return log.end(ctx, Response.json({ error: 'Unknown time zone' }, { status: 400 }));
    }

    return log.end(ctx, Response.json({ status: result }));
  } catch (err) {
    log.err(ctx, err);
    return log.end(ctx, Response.json({ error: 'Something went wrong' }, { status: 500 }));
  }
}
