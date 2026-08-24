/* The tape as a CSV, for exactly the trades the filter selected. Ported from `run-trading@v2`'s
 * `api/trades/export` (2026-08-19, S5c), with two departures noted below.
 *
 * IDS, THE SAME WAY THE LOAD-MORE ROUTE TAKES THEM, and for a stronger reason here. The page has
 * already decided what the filter selects — accounts, products, result, the date window — applied in
 * one place. A route that re-derived that from query parameters would be a second implementation of
 * the filter, and the day the two drift is the day a trader's export quietly disagrees with the
 * screen they exported it from. So the client sends the ids the page computed, and this route's only
 * job is to turn rows into text.
 *
 * NO CAP, unlike `api/trades/page` which stops at 300. Every other read here is paged because a
 * screen only draws so much; a file is not a screen, and a partial export is worse than none — an
 * accountant reconciling 300 of 2,277 trades finds the discrepancy after the work, not before.
 *
 * THE TRADER'S OWN CLOCK, because the tape is in it. A CSV whose timestamps disagreed with the
 * screen it came from would be the same file arguing with itself. `display_timezone` is display
 * only, and a CSV is display — this is exactly what that column is for, and it never reaches the
 * bucketing that produced `session_date`.
 *
 * TWO DEPARTURES FROM v2:
 *   NO NOTE COLUMN. Notes are NOT IN V1 (issue #10), so there is no free-text column here at all.
 *     The formula-injection guard in `lib/csv/export.ts` still earns its place: the account display
 *     name and the product name are both strings somebody else supplied.
 *   A STATE COLUMN INSTEAD. v2 had no quarantine model. Here an excluded or quarantined trade stays
 *     visible and countable (doctrine), so the file must say which rows those are rather than
 *     silently shipping them as ordinary trades or silently dropping them — either would make the
 *     export disagree with the tape it came from.
 */

import { getTrader } from '@/lib/trader';
import { createRouteLogger } from '@/lib/route-logger';
import { getTradesByIds } from '@/lib/trades/read';
import { productName } from '@/lib/instruments';
import { BOM, csvMoney, toCsv } from '@/lib/csv/export';

const log = createRouteLogger('api/trades/export');

/* Read in batches, because `getTradesByIds` builds one `in (...)` list and Postgres binds one
   parameter per id. The house rule is 1,000 rows a statement; the order is preserved by the
   caller's slicing and by that function's own re-ordering. */
const CHUNK = 1000;

/* THE SHAPE IS CHECKED HERE, NOT BY POSTGRES. `trade.id` is a uuid column, so a non-uuid string
   reaches the driver and comes back as `invalid input syntax for type uuid` — which this route's
   catch then reports as a 500 "Could not build the export". That is a client error wearing a server
   error's status: the caller sent bad input and gets told the server broke. Verified live, 2026-08-19
   (`{"ids":["x"]}` returned 500 before this guard). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One formatter per column, built once rather than per row — `Intl.DateTimeFormat` is expensive to
 *  construct and a 20,000-row export would otherwise build 40,000 of them. */
function formatters(zone: string) {
  return {
    date: new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }),
    time: new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  };
}

export async function POST(req: Request): Promise<Response> {
  const ctx = log.begin();
  try {
    const trader = await getTrader();
    if (!trader) return log.end(ctx, Response.json({ error: 'Not signed in' }, { status: 401 }));

    const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;

    /* A MALFORMED BODY IS A 400, NOT AN EMPTY FILE. `{"ids":"notanarray"}` and `{}` both used to
       fall through to `[]` in v2 and return 200 with a header-only CSV — bytes that look like a
       successful export of nothing, which the client cannot tell from "you filtered everything
       out". */
    if (!Array.isArray(body?.ids)) {
      return log.end(
        ctx,
        Response.json({ error: 'ids must be an array of trade ids' }, { status: 400 })
      );
    }
    const ids = body.ids.filter((v): v is string => typeof v === 'string' && UUID.test(v));
    if (ids.length === 0) {
      return log.end(ctx, Response.json({ error: 'no valid trade ids' }, { status: 400 }));
    }

    const trades = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      trades.push(...(await getTradesByIds(trader.id, ids.slice(i, i + CHUNK))));
    }

    const fmt = formatters(trader.displayTimezone);

    /* GROSS, FEES AND NET AS THREE COLUMNS rather than one. A prop account passes or fails on net,
       and a trader checking this against their firm's dashboard needs to see which of the two
       numbers they are looking at — the same reason the rail's total says "Gross P&L" rather than
       quietly showing gross under a net label. */
    const rows: (string | number | null)[][] = [
      [
        'Date',
        'Time',
        'Account',
        'Product',
        'Contract',
        'Direction',
        'Quantity',
        'Entry',
        'Exit',
        'Gross',
        'Fees',
        'Net',
        'State',
      ],
      ...trades.map((t) => [
        fmt.date.format(t.exitAt),
        fmt.time.format(t.exitAt),
        t.accountName,
        productName(t.symbolRoot) ?? t.symbolRoot,
        t.contract ?? '',
        t.direction ?? '',
        t.qty,
        t.entryPrice,
        t.exitPrice,
        csvMoney(t.grossCents),
        csvMoney(t.feeCents),
        csvMoney(t.netCents),
        // The reason when there is one, so an excluded row explains itself in the file.
        t.state === 'ok' ? '' : (t.quarantineReason ?? t.exclusionReason ?? t.state),
      ]),
    ];

    return log.end(
      ctx,
      new Response(BOM + toCsv(rows), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'cache-control': 'no-store',
        },
      }),
      { rows: trades.length }
    );
  } catch (error) {
    log.err(ctx, error);
    return Response.json({ error: 'Could not build the export' }, { status: 500 });
  }
}
