'use client';

/* THE PHONE'S CONTAINER FOR EVERY /accounts FLOW: a full-screen panel that arrives from the bottom,
 * with a stack of screens sliding over each other inside it (2026-08-28).
 *
 * Luke: "the add account modal on mobile is not a modal. it should be a new page/screen. however we
 * do it for the accounts and trades pages with options that give new pages/screens. follow for
 * consistency" — and then the rule that decides everything below: "basically no modals on mobile".
 *
 * ─── ONE RULE DECIDES WHETHER A SCREEN SLIDES ────────────────────────────────────────────────────
 *
 * **THE HEADER CHANGES, SO THE PAGE SLIDES. THE HEADER STAYS, SO THE BODY FADES.**
 *
 * Luke stated it as a walk through the manual flow: "evaluation and sim funded options both cause
 * the header to change. when the header changes, then the page slides up ... but when the user
 * clicks on a firm, the next screen still has the same header. so we wouldn't need a new page
 * sliding up. we would just need the screen to move to the next screen's step. but we need a
 * transition. it cant be just a hard chop."
 *
 * That is a better rule than "one drill-in level", which is what `filter-sheet.tsx` settled on, and
 * it SUBSUMES it: that sheet refused a second level because "the way back would be ambiguous" — and
 * the way back is ambiguous exactly when two stacked screens are named the same thing. A screen that
 * renames the bar is a place you have arrived at, and its back arrow points at a bar that says
 * something else. So depth is allowed here, bounded by the flows themselves at three positions.
 *
 * The other half of the rule is not this file's: a same-header step change is `key` + `.value-fade`,
 * which `LabelAccountForm` has shipped since C3 and which the manual form now uses between Firm and
 * Size. Emil Kowalski's tips (`ui-ux-sources.md`) list a blur-masked crossfade as the thing to reach
 * for IF a plain opacity swap ever feels off; it has not, and the system already owns the plain one.
 * The one finding worth carrying from the current research is that a step transition which is too
 * FAST gets missed entirely — people press Next and do not register that the content changed — so
 * 0.14s is the floor here rather than a target to beat.
 *
 * ─── WHY THE LAYERS ARE HELD ─────────────────────────────────────────────────────────────────────
 *
 * A screen that has been popped must stay on screen for the 200ms it takes to leave. The flow above
 * stops supplying it the instant the trader presses Back, so this holds the last node it saw at each
 * depth and keeps rendering that. Same split `FilterSheet` makes with `shown`, and `TradeSheet` with
 * its own — generalised, because there are three depths rather than one.
 *
 * THE HEADER DOES NOT TRAVEL. It is hosted absolutely above every layer and each screen portals into
 * it (`surface.tsx`), so it swaps on the frame of the tap while only the body moves.
 */

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useOverlayBack } from '@/lib/overlay-back';
import { SurfaceProvider } from './surface';

/** Out. Must agree with `.sheet-transition[data-open='false']`'s 0.2s, the same pairing
 *  `MODAL_EXIT_MS` keeps with the modal's fade. */
export const SHEET_EXIT_MS = 200;

/* Hold a sheet mounted long enough to travel, both ways.
 *
 * The entrance needs a frame at `translate-y-full` to transition FROM, and the exit needs the panel
 * to still exist while it leaves - the owner unmounts it, so the owner cannot be the thing that
 * decides when. Same division of labour as `useModalClose`, and it is a separate hook rather than a
 * shared one because the two containers have different clocks: a modal fades out in 160ms, a sheet
 * travels the height of the screen in 200.
 */
export function useSheet(onClosed: () => void) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const requestClose = useCallback(() => {
    // A second tap during the travel must not schedule a second unmount.
    if (timer.current) return;
    setOpen(false);
    timer.current = setTimeout(() => {
      timer.current = null;
      onClosed();
    }, SHEET_EXIT_MS);
  }, [onClosed]);

  return { open, requestClose };
}

/** Base plus two drill-ins. Add tops out at doors -> manual -> firm/size, Edit at edit -> type ->
 *  firm, and a flow needing a fourth is a flow that should be asking fewer questions. */
const MAX_LAYERS = 3;

