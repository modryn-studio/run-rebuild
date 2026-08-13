'use client';

/* The app shell: sidebar + content pane. Every signed-in page sits inside this.
 *
 * IT IS A LAYOUT, NOT A PER-PAGE WRAPPER, and that is load-bearing. Next remounts the page
 * subtree on navigation but PRESERVES the layout. With the shell inside each page, every nav
 * click would unmount and rebuild the sidebar: collapse state re-read from localStorage, the
 * panel visibly re-animating, a flicker on every move. In a layout it mounts once and only the
 * content swaps.
 *
 * COLLAPSE IS TWO BEHAVIOURS, split at 768px:
 *   Desktop — the sidebar is in normal flow and PUSHES the content. Collapsing animates its
 *             width to 0 and hides it completely. No icon rail: a rail keeps taking horizontal
 *             space while giving nothing back, and pops open on an accidental mouse-over.
 *   Mobile  — the sidebar NEVER pushes. Fixed, slides over the content with a scrim behind it,
 *             closes on scrim tap, Escape, or navigation. At 375px a 224px inline panel leaves
 *             151px of content, which is not a layout, it is a squeeze.
 *
 * TWO CONTROLS, ONE DIRECTION EACH. Collapse lives in the sidebar's own header row; Open floats
 * at the content pane's top-left and exists only while the sidebar is hidden. Each button is
 * adjacent to the thing it acts on IN THE STATE IT APPEARS IN — which is what a single fixed
 * toggle gives up: it holds one position, so from the collapsed state it sits diagonally
 * opposite the panel it is about to open. `[` toggles from either state.
 *
 * MOBILE IS DELIBERATELY UNFINISHED (Luke, 2026-08-13). Desktop is being built first and mobile
 * gets its own pass later, so what is here is "not broken", not "designed": the overlay keeps a
 * phone usable without pretending the layout has been thought through at that width. Do not read
 * the mobile behaviour as a settled decision.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Wallet, Receipt, Sparkles, Settings, PanelLeft, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { site } from '@/config/site';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { DetectTimezone } from '@/components/detect-timezone';
import {
  SHELL_HEADER_H,
  SIDEBAR_W,
  SIDEBAR_COLLAPSE_KEY,
  SIDEBAR_OVERLAY_QUERY,
} from '@/lib/shell';

/* The four rows the spec fixes, in the order of the questions a trader asks: what happens next
 * (Today), what I have (Accounts), what happened (Trades), what it means (Read). ONE LEVEL, four
 * rows — sub-navigation lives in the page header, never here.
 *
 * THESE ROUTES DO NOT EXIST YET and that is deliberate (Luke, 2026-08-13). Each lands with its
 * own slice — S8, S6, S5, S7 — and until then the row 404s rather than pointing at a stub page
 * that promises a surface. The alternative, shipping four placeholder pages, was rejected: a
 * stub is a screen somebody has to remember to delete.
 *
 * Safe to declare inside this `'use client'` module because nothing outside it imports NAV. The
 * constants that DO cross the boundary live in `@/lib/shell`, which has no directive — see the
 * long note in that file before moving anything.
 */
const NAV = [
  { label: 'Today', href: '/today', Icon: LayoutDashboard },
  { label: 'Accounts', href: '/accounts', Icon: Wallet },
  { label: 'Trades', href: '/trades', Icon: Receipt },
  { label: 'Read', href: '/read', Icon: Sparkles },
] as const;

const isOverlay = () =>
  typeof window !== 'undefined' && window.matchMedia(SIDEBAR_OVERLAY_QUERY).matches;

