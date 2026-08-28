'use client';

/* THE PHONE'S SHELL FOR `/accounts/details/<id>` AND ITS CHILD ROUTE: a full-screen panel that
 * arrives from the bottom (2026-08-28, Luke: "when user clicks on an account from the /accounts
 * page, the /accounts/details page need to slide up from the bottom").
 *
 * ─── WHY IT IS NOT `<ViewTransition>` ────────────────────────────────────────────────────────────
 *
 * That was the plan and it does not build here. React's `ViewTransition` ships only on the
 * experimental channel: this install is react 19.2.7 stable, which does not export it, and
 * `needs-experimental-react.js` shows Next 16.3 swapping to its vendored experimental React ONLY
 * when `blockingSSR`, `taint`, `transitionIndicator` or `gestureTransition` is set. Turning one on
 * to get a route animation swaps the whole React runtime for an experimental build - on a repo whose
 * scar tissue already includes an experimental Next feature shipping a stale stylesheet to a phone
 * while every build signal stayed green.
 *
 * So the panel animates ITSELF, on the mechanism this product already owns: `.sheet-transition` and
 * `translate-y-full` at the call site, identical to `FilterSheet`, `TradeSheet` and `AccountSheet`.
 * The trader cannot tell the difference; the build can.
 *
 * ─── IT LIVES IN THE LAYOUT, AND THAT IS THE WHOLE REASON IT IS A SEPARATE FILE ─────────────────
 *
 * `design-system.md` §7: "Persistent chrome goes in `layout.tsx`, or a `loading.tsx` and its page
 * each mount it and the entrance runs twice." A route that slides has exactly that failure mode -
 * the skeleton would slide up, then the real page would slide up again behind it. The segment layout
 * mounts this once and the boundary and the page swap INSIDE it.
 *
 * ABOVE `md` IT IS NOT A PANEL AT ALL. `max-md:fixed` and the rest are all gated, so the desktop
 * page is an ordinary column in the shell with the shell's own band above it - the same responsive
 * container `/trades/[id]` uses, and for the same reason: rendering a phone tree and a desktop tree
 * would put the page in the document twice.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function DetailPanel({ children }: { children: ReactNode }) {
  /* FALSE FOR ONE FRAME, so there is a `translate-y-full` to transition FROM. The same rAF flip
     `ModalShell` and `useSheet` make; without it the panel is simply present and nothing moves.
     THERE IS NO EXIT. A route cannot animate away - by the time the trader has pressed Back the
     next page is already being rendered by the router, and holding this one to travel would mean
     holding the navigation. `TradeSheet` gets an exit because it is client state over a page that
     never left; this is a page. */
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className={cn(
        /* `bg-bg`, NOT `bg-surface`. This panel holds a page - a chart card, a tape card, tables -
           and those are objects ON a ground. The /accounts sheets are `bg-surface` because their
           content sits directly on the panel. */
        'bg-bg mx-auto w-full max-md:fixed max-md:inset-0 max-md:z-[60] max-md:flex max-md:flex-col',
        /* `.sheet-transition` UNPREFIXED, because a Tailwind VARIANT cannot modify a hand-written
           class - `max-md:sheet-transition` compiles to nothing at all, silently, which this
           codebase has been caught by twice. Harmless above `md`: `translate` is never set there,
           so there is nothing for the transition to act on. */
        'sheet-transition',
        !open && 'max-md:translate-y-full'
      )}
      data-open={open}
    >
      {children}
    </div>
  );
}

/* THE SCROLLING BODY INSIDE THE PANEL. Separate from the header, which must not scroll away.
 *
 * `min-h-0` is what lets a flex child actually shrink; without it this grows to its content and the
 * bar above scrolls off with it. Above `md` it is a plain page column and the shell's own `<main>`
 * does the scrolling, which is why every class here is gated.
 *
 * NO `px-4` BELOW `md`. A phone screen is FULL BLEED and its children own their insets - the call
 * `/trades/[id]` made after measuring content starting at x=32 in a 358px box against the rows it
 * was drilled from at x=16. The cards inside reach the edges with `max-md:-mx-4`, so the column's
 * own gutter is what they are cancelling.
 */
export function DetailPanelBody({ children }: { children: ReactNode }) {
  return (
    <div className="scroll-thin max-md:min-h-0 max-md:flex-1 max-md:overflow-y-auto max-md:px-4 max-md:pb-8">
      {children}
    </div>
  );
}