export function AccountSheet({
  open,
  onClose,
  onBack,
  busy,
  label,
  layers,
  onMark,
}: {
  open: boolean;
  onClose: () => void;
  /** Walk back one screen. Answers Escape and the device Back button whenever depth > 0. */
  onBack: () => void;
  /* LOCKS EVERY EXIT, and it is what lets a confirmation stack on top of this one. Two sheets both
     listening for Escape on `document` would BOTH answer a single press, because `stopPropagation`
     does not reach a sibling listener on the same node — only `stopImmediatePropagation` does, and
     racing on registration order is not a mechanism. So the sheet underneath is told to stop
     listening instead, exactly as `ModalShell` is. The device Back button needs no equivalent:
     `useOverlayBack` orders its registrations by token and only the innermost answers a pop, and
     since 2026-08-28 it also declares the pops it causes itself so the sheet underneath does not
     read one as a press.
     It also blocks the exit during a write in flight, which is `AddAccountModal`'s use of it - and
     the device Back button DOES need an equivalent for that half, which is why the handler below
     spends the press rather than obeying it. */
  busy?: boolean;
  /** Names the dialog for a screen reader. The visible title is the active screen's own header. */
  label: string;
  /** Index IS depth. `null` means that layer is off-screen; index 0 is the base and never is. */
  layers: (ReactNode | null)[];
  /** Handed `useOverlayBack`'s marker once, for a caller that commits a navigation. See below. */
  onMark?: (mark: () => void) => void;
}) {
  const host = useId();
  const depth = layers.reduce<number>((d, node, i) => (node == null ? d : i), 0);

  /* THE LAST NODE SEEN AT EACH DEPTH, and it is STATE ADJUSTED DURING RENDER rather than a ref.
     A ref was the first shape and the React Compiler's lint refuses it outright ("Cannot access refs
     during render"), correctly: a ref read while rendering is a value the compiler cannot reason
     about when it decides what to memoise.
     An effect is the other obvious answer and it is wrong here for a reason the eye can see. Effects
     run AFTER paint, so a layer arriving would render empty for its first frame - the whole frame it
     is sliding in on. Setting state during render re-runs this component immediately, before the
     browser paints anything, which is exactly the guarantee this needs.
     IT TERMINATES because `layers` is the same array on the re-render it schedules: the second pass
     finds every entry already stored and sets nothing. */
  const [held, setHeld] = useState<ReactNode[]>([]);
  /* EVERY LAYER BOX EXISTS FROM THE FIRST RENDER, EMPTY, and that is a bug fix rather than tidiness
     (2026-08-28, Luke: "it does not do it on the first try. so on first load it does not slide up
     but then if i go back and try it again, it does slide up").
     This was padded to the deepest layer ever SEEN, so the box for a screen nobody had opened yet
     did not exist - and on the first Change tap it mounted ALREADY at depth 1, with
     `translate-y-full` never painted. A transition needs a FROM value that the browser has actually
     rendered; there was none, so the first open cut and every later one slid. Rendering the box
     empty and parked off-screen gives it that first frame.
     They cost nothing: an `inert`, translated, contentless `absolute` box paints nothing.
     THE HELD CONTENT STILL LAGS DELIBERATELY. The edit form passes one entry per screen in its
     stack, so the array SHRINKS on a back press - reading only what it passes would drop the
     departing layer from the document instead of sliding it away. */
  const shown = Array.from({ length: MAX_LAYERS }, (_, i) => layers[i] ?? held[i] ?? null);
  /* NO MUTATION ANYWHERE ABOVE, which is the second thing the React Compiler's lint asked for after
     it refused the ref: a copied array written into in a loop is still "a value that cannot be
     modified" as far as it can tell. Built whole, compared whole. */
  if (shown.length !== held.length || shown.some((node, i) => node !== held[i])) setHeld(shown);

  /* ONE HISTORY ENTRY, RE-ARMED PER LEVEL, and this replaces one registration PER DEPTH
     (2026-08-28, Luke: "on mobile it doesn't work. and it locks me out. I can't go back").
     Three registrations meant up to three live entries, and closing one of them from inside called
     `history.back()` — whose `popstate` the OTHER two also hear. Whichever was innermost by then
     answered it as though the trader had pressed Back, so changing a firm (which unwinds the stack
     by itself, without any press) fired a cascade: the sheet ate presses it had already spent and
     the way out stopped working. It is the same defect the filter sheet had, and the same fix.
     THE HANDLER RETURNS `true` WHILE THERE IS STILL A LEVEL TO GO BACK TO, which tells the hook to
     hand back a fresh entry: the sheet is still up, one screen shallower, and still owes Back an
     answer. So Back walks the stack one press at a time on one entry at a time.
     `depthRef` because the handler is read out of a ref long after the render that made it.
     NO URL: a half-answered flow is not a place, the call `FilterSheet` makes. */
  const busyRef = useRef(busy);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  /* ONE REGISTRATION PER DEPTH, EACH PUSHED BY THE TAP THAT DRILLED IN - and `filter-sheet.tsx`
     carries the full reasoning, because both files had the same defect for the same day. The short
     version: an entry re-armed inside a `popstate` handler has no user gesture behind it, and
     Chrome's history manipulation intervention silently discards it, so the next Back walked past
     the app and minimised the browser.
     `MAX_LAYERS` REGISTRATIONS, NOT `depth` OF THEM, because a hook count may not vary between
     renders. Each is live only at or below its own depth, so the stack of entries matches the stack
     of screens exactly.
     A WRITE IN FLIGHT SPENDS THE PRESS. Returning `true` re-arms, which is the one place this file
     still does - the sheet must stay up and still owe Back an answer, and there is no tap to hang a
     fresh entry on. `overlay-back.ts` states what that costs. */
  const markReplacing = useOverlayBack(open, () => {
    if (busyRef.current) return true;
    onClose();
    return false;
  });
  useOverlayBack(open && depth >= 1, () => {
    if (busyRef.current) return true;
    onBack();
    return false;
  });
  useOverlayBack(open && depth >= 2, () => {
    if (busyRef.current) return true;
    onBack();
    return false;
  });

  /* THE MARKER IS HANDED OUT, because a caller that COMMITS A NAVIGATION has to be able to say so
     (2026-08-28, postcheck). `useOverlayBack`'s cleanup consumes this sheet's history entry with
     `history.back()`, and inside one React commit every effect cleanup runs before anything else -
     so Delete's `router.replace('/accounts')` was racing a `back()` that would have popped it onto
     the URL of the account it had just deleted. `FilterSheet` calls the same marker for the same
     reason and it is the only thing that made `Clear all` stick.
     A CALLBACK, NOT A REF OUT-PARAM. The first shape filled a `RefObject` the caller passed in, and
     the React Compiler refuses it - "Passing a ref to a function may read its value during render" -
     which is the same rule that shaped `markReplacing` itself. Handing the function upward once is
     the version that has no ref crossing a boundary at all. */
  useEffect(() => {
    onMark?.(markReplacing);
  }, [onMark, markReplacing]);

  /* ESCAPE BACKS OUT ONE LEVEL, THEN CLOSES. Dismissing the whole sheet from a sub-screen would
     throw away the screen the trader was reading rather than the one they opened. This reaches a
     phone with a keyboard attached, and a narrowed desktop window. */
  useEffect(() => {
    if (!open) return;
    if (busy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (depth > 0) onBack();
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, depth, onBack, onClose]);

  // The page behind must not scroll while this is up, the same lock `ModalShell` takes.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      /* THREE ATTRIBUTES, THREE AUDIENCES, and they belong on the ROOT rather than on the layers:
         `pointer-events-none` stops the pointer, `aria-hidden` stops the reader, and only `inert`
         takes a dismissed panel out of the TAB ORDER. Putting the last one on the content layers is
         what once left `FilterSheet`'s footer focusable off-screen. */
      className={cn('fixed inset-0 z-[70]', !open && 'pointer-events-none')}
      aria-hidden={!open}
      inert={!open}
    >
      {/* Only ever seen during the travel, and it still earns its place: without it the roster shows
          through under a sheet that has not landed. */}
      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-300 ease-out',
          open ? 'opacity-100' : 'opacity-0'
        )}
        style={{ background: 'var(--scrim-nav)' }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-open={open}
        /* `translate-y-full` HERE, NOT IN `.sheet-transition`. The class owns the timing and the call
           site owns the position — the contract a stale stylesheet broke on 2026-08-24, when the
           dismissed state lived in a hand-written rule and a deploy without it painted an inert
           panel over the whole app. */
        className={cn(
          'sheet-transition bg-surface absolute inset-0 flex flex-col',
          !open && 'translate-y-full'
        )}
      >
        {/* THE HEADER HOST, above every layer and outside all of them. The active screen portals its
            own header in (`SurfaceHeader`), so the bar changes on the frame of the tap and the body
            underneath is the only thing that travels. */}
        <div id={host} className="absolute inset-x-0 top-0 z-10" />

        {shown.map((node, i) => (
          <div
            key={i}
            data-open={depth >= i}
            /* `inset-0` WITH `pt-16`, NOT `top-16`. `translate-y-full` is 100% of this element's OWN
               height, so a box inset from the top by the header would stop 64px short and park a
               strip of the screen at the bottom of the display.
               The base layer does not travel and needs neither the transition nor a ground of its
               own; the panel behind it already has one. */
            className={cn(
              'absolute inset-0 flex flex-col pt-16 pb-[env(safe-area-inset-bottom)]',
              i > 0 && 'sheet-transition bg-surface',
              i > depth && 'translate-y-full'
            )}
            inert={i !== depth}
          >
            <SurfaceProvider mode="sheet" headerHost={host} active={i === depth}>
              {node}
            </SurfaceProvider>
          </div>
        ))}
      </div>
    </div>
  );
}
