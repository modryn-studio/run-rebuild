'use client';

/* THE PHONE'S SHELL FOR `/accounts/details/<id>` AND ITS `/trades` CHILD.
 *
 * ─── THE HEADER DOES NOT TRAVEL, AND THAT IS THE WHOLE SHAPE OF THIS FILE ───────────────────────
 *
 * 2026-08-28, Luke, on the first version: "the /accounts/details page slides up from the bottom of
 * the screen. that works. but the header slides up with it. that is not supposed to happen. i just
 * want the header to change state."
 *
 * He is describing what `TradeSheet` already does and what `FilterSheet`'s drill-in already does:
 * the bar is rendered OUTSIDE the element that moves, so it is simply THERE on the frame of the tap
 * while only the body travels. The first version put the whole panel on `.sheet-transition`, bar
 * included, because a route has no "before" to hold the bar still - which is what the segment layout
 * below now provides.
 *
 * ─── WHY THE PIECES LIVE IN A LAYOUT ────────────────────────────────────────────────────────────
 *
 * `design-system.md` §7: "Persistent chrome goes in `layout.tsx`, or a `loading.tsx` and its page
 * each mount it and the entrance runs twice." Both are true here at once:
 *
 *   THE PANEL AND THE BAR mount once for the whole segment, so the boundary and the page swap
 *   INSIDE them. That is what lets the bar paint before the page's heavy queries land - the layout
 *   reads one cached row for the title and nothing else.
 *
 *   THE BODY IS KEYED ON THE CHILD SEGMENT, so it re-enters when the ROUTE changes (details ->
 *   trades, where the bar renames and the rule says a new page slides) and does NOT re-enter when
 *   the boundary hands over to the page, which is the same screen arriving rather than a new one.
 *
 * ABOVE `md` NONE OF THIS APPLIES. Every class is `max-md:` gated, so the desktop page is an
 * ordinary column inside the shell with the shell's own band above it - one tree, two frames, the
 * container `/trades/[id]` already uses.
 *
 * ─── WHY NOT `<ViewTransition>` ─────────────────────────────────────────────────────────────────
 *
 * It does not build here. react 19.2.7 stable does not export it, and
 * `next/dist/lib/needs-experimental-react.js` shows Next 16.3 swapping to its vendored EXPERIMENTAL
 * React only when `blockingSSR`, `taint`, `transitionIndicator` or `gestureTransition` is set.
 * Turning one on to get a route animation swaps the whole React runtime, on a repo whose scar tissue
 * already includes an experimental Next feature shipping a stale stylesheet to a phone with every
 * build signal green. Revisit if that check ever passes on stable.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/* THE PANEL. It does NOT animate - it is the frame the bar sits in and the body moves inside.
 *
 * `bg-bg`, not `bg-surface`: this holds a PAGE (a chart card, a table, a rail), and those are
 * objects on a ground. The /accounts flow sheets are `bg-surface` because their content sits
 * directly on the panel with nothing between.
 *
 * `z-[60]`, over the shell's `z-40` chrome and under the `z-[70]` overlays a page inside it can
 * still open - the trade sheet, the filter sheet, the edit sheet. */
export function DetailPanel({ children }: { children: ReactNode }) {
  return (
    <div className="bg-bg mx-auto w-full max-md:fixed max-md:inset-0 max-md:z-[60] max-md:flex max-md:flex-col">
      {children}
    </div>
  );
}

/* THE ONLY THING THAT TRAVELS, and the only thing that scrolls.
 *
 * `min-h-0` is what lets a flex child actually shrink; without it this grows to its content and the
 * bar above scrolls away with it.
 *
 * NO `px-4` BELOW `md`. A phone screen is FULL BLEED and its children own their insets - the call
 * `/trades/[id]` made after measuring content starting at x=32 in a 358px box against the rows it
 * was drilled from at x=16. The cards inside reach the edges with `max-md:-mx-4`, so the column's
 * own gutter is what they are cancelling; take the gutter away and the negative margin hangs them
 * off the screen instead, which is exactly the bug `/trades`' loading boundary had.
 */
export function DetailPanelBody({ children }: { children: ReactNode }) {
  /* FALSE FOR ONE FRAME, so there is a `translate-y-full` to transition FROM. The same rAF flip
     `ModalShell` and `useSheet` make; without it the body is simply present and nothing moves.
     THERE IS NO EXIT. A route cannot animate away without holding the navigation open while it
     does. `TradeSheet` gets an exit because it is client state over a page that never left. */
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      data-open={open}
      className={cn(
        'scroll-thin max-md:min-h-0 max-md:flex-1 max-md:overflow-y-auto max-md:px-4 max-md:pb-8',
        /* `.sheet-transition` UNPREFIXED, because a Tailwind VARIANT cannot modify a hand-written
           class - `max-md:sheet-transition` compiles to nothing at all, silently, which this
           codebase has been caught by twice. Harmless above `md`: the utility below is gated, so
           `translate` is never set there and the transition has nothing to act on. */
        'sheet-transition',
        !open && 'max-md:translate-y-full'
      )}
    >
      {children}
    </div>
  );
}
