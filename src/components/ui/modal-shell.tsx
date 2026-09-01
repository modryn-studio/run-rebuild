'use client';

/* THE FLOATING-MODAL CHROME: scrim, card, fade, Escape, backdrop click, body-scroll lock.
 *
 * MOVED OUT OF `views/accounts/` ON 2026-08-31, and the trigger was the codebase's own rule rather
 * than tidiness: "Shared, not per-page. Two copies of one control is how two headers drift." It had
 * three consumers outside that folder - the rack, the demo scenes, and `/today`'s recap through
 * `ConfirmShell` - and one of those, `ConfirmShell`, had already drifted into a SECOND COPY of this
 * shell that was missing the scrim fade, the exit fade, Escape and the scroll lock. See
 * `scar-tissue.md`, "Three overlays, three copies of the same shell".
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

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cardSurface } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { cn } from '@/lib/cn';

/** Out, and in. Must agree with the `duration-[160ms]` / `duration-300` classes below; exported so
 *  every other overlay fades on the same clock rather than each picking its own number. */
/* THE TWO LABELLING IDS LIVE WITH THE SHELL THAT READS THEM (moved here 2026-08-31 with the file).
 *
 * They were declared in `views/accounts/shared.tsx`, which made this file import from that one - and
 * that single edge is why `shared.tsx` cannot import `ModalActions` back and inlines its four
 * classes by hand instead, with a comment saying so. Owning them here points the dependency the way
 * it always should have gone: the thing that writes `aria-labelledby` owns the id, and everything
 * that writes the matching `id=` reads it from here.
 *
 * THE VALUES LOST THEIR `accounts-` PREFIX in the same move. They were named when /accounts was the
 * only surface with a modal; `/today`'s recap uses the same shell now, and a DOM id that names the
 * wrong feature is a small lie that the next reader has to disprove. Nothing selects on either
 * string except `aria-labelledby`. */

/** `ModalShell` labels its dialog by this id, so exactly one element per screen carries it - the
 *  header's title, or the completion screen's headline, which IS that screen's title. */
export const MODAL_TITLE_ID = 'modal-title';

/* A CONFIRMATION NEEDS ITS OWN (2026-08-28, postcheck). `ConfirmShell` renders OVER a form that is
   still mounted, so while Delete is up there were two live elements carrying `MODAL_TITLE_ID` - and
   `aria-labelledby` resolves to the FIRST in document order, which is the editor's. A screen reader
   announced the alertdialog as "Edit account" rather than "Delete this account?". */
export const CONFIRM_TITLE_ID = 'confirm-title';

/** Declared here as it is in `header-slot.tsx`, `use-popover.ts` and `surface.tsx` - a fourth local
 *  copy rather than a shared util invented mid-fix. `useLayoutEffect` warns on the server. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

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
  return <ModalScroller className={cn('pb-4', className)}>{children}</ModalScroller>;
}

/* THE ONE SCROLL REGION EVERY MODAL USES, AND IT HAS NO SCROLLBAR.
 *
 * 2026-08-31, Luke: *"they dont use scroll bars in modals... i dont want to either. remove
 * scrollbars from modals app wide. they use an arrow to hint scroll."* Measured on the reference's
 * own recap flow, and every number below is theirs: the scroller is `overflow-y: auto` with
 * **`scrollbar-width: none`**, and a **36px circular** button sits **centred, 12px above its
 * floor**, fading to `opacity: 0` at the end rather than unmounting.
 *
 * A COMPONENT RATHER THAN A CSS RULE ON `[role=dialog]`, and that is the choice worth defending. A
 * descendant selector would cover every modal at once and need no call site to change - but
 * `verify-css.mjs` can only protect a rule it can see as a CLASS, and `globals.css` already carries
 * one scrollbar rule the checker structurally cannot reach (the phone media query). Two invisible
 * rules is one too many. This is greppable, typed, and it carries the hint, which a CSS rule could
 * never do.
 *
 * `no-scrollbar`, NOT `scroll-thin`. The two exist for different jobs and `globals.css` states it:
 * a long content pane has to advertise that it scrolls; this one does not, because the hint
 * advertises it better than a 6px bar does.
 */
