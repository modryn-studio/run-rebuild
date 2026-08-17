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
 * The one-frame cost: the host div does not exist until the shell has mounted, so the first client
 * render finds nothing and paints no controls. It is one frame, on controls that are inert until
 * hydrated, and it is the honest price of not inventing a store. THE TITLE DELIBERATELY DOES NOT
 * COME THROUGH HERE — the shell derives it from the route synchronously, so the thing that names
 * the screen is never a frame late.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

/** The empty div the shell renders on the right of its header band. */
export const HEADER_SLOT_ID = 'page-header-slot';

/* And the one on the LEFT, where the route title normally goes. For pages that are not nav
 * destinations: the shell derives its title from NAV by pathname, so a route outside NAV renders
 * that side empty. What belongs there is usually not a title anyway but a TRAIL — the way back plus
 * which row you drilled into — and that is page knowledge, not shell knowledge. */
export const HEADER_TITLE_SLOT_ID = 'page-header-title-slot';

export function HeaderSlot({
  children,
  slot = 'controls',
}: {
  children: ReactNode;
  slot?: 'controls' | 'title';
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  // On mount only. The host is the shell's, and the shell outlives every page, so re-querying per
  // render would be work that can only ever return the same node.
  useEffect(
    () => setHost(document.getElementById(slot === 'title' ? HEADER_TITLE_SLOT_ID : HEADER_SLOT_ID)),
    [slot]
  );

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
        'lift-press lift-rest text-small text-text flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] px-3 font-medium',
        className
      )}
    >
      {children}
    </button>
  );
}
