import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTrader } from '@/lib/trader';
import { HeaderSlot } from '@/components/shell/header-slot';
import { WithSummaryRail } from '@/components/shell/summary-rail';
import { TradesTape } from '@/components/views/trades/trades-tape';
import { TradesRail } from '@/components/views/trades/trades-rail';
import { TradesControls } from '@/components/views/trades/trades-controls';
import { QuarantineNotice } from '@/components/views/trades/quarantine-notice';
import { readTradesFilter, rangeWindow, isNarrowed, isResultFiltered } from '@/lib/trades/filter';
import { getTape, getTapeIds, getDigest, getFacets, getFacetRows, getExcluded } from '@/lib/trades/read';
import { sessionDateFor } from '@/lib/time/session';

export const metadata: Metadata = { title: 'Trades' };

/** The rows sent with the HTML. The client windows 60 at a time and fetches 300 more as it goes,
 *  so this is five windows of runway before the first round trip. */
const FIRST_PAGE = 300;

/* THE RECORD. Every trade, banded by the session it was realised in, with a digest of whatever the
 * filter currently selects.
 *
 * A SERVER COMPONENT THAT READS AND HANDS DOWN. Every narrowing is applied in SQL against the
 * `trade` projection before a row crosses the wire — nothing is filtered in the browser, because a
 * page that ships the whole corpus to hide most of it is the read this build's projection exists to
 * avoid.
 *
 * THE DIGEST AND THE TAPE COUNT ONE SET. The rail is its own aggregate over the same `where` the
 * tape uses, so the page's cap can never quietly become the summary's scope — `spec.md` §S3 (P6),
 * and the defect that produced the rule is recorded on `getDigest`.
 */
export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const trader = await getTrader();
  /* REDIRECT, NOT `notFound()`, and the difference is what the trader sees when this fires.
   *
   * The layout is the gate and it redirects, so reaching here without one is a race rather than a
   * state — but `notFound()` answered that race with "this page does not exist", which is a dead
   * end AND untrue: the page exists, the session did not resolve. Luke hit exactly this (2026-08-17:
   * "i navigate to the /sessions or /trades page and i get a 404. then i navigate back to the login
   * page and sign in again"), and a 404 gave him nothing to act on — the recovery had to be guessed.
   *
   * A redirect to `/login` is the same answer the layout already gives, so the two agree, and it
   * lands somewhere that can actually fix the problem. */
  if (!trader) redirect('/login');

  const filter = readTradesFilter(await searchParams);

  /* "TODAY" IS A MARKET FACT, NOT A CALENDAR ONE. The window is measured from the SESSION date the
     trader is currently sitting in, so at 6pm CT "this month" already means the month containing
     tomorrow's trade date — which is the day their next fill will be filed under. */
  const window = rangeWindow(filter, sessionDateFor(new Date()));

  /* THE FIRST PAGE, PLUS THE MAP TO THE REST. The tape sends a slice of full rows and the ORDERED
     IDS of everything else, so the client can ask for the next batch by id as the trader reaches it.
     Ids rather than an offset: the server never re-derives the filter, so no row can appear twice or
     be skipped because the second derivation differed. A uuid is 36 bytes, so even a two-year corpus
     is well under a megabyte of ids against roughly ten of rows. */
  const [sessions, digest, facets, excluded, ids, facetRows] = await Promise.all([
    getTape(trader.id, filter, window, { limit: FIRST_PAGE }),
    getDigest(trader.id, filter, window),
    getFacets(trader.id),
    getExcluded(trader.id, filter, window),
    getTapeIds(trader.id, filter, window),
    getFacetRows(trader.id),
  ]);

  return (
    <>
      {/* INTO THE SHELL'S OWN BAND, not a second one under it. The shell already prints "Trades"
          from the route, so this page contributes only its controls. */}
      <HeaderSlot>
        <TradesControls
          filter={filter}
          products={facets.products}
          accounts={facets.accounts}
          facetRows={facetRows}
        />
      </HeaderSlot>

      <WithSummaryRail
        rail={
          <TradesRail
            digest={digest}
            filter={filter}
            resultFiltered={isResultFiltered(filter)}
            ids={ids}
          />
        }
      >
        <div className="flex flex-col gap-4">
          <QuarantineNotice
            quarantined={excluded.quarantined}
            excluded={excluded.excluded}
          />
          <TradesTape
            sessions={sessions}
            total={ids.length}
            displayTimezone={trader.displayTimezone}
            narrowed={isNarrowed(filter)}
            rest={{ ids }}
          />
        </div>
      </WithSummaryRail>
    </>
  );
}
