/* THE SUMMARY RAIL: what the tape currently in scope actually says.
 *
 * IT RECOMPUTES AGAINST THE ACTIVE FILTERS, which is the mechanic that earns a summary column at
 * all (`spec.md` §S3, P6). Filter to one account and every number here is about that account. A
 * summary of everything beside a filtered tape would just be a second dashboard.
 *
 * IT COUNTS SESSIONS, which is what this page's rail can say and no other rail can. The trader's
 * subject here is their DAYS, and "worst session" is the figure a prop trader actually needs
 * because a day is the unit their loss limit is measured in.
 *
 * FOUR FIGURES GO BLANK UNDER A RESULT FILTER and say why, rather than printing a dash. A dash means
 * "no data" and there is plenty of data — it is on the tape beside this. See `getDigest`, which
 * decides which four and carries the defect that produced the rule.
 *
 * A Server Component: it only reads and formats.
 */

import { Card } from '@/components/ui/card';
import { fmtMoney } from '@/lib/format';
import { displayDayShort, displayInstantDay } from '@/lib/time/session';
import { RANGE_LABEL, type TradesFilter } from '@/lib/trades/filter';
import type { TradesDigest } from '@/lib/trades/read';
import { DownloadCsv } from '@/components/views/trades/download-csv';

export function TradesRail({
  digest,
  filter,
  zone,
  resultFiltered,
  ids,
}: {
  digest: TradesDigest;
  filter: TradesFilter;
  /* DISPLAY ONLY, and only for the import timestamp. A session date is already bucketed and stays
     in UTC; an import is a real instant and belongs to the trader's own clock. CLAUDE.md: display
     timezone must never reach the bucketing code, and it does not - it reaches one formatter. */
  zone: string;
  /** What the blank rows below are explained by. */
  resultFiltered: boolean;
  /** The ordered ids of the whole filtered selection, for the export. Not the page's slice: a file
   *  built from what loaded would silently be "the part you scrolled to". */
  ids: string[];
}) {
  /* WHAT THE NUMBERS COVER, said once and quietly, and ONLY when there is something to say.
     "Worst session -$5,120" reads as the worst ever when it is the worst in ninety days, and a money
     surface that overstates its own scope is worse than one that is narrow. All time makes no claim
     to qualify, so it prints no caption. */
  const scope = filter.from || filter.to ? customLabel(filter) : filter.range !== 'all' ? RANGE_LABEL[filter.range] : null;

  return (
    /* A FULL-HEIGHT PANEL ON A PHONE, a card above `md` (`S5d`, 2026-08-20). Same reasoning as the
       tape's full-bleed treatment: below `md` this is not an object sitting on a page, it is a
       drawer that IS the screen for as long as it is open, so the radius and the shadow come off and
       the ground runs to every edge. `h-full` is what makes it fill the drawer rather than hanging
       from the top of it with the tape visible underneath. */
    <Card className="overflow-hidden max-md:h-full max-md:rounded-none max-md:shadow-none">
      <div className="flex items-baseline justify-between gap-3 px-5 py-4">
        <h2 className="text-title text-text font-medium">Summary</h2>
        {scope && <span className="text-body text-muted">{scope}</span>}
      </div>

      <dl className="border-rule border-t pb-2">
        <Line label="Sessions">
          <Count n={digest.sessions} />
        </Line>
        <Line label="Trades">
          <Count n={digest.trades} />
        </Line>
        <Line label="Win rate">
          {digest.winRatePct === null ? (
            <span className="text-muted">
              {resultFiltered ? 'Filtered by result' : 'Nothing decided yet'}
            </span>
          ) : (
            <span className="text-text tabular-nums">
              {digest.winRatePct}%{' '}
              <span className="text-muted">
                ({digest.wins.toLocaleString('en-US')}/
                {(digest.wins + digest.losses).toLocaleString('en-US')})
              </span>
            </span>
          )}
        </Line>

        <Group />

        {/* ALL THREE SESSION FIGURES SAY WHY THEY ARE BLANK rather than showing `Money`'s dash. A
            dash means "no data" and there is plenty of data — it is on the tape beside this. These
            are the rows that would mislead hardest: "Worst -$51.20" under a wins filter reads as
            the worst day this trader has ever had. */}
        <Line label="Average session">
          <Money cents={digest.avgSessionCents} withheld={resultFiltered} />
        </Line>
        <Line label="Best session">
          <Money cents={digest.bestSessionCents} withheld={resultFiltered} />
        </Line>
        <Line label="Worst session">
          <Money cents={digest.worstSessionCents} withheld={resultFiltered} />
        </Line>

        <Group />

        <Line label="Average win">
          <Money cents={digest.avgWinCents} />
        </Line>
        <Line label="Average loss">
          <Money cents={digest.avgLossCents} />
        </Line>

        <Group />

        {/* THE LABEL CHANGES WITH THE TRUTH. `spec.md` §S3: a surface showing a net figure must say
            whether fees were imported for that range, because the alternative is a gross number
            wearing a net label — and on the reference export the fees exceeded the gross loss. */}
        {/* NO SEPARATE FEES ROW, matching v2 (2026-08-19). Fees are carried by this LABEL, not by a
            line of their own: the label is already the load-bearing statement (`Net` means costs
            are in the figure, `Gross` means they are not), so a Fees row underneath restates what
            the word above it just said.
            AND NO FOOTNOTE EITHER (2026-08-25). A sentence used to sit under this ledger reading
            "No Cash History covers these trades, so every figure here is before costs" - the same
            fact a third time, in prose, in a card made of rows, using a filename the trader has to
            already know. `Gross P&L` says it, and it says it in the place the number is. */}
        <Line label={digest.hasFees ? 'Net P&L' : 'Gross P&L'}>
          <Money cents={digest.netCents} strong />
        </Line>
        {/* Plural even at one: the question is "how many is this pooling", and "1 account" answers
            it rather than reading as an awkward singular. */}
        <Line label="Accounts">
          <Count n={digest.accounts} />
        </Line>

        <Group />

        {/* WHERE THESE FIGURES CAME FROM, AS ROWS (P8, 2026-08-25). `spec.md` §S3 asks every surface
            presenting computed figures to state the provenance of them, and this card presented
            none: nothing here said what range the data covers or how current it is.
            ROWS, NOT PROSE (Luke: "prose is acceptable where needed. it is not needed in a data
            readout card"). This card is a ledger of label/value pairs; a sentence at the foot of it
            was the one thing in it that was not. The reference does the same thing the same way -
            its summary panel carries `First transaction` and `Last transaction` as plain rows.
            FIRST AND LAST TRADE DESCRIBE THE FILTERED SET, so they move with the filter and answer
            "what am I actually looking at". `Last import` describes the RECORD and does not, which
            is the pairing that makes a gap visible: data through June under a filter asking for
            August is a fact the trader can see rather than one they have to infer. */}
        <Line label="First trade">
          <Day iso={digest.firstDay} />
        </Line>
        <Line label="Last trade">
          <Day iso={digest.lastDay} />
        </Line>
        {/* THE ONLY ROW HERE THAT IS NOT ABOUT THE TRADES. It is the answer to "how current is
            this", which is the half of P8 the accounts page cannot give a filtered tape. */}
        <Line label="Last import">
          {digest.lastImportAt ? (
            <span className="text-text tabular-nums">
              {displayInstantDay(digest.lastImportAt, zone)}
            </span>
          ) : (
            <span className="text-muted">Never</span>
          )}
        </Line>
      </dl>

      {/* Deliberately BELOW the ledger, at the foot of the card: it is what you do with these
          numbers, not one of them. */}
      <DownloadCsv name="trades" ids={ids} />
    </Card>
  );
}

