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
 * MOBILE IS DESIGNED NOW (`S3d` and `S5d`, 2026-08-20 to 08-25). This paragraph used to say the
 * opposite - "deliberately unfinished ... not broken, not designed", Luke 2026-08-13 - and
 * `build-plan.md` quoted it as the case FOR scheduling the pass. The pass happened, so the note
 * has to stop claiming otherwise: a stale disclaimer telling the next session that a settled
 * decision is provisional is worse than no note.
 * What is settled at this width: the sidebar is a DRAWER that translates rather than narrowing,
 * dismissed by scrim tap or a leftward swipe; `BottomBar` carries the four destinations in flow
 * below `<main>`; page chrome that must not scroll lives in `HEADER_BAND_SLOT_ID` rather than
 * sticky inside the pane. Below `md` the drawer never restores a stored open state and never
 * writes one, so a phone cannot clobber the desktop's preference.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOverlayBack } from '@/lib/overlay-back';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from '@/components/ui/icon';
import { site } from '@/config/site';
import { IconButton } from '@/components/ui/icon-button';
import { Tooltip } from '@/components/ui/tooltip';
import { Wordmark } from '@/components/ui/wordmark';
import { AccountMenu } from '@/components/shell/account-menu';
import type { SessionUser } from '@/lib/trader';
import { DetectTimezone } from '@/components/detect-timezone';
import {
  HEADER_BAND_SLOT_ID,
  HEADER_SLOT_ID,
  HEADER_TITLE_SLOT_ID,
} from '@/components/shell/header-slot';
import {
  BOTTOM_BAR_H,
  SHELL_HEADER_H,
  SIDEBAR_W,
  SIDEBAR_COLLAPSE_KEY,
  SIDEBAR_OVERLAY_QUERY,
  PAGE_COLUMN,
  HEADER_INDENT,
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
 * AN EXACT MATCH, NOT A PREFIX ONE (`S5d`, 2026-08-20). This used to prefix-match so that a future
 * `/trades/<id>` would still read "Trades" rather than falling through to nothing — written when no
 * drill-down route existed, to avoid an empty band. `/trades/[id]` now exists, and the prefix match
 * is what made it render TWO title bars: the shell's saying "Trades" at y=0, and the page's own
 * saying the product at y=84. That is precisely the failure `header-slot.tsx` was written to
 * prevent, quoted from its own header: "a page needing a title and controls has to build a SECOND
 * band underneath it".
 *
 * The old comment's next sentence already described the right answer, so this is the design
 * arriving rather than changing: a drill-down returns null here, the band's left stays empty, and
 * the PAGE portals a trail into `HEADER_TITLE_SLOT_ID` — the way back plus which row you opened,
 * which is page knowledge and not shell knowledge.
 *
 * THE CONTRACT THIS CREATES: any route below a NAV href owes the title slot a trail, or its band
 * renders nameless. There is exactly one such route today and it does. */
function routeTitle(pathname: string): string | null {
  return NAV.find((n) => n.href === pathname)?.label ?? null;
}

const isOverlay = () =>
  typeof window !== 'undefined' && window.matchMedia(SIDEBAR_OVERLAY_QUERY).matches;

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  /* RESOLVED BY THE LAYOUT, not by a hook down in the account row. Server and client then render
     the same string, which is the whole fix — see `getSessionUser`. */
  user: SessionUser | null;
}) {
  // Starts collapsed and corrects on mount. The server cannot know the stored preference, so
  // rendering it open and closing it would be a visible flash on every full page load; the
  // reverse only ever opens a panel, which reads as the app arriving rather than as a glitch.
  const [collapsed, setCollapsed] = useState(true);
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  /** Where a touch on the drawer began, so a leftward drag can be told from a scroll. */
  const swipe = useRef<{ x: number; y: number } | null>(null);
  /* Drives whether the floating Open control is conditional. Starts TRUE so the server and the
     first client pass agree — a desktop render is the one that hides it, and rendering it and
     pulling it away is a flash where the reverse is not. */
  const [mdUp, setMdUp] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setMdUp(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSE_KEY);
    /* On desktop, default to OPEN when nothing is stored — the nav is the app's spine and a
       first-time visitor should see it.
       ON MOBILE IT STAYS CLOSED REGARDLESS, and until 2026-08-24 this line only managed that when
       nothing was stored: a trader who leaves the sidebar open on a desktop had `'0'` in the key,
       and the phone restored it and opened a drawer over the page on load. The overlay test has to
       come FIRST, because it is not a default — it is a rule about what this panel IS at that
       width. The summary rail carries the same repair, measured. */
    setCollapsed(isOverlay() ? true : stored !== null ? stored === '1' : false);
    setReady(true);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      /* A PHONE NEVER WRITES THE PREFERENCE. The key is shared with the desktop, where collapsing
         the sidebar is a lasting layout choice; in overlay mode it is a drawer, where closing is
         just finishing with it. Persisting the second collapsed the trader's desktop spine because
         they dismissed a drawer on their phone. Same rule in `summary-rail.tsx`. */
      if (!isOverlay()) localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  /* THE DEVICE BACK BUTTON CLOSES THE DRAWER RATHER THAN LEAVING THE PAGE (2026-08-25, Luke: "if
     the page has a back arrow or 'x' button, the back button on the user's device should take the
     user back a step or close the modal/page that has the 'x' button"). It has a close control and
     a scrim, so it is a modal, and the OS gesture used to walk straight past it.
     ONLY IN OVERLAY MODE. On a desktop this is the app's spine, not a modal, and giving a permanent
     layout choice a history entry would make Back toggle furniture.
     `mdUp` RATHER THAN `isOverlay()`, because this runs during render and `isOverlay()` reads
     `matchMedia` - the hydration mismatch this file already keeps `mdUp` in state to avoid. */
  useOverlayBack(!collapsed && !mdUp, () => setCollapsed(true));

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
          /* `z-40`, ABOVE THE STICKY CHROME (Luke, 2026-08-21: "bug with the scrim. the search bar
             and footer are not effected"). The scrim sat at `z-30` and so did both the page's
             sticky search row and the bottom bar — same layer, so DOM order decided, and the two
             pieces of chrome rendered later won. The drawer dimmed the tape and left the header and
             footer bright, which reads as the scrim failing rather than as a stacking rule.
             THE STACK, stated once so the next surface does not have to guess: sticky page chrome
             20, drawer scrims 40, drawers 50, the trade drawer 60. */
          className="fixed inset-0 z-40 md:hidden"
        />
      )}

      <aside
        /* NAMED SO THE OPEN CONTROL CAN POINT AT IT. `aria-expanded` alone only says "something is
           closed"; with `aria-controls` it says WHICH thing, which matters precisely here because
           the panel it refers to is not on screen to be found. v2 carries both. */
        id="app-sidebar"
        /* AND NAMED FOR A SCREEN READER TOO (2026-08-20, S5 step 3). `id` answers `aria-controls`;
           it does not give the landmark a name. Two `<aside>` elements ship on /trades - this and
           the summary rail - so a reader navigating by landmark heard "complementary, complementary"
           and had to enter each one to find out which was which. A landmark that appears twice has
           to say which one it is. */
        aria-label="Main navigation"
        className={cn(
          'bg-bg z-40 shrink-0 overflow-hidden',
          /* `panel-transition`, NOT a hand-rolled `transition-[width] duration-200 ease-out`. That
             is the exact drift globals.css names when it explains why the class exists: "the only
             way two panels reliably match is by being the same declaration rather than two that
             currently agree — a duration copied by hand is a duration that drifts the first time
             one of them is tuned." The sidebar was on 200ms stock ease-out while the class it was
             supposed to share runs 300ms on the product's own curve, so the two panels framing the
             work moved at visibly different speeds.
             Only once the stored preference has landed, or the correction animates on every load. */
          /* THE SAME SPLIT THE SUMMARY RAIL MAKES, and for the same reason. Above `md` this RESIZES
             in place (`width`, `ease-in-out`); below it, it now ENTERS AND LEAVES (`translate`,
             `ease-out`). One class cannot answer both, and a `max-md:` variant cannot reach a
             hand-written class — that mistake was made and caught by lint on the rail. */
          ready && (mdUp ? 'panel-transition' : 'drawer-transition'),
          /* IT SHRINKS ON A DESKTOP AND SLIDES ON A PHONE, and that is the fix for a real bug
             (Luke, 2026-08-21: "as the panel is collapsing, the hamburger button is visible
             immediately ... you shouldn't be able to see content under it until the sidebar is
             fully hidden").
             `w-0` animates the panel's WIDTH, which clips it from the right and uncovers whatever
             sits beneath, left edge first, for the whole 300ms. On a desktop that is correct — the
             sidebar is IN FLOW there and the pane genuinely widens into the space. On a phone it is
             a drawer lying ON TOP of the page, and a thing on top does not get narrower as it
             leaves, it moves off. Translating keeps it opaque and full width the entire way out.
             `max-md:w-56` re-asserts the width the desktop branch would otherwise zero out. */
          collapsed ? 'w-0 max-md:w-56 max-md:-translate-x-full' : SIDEBAR_W,
          // Overlay below md: fixed, full height, never in flow.
          'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50',
        )}
        /* A COLLAPSED SIDEBAR IS INVISIBLE AND WAS STILL FULLY TABBABLE (2026-08-25, postcheck).
           `overflow-hidden` + `w-0` on desktop and `-translate-x-full` on a phone hide PIXELS, not
           the accessibility tree - so Shift+Tab from the header walked into a 0px panel through
           Notifications, Settings, Collapse, four nav rows and the account trigger, seven stops with
           nothing on screen, and Enter opened a menu inside a zero-width box.
           `summary-rail.tsx` already states this rule and obeys it; the panel beside it did not. */
        inert={collapsed}
        /* SWIPE IT AWAY (Luke, 2026-08-21). A drawer that only closes by tapping a scrim is a
           drawer that ignores the one gesture every phone user already has for it. Horizontal only,
           and only leftward: a vertical drag is the page scrolling and must pass straight through.
           40px of travel before it counts, so a thumb resting on the panel while reading does not
           dismiss it. */
        onTouchStart={(e) => {
          swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }}
        onTouchMove={(e) => {
          const s = swipe.current;
          if (!s) return;
          const dx = e.touches[0].clientX - s.x;
          const dy = e.touches[0].clientY - s.y;
          if (Math.abs(dy) > Math.abs(dx)) {
            swipe.current = null;
            return;
          }
          if (dx < -40) {
            swipe.current = null;
            // Never persisted: the gesture only exists in overlay mode, and overlay mode does not
            // write the preference. See `toggle`.
            setCollapsed(true);
          }
        }}
        onTouchEnd={() => {
          swipe.current = null;
        }}
      >
        {/* Pinned width so the contents do not reflow while the track closes. */}
        <div className={cn('flex h-full flex-col', SIDEBAR_W)}>
          {/* `pr-3 pl-5`, matching v2 rather than a uniform `px-4`. The wordmark wants the deeper
              inset because it is type sitting against the pane edge; the collapse control wants the
              shallower one because it is a 36px disc whose own padding already carries the gap. A
              uniform 16 put the mark too close and the disc too far. */}
          <div
            className="flex shrink-0 items-center justify-between pr-3 pl-5"
            style={{ height: SHELL_HEADER_H }}
          >
            {/* NOT A LINK ON A PHONE (2026-08-24, Luke: "clicking on the wordmark should not do
                anything at all. do not let that route the user to the homepage"). `/` is the
                MARKETING door, not a destination inside the product - so on a desktop, where the
                mark sits in a sidebar beside the nav, it is a way back out and that is legible.
                On a phone the mark lives inside the drawer the trader just opened to navigate, and
                a tap there ejects them from the app they are using into a landing page. There is no
                equivalent of "home" for a signed-in trader; the bottom bar carries the four places
                that exist.
                A `<span>` below `md` rather than a disabled link, because a link that does nothing
                is still announced as a link and still offers a context menu full of ways to follow
                it. Two elements, one visible at a time, so neither has to pretend. */}
            <Link href="/" className="max-md:hidden">
              <Wordmark />
            </Link>
            <span className="md:hidden">
              <Wordmark />
            </span>
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
            {/* THREE CONTROLS, IN MONARCH'S OWN ORDER (2026-08-20). Measured on
                `app.monarch.com/transactions`: its 224px sidebar carries a 62px logo and then four
                36px round controls hard against the right edge — search, notifications (with an
                unread dot), a settings LINK to `/settings/profile`, and collapse. Run's sidebar is
                the same 224px and `IconButton` is already the same 36px circle, so this is a
                placement match rather than a new shape.
                SEARCH IS NOT AMONG THEM HERE. /trades has its own Search control in the page band
                and it searches TRADES; a second one in the shell would either duplicate it or
                promise a global search this product does not have.
                NEITHER OF THESE DOES ANYTHING YET (Luke, 2026-08-20: "nothing will happen with
                those buttons for the time being"). They are `disabled` rather than silently inert:
                a control that looks live and does nothing on click is the worse of the two, and
                `IconButton` already has a considered disabled state. Tracked as `S8b` (settings)
                and `S9c` (notifications) in `build-plan.md` — `S9b` was already taken by the
                quarantine-resolve slice in `spec.md`, which is exactly the kind of collision a
                comment inventing its own label would have shipped. */}
            <div className="flex items-center gap-0.5">
              {/* `md:flex` — below that the bell lives in the page's top bar instead, where the
                  reference puts it. One bell in the document at any width. */}
              <Tooltip label="Notifications">
                <IconButton disabled aria-label="Notifications" className="hidden md:flex">
                  <Icon name="bell" size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip label="Settings">
                <IconButton disabled aria-label="Settings">
                  {/* 20 ON A PHONE, 16 ABOVE IT (2026-08-21). See the note on `BottomBar` for the
                      measurement: a touch target's mark carries the whole control once the chip is
                      gone, so it has to be readable at arm's length rather than merely present. */}
                  <Icon name="settings" size={20} className="md:hidden" />
                  <Icon name="settings" size={16} className="hidden md:block" />
                </IconButton>
              </Tooltip>
              {/* DESKTOP ONLY (Luke, 2026-08-21: "dont need the « icon in the left sidebar. only
                  need the settings icon. match the way monarch does it"). The reference's mobile
                  drawer header carries its wordmark and a gear, nothing else — the way out is the
                  scrim, a swipe, or picking a destination.
                  ⚠️ THIS REVERSES A RECORDED DECISION, so the reasoning it overrides is worth
                  keeping visible: the note below argued the control must exist at every breakpoint
                  BECAUSE an overlay needs a visible way out, scrim-tap and Escape both being
                  learned gestures. That is still true in the abstract; what changes it is that the
                  drawer now also closes on navigation and on the darkened scrim, which at 0.40 is
                  no longer a tint a trader might miss. If the drawer ever starts feeling like a
                  trap on a device, this is the line that made it one. */}
              <Tooltip label="Collapse" shortcut="[">
                <IconButton onClick={toggle} aria-label="Collapse sidebar" className="hidden md:flex">
                  {/* ONE MARK AT EVERY BREAKPOINT, matching v2 exactly (2026-08-19). This carried
                      two — `close` below `md`, `collapse` above — on the reasoning that a modal
                      overlay wants an explicit dismiss. v2 considered the same split and rejected
                      it: the button is present at every breakpoint precisely BECAUSE the overlay
                      needs a visible way out (scrim-tap and Escape are both learned gestures,
                      neither visible), but the meaning never changes between the two — "put this
                      panel away" is one job, so it gets one mark. */}
                  <Icon name="collapse" size={16} />
                </IconButton>
              </Tooltip>
            </div>
          </div>

          {/* scroll-thin: the platform default is a 15px grey slab that reads as chrome beside
              the content, and this pane is content on paper with nothing framing it. */}
          {/* No `aria-label`: this <nav> is the only one in the document AND it is already inside
              the labelled <aside> above, so naming it a second time makes a reader announce the
              same words twice on the way in. A name is for telling two of a kind apart. */}
          {/* GONE BELOW `md`, WHERE THE BOTTOM BAR CARRIES THESE INSTEAD (`S3d`, 2026-08-20).
              Matching the reference's own split, measured off its mobile app rather than its web,
              which does not do this at all: the five primary destinations live in the tab bar and
              the drawer holds only secondary surfaces plus the account row. Run has no secondary
              surfaces yet, so below `md` this drawer is deliberately thin — wordmark and settings
              at the top, account row at the bottom (Luke, 2026-08-20: "the left sidebar might be
              kind of empty right now but that's okay").
              `max-md:hidden` rather than unmounting: the rows are the same `NAV` array either way,
              and hiding is what keeps ONE definition of the app's spine. */}
          <nav className="scroll-thin flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-2 max-md:hidden">
            {NAV.map(({ label, href, icon }) => (
              <NavRow key={href} href={href} label={label} icon={icon} pathname={pathname} />
            ))}
          </nav>
          {/* The account row is `mt-auto` below, which needs something to push against once the nav
              is hidden. Without this the row jumps to the top of an empty drawer on a phone. */}
          <div className="flex-1 md:hidden" />

          {/* `mt-auto`, no rule above it — matching both v2 and the Monarch reference, whose bottom
              account row carries no divider either. `AccountMenu` is where Settings, the theme
              toggle and Log out all live now; the persistent `/settings` row this replaced is gone,
              not hidden — porting the shape means porting where things live, not just how they look. */}
          <div className="mt-auto shrink-0 px-3 pb-3">
            <AccountMenu user={user} />
          </div>
        </div>
      </aside>

      {/* min-w-0 is what lets the pane shrink instead of forcing the flex row wider than the
          viewport — without it a wide table pushes the whole shell into a horizontal scroll.
          `relative` is what the floating Open control below is positioned against. */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* THE OPEN CONTROL FLOATS OVER THE PANE; IT IS NOT IN THE HEADER'S FLEX ROW. Ported from
            v2 (2026-08-19) after measuring the two builds side by side: this used to be an in-flow
            sibling before the title, so with the sidebar collapsed the title started at
            24 (pl-6) + 36 (the disc) + 8 (gap) = 68px, against v2's 64. Four pixels, and it moved
            the title every time the sidebar opened or closed by a different amount than v2's does.
            Out of flow, the control cannot push the title at all, and the header's own `pl-16`
            below is what clears it — which is the number v2 measured. */}
        {/* ALWAYS MOUNTED BELOW `md`, MOUNTED ONLY WHEN COLLAPSED ABOVE IT (2026-08-21). It used to
            be `{collapsed && ...}` at every width, which is why the hamburger appeared the instant a
            phone drawer STARTED closing: `collapsed` flips at the top of the 300ms exit, so the
            control popped in under a panel that was still on screen.
            On a phone the answer is not to delay it but to stop hiding it: the drawer is `z-50` and
            covers this corner completely, so a control that is always there is simply never seen
            until the panel has gone. Nothing to time, nothing to get wrong.
            Above `md` the sidebar is in flow and this corner is real estate the panel occupies, so
            the conditional stays. */}
        {(collapsed || !mdUp) && (
          <div
            className={cn(
              'absolute top-0 left-0 z-40 flex items-center px-3',
              // Only the desktop branch is conditional, so the phone one must not paint while open.
              !collapsed && 'md:hidden'
            )}
            style={{ height: SHELL_HEADER_H }}
          >
            <Tooltip label="Open sidebar" shortcut="[">
              <IconButton
                onClick={toggle}
                aria-label="Open sidebar"
                /* `aria-expanded` alone only says "something is closed". With `aria-controls` it
                   says WHICH thing, which matters here because the panel it opens is not on
                   screen. Both ported from v2. */
                aria-expanded={false}
                aria-controls="app-sidebar"
              >
                {/* THE MENU MARK AT 20, matching v2 exactly. Collapsing is an action ON a panel you
                    can see, so that mark points at it; opening is reaching for a panel that is not
                    on screen, which is what a menu glyph means everywhere. */}
                <Icon name="menu" size={20} className="max-md:hidden" />
                <Icon name="menu" size={22} className="md:hidden" />
              </IconButton>
            </Tooltip>
          </div>
        )}
        {/* ONE BAND, CARRYING THE PAGE'S IDENTITY AND ITS CONTROLS.
            It used to carry only the Open control and the theme toggle, which forced any page
            wanting a title to build a SECOND 64px band underneath — a near-empty strip above a real
            one. `header-slot.tsx` has the full argument and the quote that named it. */}
        {/* `PAGE_COLUMN` + `HEADER_INDENT`, WHICH THIS LOST when the title moved up here and
            `PageHeader` was deleted. That component carried both, and a plain `px-4` put the title
            at 16px while the cards below it sit at 16px too — so the measured 8px indent, which is
            what makes a title read as naming the card rather than floating beside it, silently
            became zero. `shell.ts` states it: "do not 'fix' a header that looks 8px off". This is
            the shift, and it was mine. */}
        <header
          className={cn(
            PAGE_COLUMN,
            HEADER_INDENT,
            'relative flex shrink-0 items-center gap-2',
            /* CLEARS THE FLOATING OPEN CONTROL, which occupies this same left corner whenever the
               sidebar is hidden. Without it that 36px disc sits directly under the title's own left
               edge. `pl-16` is v2's measured number and it beats `HEADER_INDENT`'s `pl-6` cleanly,
               because twMerge DOES dedupe two classes in the same `pl` group — unlike `pl-6` against
               `PAGE_COLUMN`'s `px-4`, which both survive and are resolved by Tailwind's sheet order
               instead. Only safe while the gutter has no responsive half: an `sm:px-*` in play would
               sort last and silently beat a bare `pl-*`. */
            /* `pl-16` (64px) clears the floating Open control, which ends at x=48, leaving a 16px
               gap. ON A PHONE THE BELL SITS TIGHT AGAINST IT instead (Luke, 2026-08-20: "you can
               push the notifications bell icon to the left so it sits closer to the sidebar
               show/hide icon"), matching the reference, whose hamburger and bell are adjacent. 48px
               puts the bell's box flush against the hamburger's, which reads as one group of two
               rather than two controls that happen to share an edge. */
            'max-md:pl-12',
            collapsed && 'pl-16'
          )}
          style={{ height: SHELL_HEADER_H }}
        >
          {/* DERIVED FROM THE ROUTE, SYNCHRONOUSLY, and that is why the title does not come through
              the portal: the thing that names the screen must never be a frame late.
              CENTRED ON A PHONE, static from `sm`. A 375px band cannot hold a left title, the open
              control and two filters without the title winning space it does not need — centring it
              lets the controls keep the edges. `pointer-events-none` while centred so it cannot
              swallow a tap meant for a control underneath it. */}
          {/* Conditional, or a drill-down route renders an empty `<h1>` into the document — a
              heading with no text is worse than no heading, because a screen reader announces the
              level and then says nothing. */}
          {/* THE BELL MOVES HERE ON A PHONE (`S5d`, 2026-08-20), matching the reference's own split:
              its mobile top bar carries the bell and its drawer carries only the gear. A MOVE, not a
              copy — the sidebar's bell is `md:flex` and this one is `md:hidden`, so exactly one is
              ever in the document. Two disabled bells on one screen would be the same nothing twice.
              Still disabled until `S9c`. */}
          <Tooltip label="Notifications">
            <IconButton disabled aria-label="Notifications" className="md:hidden">
              <Icon name="bell" size={22} />
            </IconButton>
          </Tooltip>

          {routeTitle(pathname) && (
            /* `text-h3` ON A PHONE, `text-title` from `sm` (`S5d`). The reference's mobile screen
               title is the largest thing in its band and reads as the name of the screen; at 18px
               beside a 16px nav row it read as a label. Both are roles from the ramp — this is a
               step up the scale, not a hand-picked size. */
            <h1 className="text-h3 text-text pointer-events-none absolute left-1/2 max-w-[50%] -translate-x-1/2 truncate font-medium sm:text-title sm:pointer-events-auto sm:static sm:max-w-none sm:min-w-0 sm:translate-x-0">
              {routeTitle(pathname)}
            </h1>
          )}
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
        {/* THE PANE CLEARS THE BOTTOM BAR, and it has to clear the SAFE AREA with it (`S3d`). The
            bar is `--bottom-bar-h` of content plus however much home-indicator the device reports,
            so padding by the height alone would still bury the last tape row on any gesture-bar
            iPhone. `.pane-bottom-clearance` (globals.css) states both that calc and the desktop
            value it reverts to at `md`.
            NOT AN INLINE STYLE PLUS `md:pb-12`, which is what this was and which never worked: an
            inline style always beats a class, so the desktop override was dead on arrival and the
            pane carried a phone's clearance at 1280px. Measured, not assumed. */}
        {/* PAGE CHROME THAT DOES NOT SCROLL, and therefore is not inside the thing that scrolls.
            The phone's search row lived in the page body as `sticky top-0`, which looks identical
            and is not: a sticky element belongs to its scroller, so `<main>`'s scrollbar ran the
            full height of the pane and behind the row. Out here it ends where the content does.
            Empty and zero-height until a page portals into it. See `HEADER_BAND_SLOT_ID`. */}
        <div id={HEADER_BAND_SLOT_ID} className="shrink-0" />

        <main className="scroll-thin pane-bottom-clearance min-h-0 min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>

        <BottomBar pathname={pathname} />
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
 *
 * AND IT TAKES A DIFFERENT ONE (corrected 2026-08-17, S5c). Hover was `bg-surface-2`, which is the
 * ACTIVE row's ground — so with the pointer anywhere in the nav, two rows were filled identically
 * and the ground stopped saying which one was the location. That is not a small shade issue: it
 * breaks the rule THIS comment sets, since ground is the only channel left carrying rank. Hover is
 * `bg-hover` now, which is what `run-trading@v2` uses and what its own note argues for after
 * measuring the two candidate fills at 1.045:1 and 1.075:1 and finding them not tellable apart.
 */
