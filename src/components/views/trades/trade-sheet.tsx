'use client';

/* THE PHONE'S CONTAINER FOR ONE TRADE: a full screen that arrives from the bottom, the same way
 * `FilterSheet` does (2026-08-24, Luke: "this page should pop up from the bottom of the screen just
 * like the filter screen and the date range screen... you get this point. consistency").
 *
 * IT IS RENDERED BY THE SEGMENT'S LAYOUT, AND THAT IS THE FIX FOR A REAL BUG (2026-08-25, Luke:
 * "now when i click, i see some sort of loading state then the panel slides up. is like a hiccup or
 * a double screen"). It was right: THE SHEET SLID TWICE.
 * `loading.tsx` rendered one of these, which mounted closed and animated up with the skeleton. When
 * the data landed, `page.tsx` rendered ANOTHER - a different element in a different subtree, so
 * React unmounted the first and mounted the second, which also started closed and also animated up.
 * A layout does not re-render when a child segment resolves. So the sheet mounts once, animates
 * once, and the skeleton is replaced by the facts INSIDE a panel that never moves - which is what
 * the screen did before there was a loading state at all, minus the blank wait.
 * THE LAYOUT MUST NOT FETCH. Awaiting the trade there would suspend the sheet itself, and the sheet
 * arriving instantly is the entire point. So it renders chrome only, and the title arrives by
 * portal from the page that already has it.
 *
 * IT IS STILL A ROUTE, AND THAT IS THE WHOLE TRICK. The obvious way to get a sheet is an overlay
 * over `/trades`, and `[id]/page.tsx` argues at length why this build refused that: an overlay owes
 * the phone's BACK GESTURE an answer, which means intercepting history, and getting that wrong
 * strands someone on a screen they cannot leave. So the presentation changed and the mechanism did
 * not. Back, back-swipe, a shareable URL and surviving a reload all still come free from the router;
 * the sheet is only how the route ARRIVES.
 *
 * ONE DOM TREE, NOT TWO. The desktop reaches this URL too, and rendering a phone sheet plus a
 * desktop page would mean `TradeDetail` twice in the document - two copies of the one body both
 * containers were built to share, and two elements owning the same `id`. So the container is
 * responsive instead: below `md` it is a fixed full-screen sheet with its own header and its own
 * scrollport; from `md` it is an ordinary page column and every one of those rules switches off.
 *
 * THE HEADER IS THE FILTER SHEET'S HEADER, deliberately: `h-16`, no bottom border, the title
 * centred, one control at the far left. A trade opened from the tape is a DRILL-IN, so it gets the
 * back arrow rather than the close - the same distinction `FilterSheet` makes between its axis list
 * (an `x`, dismissing an overlay) and its sub-pages (a `<-`, stepping back up). It also points the
 * same way the phone's own back gesture does.
 *
 * NO PREV/NEXT ARROWS, and that is unchanged rather than unconsidered - see the route's own note.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/icon';
import { ICON_BUTTON } from '@/components/ui/icon-button';

/* WHERE THE PAGE PUTS THE CONTRACT NAME. The sheet lives in a LAYOUT now and layouts must not
 * fetch here (see the file header), so it cannot know the title - the page does, and portals it in.
 * Same content-here/position-there split `HEADER_SLOT_ID` makes for the shell's band. */
export const TRADE_SHEET_TITLE_SLOT_ID = 'trade-sheet-title-slot';

