import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/* A `/today` WIDGET, BEFORE ITS FIGURES ARRIVE - and it is one component so six cards cannot drift.
 *
 * ─── THE MARK IS A SKELETON, AND THE DECISION IS FOR THE WHOLE PAGE ────────────────────────────
 *
 * 2026-09-03, Luke: *"what are we doing to use for loading state? skeleton or spinner in the card?
 * whatever we choose, we must use in every future card on the /today page for consistency. so
 * decide properly."*
 *
 * `design-system.md` §7 settles it with one question - **do you know the SHAPE of what is
 * arriving?** - and on `/today` the answer is always yes, more strongly than anywhere else in the
 * app: a widget's geometry is fixed by `Widget` before any data exists. A 57px header with a rule
 * under it, and a body at a height the card itself chooses. There is nothing to discover from the
 * response, so there is nothing a spinner could honestly stand in for.
 *
 *   Skeleton      the shape is known, content is filling in     <- this page, every card
 *   Spinner       a bounded action you triggered                INSIDE BUTTONS ONLY
 *   LoadingMark   a surface arriving, shape unknown             a cold entry, `(app)/loading.tsx`
 *
 * The numbers behind the default: a skeleton reads as up to **50% faster** than a spinner at
 * identical real load times, because it states the layout before the content exists, and NN/g finds
 * the benefit lands specifically in the **400ms-3s** band - which is where a two-query dashboard
 * read sits. §7 also bans the spinner from a navigation outright: *"a tap that opens a screen is not
 * a request in flight - it is a surface arriving, and the wait belongs at the destination in the
 * shape of what is coming."* A spinner inside a card is that mistake with a card around it.
 *
 * `playbooks/ui-ux-sources.md` WAS CHECKED AND DOES NOT COVER THIS. It is Emil Kowalski's body of
 * work (animations.dev, emilkowal.ski, Sonner, Vaul) and it is about MOTION - easing curves,
 * transitions, when not to animate. Its only two loading lines are *"a faster spinner makes an app
 * feel faster to load at identical real load times"*, which is about a spinner this page does not
 * use, and *"keep it under 300ms"*, which is `.wait-reveal` on the boundary. Nothing in it argues
 * against the skeleton and nothing in it is newer than §7's own citation.
 *
 * ─── THE HEADER IS THREE BARS, NOT ONE ─────────────────────────────────────────────────────────
 *
 * The real header holds three things at fixed positions - the figure-and-title, the delta beside
 * it, and the period control at the right edge - and all three exist before the data does. One wide
 * bar would say "something arrives here" and then reflow into three, which §7 calls out as reading
 * worse than the spinner it replaced.
 *
 * RAGGED WIDTHS, at roughly the real measures: `-$2,092.29 total P&L` is a long string, a delta with
 * its percentage is about half of it, and the picker is a fixed control. §7: *"a column of identical
 * bars reads as a placeholder graphic, an uneven one reads as text that has not arrived."*
 *
 * EVERY CLASS HERE IS COPIED FROM `widget.tsx` RATHER THAN APPROXIMATED - `border-rule border-b`,
 * `px-5 py-4 max-md:px-4` on the header, `px-5 py-5 max-md:px-4` on the body, and `flex-wrap` plus a
 * `min-h-6` line box on the head cluster. If that component's geometry changes this has to move with it; approximating
 * is how 57px comes back as 54 and a 3px jag survives at a third of its size.
 *
 * `aria-busy` ON THE CARD, and the bars are `aria-hidden` by `Skeleton`'s own contract: a screen
 * reader should hear one "busy" from the container rather than a stack of empty boxes.
 */
export function WidgetSkeleton({
  children,
  scope = true,
}: {
  /** The body's placeholder, sized by the card it stands in for. */
  children: React.ReactNode;
  /* WHETHER THIS CARD HAS A HEADER CONTROL. Not every `/today` widget will: the reference prints
     `this month` as a LABEL on its Goals and Recurring cards, because a period control belongs only
     where more than one period is answerable - and a boundary that draws a control the page then
     does not mount is a boundary that reflows. */
  scope?: boolean;
}) {
  return (
    <Card aria-busy className="flex flex-col overflow-hidden">
      <div className="border-rule flex w-full items-center border-b">
        <div className="flex min-w-0 flex-1 flex-col px-5 py-4 max-md:px-4">
          {/* `flex-wrap` AND NO FIXED HEIGHT, because `widget.tsx`'s own head cluster wraps and
              a skeleton that cannot wrap stops matching the card at exactly the widths where the
              card gets taller. Measured in a 416px column, where the real header goes to two
              lines: 372px against a live 396px before, 388px after - the bars are near enough to
              the real measures to cross the same threshold, and the 8px left over is the delta's
              own line box against a shorter bar. At `/today`'s real column width (611px at a 1280
              viewport) neither wraps and both are 372px exactly, which is the width that ships. */}
          <span className="flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </span>
        </div>
        {scope && (
          <span className="shrink-0 pr-5 max-md:pr-4">
            {/* `Menu`'s trigger height, at the width its longest option gives it. */}
            <Skeleton className="h-9 w-28" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 px-5 py-5 max-md:px-4">{children}</div>
    </Card>
  );
}

/* THE PLOT'S OWN BOX, which is the body of any `/today` card that draws a chart.
 *
 * 242px below `sm` and 275 above it - the two values `Plot` sets on `--chart-h`, read from that
 * component rather than rounded to a convenient number. Get it wrong and the card jumps by 33px on
 * a phone at the moment the data lands, which is the reflow the skeleton exists to prevent. */
export function PlotSkeleton() {
  return <Skeleton className="h-[242px] w-full sm:h-[275px]" />;
}

/* `Last session`'S BODY: one figure line, then five rows at the tape's own height.
 *
 * THE ROWS ARE FULL BLEED HERE TOO, and for the reason the card itself is: `TradeRow` carries its
 * own `px-5 max-md:px-4` and `WidgetSkeleton`'s body carries the same, so a boundary that inset the
 * bars twice would be 40px narrower than what lands and the whole list would shift on commit. The
 * negative margin is the card's, to the class.
 *
 * `min-h-13` IS `TradeRow`'S OWN HEIGHT, read from it rather than approximated: 52px per row, five
 * rows, four dividers. Get it wrong and the page grows or shrinks by the difference at the moment
 * the data lands, which is the reflow a skeleton exists to prevent.
 *
 * RAGGED BAR WIDTHS at roughly the real measures - an instrument, an account, a clock, a figure -
 * because four equal bars read as a table being drawn rather than as rows arriving. */
export function SessionRowsSkeleton() {
  return (
    <>
      <span className="flex min-h-6 items-center gap-x-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-32" />
      </span>
      <div className="divide-rule -mx-5 mt-4 divide-y max-md:-mx-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex min-h-13 items-center gap-4 px-5 py-2 max-md:gap-3 max-md:px-4"
          >
            <span className="flex min-w-0 flex-1 items-center gap-3 max-md:gap-2">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </span>
            <Skeleton className="h-4 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </>
  );
}
