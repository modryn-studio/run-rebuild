'use client';

/* The floating-modal chrome for /accounts: scrim, card, fade, Escape, backdrop click.
 * Ported from `run-trading@v2` (2026-08-15, S4e). The interesting part is not the markup but the
 * rules baked into it, every one of which was argued once and should not be re-argued per modal.
 *
 * THE EXIT FADE, AND WHY IT REVERSES AN EARLIER DECISION (Luke, 2026-07-30). This used to close
 * INSTANTLY on purpose: the trader has already decided, and a close that takes 300ms reads as lag
 * rather than craft. That reasoning was right about 300ms and wrong about zero — vanishing in a
 * single frame reads as a glitch, not as responsiveness. So the exit is a fade DELIBERATELY MUCH
 * FASTER THAN THE ENTRANCE: 160ms out against 300ms in. Slow enough that nothing snaps, fast enough
 * that it is over before it can be experienced as waiting. Enter slow, leave quick is also just the
 * convention — an entrance is an event, an exit is a dismissal.
 *
 * LINEAR, not the entrance's ease-out curve, and that was measured rather than chosen. On ease-out
 * a 140ms fade was already down to 10% opacity at the halfway mark, so almost all of it happened in
 * the first few frames and it still read as a snap: the curve was undoing the fix. Linear spends the
 * time evenly, which is the only way a fade this short is perceptible at all.
 *
 * The whole overlay fades on exit (scrim AND card together), where only the scrim fades on entry.
 * Fading the scrim alone on the way out would leave the card gone and the page still dimmed for a
 * beat, which looks broken rather than subtle.
 *
 * BUSY BLOCKS EVERY EXIT. Leaving mid-upload does not cancel the request — the corpus write still
 * lands while the result is thrown away, which is the one outcome worth a locked door.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cardSurface } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { MODAL_TITLE_ID } from './shared';

/** Out, and in. Must agree with the `duration-[160ms]` / `duration-300` classes below; exported so
 *  every other overlay fades on the same clock rather than each picking its own number. */
export const MODAL_EXIT_MS = 160;

/* Hold a modal mounted long enough for its exit fade, then unmount it.
 *
 * The owner calls `requestClose()` instead of unmounting directly, and passes `closing` straight
 * through to ModalShell. The timer is the only thing that actually unmounts, so a double-click on X
 * cannot schedule two of them (the ref guard), and unmounting mid-fade cannot leave a timer
 * pointing at dead state (the cleanup).
 */
export function useModalClose(onClosed: () => void) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const requestClose = useCallback(() => {
    if (timer.current) return;
    setClosing(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      /* Reset BEFORE handing back. This hook outlives the modal it closes — it lives in the owner,
         the modal is what unmounts — so a `closing` left true is still true the next time the modal
         opens, which rendered the whole overlay at opacity-0 and pointer-events-none, i.e. the
         button appeared dead until a page refresh. Caught 2026-07-30. */
      setClosing(false);
      onClosed();
    }, MODAL_EXIT_MS);
  }, [onClosed]);

  return { closing, requestClose };
}

/* The scrolling middle of a modal. `min-h-0` is not decoration: a flex child defaults to
 * `min-height: auto`, which refuses to shrink below its content, so without it the card grows past
 * `max-h` and the footer leaves the viewport instead of the body scrolling.
 *
 * THE DEFAULT `pb-4` IS LOAD-BEARING, and it is not symmetry for its own sake. `overflow-y-auto`
 * clips on EVERY side, whether or not a scrollbar ever appears, so anything that animates outward at
 * the bottom edge gets its last frames cut off by the boundary the footer sits against. In v2 that
 * was the size chips: a selection pop scaling to 1.008 was clipped on the bottom row, so the
 * confirming gesture on the last question of the screen was the one that did not play. A default
 * here rather than a fix at one call site, because the next screen to end in a selectable row would
 * inherit the same bug silently. Callers passing their own `pb-*` still win (cn is tailwind-merge).
 */
export function ModalBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('scroll-thin min-h-0 flex-1 overflow-y-auto pb-4', className)}>{children}</div>;
}

/* Pinned under the scroll, so the one action a screen exists to reach never scrolls away.
 *
 * NO TOP RULE (Luke, 2026-07-31: "the footer shouldn't have a top border"). It had one on the
 * argument that a scrolling body needs its end drawn. Measured on the reference, their modal header
 * and footer both carry `border-width: 0` — a modal is ONE object, and ruling its own chrome off
 * from its own content divides a thing that is already whole. The scroll edge is stated by the
 * content running out, not by a line. */
export function ModalFooter({ children }: { children: ReactNode }) {
  return <div className="shrink-0 px-6 py-4">{children}</div>;
}

/* Two actions, sized to their labels and pushed right — the shape for a footer offering a commit
 * AND a retreat.
 *
 * WHY NOT TWO FULL-WIDTH BUTTONS, which is what this was. The variable is not wizard-versus-form,
 * it is HOW MANY ACTIONS the footer offers. One action with no alternative earns the card's full
 * width, because the target is the footer. Two actions at `flex-1` claim the two are peers, and
 * they are not: a retreat takes half the footer's visual weight to carry a tenth of its signal.
 * Sizing to the label is what lets a pair express rank at all.
 *
 * BELOW `sm` THEY GO BACK TO FULL WIDTH at 44px, because the 36px that reads as restraint under a
 * mouse is under the tap floor. */