function customLabel(f: TradesFilter): string {
  if (f.from && f.to) return `${f.from} to ${f.to}`;
  return f.from ? `Since ${f.from}` : `Up to ${f.to}`;
}

/* A SESSION DATE, SHORT, or an em-less dash when the filter matched nothing. `-` rather than
   "None": the row is a fact about a set, and an empty set has no first day rather than a day called
   None. Same mark the blanked figures above use. */
function Day({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-muted">-</span>;
  return <span className="text-text tabular-nums">{displayDayShort(iso)}</span>;
}

function Count({ n }: { n: number }) {
  return <span className="text-text tabular-nums">{n.toLocaleString('en-US')}</span>;
}

/* Signed and coloured, or a dash when there is nothing to say. A ZERO WOULD BE A LIE here:
 * "largest loss $0.00" reads as a trader who never loses rather than one who has not lost yet. */
function Money({
  cents,
  strong,
  withheld,
}: {
  cents: number | null;
  strong?: boolean;
  /** Null because a filter makes the figure untrue, not because there is nothing to report. */
  withheld?: boolean;
}) {
  if (cents === null) {
    return <span className="text-muted">{withheld ? 'Filtered by result' : '-'}</span>;
  }
  return (
    <span
      className={`tabular-nums ${strong ? 'font-medium' : ''}`}
      style={{ color: cents >= 0 ? 'var(--color-pos)' : 'var(--color-neg)' }}
    >
      {cents > 0 ? '+' : ''}
      {fmtMoney(cents)}
    </span>
  );
}

// The rule means NEXT GROUP, not next row.
function Group() {
  return <div className="border-rule my-2 border-t" />;
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-1.5">
      {/* LABEL 14 MUTED, VALUE 16 INK, which is the reference's summary panel exactly: its
          "Total transactions" / "Largest expense" labels measure 14px/400 muted and their values
          16px/400 full ink. Both were 14 here, so the panel's figures read at the same size as the
          words describing them. 16 also makes "a figure is 16px" true across the whole page now
          that the tape's row is flat - the rail and the tape stop disagreeing about how big a
          number is. */}
      <dt className="text-body text-muted shrink-0">{label}</dt>
      <dd className="text-body-lg min-w-0 text-right">{children}</dd>
    </div>
  );
}
