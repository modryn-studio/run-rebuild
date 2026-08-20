'use client';

/* Sidebar + content pane for the sink, following the shell in modryn-builds/run-trading@v2
 * (src/components/views/app/app-shell.tsx). Two behaviours, not one, split at md (768px):
 *
 *   - Desktop: the sidebar is in normal flow and PUSHES the content. Collapsing animates its width
 *     to 0 and hides it completely rather than leaving an icon rail. A rail keeps taking horizontal
 *     space and pops open on accidental mouse-over; full hide gives the content the whole viewport.
 *   - Mobile: the sidebar NEVER pushes. It is fixed, slides in over the content with a scrim behind
 *     it, and closes on scrim tap, Escape, or picking a section.
 *
 * TWO controls, one direction each. Collapse lives in the sidebar's own header row; Open floats at
 * the content pane's top-left and exists only while the sidebar is hidden. Each button is adjacent
 * to the thing it acts on in the state it appears in. `[` toggles from either state, the same key
 * claude.ai uses.
 *
 * EVERY ROW IS FULL INK; RANK IS THE GROUND, ALONE. And the hovered row takes the SAME ground as
 * the active one (`selected`) rather than a quieter one of its own - Luke's call, simpler, with the
 * cost named at the row itself: while the pointer is in the nav two rows match, and the pointer is
 * what disambiguates. (An earlier version of this file demoted inactive rows to `muted` and gave
 * hover its own ground. Both are gone; if you are reading a comment that says otherwise, it is this
 * one that is current.)
 *
 * NO LITERAL VALUES, same as every other file under this route. The scrim reads `--scrim-nav`,
 * the system's own token for a panel that slides OVER the page - see the note at the element.
 *
 * DEFAULT OPEN ON DESKTOP, unlike run-trading, which defaults collapsed because it is a working app
 * where the content is the point. This is a reference page: it is navigated, so the section list
 * should be there on arrival. Mobile still starts closed.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
/* SIZED AND WEIGHTED EXPLICITLY, because Run has no `LucideProvider` (2026-08-20). In the
   boilerplate these are bare and inherit 18px/1.75 from the provider in its root layout; here a
   bare lucide mark falls back to the library's stock 24px/stroke-2, which is two-thirds the width
   of the 36px chip holding it and visibly heavier than every hand-drawn mark beside it. These two
   stay lucide rather than moving to `MARKS`: they are the RACK's own furniture, not product UI. */
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { ICON_SIZE, ICON_STROKE } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/icon-button';
import { AccountMenu } from '@/components/shell/account-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { GROUPS, NAV } from '../sections';

const COLLAPSE_KEY = 'sink_sidebar_collapsed';
const MOBILE = '(max-width: 767px)';

const isOverlay = () => typeof window !== 'undefined' && window.matchMedia(MOBILE).matches;

