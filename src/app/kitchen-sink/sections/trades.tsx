/* THE TAPE, ITS RAIL, AND THE TWO WAYS THEY CAN BE EMPTY. Re-homed from the original rack
 * (2026-08-20) with the fixtures and their reasoning intact rather than rewritten.
 *
 * A SERVER COMPONENT. Every piece here only reads and formats; `TradesTape` brings its own client
 * boundary for the drawer and the endless scroll.
 *
 * THE FIXTURES MOVED OUT (2026-08-20) to `../_fixtures/trades`, when the drawer got a section of
 * its own and needed the same rows. Two sections hand-writing one shape is how the tape and the
 * drawer end up disagreeing about what a trade is. The no-fixture-looks-real rule travels with
 * them and is stated there.
 */

import { TradesTape } from '@/components/views/trades/trades-tape';
import { TradesRail } from '@/components/views/trades/trades-rail';
import { TradesRailSkeleton } from '@/components/views/trades/trades-rail-skeleton';
import { QuarantineNotice } from '@/components/views/trades/quarantine-notice';
import { EMPTY_FILTER } from '@/lib/trades/filter';
import { Note, Row, Section } from '../_components/section';
import { RecentTrades } from '@/components/views/accounts/recent-trades';
import {
  DIGEST_FIXTURE,
  DIGEST_FIXTURE_IDS,
  TAPE_FIXTURE,
  ACCOUNTS_FIXTURE,
} from '../_fixtures/trades';

export function TradesSection() {
  return (
    <Section
      id="trades"
      title="Trades"
      intro="The product's own surfaces, built from the shipped components with a scripted set. This is where the design system stops being tokens and starts being a screen, and it is the one section that would survive being wrong the longest without it."
    >
      <Row
        label="The tape"
        note="sessions descend, rows descend by ENTRY inside one"
      >
        <TradesTape
          sessions={TAPE_FIXTURE}
          total={7}
          displayTimezone="UTC"
          narrowed={false}
          accounts={ACCOUNTS_FIXTURE}
          selectedAccounts={[]}
        />
        <Note>
          Rows order by the ENTRY rather than the exit: a position scaled out in three pieces closes
          on a single stamp, so ordering by the exit prints one time on three rows and the sequence
          reads as random. The band&apos;s subtotal is MUTED on purpose, because it labels rows
          already on screen and in full ink it competes with the results it only summarises. Click
          any row to open the drawer.
        </Note>
        <Note>
          The third row is quarantined: marked, muted rather than coloured, still listed, and absent
          from its own band&apos;s figures. That is the whole of &ldquo;an exclusion may never
          silently shrink the record&rdquo; in one row: 3 trades in the band, 4 rows under it.
        </Note>
      </Row>

      <Row
        label="The summary rail, waiting"
        note="unfiltered and filtered: the caption and the footer are not waiting on anything"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TradesRailSkeleton filter={EMPTY_FILTER} hasIds />
          {/* A narrowed tape, so the caption renders for real, and a filter that selected nothing,
              so the footer is absent exactly as `DownloadCsv` would be. */}
          <TradesRailSkeleton filter={{ ...EMPTY_FILTER, range: 'last30' }} hasIds={false} />
        </div>
        <Note>
          A skeleton rather than a spinner, because nothing about this panel&rsquo;s shape depends on
          the data: twelve rows in five groups, always. It mirrors the real rail row for row on
          purpose, since a skeleton whose shape does not match reflows the moment the content lands,
          which reads worse than the spinner it replaced. The bar widths are deliberately ragged: a
          column of identical bars reads as a placeholder graphic, an uneven one reads as text that
          has not arrived. It also holds itself invisible for 300ms, so a fast load never flashes it.
          The caption beside &ldquo;Summary&rdquo; and the Download CSV footer are rendered rather
          than skeletonised: both depend on the filter and the id list, which the page has before the
          digest resolves. Drawing bars for them meant one vanished and the other jumped to centre
          when the figures landed: the reflow this component promises not to cause.
        </Note>
      </Row>

      <Row
        label="The summary rail"
        note="the same digest twice: unfiltered, then under a wins-only filter"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TradesRail
            digest={DIGEST_FIXTURE}
            filter={EMPTY_FILTER}
            resultFiltered={false}
            ids={DIGEST_FIXTURE_IDS}
          />
          <TradesRail
            digest={{
              ...DIGEST_FIXTURE,
              winRatePct: null,
              avgSessionCents: null,
              bestSessionCents: null,
              worstSessionCents: null,
            }}
            filter={{ ...EMPTY_FILTER, results: ['win'] }}
            resultFiltered
            ids={DIGEST_FIXTURE_IDS}
          />
        </div>
        <Note>
          It recomputes against the active filter, which is what earns a summary column at all. FOUR
          FIGURES GO BLANK on the right and say why, rather than printing a dash: a win rate of 100%
          is not a statistic, it is the filter read back, and a &ldquo;worst session&rdquo; with the
          losses removed is the one that actually misleads. A dash would claim there is no data,
          when the data is on the tape beside it.
        </Note>
        <Note>
          Download CSV sits at the FOOT of the card, below the ledger, because it is what you do with
          these numbers rather than one of them. It renders only when the selection is non-empty: an
          empty file is a worse answer than no offer, since the trader has to open it to find out.
        </Note>
      </Row>

      {/* THE PHONE'S TABLE ON AN ACCOUNT PAGE, racked here beside the tape it borrows its row from -
          which is the point of putting it here rather than in a section of its own. The two are one
          object with two headers and two lengths, and a rack row is where that either holds or
          visibly does not. */}
      <Row label="Recent Trades" note="four rows, the tape's own row, Monarch's inset CTA">
        <RecentTrades
          trades={TAPE_FIXTURE.flatMap((d) => d.trades)}
          zone="America/Chicago"
          allHref="#"
        />
        <Note>
          The header row is `min-h-13` and takes the row&apos;s own gutter, so it reads as the
          table&apos;s caption rather than as the tape&apos;s toolbar, which is `min-h-15` and
          carries three controls. The CTA is a full-width `lg` button inside the card&apos;s padding:
          the same object the modal footers use, not a size invented for one table.
        </Note>
      </Row>

      <Row label="Recent Trades, day one" note="the empty case says so rather than drawing a button">
        <RecentTrades trades={[]} zone="America/Chicago" allHref="#" />
        <Note>
          No narrowed variant. These four rows are never filtered. The Filters control lives on the
          screen the button leads to, which is the screen with a list worth narrowing.
        </Note>
      </Row>

      <Row label="Empty and excluded" note="two empties, two different sentences">
        <div className="flex flex-col gap-4">
          <TradesTape sessions={[]} total={0} displayTimezone="UTC" narrowed={false} accounts={[]} selectedAccounts={[]} />
          <TradesTape sessions={[]} total={0} displayTimezone="UTC" narrowed accounts={[]} selectedAccounts={[]} />
          <QuarantineNotice quarantined={3} excluded={0} />
          <QuarantineNotice quarantined={0} excluded={7} />
        </div>
        <Note>
          The two empties are different sentences on purpose: telling a trader with two years of tape
          that they have never traded is the version that costs trust. The notice states what is on
          the tape and out of every figure. `QuarantineNotice` with both counts at zero renders
          NOTHING, which is why there is no third card here - a permanent &ldquo;0 quarantined&rdquo;
          row is a status light for a condition that has never occurred.
        </Note>
      </Row>
    </Section>
  );
}
