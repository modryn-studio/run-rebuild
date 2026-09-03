import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/* THE ROSTER PAGE, BEFORE ITS FIGURES ARRIVE - the body of `(app)/accounts/loading.tsx`.
 *
 * A COMPONENT RATHER THAN A ROUTE FILE, and the house rule is why: *"a component isn't done until
 * it appears in `/kitchen-sink` in every state, in the same commit."* A `loading.tsx` cannot be
 * racked - it is a route's default export, reachable only by suspending that route - so the
 * placeholder lived somewhere nobody could review it against the card it stands in for. Extracted
 * 2026-09-03 for exactly that reason, the same shape `widget-skeleton.tsx` takes for `/today`.
 *
 * ─── WHICH MARK, AND WHY THIS PAGE WAS THE ONE STILL GETTING IT WRONG ──────────────────────────
 *
 * `/accounts` had NO boundary until 2026-09-03, so it fell through to `(app)/loading.tsx` - the
 * WORDMARK - while `/trades` beside it in the same shell showed a skeleton. `design-system.md` §7 is
 * unambiguous: the wordmark is for a COLD ENTRY and nothing else, and a tab-to-tab move inside a
 * mounted shell is not one. The sidebar, the header and the bottom bar never left.
 *
 * `trades/loading.tsx`'s own note is what hid it. It asks *"why /trades needed its own and /accounts
 * did not"* and answers correctly for the question it was asking: `/trades` portals a 57px search
 * row into the shell's BAND, a sibling of `<main>`, so a suspended `/trades` moved the whole pane by
 * 57px. `/accounts` portals only into the header's existing flex row and shifts no geometry, so it
 * had no JAG. That got read as "and therefore needs no boundary", which does not follow - it needed
 * none to stop a jump, and still needed one to show the right mark.
 *
 * ─── IT MIRRORS THE PAGE'S BOXES, NOT A RESEMBLANCE OF THEM ────────────────────────────────────
 *
 * The chart card, then the same `lg:grid-cols-[minmax(0,1fr)_304px]` split the roster and the
 * summary rail sit in. 304px is fixed on the page and fixed here. Every class is copied from the
 * real components rather than approximated - `min-h-14` / `sm:min-h-21` on a row, a 36px disc, the
 * `bg-band` group header - because a card that arrives 40px taller than its placeholder makes
 * everything under it jump, which is the jag the boundary exists to prevent.
 *
 * ─── RAGGED, DELIBERATELY ──────────────────────────────────────────────────────────────────────
 *
 * The reasoning `trades-rail-skeleton.tsx` states and §7 now carries: a column of identical bars
 * reads as a placeholder GRAPHIC, a ragged one reads as text that has not arrived. These are
 * account names and rail figures at roughly their real measures.
 *
 * `.wait-reveal` IS NOT HERE, and that is on purpose: it belongs to the BOUNDARY, which is the
 * thing that knows whether a wait is happening. Racking a component that holds itself invisible for
 * 300ms would rack a blank box.
 */
export function RosterSkeleton() {
  return (
    <>
      {/* THE CHART CARD AT ITS REAL HEIGHT, and the same idiom `accounts/details/[id]/loading.tsx`
          uses because it is the same card: an eyebrow, the figure, the plot, and the range row that
          only the phone draws. Measured 382px on the live page. */}
      <Card className="overflow-clip max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none">
        <div className="px-5 pt-5 max-sm:px-0">
          {/* The eyebrow is desktop-only on this card, exactly as `PnlChart` draws it. */}
          <Skeleton className="hidden h-4 w-20 sm:block" />
          <Skeleton className="mt-2 h-8 w-44 max-sm:mt-0" />
        </div>
        <Skeleton className="mx-5 mt-4 h-56 max-sm:mx-0" />
        {/* THE PHONE'S RANGE CHIP ROW, and it is `sm:hidden` because that is where the real one
            lives: above `sm` the ranges are a `Menu` in the header, which this card's own figure
            row already accounts for. */}
        <div className="flex justify-between gap-1 px-5 py-4 max-sm:px-0 sm:hidden">
          {RANGES.map((w, i) => (
            <span key={i} className="block flex-1" style={{ maxWidth: w }}>
              <Skeleton className="h-11 w-full" />
            </span>
          ))}
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_304px]">
        {/* THE ROSTER. Two group bands and their rows, which is roughly what one screen of this
            card holds - the real card groups by phase and prints a band per group. */}
        <Card className="min-w-0 overflow-clip">
          <div className="border-rule flex min-h-15 items-center border-b px-5 py-2 max-sm:min-h-11 max-sm:px-4">
            <Skeleton className="h-5 w-28" />
          </div>
          {GROUPS.map((rows, g) => (
            <div key={g}>
              <div className="bg-band flex items-center justify-between px-5 py-2 max-sm:px-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-16" />
              </div>
              {rows.map((w, i) => (
                <RosterRow key={i} width={w} />
              ))}
            </div>
          ))}
        </Card>

        {/* THE SUMMARY RAIL, which orders last below `lg` on the page and has nothing to reorder
            here because both columns are placeholders. */}
        <div className="flex flex-col gap-4">
          <RailCard lines={SUMMARY_LINES} />
        </div>
      </div>
    </>
  );
}

/** The phone's range chips: 1D through ALL, at the measures `SHORT_LABELS` produces. */
const RANGES = [34, 36, 36, 40, 44, 36, 40];
/** Two groups of accounts, which is roughly what one screen of this roster holds. */
const GROUPS: number[][] = [
  [132, 108, 148],
  [116, 140],
];
const SUMMARY_LINES = [72, 60, 84, 56, 68, 76];

/* ONE ROSTER ROW. `min-h-14` on a phone and `sm:min-h-21` (84px) above it, which is the real row's
   own pair - the taller desktop row is a FLOOR rather than a height, because a wrapping account
   name grows it. The disc is 36px (`h-9 w-9 rounded-full` in `roster-card.tsx`), so the placeholder
   is a circle at that size or the row's left edge reads as a square about to become one. */
function RosterRow({ width }: { width: number }) {
  return (
    <div className="flex min-h-14 items-center gap-3 py-2.5 pr-4 pl-4 sm:min-h-21 sm:gap-5 sm:py-3 sm:pr-5 sm:pl-7">
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="block" style={{ width }}>
          <Skeleton className="h-5 w-full" />
        </span>
        <Skeleton className="h-4 w-20" />
      </div>
      {/* The sparkline column, which the row drops below `sm` - so this drops there too. */}
      <span className="hidden shrink-0 sm:block">
        <Skeleton className="h-8 w-24" />
      </span>
      <div className="flex min-w-24 shrink-0 justify-end sm:min-w-32">
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  );
}

/** A rail card: a title row at the height its heading takes, then label/value pairs. */
function RailCard({ lines }: { lines: number[] }) {
  return (
    <Card className="overflow-hidden max-md:-mx-4 max-md:rounded-none max-md:shadow-none">
      <div className="px-5 py-4 max-md:flex max-md:min-h-13 max-md:items-center max-md:px-4 max-md:py-0">
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="border-rule border-t pb-2 max-md:pb-1">
        {lines.map((w, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 px-5 py-1.5 max-md:px-4 max-md:py-2"
          >
            <Skeleton className="h-5 w-16" />
            <span className="block" style={{ width: w }}>
              <Skeleton className="h-5 w-full" />
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
