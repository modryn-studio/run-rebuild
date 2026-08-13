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
import { PanelRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PAGE_COLUMN, RAIL_W } from '@/lib/shell';

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

  useEffect(() => {
    setCollapsed(localStorage.getItem(RAIL_COLLAPSE_KEY) === '1');
    setReady(true);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(RAIL_COLLAPSE_KEY, next ? '1' : '0');
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
    <div className={cn(PAGE_COLUMN, 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]')}>
      <div className="min-w-0">{children}</div>

      <aside
        className={cn(
          'overflow-hidden',
          ready && 'lg:transition-[width] lg:duration-200 lg:ease-out',
          // cn(), never a template string: `lg:w-76` and `lg:w-0` are the same utility group
          // under the same modifier, so a raw template leaves BOTH in the attribute and
          // Tailwind's sheet order decides — which puts w-76 last and the rail never closes.
          collapsed ? 'lg:w-0' : RAIL_W,
        )}
      >
        <div className={cn('w-full', RAIL_W)}>{rail}</div>
      </aside>

      {/* Reopen control, only while hidden and only where hiding is possible. */}
      {collapsed && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Open summary"
          title="Open summary  ]"
          className="text-muted hover:text-ink hover:bg-surface-2 focus-visible:ring-accent fixed right-4 bottom-4 z-20 hidden size-11 place-items-center rounded-sm focus-visible:ring-2 focus-visible:outline-none lg:grid"
        >
          <PanelRight className="size-4" />
        </button>
      )}
    </div>
  );
}