export function TradeSheet({ children }: { children: React.ReactNode }) {
  /* IT ARRIVES CLOSED AND OPENS ON THE NEXT FRAME, which is what makes it animate at all. A sheet
     that renders already-open has nothing to transition FROM: the browser paints the final state
     once and the travel never happens. `requestAnimationFrame` rather than a timeout because the
     only requirement is "after the first paint", which is exactly what rAF means.
     `@starting-style` would express this in CSS, but it applies to an element entering the DOM and
     this element is also the desktop's page container - it must not animate there. State keeps the
     two cases apart without a second element. */
  const [open, setOpen] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  /* IT LEAVES THE WAY IT ARRIVED (2026-08-24, Luke: "does it animate back towards the bottom of the
     screen or does it just close out? i need consistency"). It just closed: a route unmounts the
     moment navigation commits, so there was nothing left on screen to animate.
     So the control drives the animation and the navigation follows it. `setOpen(false)` starts the
     200ms the class already declares for leaving, and the push happens after.
     A TIMEOUT, NOT `transitionend`: reduced motion collapses the duration to zero and a
     `transitionend` may never fire at all, which would strand the trader on a screen whose back
     button silently does nothing. A timer always resolves. 220ms is the declared 0.2s plus a frame.
     THE OS BACK GESTURE STILL GOES STRAIGHT BACK, and that is correct rather than a gap: the
     browser draws its own page transition for that, and overriding it would make Run's animation
     fight the platform's. Our control animates our way; the system's animates its way. */
  const leave = () => {
    setOpen(false);
    setTimeout(() => router.push('/trades'), 220);
  };

  return (
    <div
      data-open={open}
      className={cn(
        /* `.sheet-transition` is unprefixed because a Tailwind variant cannot modify a hand-written
           class - `max-md:sheet-transition` compiles to nothing, which this codebase has been
           caught by twice. It is harmless above `md`: the class names only a transition, and
           nothing up there ever changes `translate`. */
        'sheet-transition bg-bg',
        'max-md:fixed max-md:inset-0 max-md:z-[70] max-md:flex max-md:flex-col',
        !open && 'max-md:translate-y-full',
        /* `md:px-4`, NOT `PAGE_COLUMN` VERBATIM (2026-08-24, Luke: "we are not using the full width
           of the screen"). `PAGE_COLUMN` is `mx-auto w-full px-4`, and that `px-4` applied at every
           width - on top of the scrollport's own `px-4` below `md`. Measured at 390: content began
           at x=32 in a 358px box, against the tape rows it was drilled from at x=16, and the header
           put its back arrow at x=24 where `FilterSheet`'s sits at 8.
           A phone sheet is FULL BLEED and its children own their insets, which is what the filter
           sheet already does. The column and its gutter belong to the desktop page only. */
        'mx-auto w-full md:px-4 md:pb-8'
      )}
    >
      {/* PHONE ONLY. Above `md` the shell's own band carries the trail, which is where a route
          below a NAV href is supposed to put it (`header-slot.tsx`). */}
      <div className="relative flex h-16 shrink-0 items-center justify-center px-2 md:hidden">
        {/* THE WRAPPER IS POSITIONED, NOT THE CONTROL, and `icon-button.tsx` documents why in its
            own header: `.lift-press` sets `position: relative` UNLAYERED to anchor its 44px hit
            expander, so an `absolute` passed through `className` silently resolves to relative. It
            did exactly that on `FilterSheet`'s back arrow, which rendered inline beside the centred
            title instead of at the far left. */}
        <div className="absolute left-2">
          {/* A BUTTON HERE, AND A LINK IN THE DESKTOP TRAIL, because the two do different jobs.
              This one has to ANIMATE before it navigates, which a plain link cannot express - and
              the middle-click, cmd-click and "copy link address" a link buys are worth nothing on
              the touch screen this control only exists on (`md:hidden`). The route's own trail in
              the shell band stays a `<Link>` for exactly those affordances.
              It pushes `/trades` rather than calling `back()`, for the reason the route states:
              back depends on how the trader ARRIVED, and someone opening this URL cold would be
              sent wherever they were before Run. */}
          <button type="button" onClick={leave} aria-label="Back to trades" className={ICON_BUTTON}>
            <Icon name="back" size={22} />
          </button>
        </div>
        {/* EMPTY UNTIL THE PAGE FILLS IT, which is correct rather than a gap: during the wait the
            trade has not been read, and a placeholder would be a label that changes into a
            different label. `px-12` keeps the centred text clear of the back arrow at either end. */}
        <h2
          id={TRADE_SHEET_TITLE_SLOT_ID}
          className="text-h3 text-text min-w-0 truncate px-12 font-medium"
        />
      </div>

      {/* THE SCROLLPORT IS THIS, NOT THE PANE BEHIND IT. `min-h-0` is what lets a flex child
          actually shrink and scroll; without it this grows to its content and the sheet's header
          scrolls away with the body. Bounded top and bottom by the header above and the sheet's own
          edge, so the bar cannot run behind either - the same rule the shell now follows.
          `pb-8` inside the scrollport rather than on the sheet, or the last row sits on the screen's
          bottom edge with nothing under it. */}
      {/* `scroll-thin` UNPREFIXED, and the linter is why. I wrote `max-md:scroll-thin` two lines
          after commenting on this exact trap: a Tailwind VARIANT can only modify a Tailwind
          UTILITY, and `scroll-thin` is hand-written in globals.css, so the prefixed form compiles
          to nothing at all - silently. Unprefixed it is harmless above `md`, where this element has
          no overflow and therefore no bar to thin. */}
      <div className="scroll-thin max-md:min-h-0 max-md:flex-1 max-md:overflow-y-auto max-md:px-4 max-md:pb-8">
        {/* `max-w-[560px]`, the drawer's own width, so the fact list has the same measure at every
            viewport rather than stretching a label/value pair across a 1600px monitor. */}
        <div className="mx-auto w-full max-w-[560px]">{children}</div>
      </div>
    </div>
  );
}
