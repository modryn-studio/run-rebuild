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
import { QuarantineNotice } from '@/components/views/trades/quarantine-notice';
import { EMPTY_FILTER } from '@/lib/trades/filter';
import { Note, Row, Section } from '../_components/section';
import {
  DIGEST_FIXTURE,
  DIGEST_FIXTURE_IDS,
  TAPE_FIXTURE,
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
        <TradesTape sessions={TAPE_FIXTURE} total={7} displayTimezone="UTC" narrowed={false} />
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

      <Row label="Empty and excluded" note="two empties, two different sentences">
        <div className="flex flex-col gap-4">
          <TradesTape sessions={[]} total={0} displayTimezone="UTC" narrowed={false} />
          <TradesTape sessions={[]} total={0} displayTimezone="UTC" narrowed />
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
