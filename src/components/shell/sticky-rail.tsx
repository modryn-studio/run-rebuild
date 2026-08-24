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
  const [fits, setFits] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* `offsetHeight`, not `getBoundingClientRect`: this element's height does not change when it
       becomes sticky, so the observer below cannot feed itself. */
    const check = () => setFits(el.offsetHeight <= window.innerHeight);
    check();
    // The rail's own height changes when its content does — a filter that drops the trade count
    // from four digits to three reflows it. The viewport changes on resize and on zoom.
    const ro = new ResizeObserver(check);
    ro.observe(el);
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
      className={cn('max-lg:order-last lg:self-start', fits && 'lg:sticky lg:top-0', className)}
    >
      {children}
    </aside>
  );
}
