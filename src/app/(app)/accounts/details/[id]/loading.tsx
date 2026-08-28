import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PAGE_COLUMN } from '@/lib/shell';
import { cn } from '@/lib/cn';

/* THE ACCOUNT PAGE, BEFORE ITS FIGURES ARRIVE (2026-08-28, Luke: "sometimes it takes a second to
 * load the /accounts/details page. can we load the head instantly? can we/should we use skeleton or
 * a spinner or the run loading mark for this gap?").
 *
 * THE HEAD IS ALREADY INSTANT, and not because of this file. The segment's `layout.tsx` renders the
 * bar and reads one cached row for the title, so it paints before the page's five queries resolve;
 * a layout persists while its boundary hands over, so the bar never belongs to the wait. This file
 * only fills the body underneath it.
 *
 * A SKELETON, WHICH IS THE HOUSE ANSWER RATHER THAN A PREFERENCE. `design-system.md` §7: "Skeleton
 * when you know what is coming (the default), Spinner inside buttons only, the wordmark for a cold
 * entry." Tapping a roster row is not a cold entry - the shell never left, and on a phone the bar
 * above this is already showing the account's name - and the shape of what is coming is known
 * exactly. The wordmark stays for the first paint of the app.
 *
 * IT OCCUPIES THE SAME BOXES THE PAGE WILL, which is the whole job and the thing `/trades`' own
 * boundary got wrong for a week: `PAGE_COLUMN` here, so the cards' `max-md:-mx-4` cancels a gutter
 * that exists rather than hanging them off the screen. Chart, then four rows, then two tables - the
 * phone's order, because above `md` the shell's band is showing and this segment is a normal page.
 */
export default function Loading() {
  return (
    <div className={cn(PAGE_COLUMN, 'pb-8 max-md:px-0 max-md:pb-0')}>
      {/* THE CHART CARD AT ITS REAL HEIGHT. The eyebrow, the figure, the plot and the range row are
          all drawn rather than approximated, because a card that arrives 40px taller than its
          placeholder makes everything under it jump - which is the jag this whole file exists to
          prevent. */}
      <Card className="overflow-clip max-md:-mx-4 max-md:rounded-none max-md:shadow-none">
        <div className="px-5 pt-5 max-md:px-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-2 h-9 w-40" />
        </div>
        <Skeleton className="mx-5 mt-5 h-56 max-md:mx-4" />
        <div className="flex items-center justify-between px-5 py-4 max-md:px-4">
          {/* `Skeleton` TAKES A CLASS AND NOT A STYLE, so a measured width goes on a wrapper. The
              same shape `/trades`' boundary uses for its ragged instrument names. */}
          {RANGES.map((w, i) => (
            <span key={i} className="block" style={{ width: w }}>
              <Skeleton className="h-8 w-full" />
            </span>
          ))}
        </div>
      </Card>

      {/* RECENT TRADES, PHONE ONLY, because above `md` the tape sits in the grid below instead.
          `md:hidden` here and `max-md:hidden` on the grid, so exactly one is ever drawn - the same
          split the page itself makes. */}
      <div className="md:hidden">
        <Card className="mt-4 overflow-clip max-md:-mx-4 max-md:rounded-none max-md:shadow-none">
          <div className="border-rule flex min-h-13 items-center border-b px-5 max-md:px-4">
            <Skeleton className="h-5 w-32" />
          </div>
          {ROWS.map((w, i) => (
            <TradeRow key={i} width={w} />
          ))}
          <div className="px-4 py-3">
            <Skeleton className="h-12 w-full" />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 max-md:mt-6 lg:grid-cols-[minmax(0,1fr)_304px]">
        {/* The tape, desktop only, matching the page's own `DesktopOnly` gate. */}
        <div className="min-w-0 max-md:hidden">
          <Card className="overflow-clip">
            <div className="border-rule min-h-15 items-center border-b px-5 py-2">
              <Skeleton className="mt-3 h-5 w-40" />
            </div>
            {ROWS.map((w, i) => (
              <TradeRow key={i} width={w} />
            ))}
          </Card>
        </div>

        {/* The rail's two cards. Ragged line lengths, deliberately, and it is the reasoning
            `trades-rail-skeleton.tsx` states: a column of identical bars reads as a placeholder
            GRAPHIC, a ragged one reads as text that has not arrived. */}
        <div className="flex flex-col gap-4">
          <RailCard lines={SUMMARY_LINES} />
          <RailCard lines={DATA_LINES} />
        </div>
      </div>
    </div>
  );
}

/** The chart's range row: 1D through ALL, at their real measures. */
const RANGES = [28, 32, 32, 34, 38, 30, 40];
/** Four instrument names at the lengths the tape actually produces. */
const ROWS = [104, 88, 116, 96];
const SUMMARY_LINES = [72, 60, 84, 56, 68, 76];
const DATA_LINES = [64, 88, 72, 56];

/** One row of the tape: `min-h-13`, the mark and the instrument left, the net pinned right. */
function TradeRow({ width }: { width: number }) {
  return (
    <div className="border-rule flex min-h-13 items-center gap-4 border-b px-5 py-2 max-md:gap-3 max-md:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3 max-md:gap-2">
        {/* `InstrumentMark` is a 32px disc, so the placeholder is one too — `rounded-full` rather
            than the primitive's default corner, or the row's left edge reads as a squared-off box
            that is about to become a circle. */}
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <span className="block" style={{ width }}>
          <Skeleton className="h-5 w-full" />
        </span>
      </div>
      <div className="flex min-w-24 shrink-0 justify-end sm:min-w-32">
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  );
}

/** A rail card: a title row at the same height its heading takes, then label/value pairs. */
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
