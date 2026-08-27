import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { HeaderSlot } from '@/components/shell/header-slot';

/* THE TAPE, BEFORE ITS ROWS ARRIVE — and it exists because the shared one was the wrong mark AND
 * the wrong SHAPE for this route.
 *
 * ─── WHY /trades NEEDED ITS OWN AND /accounts DID NOT (2026-08-27) ───────────────────────────────
 *
 * Luke, on a phone: "when i switch between /accounts and /trades page, i get the Run loading mark in
 * the main content area with the header already loaded. then a split second later the entire screen
 * flashes and the page is now loaded ... it only happens on the /trades page."
 *
 * It was not a speed difference. `/trades` portals a search row into `HEADER_BAND_SLOT_ID`, which is
 * a SIBLING of `<main>` in the shell's flex column and is zero-height until a page fills it. That row
 * measures 57px below `md` (pt-2 + h-9 + pb-3 + the hairline). So while the page was suspended the
 * band was empty and `<main>` began 57px higher up the screen; the moment the page committed, the
 * band inflated and the entire pane dropped 57px. That is the flash. `/accounts` portals only into
 * `HEADER_SLOT_ID`, which is an existing flex row inside a fixed-height header - it changes no
 * geometry at all, which is exactly why the same navigation felt smooth in the other direction.
 *
 * So the fix is not a faster query or a nicer spinner: it is a waiting state that occupies the same
 * boxes the page will. This one reserves the band and stands in for the tape.
 *
 * ─── AND THE WORDMARK WAS THE WRONG MARK ────────────────────────────────────────────────────────
 *
 * `design-system.md` §7 already decides this: "Skeleton when you know what is coming (the default),
 * Spinner inside buttons only, the wordmark for a COLD ENTRY." Tab-to-tab inside a shell that is
 * already on screen is not a cold entry - the sidebar, the header and the bottom bar never left. The
 * shape of what is coming is known exactly, so a skeleton is the house answer and the wordmark stays
 * for the first paint of the app.
 *
 * IT COVERS `/trades/[id]` TOO unless that segment declares its own, which is why it now does - a
 * tape skeleton behind a full-screen detail sheet would be a worse answer than the one this replaced.
 */
export default function Loading() {
  return (
    <>
      {/* THE PHONE'S SEARCH ROW, AT ITS EXACT HEIGHT. Every class here is copied from
          `TradesSearchPill`'s own wrapper and field rather than approximated, because approximating
          it is how the 57px comes back as 54 and the jag survives at a third of its size. If that
          row's geometry changes, this has to move with it. */}
      <HeaderSlot slot="band">
        <div className="bg-bg border-border border-b px-4 pt-2 pb-3 md:hidden">
          {/* THE FIELD ITSELF, not a grey bar in its place. A search box is chrome: it is drawn
              before the data and it does not depend on it, so standing it in with a placeholder
              would announce a wait that is not happening to it. */}
          <div className="border-border bg-surface h-9 rounded-[var(--radius-sm)] border" />
        </div>
      </HeaderSlot>

      <div className="flex flex-col gap-4">
        <Card className="overflow-clip max-md:-mx-4 max-md:rounded-none max-md:shadow-none">
          {/* The tape's own column header: `min-h-15`, `max-md:hidden`, gone on a phone. */}
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
      </div>
    </>
  );
}

/* RAGGED, DELIBERATELY, and it is the same reasoning `trades-rail-skeleton.tsx` states: a column of
   identical bars reads as a placeholder GRAPHIC, a ragged one reads as text that has not arrived.
   These are instrument names at their real measures - "MNQ 12-26" against "MES 03-27". Two sessions
   of four and three because that is roughly what one screen of this tape holds on a phone. */
const SESSIONS: number[][] = [
  [104, 88, 116, 96],
  [92, 120, 84],
];

/** One row of the tape: `min-h-13`, the mark and the instrument left, the net pinned right. */
function TapeRow({ width }: { width: number }) {
  return (
    <div className="flex min-h-13 items-center gap-4 px-5 py-2 max-md:gap-3 max-md:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3 max-md:gap-2">
        {/* `InstrumentMark` is a 32px disc, so the placeholder is one too - `rounded-full` rather
            than the primitive's default corner, or the row's left edge reads as a squared-off box
            that is about to become a circle. */}
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <span className="block" style={{ width }}>
          <Skeleton className="h-5 w-full" />
        </span>
      </div>
      {/* The account column, which the row drops below `sm` — so this drops there too. */}
      <span className="hidden min-w-0 flex-1 sm:block">
        <Skeleton className="h-5 w-32" />
      </span>
      <div className="flex min-w-24 shrink-0 justify-end sm:min-w-32">
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  );
}
