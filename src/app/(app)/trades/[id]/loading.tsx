import { SHEET_CONTROL_ICON } from '@/components/ui/sheet-header';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { ICON_BUTTON } from '@/components/ui/icon-button';
import { Skeleton } from '@/components/ui/skeleton';
import { HeaderSlot } from '@/components/shell/header-slot';

/* ONE TRADE, BEFORE IT ARRIVES.
 *
 * IT EXISTS BECAUSE THE SEGMENT ABOVE IT NOW HAS ONE (2026-08-27). A `loading.tsx` covers every
 * nested route that does not declare its own, so `trades/loading.tsx` would otherwise stand a TAPE
 * skeleton behind this screen - and below `md` this screen is a `fixed inset-0 z-[70]` sheet, so
 * the trader would watch a fake tape paint and then be covered by a sheet. Worse than the wordmark
 * it replaced, which is the test a new waiting state has to pass.
 *
 * `trade-drawer.tsx` already predicted this file: "That screen now states its own waiting shape in
 * `[id]/loading.tsx`, which is where the wait belongs - at the destination, in the shape of what is
 * arriving, rather than as a bead on the thing you just left." That was the argument for removing a
 * spinner from the tape row, and it was written against a file that did not exist yet. Now it does.
 *
 * THE WAY BACK IS REAL WHILE YOU WAIT. Both back controls are live `Link`s rather than placeholders,
 * because the one thing a trader is certain to want from a screen that has not loaded is out of it.
 * Only the parts that depend on the trade are skeletons.
 */
export default function Loading() {
  return (
    <>
      <HeaderSlot slot="title">
        <Link href="/trades" aria-label="Back to trades" className={ICON_BUTTON}>
          <Icon name="back" size={18} />
        </Link>
        {/* The title is the instrument and it is not known yet, so it is the one thing in this band
            that waits. `h-6` is `text-title`'s line box, so nothing moves when the word lands. */}
        <Skeleton className="ml-1 h-6 w-32" />
      </HeaderSlot>

      {/* Every class on this wrapper and the two below is `[id]/page.tsx`'s own. A waiting state
          whose box differs from its page reflows on arrival, which is the failure it exists to
          prevent. */}
      <div className="bg-bg mx-auto w-full max-md:fixed max-md:inset-0 max-md:z-[70] max-md:flex max-md:flex-col md:px-4 md:pb-8">
        {/* `SheetHeader`'s geometry, hand-built: it takes a `title: string` and there is no string
            yet. Passing a placeholder one would print an invented instrument for a frame. */}
        <div className="bg-bg relative flex h-16 shrink-0 items-center justify-center px-2 md:hidden">
          <div className="absolute left-2">
            <Link href="/trades" aria-label="Back to trades" className={ICON_BUTTON}>
              <Icon name="back" size={SHEET_CONTROL_ICON} />
            </Link>
          </div>
          <Skeleton className="h-6 w-36" />
        </div>

        <div className="scroll-thin max-md:min-h-0 max-md:flex-1 max-md:overflow-y-auto max-md:px-4 max-md:pb-8">
          <div className="mx-auto w-full max-w-[560px]">
            {/* THE HEAD: a 64px instrument mark on the left, the net and its account on the right. */}
            <div className="px-6 pt-6">
              <div className="flex items-start justify-between gap-4">
                <Skeleton className="size-16 rounded-full" />
                <div className="flex flex-col items-end gap-2">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-5 w-40" />
                </div>
              </div>
              <Skeleton className="mt-4 h-8 w-48" />
            </div>

            {/* THE FACT LIST. Ragged widths for the same reason `trades-rail-skeleton.tsx` gives:
                a column of identical bars reads as a graphic, a ragged one as text on its way. */}
            <div className="px-6 py-6">
              {ROWS.map(([label, value], i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-2">
                  <span className="block" style={{ width: label }}>
                    <Skeleton className="h-5 w-full" />
                  </span>
                  <span className="block" style={{ width: value }}>
                    <Skeleton className="h-5 w-full" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** The real labels' approximate measures — Direction, Quantity, Entry, Exit, Gross, Fees, Net. */
const ROWS: [number, number][] = [
  [64, 48],
  [68, 32],
  [52, 96],
  [44, 96],
  [56, 72],
  [40, 56],
  [36, 80],
];
