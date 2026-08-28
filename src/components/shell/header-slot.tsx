'use client';

/* Lets a page put its own controls in the SHELL's header band. Ported from `run-trading@v2`
 * (2026-08-17, S5c).
 *
 * WHY THIS EXISTS, and it is the bug this build had re-created. One 64px band should carry the
 * page's identity AND its controls. Without a way for a page to reach that band, a page needing a
 * title and controls has to build a SECOND band underneath it — which is exactly what `PageHeader`
 * did here, leaving `/trades` with a near-empty strip carrying one theme toggle above a strip
 * carrying the title and the filters. v2 shipped that shape once and Luke named it (2026-07-29:
 * "the sessions header is the good morning header"). The band is the page's, so the page has to be
 * able to reach it.
 *
 * A PORTAL, NOT CONTEXT. Context would mean the shell holding page-owned React nodes in state and
 * the page writing to that state in an effect — a store whose only reader is one element, plus a
 * dependency-identity trap, since a JSX child is a new object every render and a naive
 * `useEffect(..., [node])` re-registers forever. A portal keeps the controls in the PAGE's tree,
 * where their state and handlers already live, and only relocates where they paint.
 *
 * The host div does not exist until the shell has mounted, so the first client render finds nothing.
 * That used to cost a visible frame; it is now resolved in a LAYOUT effect, before paint — see the
 * note on the alias below, and the flash it was hiding. THE TITLE DELIBERATELY DOES NOT COME THROUGH
 * HERE — the shell derives it from the route synchronously, so the thing that names the screen is
 * not a portal's problem at all.
 */

import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

/* BEFORE THE PAINT, NOT AFTER IT (2026-08-27), and the one-frame cost this file's header describes
 * is what changed hands. It was `useEffect`, which runs AFTER the browser has painted - and for the
 * band slot that frame is not cosmetic, because the band carries HEIGHT. Navigating to `/trades`
 * committed a page whose 57px search row was not in the document yet, so `<main>` painted one frame
 * 57px too high and then dropped. Luke saw it as "the entire screen flashes".
 *
 * A layout effect and its state update are flushed SYNCHRONOUSLY before paint, so the host is found
 * and the portal is filled in the same frame the page commits. There is nothing left to see.
 *
 * THE ALIAS IS FOR THE SERVER, not for taste: `useLayoutEffect` has no meaning during SSR and React
 * warns about it, so the server takes `useEffect` - which never runs there either. Same behaviour,
 * no warning. This is the standard isomorphic form; it is picked once at module scope, so the hook
 * called at the call site is unconditional.
 */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** The empty div the shell renders on the right of its header band. */
export const HEADER_SLOT_ID = 'page-header-slot';

/* And the one on the LEFT, where the route title normally goes. For pages that are not nav
 * destinations: the shell derives its title from NAV by pathname, so a route outside NAV renders
 * that side empty. What belongs there is usually not a title anyway but a TRAIL — the way back plus
 * which row you drilled into — and that is page knowledge, not shell knowledge. */
export const HEADER_TITLE_SLOT_ID = 'page-header-title-slot';

/* A FULL-WIDTH BAND BETWEEN THE HEADER AND THE SCROLLER, for page chrome that must not scroll and
 * must not be scrolled BEHIND (2026-08-24, Luke: "the scrollbar needs to stop at the bottom of the
 * header and stop at the top of the footer ... fyi the search bar is part of the mobile header").
 *
 * WHY A SLOT AND NOT `sticky`. The phone's search row was `sticky top-0` INSIDE `<main>`, and a
 * sticky element is a child of its scroller by definition - so the scrollbar ran the full height of
 * the pane and behind it. Sticky makes a thing LOOK like header; only leaving the scroller makes it
 * one. The row does not scroll, so it does not belong to the scrolling box.
 *
 * It is the page's content and the shell's position, which is the same split `HEADER_SLOT_ID`
 * already makes for the band's controls. */
export const HEADER_BAND_SLOT_ID = 'page-header-band-slot';

export function HeaderSlot({
  children,
  slot = 'controls',
  hostId,
}: {
  children: ReactNode;
  slot?: 'controls' | 'title' | 'band';
  /* A HOST THAT IS NOT THE SHELL'S (2026-08-28). `/accounts/details` on a phone is a full-screen
     panel that COVERS the shell's band, so a control portalled into that band would be invisible
     and still focusable. The panel publishes its own bar as a host and passes its id here.
     It wins over `slot`, which is the shell's three named positions. */
  hostId?: string;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  // On mount only. The host is the shell's, and the shell outlives every page, so re-querying per
  // render would be work that can only ever return the same node.
  useIsomorphicLayoutEffect(() => {
    const id =
      hostId ??
      (slot === 'title'
        ? HEADER_TITLE_SLOT_ID
        : slot === 'band'
          ? HEADER_BAND_SLOT_ID
          : HEADER_SLOT_ID);
    setHost(document.getElementById(id));
  }, [slot, hostId]);

  return host ? createPortal(children, host) : null;
}

/* THE SECONDARY CONTROL THAT GOES IN THE BAND: 36px tall, a hairline, a hair of lift. This is
 * `lift-press`'s geometry with a label instead of a mark, which is the same control class
 * `IconButton` already is — that primitive was measured off the same reference.
 *
 * SHARED, NOT PER-PAGE. Two copies of one control is how two headers drift, and this band is about
 * to be used by Trades, Accounts and whatever S6 adds.
 *
 * NOT `Button variant="secondary"`. That is the page's CTA class: taller, its own ground, and it
 * competes with a title sitting beside it. A header control is chrome, and v2's markup is explicit
 * about the distinction — measured off the reference's own header band.
 *
 * `gap-1.5` applies whether or not a child mark is present, because a lone label has nothing to sit
 * beside, so one class covers both shapes and no call site has to know which it is. */
export function HeaderControl({ children, className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        /* `text-body`, NOT `text-small` (2026-08-24). Measured on the reference: its toolbar
           buttons - Search, Filters, Sort, Columns, Edit multiple - are 14px/500 at `h-9`, the
           SAME size as its muted body copy, not a step below it. This chip was 12px, which made
           the page's chrome smaller than the content it controls and put a size step in the scale
           that the reference does not have. `h-9` already matched; only the type was out.
           It also ends a visible inconsistency: the header's plain-text `Clear` is `text-body`, so
           the undo sat a size ABOVE the three chips it belongs beside. */
        'lift-press lift-rest text-body text-text flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] px-3 font-medium',
        className
      )}
    >
      {children}
    </button>
  );
}
