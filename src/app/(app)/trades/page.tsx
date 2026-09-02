import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTrader } from '@/lib/trader';
import { HeaderSlot, HeaderDivider } from '@/components/shell/header-slot';
import { WithSummaryRail } from '@/components/shell/summary-rail';
import { TradesTape } from '@/components/views/trades/trades-tape';
import { TradesRail } from '@/components/views/trades/trades-rail';
import { TradesControls, TradesSearchPill } from '@/components/views/trades/trades-controls';
import { ImportTradesButton } from '@/components/views/trades/import-trades-button';
import { QuarantineNotice } from '@/components/views/trades/quarantine-notice';
import {
  readTradesFilter,
  rangeWindow,
  isNarrowed,
  isResultFiltered,
  type TradesFilter,
} from '@/lib/trades/filter';
import { getTape, getTapeIds, getDigest, getFacets, getFacetRows, getExcluded } from '@/lib/trades/read';
import { sessionDateFor } from '@/lib/time/session';
import { Suspense } from 'react';
import { TradesRailSkeleton } from '@/components/views/trades/trades-rail-skeleton';

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
/* THE ONE THING THAT WAITS. An async child inside `<Suspense>` is how a Server Component defers a
 * single slow read without deferring the page: everything outside this streams immediately, and
 * this arrives when its query does.
 * It takes `ids` rather than reading them again - the tape already needs that list for its endless
 * scroll, so re-querying here would trade one wait for two. */
async function RailFigures({
  traderId,
  filter,
  window,
  ids,
}: {
  traderId: string;
  filter: TradesFilter;
  window: { from: string | null; to: string | null };
  ids: string[];
}) {
  const digest = await getDigest(traderId, filter, window);
  return (
    <TradesRail
      digest={digest}
      filter={filter}
      resultFiltered={isResultFiltered(filter)}
      ids={ids}
    />
  );
}

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
  /* THE DIGEST IS NOT AWAITED HERE, and that is the point of the Suspense boundary below. It is the
     heaviest read on the page - it aggregates the whole filtered set and groups it by session, where
     the tape only reads the first 60 rows - so awaiting it with everything else made the tape wait
     on a figure that sits beside it rather than inside it. Split out, the record paints as soon as
     it is ready and the summary fills in after. */
  const [sessions, facets, excluded, ids, facetRows] = await Promise.all([
    getTape(trader.id, filter, window, { limit: FIRST_PAGE }),
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
        {/* THE RULE SAYS THIS BAND HAS TWO HALVES: everything to its left narrows what is on the
            page, and the one thing to its right adds to it. Monarch draws the same line in the
            same place on `/transactions` (Luke, 2026-09-02).
            `max-md:hidden` BECAUSE ITS LEFT-HAND SIDE IS. `TradesControls` is `contents
            max-md:hidden` - the phone narrows from `TradesSearchPill` in the page body instead -
            so below `md` the band holds one disc and nothing else, and a separator with nothing on
            one side of it is a stray mark rather than a division. */}
        <HeaderDivider className="max-md:hidden" />
        {/* LAST IN THE BAND, AFTER THE CONTROLS THAT NARROW - the order every header in this app
            uses: the undo, then chrome, then the one thing wearing the accent
            (`accounts-header.tsx`). OUTSIDE `TradesControls` deliberately: that component is
            `contents max-md:hidden` because narrowing on a phone happens in `TradesSearchPill`
            instead, and this control is wanted at BOTH widths. It carries its own breakpoint pair.
            UNSCOPED - see `import-trades-button.tsx` for why that is a property and not a gap. */}
        <ImportTradesButton />
      </HeaderSlot>

      <WithSummaryRail
        rail={
          /* THE FALLBACK IS THE RAIL'S OWN SHAPE, twelve rows in five groups, because that shape is
             known before the numbers are. A skeleton that does not match reflows on arrival, which
             reads worse than the spinner it replaced. */
          <Suspense fallback={<TradesRailSkeleton filter={filter} hasIds={ids.length > 0} />}>
            <RailFigures
              traderId={trader.id}
              filter={filter}
              window={window}
              ids={ids}
            />
          </Suspense>
        }
      >
        <div className="flex flex-col gap-4">
          {/* THE PHONE'S SEARCH ROW, in the page body rather than the header band — a full row of
              its own directly under the title, the way the reference has it. Desktop keeps its
              chips in the band; this is `md:hidden` and that one is `max-md:hidden`, so exactly one
              set of controls is on screen at any width. */}
          <TradesSearchPill
            applied={filter}
            products={facets.products}
            accounts={facets.accounts}
            facetRows={facetRows}
          />
          <QuarantineNotice
            quarantined={excluded.quarantined}
            excluded={excluded.excluded}
          />
          <TradesTape
            accounts={facets.accounts}
            selectedAccounts={filter.accounts}
            sessions={sessions}
            total={ids.length}
            displayTimezone={trader.displayTimezone}
            narrowed={isNarrowed(filter)}
            /* THE DEAD END THIS PAGE SHIPPED WITH: "Import your Tradovate exports and they will
               appear here" was an instruction with nothing to press. The band's control is 200px
               away in chrome the trader has not looked at yet; the empty state IS the page at
               that moment. Only the `!narrowed` branch renders it - see `Empty`. */
            emptyAction={<ImportTradesButton cta />}
            rest={{ ids }}
          />
        </div>
      </WithSummaryRail>
    </>
  );
}
