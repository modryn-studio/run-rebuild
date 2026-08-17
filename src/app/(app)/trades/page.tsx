import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTrader } from '@/lib/trader';
import { HeaderSlot } from '@/components/shell/header-slot';
import { WithSummaryRail } from '@/components/shell/summary-rail';
import { TradesTape } from '@/components/views/trades/trades-tape';
import { TradesRail } from '@/components/views/trades/trades-rail';
import { TradesControls } from '@/components/views/trades/trades-controls';
import { QuarantineNotice } from '@/components/views/trades/quarantine-notice';
import { readTradesFilter, rangeWindow, isNarrowed, isResultFiltered } from '@/lib/trades/filter';
import { getTape, getDigest, getFacets, getExcluded } from '@/lib/trades/read';
import { sessionDateFor } from '@/lib/time/session';

export const metadata: Metadata = { title: 'Trades' };

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
  // The (app) layout is the auth gate, so no trader here is a sign-out race rather than a state.
  if (!trader) notFound();

  const filter = readTradesFilter(await searchParams);

  /* "TODAY" IS A MARKET FACT, NOT A CALENDAR ONE. The window is measured from the SESSION date the
     trader is currently sitting in, so at 6pm CT "this month" already means the month containing
     tomorrow's trade date — which is the day their next fill will be filed under. */
  const window = rangeWindow(filter, sessionDateFor(new Date()));

  const [sessions, digest, facets, excluded] = await Promise.all([
    getTape(trader.id, filter, window),
    getDigest(trader.id, filter, window),
    getFacets(trader.id),
    getExcluded(trader.id, filter, window),
  ]);

  return (
    <>
      {/* INTO THE SHELL'S OWN BAND, not a second one under it. The shell already prints "Trades"
          from the route, so this page contributes only its controls. */}
      <HeaderSlot>
        <TradesControls filter={filter} products={facets.products} accounts={facets.accounts} />
      </HeaderSlot>

      <WithSummaryRail
        rail={
          <TradesRail digest={digest} filter={filter} resultFiltered={isResultFiltered(filter)} />
        }
      >
        <div className="flex flex-col gap-4">
          <QuarantineNotice
            quarantined={excluded.quarantined}
            excluded={excluded.excluded}
          />
          <TradesTape
            sessions={sessions}
            total={digest.trades + excluded.quarantined + excluded.excluded}
            displayTimezone={trader.displayTimezone}
            narrowed={isNarrowed(filter)}
          />
          {/* PROVENANCE, on the page that presents computed figures (`spec.md` §S3, P8). It names
              the source and the range the numbers actually cover rather than claiming freshness the
              corpus cannot support. */}
          {digest.trades > 0 && (
            <p className="text-caption text-muted px-1">
              From your Tradovate export, covering {digest.firstDay} to {digest.lastDay}.
            </p>
          )}
        </div>
      </WithSummaryRail>
    </>
  );
}