/* THE PHONE'S PRIMARY NAVIGATION (`S3d`, 2026-08-20).
 *
 * FOUR ITEMS OFF THE SAME `NAV` ARRAY the drawer uses, in the same order with the same marks. One
 * definition of the app's spine: a bar and a drawer that each held their own list would disagree
 * the first time a destination was added, and the disagreement would only show on one breakpoint.
 *
 * BELOW `md` ONLY, the same 767px boundary `SIDEBAR_OVERLAY_QUERY` already draws for the drawer.
 * Above it the sidebar is the spine and a second copy of the nav would be the same job twice.
 *
 * IT CLEARS THE HOME INDICATOR. `BOTTOM_BAR_H` is the CONTENT box; `env(safe-area-inset-bottom)` is
 * added as padding underneath, so on a gesture-bar iPhone the labels sit above the indicator rather
 * than under it. The bar's painted ground extends through the inset, which is why the inset is
 * padding on this element rather than a margin below it.
 *
 * ─── THE ACTIVE STATE IS INK AND WEIGHT, WHICH IS A STATED EXCEPTION ──────────────────────────
 *
 * `design-system.md` is explicit that a nav row's rank is carried by the GROUND alone, and that ink
 * stays full on every row because a destination is not metadata. That rule was written for the
 * sidebar, where a row is 224px wide and a `bg-selected` pill has somewhere to live. A 56px tab is
 * 25% of that width and a filled pill behind an icon-plus-label reads as a button, not a location.
 *
 * The reference solves it by filling the ICON — its active tab swaps a stroked mark for a solid
 * one. Run draws one weight of every mark through a single wrapper (`icon.tsx`), and drawing a
 * second filled set for four icons is a bigger change than this slice, so the remaining channels
 * are ink and weight. Recorded here and in `design-system.md` as the one place the ground rule does
 * not reach, rather than left as a silent divergence.
 */
