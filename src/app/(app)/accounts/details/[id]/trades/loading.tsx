import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/* THE ACCOUNT'S TAPE, BEFORE ITS ROWS ARRIVE (2026-08-28, Luke: "the trade details page needs to
 * have a different skeleton loading screen than the /account/details page. the skeleton should be
 * similar if not exactly the same as the /trades page skeleton").
 *
 * IT EXISTS BECAUSE A BOUNDARY COVERS ITS WHOLE SUBTREE. Without this file the segment's own
 * `loading.tsx` one level up served this route too - so tapping "View all trades" put up a chart
 * card, four rows and two fact tables, none of which this screen has. A waiting state that stands in
 * for a different page is worse than none: it moves, and then everything it drew is replaced.
 *
 * THE SAME SHAPE AS `/trades`' OWN BOUNDARY, because it is the same tape. Session bands, ragged
 * instrument names at their real measures, the net pinned right. What differs is one line: that one
 * portals its search row into the SHELL's band, and this one draws a placeholder in place, because
 * the panel's band is a host this file cannot portal into from a Server Component. They swap in the
 * same commit - the band inflates as this row disappears - so the net height does not move.
 *
 * NO PAGE COLUMN HERE, unlike `/trades`. The segment layout's body already supplies `max-md:px-4`,
 * so the cards' `max-md:-mx-4` has a gutter to cancel. Adding another would double it - the mirror
 * image of the bug the sibling boundary had, and the reason `design-system.md` §6b now states that a
 * negative margin is always cancelling something.
 */
export default function Loading() {
  return (
    <>
      {/* THE SEARCH ROW, AT ITS EXACT HEIGHT. Every class is copied from `TradesSearchPill`'s own
          wrapper and field rather than approximated, because approximating it is how 57px comes
          back as 54 and the jag survives at a third of its size.
          THE FIELD ITSELF, not a grey bar in its place. A search box is chrome: it is drawn before
          the data and does not depend on it, so standing it in with a placeholder would announce a
          wait that is not happening to it. */}
      <div className="bg-bg border-border -mx-4 border-b px-4 pt-2 pb-3 md:hidden">
        <div className="border-border bg-surface h-9 rounded-[var(--radius-sm)] border" />
      </div>

      <Card className="mt-4 overflow-clip max-md:-mx-4 max-md:mt-0 max-md:rounded-none max-md:shadow-none">
        {/* The tape's own column header: `min-h-15`, and gone on a phone. */}
        <div className="border-rule min-h-15 items-center border-b px-5 py-2 max-md:hidden">
          <Skeleton className="mt-3 h-5 w-40" />
        </div>

        {SESSIONS.map((rows, s) => (
          <div key={s}>
            {/* The session band: `bg-band`, a date on the left and the day's net on the right. */}
            <div className="bg-band flex items-center justify-between px-5 py-2 max-md:px-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16" />
            </div>
            {rows.map((w, i) => (
              <TapeRow key={i} width={w} />
            ))}
          </div>
        ))}
      </Card>
    </>
  );
}

/* RAGGED, DELIBERATELY, and it is the reasoning `trades-rail-skeleton.tsx` states: a column of
   identical bars reads as a placeholder GRAPHIC, a ragged one reads as text that has not arrived.
   These are instrument names at their real measures. Two sessions of four and three, which is
   roughly what one screen of this tape holds on a phone. */
const SESSIONS: number[][] = [
  [104, 88, 116, 96],
  [92, 120, 84],
];

/** One row of the tape: `min-h-13`, the mark and the instrument left, the net pinned right. */
function TapeRow({ width }: { width: number }) {
  return (
    <div className="flex min-h-13 items-center gap-4 px-5 py-2 max-md:gap-3 max-md:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3 max-md:gap-2">
        {/* `InstrumentMark` is a 32px disc, so the placeholder is one too — `rounded-full` rather
            than the primitive's default corner, or the row's left edge reads as a squared-off box
            that is about to become a circle. */}
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <span className="block" style={{ width }}>
          <Skeleton className="h-5 w-full" />
        </span>
      </div>
      {/* The account column is off on this screen — every row belongs to the one account — so unlike
          `/trades`' boundary there is no middle cell to stand in for. */}
      <div className="flex min-w-24 shrink-0 justify-end sm:min-w-32">
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  );
}
