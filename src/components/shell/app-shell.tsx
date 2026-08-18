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
import { cn } from '@/lib/cn';
import { Icon, type IconName } from '@/components/ui/icon';
import { site } from '@/config/site';
import { IconButton } from '@/components/ui/icon-button';
import { Tooltip } from '@/components/ui/tooltip';
import { Wordmark } from '@/components/ui/wordmark';
import { AccountMenu } from '@/components/shell/account-menu';
import { DetectTimezone } from '@/components/detect-timezone';
import { HEADER_SLOT_ID, HEADER_TITLE_SLOT_ID } from '@/components/shell/header-slot';
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
  { label: 'Today', href: '/today', icon: 'today' },
  { label: 'Accounts', href: '/accounts', icon: 'accounts' },
  { label: 'Trades', href: '/trades', icon: 'trades' },
  { label: 'Read', href: '/read', icon: 'read' },
] as const;

/* WHAT NAMES THE SCREEN, from the route rather than from the page.
 *
 * Longest match wins, so a future `/trades/<id>` still reads "Trades" rather than falling through
 * to nothing. A route outside NAV returns null and the band's left side stays empty for
 * `HEADER_TITLE_SLOT_ID` to fill — that is the drill-down case, where what belongs there is a trail
 * and not a title. */
function routeTitle(pathname: string): string | null {
  const hit = [...NAV]
    .filter((n) => pathname === n.href || pathname.startsWith(`${n.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return hit?.label ?? null;
}

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
    /* h-dvh + overflow-hidden, NOT min-h-dvh. THE PANE SCROLLS, NOT THE DOCUMENT, and that is a
       structural decision rather than a scrollbar preference:
         - the sidebar and the header stay put instead of scrolling away with the content
         - the scrollbar belongs to the pane, so `.scroll-thin` governs it. Let the document
           scroll and you get the platform's 15px grey slab, which reads as chrome sitting beside
           a surface whose whole register is content on paper with nothing framing it
         - `loading.tsx` can then replace only the pane, which is what makes the sidebar stay
           interactive while a route waits
       Corrected 2026-08-13 after the rack's bar did not match the previous build's; the cause was
       here, not in the CSS. */
    <div className="bg-bg flex h-dvh overflow-hidden">
      {/* Reports the browser's zone once per tab. Lives here rather than on a page so it covers
          every signed-in surface — the relocation S3a's note promised. */}
      <DetectTimezone />

      {/* The scrim exists only in overlay mode, and only while open. `md:hidden` keeps it out of
          the desktop tree entirely rather than relying on opacity.
          `--scrim-nav` is the system's own token for exactly this — the underlay for a panel that
          slides OVER the page rather than pushing it — and it is a separate literal per mode, not
          a tint of the modal scrim. Applied as an inline style because it lives outside a Tailwind
          colour namespace, so there is no `bg-*` utility for it. */}
      {!collapsed && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={toggle}
          style={{ background: 'var(--scrim-nav)' }}
          className="fixed inset-0 z-30 md:hidden"
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
            <Link href="/">
              <Wordmark />
            </Link>
            {/* THE PRIMITIVES THIS REPO ALREADY OWNS, which the shell was hand-rolling past.
                `icon-button.tsx`'s own note settles the shape and names this exact control: "A
                CIRCLE SINCE 2026-08-01, and it is a rule rather than a preference: shape follows the
                control's CONTENT... It also settles what Luke asked: the sidebar toggle now matches
                the wordmark beside it." It did not — the shell drew a `rounded-sm` rectangle with a
                flat hover fill, so the one control that rule was written for was the one control not
                obeying it.
                `Tooltip` for the same reason: a native `title` waits a second, is unstyled, and is
                the only hint in the product that is not the app's own raised object. Teaching the
                key is what that component exists for. */}
            <Tooltip label="Collapse" shortcut="[">
              <IconButton onClick={toggle} aria-label="Collapse navigation">
                {/* Two marks, one job. Below `md` the panel is a modal overlay and this is its
                    explicit dismiss, so it reads as a close; above it, it is a collapse. */}
                <Icon name="close" size={16} className="md:hidden" />
                <Icon name="collapse" size={16} className="hidden md:block" />
              </IconButton>
            </Tooltip>
          </div>

          {/* scroll-thin: the platform default is a 15px grey slab that reads as chrome beside
              the content, and this pane is content on paper with nothing framing it. */}
          <nav className="scroll-thin flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
            {NAV.map(({ label, href, icon }) => (
              <NavRow key={href} href={href} label={label} icon={icon} pathname={pathname} />
            ))}
          </nav>

          {/* `mt-auto`, no rule above it — matching both v2 and the Monarch reference, whose bottom
              account row carries no divider either. `AccountMenu` is where Settings, the theme
              toggle and Log out all live now; the persistent `/settings` row this replaced is gone,
              not hidden — porting the shape means porting where things live, not just how they look. */}
          <div className="mt-auto shrink-0 px-3 pb-3">
            <AccountMenu />
          </div>
        </div>
      </aside>

      {/* min-w-0 is what lets the pane shrink instead of forcing the flex row wider than the
          viewport — without it a wide table pushes the whole shell into a horizontal scroll. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ONE BAND, CARRYING THE PAGE'S IDENTITY AND ITS CONTROLS.
            It used to carry only the Open control and the theme toggle, which forced any page
            wanting a title to build a SECOND 64px band underneath — a near-empty strip above a real
            one. `header-slot.tsx` has the full argument and the quote that named it. */}
        <header
          className="relative flex shrink-0 items-center gap-2 px-4"
          style={{ height: SHELL_HEADER_H }}
        >
          {/* The Open control: only while the sidebar is hidden, and adjacent to where it will
              appear. Same 64px band as the sidebar's own header row. */}
          {collapsed && (
            <Tooltip label="Open" shortcut="[">
              <IconButton onClick={toggle} aria-label="Open navigation">
                {/* The collapse mark, mirrored: pointing right says "put this away", pointing left
                    says "bring it back", so one drawn mark describes both directions of one
                    action rather than the set gaining a second glyph for the reverse. */}
                <Icon name="collapse" size={16} className="rotate-180" />
              </IconButton>
            </Tooltip>
          )}

          {/* DERIVED FROM THE ROUTE, SYNCHRONOUSLY, and that is why the title does not come through
              the portal: the thing that names the screen must never be a frame late.
              CENTRED ON A PHONE, static from `sm`. A 375px band cannot hold a left title, the open
              control and two filters without the title winning space it does not need — centring it
              lets the controls keep the edges. `pointer-events-none` while centred so it cannot
              swallow a tap meant for a control underneath it. */}
          <h1 className="text-title text-text pointer-events-none absolute left-1/2 max-w-[50%] -translate-x-1/2 truncate font-medium sm:pointer-events-auto sm:static sm:max-w-none sm:min-w-0 sm:translate-x-0">
            {routeTitle(pathname)}
          </h1>
          {/* The other end of the band, for routes outside NAV: a trail rather than a title, and
              that is page knowledge. Empty and zero-width until a page portals into it. */}
          <div id={HEADER_TITLE_SLOT_ID} className="flex min-w-0 items-center" />

          {/* NO THEME TOGGLE HERE. v2 carries exactly one, in `AccountMenu` at the foot of the
              sidebar, verified against Monarch's own account menu before the move — its "Dark mode"
              row is the same control in the same place. A second copy in the header band was this
              build's own addition; `/login` and `/status` keep theirs, since neither has this shell
              or an account menu to hold it. */}
          <div id={HEADER_SLOT_ID} className="ml-auto flex shrink-0 items-center gap-2" />
        </header>

        {/* min-h-0 is what lets a flex child actually shrink and scroll; without it the pane
            grows to its content and the document scrolls again. */}
        <main className="scroll-thin min-h-0 min-w-0 flex-1 overflow-y-auto pb-12">{children}</main>
      </div>
    </div>
  );
}

/* EVERY ROW IS FULL INK AT 400. The active row is distinguished by its GROUND ALONE.
 *
 * Settled 2026-08-13 (Luke) after both candidates were rendered in the rack and the reference was
 * measured live rather than assumed. What the measurement found is that the previous build had
 * NOT copied the reference here, and this build inherited the divergence believing it had:
 *
 *   reference       inactive 16/400 FULL INK    active 16/400 + surface-2
 *   previous build  inactive 16/500 muted       active 16/500 + surface-2
 *
 * `design-system.md` had already flagged the muted/500 rule as the one thing to re-examine rather
 * than adopt, because it was tuned against a twelve-row sidebar and Run has four. Four rows do not
 * need ink, weight AND ground all saying the same thing; the ground says it on its own, and the
 * sidebar stops competing with the content it points at.
 *
 * HOVER STILL MOVES, because a row has to answer the pointer — it takes the ground, not the ink.
 */
function NavRow({
  href,
  label,
  icon,
  pathname,
}: {
  href: string;
  label: string;
  icon: IconName;
  pathname: string;
}) {
  // Prefix match so /trades/123 still lights the Trades row, but never let '/' match everything.
  const active = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'text-nav text-text focus-visible:ring-accent flex min-h-11 items-center gap-3 rounded-sm px-3 font-normal focus-visible:ring-2 focus-visible:outline-none md:min-h-9',
        active ? 'bg-surface-2' : 'hover:bg-surface-2',
      )}
    >
      <Icon name={icon} className="shrink-0" />
      {label}
    </Link>
  );
}