export function AppShell({ children }: { children: React.ReactNode }) {
  // Starts collapsed and corrects on mount. The server cannot know the stored preference, so
  // rendering it open and closing it would be a visible flash on every full page load; the
  // reverse only ever opens a panel, which reads as the app arriving rather than as a glitch.
  const [collapsed, setCollapsed] = useState(true);
  const [ready, setReady] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSE_KEY);
    // On desktop, default to OPEN when nothing is stored — the nav is the app's spine and a
    // first-time visitor should see it. On mobile it stays closed regardless.
    setCollapsed(stored !== null ? stored === '1' : isOverlay());
    setReady(true);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  // Close on navigation, but only in overlay mode: on desktop the sidebar is the app's spine and
  // collapsing it every time you clicked a row would be hostile.
  useEffect(() => {
    if (isOverlay()) setCollapsed(true);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Never steal the bracket from someone typing. `[` is a literal character in any field.
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === '[' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        toggle();
      }
      if (e.key === 'Escape' && isOverlay()) setCollapsed(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return (
    <div className="bg-bg flex min-h-dvh">
      {/* Reports the browser's zone once per tab. Lives here rather than on a page so it covers
          every signed-in surface — the relocation S3a's note promised. */}
      <DetectTimezone />

      {/* The scrim exists only in overlay mode, and only while open. `md:hidden` keeps it out of
          the desktop tree entirely rather than relying on opacity. */}
      {!collapsed && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={toggle}
          className="bg-ink/20 fixed inset-0 z-30 md:hidden"
        />
      )}

      <aside
        className={cn(
          'bg-bg z-40 shrink-0 overflow-hidden',
          // Only animate once the stored preference has been applied, or the correction itself
          // animates on every load.
          ready && 'transition-[width] duration-200 ease-out',
          collapsed ? 'w-0' : SIDEBAR_W,
          // Overlay below md: fixed, full height, never in flow.
          'max-md:fixed max-md:inset-y-0 max-md:left-0',
        )}
      >
        {/* Pinned width so the contents do not reflow while the track closes. */}
        <div className={cn('flex h-full flex-col', SIDEBAR_W)}>
          <div
            className="flex shrink-0 items-center justify-between px-4"
            style={{ height: SHELL_HEADER_H }}
          >
            <Link href="/" className="text-title font-serif">
              {site.name}
            </Link>
            <button
              type="button"
              onClick={toggle}
              aria-label="Collapse navigation"
              title="Collapse navigation  ["
              className="text-muted hover:text-ink hover:bg-surface-2 focus-visible:ring-accent grid size-11 place-items-center rounded-sm focus-visible:ring-2 focus-visible:outline-none md:size-8"
            >
              <X className="size-4 md:hidden" />
              <PanelLeft className="hidden size-4 md:block" />
            </button>
          </div>

          <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
            {NAV.map(({ label, href, Icon }) => (
              <NavRow key={href} href={href} label={label} Icon={Icon} pathname={pathname} />
            ))}
          </nav>

          <div className="border-border shrink-0 border-t px-3 py-2">
            <NavRow href="/settings" label="Settings" Icon={Settings} pathname={pathname} />
          </div>
        </div>
      </aside>

      {/* min-w-0 is what lets the pane shrink instead of forcing the flex row wider than the
          viewport — without it a wide table pushes the whole shell into a horizontal scroll. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className="flex shrink-0 items-center gap-2 px-4"
          style={{ height: SHELL_HEADER_H }}
        >
          {/* The Open control: only while the sidebar is hidden, and adjacent to where it will
              appear. Same 64px band as the sidebar's own header row. */}
          {collapsed && (
            <button
              type="button"
              onClick={toggle}
              aria-label="Open navigation"
              title="Open navigation  ["
              className="text-muted hover:text-ink hover:bg-surface-2 focus-visible:ring-accent grid size-11 place-items-center rounded-sm focus-visible:ring-2 focus-visible:outline-none md:size-8"
            >
              <PanelLeft className="size-4" />
            </button>
          )}
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        <main className="min-w-0 flex-1 pb-12">{children}</main>
      </div>
    </div>
  );
}

/* Inactive rows are `muted`; the active row alone is full ink on a recessed ground.
 *
 * `design-system.md` flags this as the one thing to re-examine rather than adopt: the rule was
 * tuned against a sidebar with a dozen rows, and four rows in a 224px column is a much emptier
 * panel. Left as specified so the review gate has the real thing to look at.
 */
function NavRow({
  href,
  label,
  Icon,
  pathname,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  pathname: string;
}) {
  // Prefix match so /trades/123 still lights the Trades row, but never let '/' match everything.
  const active = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'text-nav focus-visible:ring-accent flex min-h-11 items-center gap-3 rounded-sm px-3 focus-visible:ring-2 focus-visible:outline-none md:min-h-9',
        active ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink hover:bg-surface-2',
      )}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </Link>
  );
}
