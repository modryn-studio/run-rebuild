'use client';

/* PHONE ONLY: which slice of the roster the whole screen is about.
 *
 * "All", then one chip per group that actually has accounts. Picking one REPLOTS THE CHART AND
 * FILTERS THE ROSTER — the two move together, which is the thing worth copying (Luke, 2026-07-30,
 * against `run-trading@v2`: "the chart switches to display the info depending on which tab is
 * selected"). Anything less and this would be a roster filter sitting under a chart that disagrees
 * with it, which is the exact defect v2 shipped and this build's `chart-view.tsx` was written to
 * prevent.
 *
 * WHY IT IS NOT ON DESKTOP. There the roster shows every group at once beside the summary rail, so
 * a filter would be hiding cards that already fit. On a phone the groups are a vertical scroll and
 * the chart is a full screen away from the card you care about — the chips are how you get one
 * answer without scrolling for it. The invariant that scope cannot survive the control that sets it
 * is enforced in `accounts-view.tsx`, not assumed here.
 *
 * "ALL", NOT "TOTAL P&L" (2026-08-27, Luke: "Run would use Total P&L or P&L or All"). Every other
 * chip in this row names a GROUP OF ACCOUNTS, so the first one has to as well — "Total P&L" beside
 * "Evaluation" is two different kinds of noun in one row, and it would also be the only chip that
 * names a MEASURE while the thing being switched is a SET. The figure directly beneath already says
 * which money it is, and on a phone the page title says the rest.
 *
 * THE UNLABELLED GROUP GETS A CHIP TOO, and that is a correctness call rather than a completeness
 * one. If it were left out, the chips would not add up: the sum of the named groups would be less
 * than "All" with nothing on screen explaining the gap, and a trader whose accounts are ALL still
 * unlabelled would find no chip that shows them. A scope row whose parts do not cover the whole is
 * a quiet lie about how many accounts you have, which is the one thing this product cannot afford.
 * It is called `Unlabelled` — see `UNLABELLED_TYPE_TITLE` for why it stopped saying "Not yet".
 *
 * CHIPS, NOT TABS. The picked one takes a filled ground rather than an underline: an underline is a
 * navigation idiom (it says "you are on this page") and this changes what the screen SHOWS, not
 * where you are. It is literally the same object the range row under the chart uses — `SegmentedItem`
 * — which is where the pill and its argument live.
 */

import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_ORDER,
  UNLABELLED_TYPE,
  UNLABELLED_TYPE_TITLE,
  type AccountTypeKey,
} from '@/lib/prop-firms';
import { SegmentedItem } from '@/components/ui/segmented';
import { cn } from '@/lib/cn';

/** Which accounts the page is currently about: everything, one type, or the ones with no type. */
export type Scope = 'all' | AccountTypeKey | typeof UNLABELLED_TYPE;

/** Does an account belong to a scope? One definition, so the chips and the roster cannot disagree. */
export function inScope(a: { accountType: string | null }, scope: Scope): boolean {
  if (scope === 'all') return true;
  if (scope === UNLABELLED_TYPE) return a.accountType === null;
  return a.accountType === scope;
}

export function ScopeTabs({
  accounts,
  scope,
  onScope,
  className,
}: {
  /** The roster as the page received it — the chips describe what EXISTS, not what is selected. */
  accounts: { accountType: string | null }[];
  scope: Scope;
  onScope: (s: Scope) => void;
  /* `sm:hidden` LIVES AT THE CALL SITE, NOT IN HERE, and `filter-sheet.tsx`'s rack section states
     why in one line: "a component that erases itself above a breakpoint cannot be racked, and
     'cannot be racked' is how this got missed the first time." That sheet cost a phone-bricking
     deploy for exactly that reason. Where this appears is the page's decision anyway. */
  className?: string;
}) {
  /* BUILT FROM WHAT THE TRADER HAS, not from the full type list. A chip that filters to nothing is a
     control that can only disappoint, and on a two-account roster most of them would be. */
  const tabs: { value: Scope; label: string }[] = [
    { value: 'all', label: 'All' },
    ...ACCOUNT_TYPE_ORDER.filter((t) => accounts.some((a) => a.accountType === t)).map((t) => ({
      value: t as Scope,
      label: ACCOUNT_TYPE_LABELS[t],
    })),
    ...(accounts.some((a) => a.accountType === null)
      ? [{ value: UNLABELLED_TYPE as Scope, label: UNLABELLED_TYPE_TITLE }]
      : []),
  ];

  // One group and nothing to switch between: "All" beside itself is a control with no second state.
  if (tabs.length < 3) return null;

  return (
    /* SCROLLABLE, AND IT HAS TO BE: four groups plus "All" do not fit 390px, and the alternative —
       wrapping to two rows — would push the figure down the screen on the one viewport with no room
       to spare. `-mx-4 px-4` lets the row bleed to both screen edges so a chip scrolled to the end
       does not stop short of one, while the first still lines up with the page column.
       AND NO BAR (2026-08-27). `.scroll-none` rather than the app's `.scroll-thin`, because on a
       390px screen the bar was a full-width grey rule sitting under five chips - more ink than the
       thing it describes, and describing something the chips already say by being cut off at the
       edge. `pb-1` goes with it: that padding existed to hold the bar off the chips. */
    <div className={cn('scroll-none -mx-4 mb-1 overflow-x-auto px-4', className)}>
      <div className="flex w-max gap-1">
        {tabs.map((t) => {
          const on = scope === t.value;
          return (
            <SegmentedItem key={t.value} selected={on} onClick={() => onScope(t.value)}>
              {t.label}
            </SegmentedItem>
          );
        })}
      </div>
    </div>
  );
}