export function ModalScroller({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  /* MEASURED, NOT ASSUMED, and re-measured on every event that can change the answer: the trader
     scrolling, and the content or the viewport resizing under a `max-h-[85dvh]` card. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setMore(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      el.removeEventListener('scroll', check);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={ref} className={cn('no-scrollbar min-h-0 flex-1 overflow-y-auto', className)}>
        {children}
      </div>

      {/* AN `IconButton`, NOT A SHADOWED CIRCLE. Theirs is white with
          `0 2px 8px rgba(34,32,29,.1)`, and `design-system.md` is explicit that a control gets a
          border OR a shadow and only `Card` gets the shadow. `IconButton` is already "36px, a
          hairline, a hair of lift" - the same object, at the same size, measured off the same
          reference when that primitive was built. `bg-surface` so content does not read through it.
          `aria-hidden` and `tabIndex={-1}`: it duplicates a gesture the scroller already has, so a
          keyboard user would meet an extra stop for nothing. This is a POINTER hint. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-3 flex justify-center transition-opacity duration-200 ease-out',
          more ? 'opacity-100' : 'opacity-0'
        )}
      >
        <IconButton
          tabIndex={-1}
          className={cn('bg-surface rounded-full', more && 'pointer-events-auto')}
          onClick={() =>
            ref.current?.scrollBy({ top: ref.current.clientHeight * 0.8, behavior: 'smooth' })
          }
        >
          <Icon name="chevron" size={16} />
        </IconButton>
      </div>
    </div>
  );
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
  role = 'dialog',
  labelledBy = MODAL_TITLE_ID,
  width = 'max-w-lg',
  className,
  children,
}: {
  /** Called by Escape and by a backdrop click. A modal with internal steps passes a handler that
   *  walks back one step instead of closing, so the shell never has to know about views. */
  onDismiss: () => void;
  busy?: boolean;
  /** True once the owner has started closing (see `useModalClose`). Drives the exit fade. */
  closing?: boolean;
  /* THE THREE THINGS A SECOND CALLER NEEDED (2026-08-31). `ConfirmShell` had reimplemented this
     whole shell rather than take it, and the copy was missing the scrim fade, the exit fade, the
     Escape handler and the scroll lock - so `Add account` faded and `Close this account?` appeared
     and vanished in a frame. Luke noticed it from the outside: *"the scrim animation is not the
     same as the /account page"*. Three optional props were the entire distance between the two
     files, and every default here is what the eleven existing callers already got. */
  role?: 'dialog' | 'alertdialog';
  labelledBy?: string;
  width?: string;
  /** Stacking only. `ConfirmShell` raises this over the edit modal it opens on top of. */
  className?: string;
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

  /* ─── A MODAL IS A CHILD OF `<body>`, NEVER OF THE THING IT COVERS (#35, fixed 2026-08-31) ─────
   *
   * `label-account-form.tsx` returns `<>{screen}{confirmations}</>` and `label-account-modal.tsx`
   * wraps that whole thing in this shell's card - so `Close this account?` was rendering INSIDE the
   * editor it sits on top of. Its own comment claimed "`z-[70]` OVER THE EDIT MODAL'S `z-[60]`",
   * and that was never what was happening: nested inside that stacking context, it won by DOM order
   * instead.
   *
   * IT WORKED, AND THAT IS THE DANGEROUS PART. `position: fixed` escapes an `overflow: hidden`
   * ancestor, so the confirmation drew correctly - right up until the day something puts a
   * `transform`, `filter` or `contain` on `cardSurface`. Any one of those makes the card a
   * containing block for fixed descendants, and the confirmation would be clipped to a card it is
   * supposed to cover. `recent-trades.tsx` and `trades-controls.tsx` were both moved to avoid
   * exactly this, which is how it got filed.
   *
   * A PORTAL SETTLES IT rather than a rule nobody can see: every modal is a direct child of `body`,
   * so `z-index` means what the comments have always said it means, and nesting one shell inside
   * another is no longer a thing a call site can accidentally do.
   *
   * THE HOST IS STATE, not `document.body` read during render - this component server-renders, and
   * `createPortal` needs a real node. Resolved in a layout effect, so the portal exists before the
   * browser paints and the entrance is not a frame late. */
  const [host, setHost] = useState<HTMLElement | null>(null);
  useIsomorphicLayoutEffect(() => setHost(document.body), []);
  if (!host) return null;

  return createPortal(
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
      className={cn(
        'fixed inset-0 z-[60] flex items-center justify-center p-4 transition-opacity duration-[160ms] ease-linear',
        closing ? 'pointer-events-none opacity-0' : 'opacity-100',
        className
      )}
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
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn(
          cardSurface,
          'relative z-10 flex max-h-[85dvh] w-full flex-col overflow-hidden',
          width
        )}
      >
        {children}
      </div>
    </div>,
    host
  );
}
