import { getTrader } from '@/lib/trader';
import { createRouteLogger } from '@/lib/route-logger';
import { getTradesByIds } from '@/lib/trades/read';

const log = createRouteLogger('api/trades/page');

/* THE NEXT BATCH OF TAPE ROWS, BY ID. Ported from `run-trading@v2` (2026-08-17, S5c).
 *
 * WHY THIS EXISTS. `/trades` pages its tape server-side: the page builds an ordered INDEX of every
 * trade the filter selects (ids only) and full rows for the first few hundred. That is what keeps a
 * two-year corpus off the wire on first paint, and it leaves one honest gap — reaching the bottom of
 * the loaded rows has nothing behind it. This is what is behind it.
 *
 * IDS, NOT AN OFFSET, and that is the important choice. The client already holds the ordered id list
 * from the index, so it asks for exactly the rows it wants rather than for "the next 300 of whatever
 * the server thinks the order is". No cursor to keep in step, and no chance of a row appearing twice
 * or being skipped because the filter was re-derived slightly differently on the second call.
 *
 * THE IDS ARE NOT TRUSTED. Every read is scoped to the signed-in trader, so a hand-crafted body can
 * only ever ask for rows that trader already owns — a wrong id returns nothing rather than somebody
 * else's tape. The batch is capped so one request cannot ask for the whole corpus.
 *
 * NO FEE RECOMPUTATION HERE, which is the one place this is simpler than v2's. Its route had to
 * re-derive per-contract rates on every trip and argue that a rate is a group and therefore stable;
 * `fee_cents` is a column on `trade` in this build, settled once by the projector, so a row fetched
 * on page five carries the same net it would have carried on page one by construction.
 */

/** One batch. Matches the client's own, so scrolling reaches for the same amount every time. */
const MAX_IDS = 300;

export async function POST(req: Request): Promise<Response> {
  const ctx = log.begin();
  try {
    const trader = await getTrader();
    if (!trader) return log.end(ctx, Response.json({ error: 'Not signed in' }, { status: 401 }));

    const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((v): v is string => typeof v === 'string').slice(0, MAX_IDS)
      : [];
    if (ids.length === 0) return log.end(ctx, Response.json({ trades: [] }));

    // Scoped by trader FROM THE SESSION, never from the request.
    const trades = await getTradesByIds(trader.id, ids);
    return log.end(ctx, Response.json({ trades }));
  } catch (error) {
    log.err(ctx, error);
    return Response.json({ error: 'Could not load trades' }, { status: 500 });
  }
}
