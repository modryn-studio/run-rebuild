'use client';

/* The 304px summary rail: digests whatever the page is currently showing.
 *
 * IT COLLAPSES; IT DOES NOT UNMOUNT. Conditionally rendering it made a one-way door on the
 * previous build — the control that reopens it lived on the thing being removed, so once closed
 * there was no visible way back. It stays mounted and animates to zero width instead.
 *
 * The track follows the child's own width via `lg:grid-cols-[minmax(0,1fr)_auto]`, and an inner
 * element pinned to `lg:w-76` stops the contents reflowing while the track closes.
 *
 * BELOW `lg` IT IS A STACKED BLOCK THAT NEVER COLLAPSES. "A panel the full width of the screen is
 * not a rail, and collapsing it would just be hiding content with no visible way back."
 *
 * `]` toggles it — the bracket that pairs with the sidebar's `[`.
 */

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Tooltip } from '@/components/ui/tooltip';
import { PAGE_COLUMN, RAIL_W } from '@/lib/shell';
import { StickyRail } from '@/components/shell/sticky-rail';

const RAIL_COLLAPSE_KEY = 'run_rail_collapsed';

export function WithSummaryRail({
  rail,
  children,
}: {
  /** The digest itself. Rendered by the page, since only the page knows the filtered set. */
  rail: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  // Drives `inert` only. Below lg the rail is a stacked block that is never collapsed, so marking
  // it inert there would hide content nobody hid.
  const [lgUp, setLgUp] = useState(false);

  /* THE STORED WIDTH HAS TO LAND BEFORE THE TRANSITION DOES, and setting both in one effect does
   * the opposite. A transition that is present when a value changes is a transition that RUNS, so
   * the class and the width arriving in one commit made the rail visibly glide shut on every load
   * for anyone who had closed it — restored correctly and wrong at the same time, which only shows
   * on a real reload. `run-trading@v2` measured this twice, and its second attempt (deferring by
   * `requestAnimationFrame`) failed too, because rAF is a timing guess and React schedules its own
   * re-render from an effect on its own terms.
   *
   * So this does not guess. It runs after every commit until settled and asks the only question
   * that matters: does what is on screen already agree with storage? Until it does, apply the width
   * and return WITHOUT arming the transition. Once it does, arm it — by which point there is no
   * pending change left to animate. Bounded by the `ready` guard: at most two passes, after which
   * the first line returns immediately on every render including every later toggle. */
  useEffect(() => {
    if (ready) return;
    let stored = false;
    try {
      stored = localStorage.getItem(RAIL_COLLAPSE_KEY) === '1';
    } catch {
      // Private mode or blocked storage. The default stands rather than the component throwing.
    }
    if (collapsed !== stored) {
      setCollapsed(stored);
      return;
    }
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [ready, collapsed]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setLgUp(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(RAIL_COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        // The preference is lost, the toggle still works. Never let storage break the control.
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === ']' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return (
    <div className={cn(PAGE_COLUMN, 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]')}>
      <div className="min-w-0">{children}</div>

      {/* `StickyRail` OWNS THE PIN, and it measures rather than assuming. This carried a blanket
          `lg:sticky lg:top-0`, which is the version that hides the bottom of a rail taller than the
          viewport — see that file for the measurement. It also owns `order-last` below `lg`, where
          the tape is the subject and the summary is a comment on it. */}
      <StickyRail
        className={cn(
          'overflow-hidden',
          /* `panel-transition` so the rail and the sidebar are ONE declaration rather than two that
             currently agree — globals.css names this class after exactly that, since the rail was
             the second panel it had to cover. A hand-rolled `lg:transition-[width] duration-200`
             here ran the two panels framing the work at different speeds on the same curve nobody
             chose. */
          ready && 'panel-transition',
          // cn(), never a template string: `lg:w-76` and `lg:w-0` are the same utility group
          // under the same modifier, so a raw template leaves BOTH in the attribute and
          // Tailwind's sheet order decides — which puts w-76 last and the rail never closes.
          collapsed ? 'lg:w-0' : RAIL_W,
        )}
        /* A collapsed rail is 0px wide and its contents are still in the tab order and still read
           aloud — `overflow-hidden` hides pixels, not the accessibility tree. Only above `lg`,
           where collapsing is possible at all. */
        inert={lgUp && collapsed}
      >
        <div className={cn('w-full', RAIL_W)}>{rail}</div>
      </StickyRail>

      {/* Reopen control, only while hidden and only where hiding is possible.
          `IconButton` in a POSITIONED WRAPPER rather than a positioned IconButton: `.lift-press`
          sets `position: relative` unlayered to anchor its 44px hit expander, so a `fixed` passed
          through `className` resolves back to `relative` and the control lands somewhere in the
          middle of the page — silently, with no error and no type complaint. `icon-button.tsx`
          states this; it cost a session once already. */}
      {collapsed && (
        <div className="fixed right-4 bottom-4 z-20 hidden lg:block">
          <Tooltip label="Show summary" shortcut="]" align="end">
            <IconButton onClick={toggle} aria-label="Open summary">
              <Icon name="collapse" size={18} className="rotate-180" />
            </IconButton>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