export function SinkShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  // Transitions stay off until the stored preference is known, so the panel does not visibly swing
  // into place on first paint.
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(NAV[0].id);
  const scroller = useRef<HTMLElement>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(COLLAPSE_KEY);
    } catch {
      // Private mode / blocked storage.
    }
    // The stored value is a DESKTOP preference. On mobile the panel is an overlay, so honouring
    // "open" would cover the whole page the instant it loads. Always start closed there.
    setCollapsed(isOverlay() ? true : stored === '1');
    setReady(true);
  }, []);

  /* WHICH SECTION AM I IN. run-trading reads the active row off usePathname, because its rows are
     routes. These are anchors on one page, so the equivalent is a scroll spy, and without one the
     sidebar is a list of links that never tells you where you are.

     MEASURED ON SCROLL, NOT VIA IntersectionObserver. The observer version was wrong in a way that
     showed up the moment you used it: it tracked a SET of intersecting sections and picked the
     first in document order, so clicking "Icons" scrolled to #icons while the still-intersecting
     Motion section above it kept winning the pick - the sidebar highlighted the section you had
     just left. "First intersecting" is simply not the same question as "which one am I reading".

     The right question is: which section's top has most recently crossed a line near the top of
     the pane. Sections are in document order, so that is the LAST one whose top is at or above the
     line, and once one falls below it every later one does too - hence the break. */
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;

    let frame = 0;
    const pick = () => {
      frame = 0;
      // The line a heading has to cross to count as current, in viewport coordinates.
      const line = root.getBoundingClientRect().top + 96;

      let current = NAV[0].id;
      for (const entry of NAV) {
        const el = root.querySelector<HTMLElement>(`#${CSS.escape(entry.id)}`);
        if (!el) continue;
        if (el.getBoundingClientRect().top > line) break;
        current = entry.id;
      }

      /* AT THE BOTTOM, THE LAST SECTION WINS regardless. A short final section can never push its
         own heading above the line - there is no scroll left to give - so without this the last
         nav row is unreachable and the second-to-last stays lit while you read the end of the page. */
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2) {
        current = NAV[NAV.length - 1].id;
      }

      setActive(current);
    };

    // rAF-coalesced: scroll fires far faster than paint, and this reads layout.
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(pick);
    };

    pick();
    root.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      root.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Escape closes the overlay. Desktop is left alone: there, collapsing is a deliberate layout
  // preference, not a dismissal, so Escape should not undo it.
  useEffect(() => {
    if (collapsed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOverlay()) setCollapsed(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [collapsed]);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        // Private mode / blocked storage: the panel still toggles, it just will not be remembered.
      }
      return next;
    });
  }, []);

  /* `[` toggles the sidebar. Guarded on the event target, because `[` is a PRINTABLE character:
     unguarded, typing a bracket into any field on this page (and this page is mostly fields) would
     lose the keystroke and move the layout instead. Escape above needs no such guard, since Escape
     in a text field should still dismiss the overlay.
     Modifiers pass straight through: Cmd/Alt+[ is browser history navigation, and taking it would
     be the shortcut stealing something the user already owns. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      toggle();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggle]);

  const closeIfOverlay = () => {
    if (isOverlay()) setCollapsed(true);
  };

  /* overflow-CLIP, NOT overflow-hidden, and that one word is the whole fix for a real bug.
     `overflow: hidden` still makes a box a SCROLL CONTAINER - it only removes the user's ability
     to scroll it by hand. A native #hash jump scrolls every scroll-container ancestor of its
     target, not just the nearest, so clicking a sidebar link scrolled <main> correctly AND scrolled
     this root by 64px, carrying the content header off the top of the viewport. Measured: the
     root's scrollTop went 0 -> 64 on every click.
     `overflow: clip` is not a scroll container at all, so there is nothing for the browser to
     scroll and the header cannot move - on click, on a direct load at a #hash, or by any other
     route. That is why the nav rows below are plain anchors again rather than JS-intercepted
     clicks: with the container fixed, the native behaviour is correct.
     (run-rebuild's shell never hits this because its sidebar navigates between ROUTES with
     next/link. Hash anchors are this page's own shape, so this is this page's own bug.) */
  return (
    <div className="flex h-dvh overflow-clip">
      {/* Scrim: mobile only. Always mounted rather than conditionally rendered, so it fades both in
          AND out in step with the panel's slide. A mount/unmount scrim pops on close even once the
          slide itself is smooth.
          `--scrim-nav`, NOT `bg-bg/60` AND NO BLUR (2026-08-20). The boilerplate washes the page's
          own ground at 60% and blurs behind it, which needs no token - correct for a repo with no
          scrim in its palette. This one HAS the token, and it is the system's own answer to exactly
          this question: the underlay for a panel that slides OVER the page rather than pushing it,
          a separate literal per mode rather than a tint of the modal scrim. Run's real shell uses
          it, `run-trading@v2` uses the same treatment, and neither blurs - so a rack that blurred
          was demonstrating a mobile sidebar the product does not have.
          An inline style because the token lives outside a Tailwind colour namespace, so there is
          no `bg-*` utility for it. */}
      <div
        aria-hidden
        onClick={toggle}
        style={{ background: 'var(--scrim-nav)' }}
        className={cn(
          // ease-out, opted into: the scrim ENTERS and LEAVES, and the project default is `ease`,
          // which is for a state change on something already in place. Duration stays the 200ms
          // default (globals.css @theme).
          'fixed inset-0 z-40 transition-opacity ease-out md:hidden',
          collapsed ? 'pointer-events-none opacity-0' : 'opacity-100'
        )}
      />

      {/* .panel-transition (globals.css), NOT transition-all. Two reasons it is a shared class
          rather than utilities here: any second panel in a project has to move at exactly this
          speed, and the only way two panels reliably match is by being the same declaration; and
          it names `translate` rather than `transform`, which Tailwind v4's -translate-x-* actually
          sets - a transition listing `transform` animates nothing and the panel snaps.
          Applied only once `ready`, or the correction from the stored preference animates on
          every single load. */}
      <aside
        id="sink-sidebar"
        aria-label="Sections"
        className={cn(
          /* NO RIGHT BORDER. The sidebar shares the page ground, so a rule between it and the
             content would be drawing an edge around something that is not a separate object -
             the shell is one surface with a nav rail in it, not two panels stitched together. */
          'bg-bg fixed inset-y-0 left-0 z-50 w-56 shrink-0 overflow-hidden md:relative md:z-auto md:translate-x-0',
          ready && 'panel-transition',
          collapsed ? '-translate-x-full md:w-0' : 'translate-x-0 md:w-56'
        )}
      >
        {/* Fixed inner width so the contents do not reflow while the desktop panel animates shut. */}
        <div className="flex h-full w-56 flex-col">
          {/* THE SIDEBAR'S HEADER. h-16, the SAME height as the content pane's header opposite it,
              so the two top rows sit in one band across the shell rather than stepping. That
              agreement is the whole reason both are stated rather than derived. */}
          <div className="flex h-16 shrink-0 items-center justify-between pr-3 pl-6">
            <span className="text-small font-medium">Kitchen sink</span>
            {/* Every breakpoint, not md-only. On mobile the panel is an overlay and this is its
                explicit dismiss: without it the only ways out are scrim-tap and Escape, both
                learned gestures, neither visible. On desktop it is the collapse. One button, both
                jobs, because in both cases it means put this panel away. */}
            <Tooltip label="Collapse sidebar" shortcut="[">
              <IconButton
                onClick={toggle}
                aria-label="Collapse sidebar"
                aria-expanded
                aria-controls="sink-sidebar"
              >
                <PanelLeftClose size={ICON_SIZE} strokeWidth={ICON_STROKE} />
              </IconButton>
            </Tooltip>
          </div>

          {/* no-scrollbar: the rail still scrolls, it just never paints a bar. A scrollbar inside
              a nav rail is chrome on a surface whose whole job is to stay quiet. */}
          <nav
            aria-label="Sections"
            className="no-scrollbar flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 pb-6"
          >
            {GROUPS.map((group) => (
              <div key={group} className="flex flex-col gap-1">
                <span className="text-caption text-muted px-3 uppercase">{group}</span>
                {NAV.filter((entry) => entry.group === group).map((entry) => (
                  <a
                    key={entry.id}
                    href={`#${entry.id}`}
                    onClick={closeIfOverlay}
                    // The active row is signalled by ground and ink, neither of which a screen
                    // reader can see. aria-current is the programmatic half of the same statement.
                    aria-current={active === entry.id ? 'location' : undefined}
                    /* EVERY ROW IS FULL INK. The active row is distinguished by its GROUND ALONE.
                       This used to demote inactive rows to `muted`, so ink AND ground both said the
                       same thing - which is one channel more than the job needs on a list this
                       short, and it left the sidebar competing with the content it points at.
                       Muted is also the role this system reserves for METADATA, and a destination
                       you can navigate to is not metadata; painting it that way is a hierarchy
                       inversion rather than a shade preference.

                       HOVER IS THE ACTIVE FILL, deliberately the same value (Luke, 2026-08-19:
                       "i want hover to be the active fill color. simpler"). This reverses an
                       earlier rule that hover needed its own quieter ground so two rows could never
                       look alike. The cost is real and accepted rather than hidden: while the
                       pointer is in the nav, two rows carry the same fill and the ground alone does
                       not say which is your location - the pointer does. */
                    className={cn(
                      // A rounded RECTANGLE, not a circle: this is a labelled row, a place to go.
                      // The circle is reserved for icon-only controls acting on the shell.
                      'text-small flex h-10 items-center rounded-sm px-3 transition-colors',
                      active === entry.id ? 'bg-selected text-text' : 'text-text hover:bg-selected'
                    )}
                  >
                    {entry.label}
                  </a>
                ))}
              </div>
            ))}
          </nav>

          {/* mt-auto, and NO rule above it: the divider was doing a job that spacing and a shared
              hover fill already do. This is where Settings, the theme toggle and Log out live for
              the whole app - which is why there is no second theme control anywhere else.
              user={null} here because the sink has no session; a real project passes one in. */}
          <div className="mt-auto shrink-0 px-3 pb-3">
            <AccountMenu user={null} />
          </div>
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Reopen control, only while hidden. Floats over the pane rather than living in the band
            below, so nothing has to render a placeholder for it while the sidebar is open. */}
        {collapsed && (
          <div className="absolute top-0 left-0 z-40 flex h-16 items-center px-3">
            {/* No alignment prop needed: Tooltip clamps itself to the viewport, which is what
                this control against the left edge would otherwise have needed one for. */}
            <Tooltip label="Open sidebar" shortcut="[">
              <IconButton
                onClick={toggle}
                aria-label="Open sidebar"
                // aria-expanded alone only says "something is closed". With aria-controls it says
                // WHICH thing, which matters here because the panel it opens is not on screen.
                aria-expanded={false}
                aria-controls="sink-sidebar"
              >
                <PanelLeft size={ICON_SIZE} strokeWidth={ICON_STROKE} />
              </IconButton>
            </Tooltip>
          </div>
        )}

        {/* THE CONTENT PANE'S HEADER, and it BELONGS TO THE SHELL, not to the page. Rendered here
            on every route, so a page that paints nothing still has one and the top band never
            steps. h-16, the same height as the sidebar's own header row opposite it.

            A SIBLING ABOVE THE SCROLL AREA, NOT A STICKY CHILD INSIDE IT. That is the difference
            between a scrollbar running the full height of the pane and one that starts below the
            band, and the latter is right. It also means a page docking something to the top of the
            pane sticks at top:0, because the scrollport already begins below this.

            NO BOTTOM RULE AND NO SHADOW, scrolled or not: it is the page holding still, not an
            object stacked on it. It takes the page ground for the same reason - it is an opaque
            mask across the top of the scroll area, not a separate surface.

            pl-16 when collapsed clears the floating Open control, which occupies that same corner
            whenever the sidebar is hidden; without it the two overlap. */}
        <header
          className={cn(
            'bg-bg relative z-30 flex h-16 shrink-0 items-center px-6',
            collapsed && 'pl-16'
          )}
        >
          {/* DELIBERATELY EMPTY ON THIS ROUTE. The band still earns its 64px on structure - it is
              the opaque mask across the top of the scroll area and the space the floating Open
              control sits in - but the kitchen sink is one page, so a title here would only ever
              restate the section you are already looking at. A real project puts its route title
              and its page controls in this band; that is the point of the shell owning it. */}
        </header>
        <main ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