function BottomBar({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Primary"
      /* `border-border`, NOT `border-rule` (2026-08-21). The bar's ground is `surface` and the tape
         above it is `surface` too, so a `rule` edge — whose light value is the PAGE colour — drew
         white on white and the bar had no top at all. The reference's own tab bar carries a clearly
         visible divider; this is an EDGE bounding one surface against another, which is `border`'s
         job. Same token confusion the page header's own bottom edge hit the day before. */
      /* IN FLOW, NOT `fixed` (2026-08-24). As a fixed element it left the flex column, so `<main>`
         - `flex-1` in an `h-dvh` column - stretched to the viewport floor and ran its scrollbar
         down BEHIND the bar. As the column's last in-flow child it pins to the bottom exactly the
         same way, and `main` now ends where it begins.
         `shrink-0` is what makes that true: without it the bar would compress before the pane does.
         The safe-area padding stays on the bar, which is the element that actually touches the
         home indicator. */
      className="border-border bg-surface flex shrink-0 border-t md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV.map(({ label, href, icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            /* `flex-1` so four tabs split the width evenly whatever the labels say — a tab bar
               whose items size to their text shifts every time a destination is renamed. */
            className={cn(
              'text-caption flex flex-1 flex-col items-center justify-center gap-1 transition-colors',
              active ? 'text-text font-medium' : 'text-muted',
            )}
            style={{ height: BOTTOM_BAR_H }}
          >
            {/* 24, UP FROM 20 (Luke, 2026-08-21: "i feel like monarch's icons are bigger on
                mobile"). Measured on the reference's own tab bar, the mark stands roughly 3.4x its
                label's cap height where Run's stood at 2.5x — the icon carries the tab and the word
                confirms it, not the other way round. The label stays `text-caption`, which is the
                ramp's "a label naming the thing under it" and is exactly this job; shrinking it
                further would reach for `text-micro`, whose 0.14em tracking is built for spaced caps
                and would space out "Dashboard" like an eyebrow. */}
            <Icon name={icon} size={24} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

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
      /* `group` SO THE MARK CAN REACT TO A HOVER ANYWHERE ON THE ROW. A 20px icon is far too small
         to be its own hover target, which is why the stroke thickens from the row rather than from
         the glyph.
         HOVER IS `bg-hover`, NOT `bg-surface-2`, and that was a real defect rather than a shade
         preference: `surface-2` is the ACTIVE row's ground, so pointing at any inactive row painted
         it the exact colour of the one you are on. Two rows filled, neither saying which is the
         location — concealed state, which is what v2's own note calls it after measuring the pair
         at 1.045:1 and 1.075:1 and finding them not tellable apart.
         NO LOCAL FOCUS RING. `globals.css` defines a 2px solid accent outline on `:focus-visible`
         app-wide, and `focus-visible:outline-none` here was suppressing it to substitute a weaker
         one — the same substitution `theme-toggle.tsx` records being removed everywhere else.
         `transition-colors`, not `transition`: only colour changes, so animating `all` would put
         the layout properties on the clock for nothing. */
      className={cn(
        'text-nav group flex h-10 items-center gap-3 rounded-sm px-3 font-normal transition-colors',
        /* ONE GROUND FOR BOTH, and `selected` is the token that means it (Luke, 2026-08-20,
           adopting the boilerplate's call). Active was `surface-2` and hover was `hover`: two
           tokens, two values, for one question. The rule is that a row's rank is carried by the
           GROUND ALONE and the pointer already disambiguates the moment two rows match, so a
           separate hover value is one channel more than the job needs. Ink stays full on every
           row - a destination is not metadata. */
        active ? 'bg-selected text-text' : 'text-text hover:bg-selected',
      )}
    >
      {/* HOVER THICKENS THE STROKE, 1.5 -> 1.8. claude.ai's move translated: their sidebar icons are
          a variable font and they animate its weight axis on hover; we draw SVG, so the equivalent
          axis is stroke-width. CSS beats the wrapper's presentation attribute, so the wrapper needs
          no change. 20px, matching v2 — the shell's marks are a size up from the 16px an icon
          BUTTON carries, because a nav row is read at a glance rather than aimed at.
          NO CURVE AND NO DURATION, BOTH DELETED (2026-08-20, S5 step 3). This read
          `duration-200 ease-out`, which is two hand-picked values that happen to equal the system
          defaults, and one of them was the WRONG curve by the role table: a hover is a state change
          IN PLACE, so it takes `ease`, and `ease-out` is for something entering or leaving. The row
          around this glyph carries a bare `transition-colors` and therefore already runs on `ease`,
          so the ground faded on one curve while the stroke inside it thickened on another - two
          curves in a single gesture. Naming nothing inherits 200ms and `ease` from `@theme`, which
          is the whole reason the default was set there. */}
      {/* 24 ON A PHONE, 20 ABOVE IT. The rail is the same 224px at both widths, but a phone reads
          it at arm's length and with a thumb rather than a pointer. */}
      <Icon
        name={icon}
        size={20}
        className="shrink-0 transition-[stroke-width] group-hover:[stroke-width:1.8] max-md:hidden"
      />
      <Icon name={icon} size={24} className="shrink-0 md:hidden" />
      {label}
    </Link>
  );
}
