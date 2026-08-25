'use client';

/* THE RIGHT RAIL, PINNED ONLY WHEN IT ACTUALLY FITS. Ported from `run-trading@v2` (2026-08-17, S5c).
 *
 * A RAIL TALLER THAN THE VIEWPORT CANNOT BE PINNED AT `top-0` without hiding its own bottom
 * forever, and the textbook fix — `max-h` plus `overflow-y-auto` — is a second scrollbar, which
 * Luke ruled out (2026-08-03: "i said, i didn't want two scroll bars... i knew it would look
 * stupid"). So the two states are CHOSEN rather than combined: pin it, or let it scroll with the
 * page. A blanket `lg:sticky lg:top-0`, which is what this replaced here, is the version that hides
 * the bottom of a long rail.
 *
 * IT MEASURES RATHER THAN GUESSING A BREAKPOINT. v2's first answer was a `min-height: 720px` media
 * query, and its own note records why that was wrong: the query is a statement about the VIEWPORT
 * and the question is about the RAIL. Measured there in a 662px viewport, two pages were denied a
 * pin they had room for because a third page's rail is nearly twice their height. One number cannot
 * describe three rails, and it was the tallest that set it.
 *
 * NO LAYOUT EFFECT, deliberately. This resolves after the first paint, so a rail that will pin
 * spends one frame static — and static and sticky are pixel-identical until the page scrolls, so
 * there is nothing to see. `useLayoutEffect` would buy an invisible improvement and cost the SSR
 * warning it always does.
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export function StickyRail({ className, children, ...props }: React.ComponentProps<'aside'>) {
  const ref = useRef<HTMLElement>(null);
  /* HOW FAR ABOVE THE SCROLLPORT'S TOP THIS PINS, in px, and `null` until measured.
     0 when the rail fits: it pins the moment it reaches the top, which is what it always did.
     NEGATIVE when it does not: `scrollport - rail`, so the rail travels up with the tape until its
     BOTTOM lands on the scrollport's bottom, and pins there. */
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* IT MEASURES AGAINST THE SCROLLPORT, NOT THE WINDOW (2026-08-24), and that is the one thing
       this port got wrong. v2 compared the rail to `window.innerHeight` and was right to: THE
       DOCUMENT scrolled there, so the window WAS the scrollport.
       run-rebuild does not scroll the document - `app-shell.tsx` is `h-dvh overflow-hidden` and
       `<main>` is the thing that scrolls, sitting below a 64px header. So the window overstated the
       available height by exactly that header, and the test claimed a fit it did not have.
       Reproduced at 1280x560: the rail is 523px, the window says 560 so it pinned, and `<main>` is
       496 - so 27px of the rail's bottom sat below the scrollport with no way to reach it. That is
       precisely the failure this component exists to prevent, restated one layer up.
       `clientHeight`, not `getBoundingClientRect().height`: the scrollport's inner height excluding
       any horizontal bar, which is the space a sticky child actually has.

       `offsetHeight` for the rail, not `getBoundingClientRect`: this element's height does not
       change when it becomes sticky, so the observer below cannot feed itself. */
    const check = () => {
      const port = el.closest('main') ?? el.parentElement;
      const available = port?.clientHeight ?? window.innerHeight;
      /* A TALL RAIL STICKS TOO, IT JUST STICKS LATER (2026-08-25, Luke: "the main goal is to get the
         card to stick during scroll. but some screens like laptops are shorter and then the bottom
         of the summary card is cut off").
         The old test was all-or-nothing - pin at the top, or give up and scroll away for the rest of
         the tape - which made the card's HEIGHT a budget: every row added moved the cliff closer,
         and the only lever left was deleting facts to satisfy a layout rule.
         A negative `top` removes the budget. The rail scrolls up with the tape until its bottom
         reaches the scrollport's bottom, then holds for the rest of the scroll. The whole card is
         reachable, nothing is clipped, and there is no second scrollbar - which Luke ruled out in
         v2 and which is the textbook "fix" for this that we are deliberately not using.
         `Math.min(0, ...)` so a rail that fits keeps `top: 0` and the old behaviour exactly. */
      setTop(Math.min(0, available - el.offsetHeight));
    };
    check();
    // The rail's own height changes when its content does — a filter that drops the trade count
    // from four digits to three reflows it. The viewport changes on resize and on zoom.
    const ro = new ResizeObserver(check);
    ro.observe(el);
    /* THE SCROLLPORT IS OBSERVED TOO. Its height changes without the window's on this app - the
       phone's header band appears, the bottom bar comes and goes at `md` - and a rail that only
       re-checks when the rail itself reflows would keep a stale verdict through all of it. */
    const port = el.closest('main');
    if (port) ro.observe(port);
    window.addEventListener('resize', check);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', check);
    };
  }, []);

  return (
    <aside
      ref={ref}
      {...props}
      /* `self-start` STAYS UNCONDITIONAL. A grid item stretches to its row by default, which on a
         tape of 360 trades makes this column as tall as the tape — wrong at every viewport, pinned
         or not, and it is also what stops a sticky child from having anywhere left to travel.
         `top-0`, not `top-4`: the tape's own sticky header rests at 0, so the two tops have to agree
         or they drift apart the moment you scroll.
         `className` LAST so a caller's width utilities win — the collapsing `lg:w-76` / `lg:w-0`
         pair are both width utilities under one modifier, and twMerge has to see the caller's as
         the later argument or the closed state never applies. */
      /* THE OFFSET RIDES A CUSTOM PROPERTY, NOT AN INLINE `top`, and that is not style preference.
         Below `md` this same element is the phone's summary DRAWER - `max-md:fixed max-md:inset-y-0`
         - where `top` is load-bearing and an inline value would beat the class and break it. A
         variable is inert until a rule reads it, and only the `lg:` rule does. */
      style={top === null ? undefined : ({ '--rail-top': `${top}px` } as React.CSSProperties)}
      className={cn(
        'max-lg:order-last lg:self-start',
        top !== null && 'lg:sticky lg:top-[var(--rail-top)]',
        className
      )}
    >
      {children}
    </aside>
  );
}
