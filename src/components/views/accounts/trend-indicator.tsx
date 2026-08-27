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
  note,
  baseDollars,
}: {
  cents: number;
  /** "3 month change" / "All time" — supplied by the chart so its menus govern this line. */
  periodLabel: string;
  /* The phone's shorter form. BOTH render and CSS picks one, rather than a JS width check: the
     choice has to be right on the first paint and the server has no viewport. Two spans of four
     words is cheaper than a hydration flash. */
  periodShort?: string;
  /* A TRAILING CLAUSE, PHONE ONLY, and only the chart passes one (2026-08-27, Luke: "i do realize
     that we want to say 'Across 2 accounts' and that is important. but maybe we can make it all
     fit"). It fits: the change and the coverage are two short facts and the line already wraps
     rather than truncating, so the worst case is two lines instead of a lost one.
     WHY NOT ON A DESKTOP. The summary rail sits beside the chart there and already prints
     `Accounts 8` off the same set - the same money-said-twice this page keeps deleting. On a phone
     that rail is a full screen below the fold, so the fact has nowhere else to be.
     NOT PASSED BY THE GROUP HEADERS. Their coverage is the rows directly underneath them. */
  note?: string;
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
      /* `text-body-lg` (16px), NOT `text-body` (2026-08-26). Measured on Monarch, the reference for
         this card: its change line is 16px/600 beside a 24px figure on the chart, and 16px again
         beside an 18px title on each group header - the same size in both places, one step under
         the number it qualifies rather than two. At 14px this line was the same size as the row
         METADATA two tiers below it, so the chart's headline had nothing supporting it. */
      className="value-fade text-body-lg flex flex-wrap items-center gap-x-1.5 gap-y-0.5"
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
            {/* ONE SPAN, NOT TWO WITH A SEPARATOR BETWEEN THEM. A `·` in its own element gets the
                row's `gap-x-1.5` on both sides and reads as a third item; inside the string it is
                punctuation, which is what it is. */}
            <span className="sm:hidden">{note ? `${periodShort} · ${note}` : periodShort}</span>
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