export function ModalActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end gap-2 max-sm:gap-3 [&>*]:max-sm:min-h-11 [&>*]:max-sm:flex-1">
      {children}
    </div>
  );
}

export function ModalShell({
  onDismiss,
  busy,
  closing,
  children,
}: {
  /** Called by Escape and by a backdrop click. A modal with internal steps passes a handler that
   *  walks back one step instead of closing, so the shell never has to know about views. */
  onDismiss: () => void;
  busy?: boolean;
  /** True once the owner has started closing (see `useModalClose`). Drives the exit fade. */
  closing?: boolean;
  children: ReactNode;
}) {
  // `open` starts false and flips true one frame after mount, so arriving is a transition.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onDismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onDismiss]);

  // The page behind must not scroll while this is up, or the wheel moves the roster underneath the
  // modal and the trader loses their place for having opened a dialog.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /* A backdrop click must have STARTED outside the card, not merely ended there.
   *
   * The bug this fixes (Luke, 2026-07-30): select text in the firm search, drag past the card's
   * edge, release, and the modal closed. `click` fires on the nearest common ancestor of mousedown
   * and mouseup, so a drag beginning inside the card and ending outside it dispatches `click` out
   * here even though the press never was. Inspecting the click's target cannot tell the two apart,
   * because by then the target already is outside the card.
   *
   * CONTAINMENT, NOT `target === currentTarget`, and the difference is not academic — the first
   * attempt used the identity check and broke backdrop-click-to-close entirely. The scrim is an
   * absolutely-positioned CHILD covering the whole overlay, so what sits under the cursor on a
   * genuine backdrop click is the scrim, never this container: the identity check was false for
   * every real click. "Was the press outside the card" is the actual question, and it is true for
   * the scrim and false for anything in the dialog.
   */
  const cardRef = useRef<HTMLDivElement>(null);
  const pressedOutside = useRef(false);
  const outsideCard = (target: EventTarget | null) => !cardRef.current?.contains(target as Node);

  return (
    <div
      /* Exit fades the whole overlay; entry leaves the card alone (only the scrim animates in).
         `pointer-events-none` while closing so a second click during the fade cannot land.
         `ease-linear` IS A STATED EXCEPTION TO THE CURVE ROLES, not an oversight, and it is written
         down here because an audit flagged it as one (2026-08-20). The role table says `linear` is
         for CONSTANT motion only - the spinner - and that something leaving takes `ease-out`. This
         departs from it on a measurement, recorded at the top of this file: on ease-out a 140ms fade
         is already at 10% opacity by the halfway mark, so almost all of it happens in the first few
         frames and it still reads as a snap. The curve was undoing the fix the short duration
         exists for.
         `ui-ux-sources.md` sanctions exactly this shape of departure - Sonner ships `ease` where
         `ease-out` is technically correct, "a real reminder that the role table is a default, not a
         law". A departure with a measurement behind it stands; one without does not. */
      className={`fixed inset-0 z-[60] flex items-center justify-center p-4 transition-opacity duration-[160ms] ease-linear ${
        closing ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      onMouseDown={(e) => {
        pressedOutside.current = outsideCard(e.target);
      }}
      onClick={(e) => {
        if (!busy && pressedOutside.current && outsideCard(e.target)) onDismiss();
        pressedOutside.current = false;
      }}
    >
      {/* A sibling of the dialog, not a wrapper around it, so the card itself never animates on the
          way IN — only the dim layer transitions. */}
      <div
        aria-hidden
        /* `ease-out`, THE TOKEN, not the curve written out (2026-08-20). This read
           `ease-[cubic-bezier(0.22,0.61,0.36,1)]`, which IS `--ease-out` - the same numbers, inlined
           at a call site. A token spelled out by hand is a second copy of a value that has one home,
           and it silently stops tracking the token the moment the curve is ever retuned. */
        className={`absolute inset-0 transition-opacity duration-300 ease-out ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        /* `--scrim`, not a color-mix off `--color-text`: that token inverts by mode, so in dark it
           painted the page 40% WHITE. See the token's own note in globals.css. */
        style={{ background: 'var(--scrim)' }}
      />
      {/* ONE SCROLLBAR, AND IT IS INSIDE THE CARD. The dialog is a flex column, its middle child is
          `flex: 1 1 0%` with `overflow-y: auto` and no border, and the footer sits outside that
          child so the primary action never scrolls away. In v2 this card was `overflow-y-auto`
          itself while the firm list ALSO had its own `max-h` scroller inside it: two scrollbars, and
          at browser zoom you met both. */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={MODAL_TITLE_ID}
        className={cn(cardSurface, 'relative z-10 flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden')}
      >
        {children}
      </div>
    </div>
  );
}
