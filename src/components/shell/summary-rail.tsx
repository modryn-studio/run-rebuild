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
 * `]` toggles it — the bracket that pairs with the sidebar's `[`. ONE HEADER BUTTON DOES BOTH
 * DIRECTIONS, ported from v2's `SessionsLayout` exactly (2026-08-19) — it used to be a floating
 * bottom-right button that only ever reopened, with no way to close from the header at all. v2
 * never had that split: the same `IconButton` stays mounted in the header band and just flips
 * icon rotation, `data-active` (held pressed while shown, same as `lift-press` gives Date/Filters
 * while their panel is open) and its tooltip label between "Hide summary" and "Show summary".
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOverlayBack } from '@/lib/overlay-back';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Tooltip } from '@/components/ui/tooltip';
import { PAGE_COLUMN, RAIL_W } from '@/lib/shell';
import { StickyRail } from '@/components/shell/sticky-rail';
import { HeaderSlot } from '@/components/shell/header-slot';

const RAIL_COLLAPSE_KEY = 'run_rail_collapsed';

export function WithSummaryRail({
  rail,
  children,
  toggleHostId,
  overPanel = false,
}: {
  /** The digest itself. Rendered by the page, since only the page knows the filtered set. */
  rail: React.ReactNode;
  children: React.ReactNode;
  /* WHERE THE TOGGLE GOES WHEN THE SHELL'S BAND IS NOT VISIBLE (2026-08-28). The account's own
     trades screen is a full-screen panel covering that band, so it publishes its bar as a host and
     names it here. Absent means the shell's band, which is every other caller. */
  toggleHostId?: string;
  /* THE DRAWER HAS TO OUTRANK THE PANEL IT OPENS OVER. The detail panel is `z-[60]`, so the phone
     drawer's own `z-50` and its scrim's `z-40` would both open BEHIND it - visible only as a dimmed
     nothing. Raised rather than made unconditional, because on `/trades` there is no panel and the
     lower pair is correct: it must stay under the modals at `z-[60]` and above. */
  overPanel?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  /* THREE BEHAVIOURS, ONE VALUE, AND IT STARTS UNKNOWN (2026-08-24). Below `md` the rail is a
   * right-hand DRAWER; between `md` and `lg` it is a stacked block that never collapses; above `lg`
   * it is a column that collapses sideways.
   *
   * This was two booleans, `lgUp` and `mdUp`, and `mdUp` DEFAULTED TO THE DESKTOP ANSWER. That
   * default is what made the drawer open itself on a phone on every load, and it took a measurement
   * to see rather than a reading: at 390px the rail sat at x=70, 320px wide, fully on screen over
   * the tape, on first paint. The restore effect below and the phone override were both correct in
   * isolation and raced each other — the override set `collapsed` true, the restore effect saw
   * `collapsed` change while `ready` was still false, read the DESKTOP preference out of storage,
   * and put it straight back to false.
   *
   * `null` is the fix, and it is structural rather than a reordering: nothing acts on a breakpoint
   * until the breakpoint has actually been read, so there is no wrong first answer to race. */
  const [bp, setBp] = useState<null | 'phone' | 'stack' | 'rail'>(null);
  const lgUp = bp === 'rail';
  // Unknown reads as desktop for the purposes below: `inert` must not be applied to a stacked block.
  const mdUp = bp !== 'phone';
  /** Where a touch on the drawer began, so a rightward drag can be told from a scroll. */
  const swipe = useRef<{ x: number; y: number } | null>(null);

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
    if (ready || bp === null) return;
    let stored = false;
    try {
      stored = localStorage.getItem(RAIL_COLLAPSE_KEY) === '1';
    } catch {
      // Private mode or blocked storage. The default stands rather than the component throwing.
    }
    /* A PHONE ALWAYS STARTS CLOSED, whatever the stored preference says. The preference is one key
       shared with the desktop, where "open" is the sensible default and most traders will leave it
       that way — restoring that on a phone drops a drawer over the list on every first load, which
       is the opposite of the screen this slice is copying. The sidebar makes the identical call for
       the identical reason (`app-shell.tsx`: "On mobile it stays closed regardless").
       It is resolved HERE rather than in an effect of its own, and that is the whole repair: two
       effects both writing `collapsed` before `ready` is armed is a race by construction, however
       carefully each one is written. One expression, one answer.
       It does not WRITE the override, so a phone visit never clobbers the desktop preference. */
    const want = bp === 'phone' ? true : stored;
    if (collapsed !== want) {
      setCollapsed(want);
      return;
    }
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [ready, collapsed, bp]);

  useEffect(() => {
    const lg = window.matchMedia('(min-width: 1024px)');
    const md = window.matchMedia('(min-width: 768px)');
    const sync = () => setBp(lg.matches ? 'rail' : md.matches ? 'stack' : 'phone');
    sync();
    lg.addEventListener('change', sync);
    md.addEventListener('change', sync);
    return () => {
      lg.removeEventListener('change', sync);
      md.removeEventListener('change', sync);
    };
  }, []);

  /* CROSSING INTO PHONE WIDTH AFTER THE FIRST PAINT closes it too — a desktop rail that is open
     when the window narrows would otherwise become a drawer nobody opened. Deliberately keyed on
     `bp` and `ready` ALONE: opening the drawer changes neither, so this cannot re-close a panel the
     trader just asked for. First load is already handled above, where it belongs. */
  useEffect(() => {
    if (ready && bp === 'phone') setCollapsed(true);
  }, [ready, bp]);

  /* THE DEVICE BACK BUTTON CLOSES THE DRAWER RATHER THAN LEAVING THE PAGE (2026-08-25, Luke). It
     has a close control and a scrim below `md`, so it is a modal, and the OS gesture used to walk
     straight past it and off `/trades`.
     PHONE ONLY, which is exactly the width at which this is a drawer at all. At `stack` it never
     collapses and at `rail` it is a column - neither is something Back should be undoing. */
  useOverlayBack(!collapsed && bp === 'phone', () => setCollapsed(true));

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      /* A PHONE NEVER WRITES THE PREFERENCE, and that is the other half of the override above
         rather than a new rule. One key is shared with the desktop, where the rail is a COLUMN and
         "collapsed" is a lasting layout choice; on a phone it is a drawer, where closing is just
         finishing with it. Persisting the second would collapse the trader's desktop rail because
         they dismissed a drawer on their phone — which the scrim tap has been quietly doing. */
      if (bp !== 'phone') {
        try {
          localStorage.setItem(RAIL_COLLAPSE_KEY, next ? '1' : '0');
        } catch {
          // The preference is lost, the toggle still works. Never let storage break the control.
        }
      }
      return next;
    });
  }, [bp]);

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
    <>
      {/* THE ONE CONTROL, BOTH DIRECTIONS — ported from v2's `SessionsLayout` exactly. This used to
          be two different things: a keyboard-only close (`]`, undiscoverable) and a floating
          bottom-right button that only ever reopened. v2 never had that split — one `IconButton` in
          the header does both jobs, staying mounted and just flipping icon rotation, `data-active`
          and the tooltip label. A control that vanishes on close is a control with no way back that
          isn't also invisible. */}
      <HeaderSlot hostId={toggleHostId}>
        {/* ON A PHONE IT ONLY OPENS (2026-08-24, Luke: "the 'hide summary' button inside the summary
            panel is unnecessary at this point. remove it"). Below `md` the rail is a drawer, and a
            drawer already has two ways out that a column does not: the scrim and, as of this change,
            a swipe. The toggle's closing half was the third, and it was the one nobody could reach
            — the open drawer lies over the header slot it lives in.
            ABOVE `md` IT KEEPS BOTH DIRECTIONS, because there it is a column with no scrim and no
            gesture: take the closing half away and the only way to collapse the rail is the `]`
            shortcut, which is exactly the undiscoverable state v2 was ported here to fix.
            `contents` so the wrapper adds no box to the header's flex row; `max-md:hidden` beats it
            at phone width because twMerge keeps utilities that carry different modifiers. */}
        <div className={cn('contents', !collapsed && 'max-md:hidden')}>
        <Tooltip label={collapsed ? 'Show summary' : 'Hide summary'} shortcut="]">
          {/* VISIBLE AT EVERY WIDTH NOW (`S5d`, 2026-08-20, Luke's idea). It was `hidden lg:flex`,
              because below `lg` the rail was a stacked block that never collapsed and a toggle for
              something permanently open is a control that does nothing.
              Below `md` the rail is no longer stacked — it is a panel that slides in from the right
              — so the toggle has a real job again, and it takes the top-bar slot the reference uses
              for controls Run does not have (its bulk-edit and add-transaction buttons).
              IT IS THE SAME CONTROL, not a second one: same component, same `data-active`, same
              tooltip, same `]` shortcut. A phone-only twin would be two definitions of one job. */}
          <IconButton
            onClick={toggle}
            aria-label={collapsed ? 'Show summary' : 'Hide summary'}
            aria-pressed={!collapsed}
            data-active={!collapsed}
          >
            {/* TWO MARKS FOR ONE CONTROL, because the control does two different things. Above `md`
                the rail COLLAPSES a column sideways and the chevron points the way it travels,
                flipping when it opens — a direction that is literally true there. Below `md` it
                OPENS A DRAWER, where a direction describes nothing and a pair of left chevrons in
                the top-right corner reads as "back". See `DrawnSummary` in icon.tsx. */}
            <Icon name="summary" size={22} className="md:hidden" />
            <Icon
              name="collapse"
              size={18}
              className={cn('hidden transition-transform md:block', !collapsed && 'rotate-180')}
            />
          </IconButton>
        </Tooltip>
        </div>
      </HeaderSlot>

      {/* THE DRAWER'S SCRIM, phone only. `--scrim-nav`, the same token and the same no-blur
          treatment the sidebar's overlay uses — two drawers framing one screen have to dim it the
          same way or the second one reads as a different kind of thing. Tapping it closes, which is
          the affordance every overlay in this product already has. */}
      <button
        type="button"
        aria-label="Hide summary"
        onClick={toggle}
        style={{ background: 'var(--scrim-nav)' }}
        className={cn(
          'fixed inset-0 transition-opacity ease-out md:hidden',
          overPanel ? 'z-[65]' : 'z-40',
          collapsed ? 'pointer-events-none opacity-0' : 'opacity-100'
        )}
      />

      {/* `max-md:px-0` INSIDE THE PANEL (2026-08-28, postcheck). `DetailPanelBody` already supplies
          the phone's gutter, so the column's own `px-4` doubled it: the tape rendered 16px inset
          while its `loading.tsx` - which correctly has no column - rendered full bleed, and the
          skeleton stepped 16px sideways as the page committed. `SubjectPage` zeroes the same gutter
          for the sibling route and states the same reason. */}
      <div
        className={cn(
          PAGE_COLUMN,
          'grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]',
          overPanel && 'max-md:px-0'
        )}
      >
        <div className="min-w-0">{children}</div>

        {/* `StickyRail` OWNS THE PIN, and it measures rather than assuming. This carried a blanket
            `lg:sticky lg:top-0`, which is the version that hides the bottom of a rail taller than
            the viewport — see that file for the measurement. It also owns `order-last` below `lg`,
            where the tape is the subject and the summary is a comment on it. */}
        <StickyRail
          /* NAMED, because it is the SECOND `<aside>` on the page (2026-08-20, S5 step 3). The
             sidebar is the other one, and two unnamed complementary landmarks make a reader
             navigating by landmark enter each one to find out which is which. "Summary" is what the
             card inside it is titled and what its own toggle calls it, so the three agree. */
          aria-label="Summary"
          className={cn(
            /* CLIP, BUT NOT THE CARD'S SHADOW (2026-08-20, Luke: "there is a slight awkward squared
               off shadow or something at the bottom edges of the summary card"). This was a blanket
               `overflow-hidden`, and this element's box is pixel-identical to the `Card` inside it —
               measured at 304 x 483.33 for both — so the card's `0 2px 4px` shadow was clipped to
               nothing and the card rendered flat with hard square corners. The tape card beside it
               has no clipping ancestor and kept its shadow, which is what made the pair look wrong
               rather than merely plain.
               The clip itself is not optional: without it the pinned 304px contents spill past the
               closing edge for the whole 300ms. `.clip-allow-shadow` (globals.css) clips the layout
               and lets paint escape 8px, which is the CSS feature for this exact case.
               COLLAPSED GOES BACK TO `overflow-hidden`, or that 8px margin shows a sliver of a panel
               that is meant to be gone. Guarded on `lgUp` for the same reason `inert` below is: the
               rail does not collapse at all beneath `lg`, so a stored `collapsed` must not reach
               this decision and clip the shadow on a phone. */
            /* A RIGHT-HAND DRAWER ON A PHONE (`S5d`, 2026-08-20, Luke's idea and it solves a problem
               this slice had otherwise left open). The reference's mobile list carries no summary
               panel at all, and copying that literally would have stranded Net P&L, win rate and
               average session with nowhere to live until `S8` builds Today — the figures exist on
               no other surface.
               So the rail is not deleted below `md`, it is RE-CONTAINED: fixed to the right edge,
               off-screen until the header's summary toggle asks for it. It stacked underneath the
               tape before, which meant a trader scrolling 360 rows met it only after all of them.
               `.drawer-transition` is the same declaration the trade drawer slides on — 0.3s
               `ease-out`, translate — because this is the same move: a panel entering and leaving,
               not one resizing in place. The trade drawer does not exist below `md` (a row navigates
               to `/trades/[id]` there), so the right edge is free and the two never collide.
               A SECOND DRAWER, DELIBERATELY SYMMETRIC: nav slides from the left off the hamburger,
               summary from the right off its own toggle. */
            'max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:w-[min(20rem,85vw)] max-md:overflow-y-auto',
            overPanel ? 'max-md:z-[70]' : 'max-md:z-50',
            collapsed && 'max-md:translate-x-full',
            lgUp && collapsed ? 'overflow-hidden' : 'clip-allow-shadow',
            /* `panel-transition` so the rail and the sidebar are ONE declaration rather than two
               that currently agree — globals.css names this class after exactly that, since the
               rail was the second panel it had to cover. A hand-rolled
               `lg:transition-[width] duration-200` here ran the two panels framing the work at
               different speeds on the same curve nobody chose. */
            /* TWO DECLARATIONS, CHOSEN IN JS RATHER THAN BY A VARIANT (`S5d`, 2026-08-20). This
               was written as `max-md:drawer-transition` and lint rejected it — correctly, and it
               would have been a silent bug otherwise: a Tailwind VARIANT can only modify a Tailwind
               UTILITY, so a `max-md:` prefix on a hand-written class in globals.css generates
               nothing at all and the phone drawer would have snapped rather than slid.
               The two are genuinely different moves: above `md` the rail RESIZES in place, which is
               `panel-transition`'s width-and-`ease-in-out`; below it the rail ENTERS AND LEAVES,
               which is `drawer-transition`'s translate-and-`ease-out`. `mdUp` already exists for
               `inert`, so the choice costs nothing new. */
            ready && (mdUp ? 'panel-transition' : 'drawer-transition'),
            // cn(), never a template string: `lg:w-76` and `lg:w-0` are the same utility group
            // under the same modifier, so a raw template leaves BOTH in the attribute and
            // Tailwind's sheet order decides — which puts w-76 last and the rail never closes.
            collapsed ? 'lg:w-0' : RAIL_W,
          )}
          /* A collapsed rail is 0px wide and its contents are still in the tab order and still
             read aloud — `overflow-hidden` hides pixels, not the accessibility tree. Only above
             `lg`, where collapsing is possible at all. */
          /* Off-screen is off-screen at both ends: `w-0` above `lg`, translated out below `md`.
             Between them it is a stacked block that is always visible, so `inert` must not reach it
             there — `overflow-hidden` and a translate hide PIXELS, never the accessibility tree. */
          inert={collapsed && (lgUp || !mdUp)}
          /* SWIPE IT AWAY (2026-08-24, Luke: "the user needs to be able to swipe the summary panel
             to the right to close it to be consistent with the ability to close the left side
             panel by swiping"). The sidebar's gesture mirrored, and mirrored is the operative word:
             this panel enters from the RIGHT, so it leaves rightward. A drawer whose dismissing
             gesture ran the other way would be asking the trader to push it further onto the screen.
             Same 40px threshold and the same vertical guard, because a rail of figures is
             scrollable on a phone and a scroll must pass straight through.
             The handlers are unconditional; the gesture is not, because above `md` this element is
             an in-flow column that no touch device is going to be dragging. */
          onTouchStart={(e) => {
            swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          }}
          onTouchMove={(e) => {
            const s = swipe.current;
            if (!s || mdUp) return;
            const dx = e.touches[0].clientX - s.x;
            const dy = e.touches[0].clientY - s.y;
            if (Math.abs(dy) > Math.abs(dx)) {
              swipe.current = null;
              return;
            }
            if (dx > 40) {
              swipe.current = null;
              toggle();
            }
          }}
          onTouchEnd={() => {
            swipe.current = null;
          }}
        >
          {/* `max-md:h-full` so the drawer's contents fill it. Without it the `Card` inside keeps its
              natural height and hangs from the top of a full-height transparent container, with the
              tape showing through underneath — which reads as a card that failed to load rather
              than as a panel. */}
          <div className={cn('w-full max-md:h-full', RAIL_W)}>{rail}</div>
        </StickyRail>
      </div>
    </>
  );
}
