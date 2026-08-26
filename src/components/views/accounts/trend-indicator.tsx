/* WHAT A WINDOW CHANGED BY, with its direction and its period — ported from `run-trading@v2`.
 *
 * THE BIG FIGURE IS INK; THIS IS THE ONE THAT TAKES COLOUR, and the split is deliberate. A page
 * where every number is already green has spent that signal on a resting state, so the total above
 * stays ink and this carries the direction. v2's own carve-out: "the big number is a STATE and stays
 * ink; this is a DELTA, one small line per card, and a delta with no direction is not a delta."
 *
 * A FLAT WINDOW GETS NO ARROW AND NO COLOUR. Zero has no direction, and drawing one — even a
 * neutral one — is the interface insisting something happened.
 *
 * NO EXPLICIT `+`. The arrow already carries the direction, and a plus beside an up arrow beside a
 * green figure is the same fact said three times.
 *
 * THE PERCENTAGE IS ABSENT RATHER THAN DEFAULTED whenever any account in scope has no stated size.
 * Dividing by a guess would print a confident wrong number on the one page whose job is being
 * straight about what Run does and does not know — and it would drift toward looking right as more
 * accounts got labelled, which is worse than being obviously missing.
 */

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { fmtMoney } from '@/lib/format';

export function TrendIndicator({
  cents,
  periodLabel,
  periodShort,
  baseDollars,
}: {
  cents: number;
  /** "3 month change" / "All time" — supplied by the chart so its menus govern this line. */
  periodLabel: string;
  /* The phone's shorter form. BOTH render and CSS picks one, rather than a JS width check: the
     choice has to be right on the first paint and the server has no viewport. Two spans of four
     words is cheaper than a hydration flash. */
  periodShort?: string;
  /** Total stated size behind the figure, or null when any account in scope has none. */
  baseDollars: number | null;
}) {
  const flat = cents === 0;
  const up = cents > 0;
  const pct = baseDollars && baseDollars > 0 ? (cents / 100 / baseDollars) * 100 : null;

  return (
    /* `key` REMOUNTS THIS ON EVERY CHANGE, which is what makes `.value-fade` fire. Both chart menus
       govern this line, so picking a new period replaced the figure in a single frame while the
       chart beside it redrew over its own curve — two halves of one change moving at different
       speeds. A transition cannot help: the text itself is different, so there is no painted FROM
       value to travel from. Keyed on the CONTENT rather than the period, because a period change
       that happens to produce the same figure is not a change. */
    <div
      key={`${cents}:${periodLabel}`}
      className="value-fade text-body flex flex-wrap items-center gap-x-1.5 gap-y-0.5"
    >
      <span
        className={cn(
          'flex items-center gap-0.5 font-semibold tabular-nums',
          flat ? 'text-muted' : up ? 'text-pos' : 'text-neg'
        )}
      >
        {/* Drawn pointing up-right; a quarter turn clockwise lands it down-right. */}
        {!flat && <Icon name="trend" size={16} className={cn('shrink-0', !up && 'rotate-90')} />}
        {fmtMoney(Math.abs(cents))}
        {pct !== null && <span className="ml-0.5">({pct.toFixed(1)}%)</span>}
      </span>
      <span className="text-muted font-medium">
        {periodShort ? (
          <>
            <span className="sm:hidden">{periodShort}</span>
            <span className="hidden sm:inline">{periodLabel}</span>
          </>
        ) : (
          periodLabel
        )}
      </span>
    </div>
  );
}

/* THE DENOMINATOR, OR NULL — and null the moment ONE account in the set is unsized, rather than
 * quietly summing the ones that are. A percentage against a partial base is a WRONG number, not a
 * partial one. */
export function sizeBase(accounts: { sizeDollars: number | null }[]): number | null {
  if (accounts.length === 0) return null;
  let sum = 0;
  for (const a of accounts) {
    if (a.sizeDollars === null) return null;
    sum += a.sizeDollars;
  }
  return sum > 0 ? sum : null;
}
