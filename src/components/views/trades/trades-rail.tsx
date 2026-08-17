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
import { RANGE_LABEL, type TradesFilter } from '@/lib/trades/filter';
import type { TradesDigest } from '@/lib/trades/read';

export function TradesRail({
  digest,
  filter,
  resultFiltered,
}: {
  digest: TradesDigest;
  filter: TradesFilter;
  /** What the four blank rows below are explained by. */
  resultFiltered: boolean;
}) {
  /* WHAT THE NUMBERS COVER, said once and quietly, and ONLY when there is something to say.
     "Worst session -$5,120" reads as the worst ever when it is the worst in ninety days, and a money
     surface that overstates its own scope is worse than one that is narrow. All time makes no claim
     to qualify, so it prints no caption. */
  const scope = filter.from || filter.to ? customLabel(filter) : filter.range !== 'all' ? RANGE_LABEL[filter.range] : null;

  return (
    <Card className="overflow-hidden">
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

        <Line label="Best session">
          <Money cents={digest.bestSessionCents} withheld={resultFiltered} />
        </Line>
        <Line label="Worst session">
          <Money cents={digest.worstSessionCents} withheld={resultFiltered} />
        </Line>

        <Group />

        <Line label="Largest win">
          <Money cents={digest.largestWinCents} />
        </Line>
        <Line label="Largest loss">
          <Money cents={digest.largestLossCents} />
        </Line>

        <Group />

        {/* THE LABEL CHANGES WITH THE TRUTH. `spec.md` §S3: a surface showing a net figure must say
            whether fees were imported for that range, because the alternative is a gross number
            wearing a net label — and on the reference export the fees exceeded the gross loss. */}
        <Line label={digest.hasFees ? 'Net P&L' : 'Gross P&L'}>
          <Money cents={digest.netCents} strong />
        </Line>
        <Line label="Fees">
          <Money cents={digest.feesCents} />
        </Line>
        {/* Plural even at one: the question is "how many is this pooling", and "1 account" answers
            it rather than reading as an awkward singular. */}
        <Line label="Accounts">
          <Count n={digest.accounts} />
        </Line>
      </dl>

      {!digest.hasFees && digest.trades > 0 && (
        <p className="border-rule text-caption text-muted border-t px-5 py-3">
          No Cash History covers these trades, so every figure here is before costs.
        </p>
      )}
    </Card>
  );
}

function customLabel(f: TradesFilter): string {
  if (f.from && f.to) return `${f.from} to ${f.to}`;
  return f.from ? `Since ${f.from}` : `Up to ${f.to}`;
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
      <dt className="text-body text-muted shrink-0">{label}</dt>
      <dd className="text-body min-w-0 text-right">{children}</dd>
    </div>
  );
}
