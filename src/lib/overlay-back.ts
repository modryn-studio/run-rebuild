/* THE DEVICE BACK BUTTON DISMISSES THE OVERLAY, IT DOES NOT LEAVE THE APP (2026-08-25, Luke: "if
 * the page has a back arrow or 'x' button, the back button on the user's device should take the
 * user back a step or close the modal/page that has the 'x' button").
 *
 * It was right, and the gap was real: every dismissible surface on the phone except the trade route
 * was pure client state, so the OS back gesture walked straight past it and out of `/trades`
 * entirely. A trader who opened Filters and pressed back left the tape rather than closing the
 * panel sitting in front of them.
 *
 * THE RULE IS "ANYTHING WITH AN X OR A BACK ARROW ANSWERS THE BACK BUTTON", and it lives here
 * rather than in each surface, because a rule remembered per call site is a rule that is wrong on
 * the sixth one. Filters, its drill-in, the sidebar drawer and the summary panel all call this.
 *
 * ─── WHY THIS IS SAFE, GIVEN THE PROJECT ALREADY REFUSED IT ONCE ─────────────────────────────
 *
 * `trades/[id]` argued against overlays precisely because "an overlay owes the phone's BACK GESTURE
 * an answer, which means intercepting history, and getting that wrong strands someone on a screen
 * they cannot leave". That objection stands; this is the answer to it rather than a dismissal.
 *
 * The way history interception strands people is by falling out of sync - pushing an entry and then
 * failing to consume it, so the stack fills with entries that dismiss nothing and Back stops
 * appearing to work. So the ownership here is strict and symmetric, and it hangs off ONE effect:
 *
 *   - Opening pushes exactly one entry, tagged with a token only this hook issues.
 *   - `popstate` means the OS consumed it. Flip the flag FIRST, then close.
 *   - Closing from an in-app control runs the effect's cleanup, which consumes the entry with
 *     `back()` - but only if popstate did not already, and only if our entry is still on top.
 *
 * The last clause is what stops the worst failure. If the overlay unmounts because the trader
 * navigated somewhere else (a tab in the bottom bar), an unconditional `back()` would undo that
 * navigation and yank them backwards. Checking that `history.state` still carries OUR token means
 * we only ever consume an entry we actually put there.
 *
 * NEXT'S ROUTER IS FINE WITH THIS, and it is documented rather than assumed: "Next.js allows you to
 * use the native `window.history.pushState` ... to update the browser's history stack without
 * reloading the page", and such calls "integrate into the Next.js Router, allowing you to sync with
 * `usePathname`" (`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`).
 * Measured on this app before it was relied on: pushing a different PATHNAME left all 60 tape rows
 * mounted and fired zero network requests, and so did the `back()` that undid it. That is the whole
 * reason the trade sheet can change the URL without the tape unmounting underneath it.
 */

import { useEffect, useRef } from 'react';

/** Tags the entries this hook issues, so cleanup can tell one of ours from anybody else's. */
const TOKEN = 'runOverlay';
let counter = 0;

export function useOverlayBack(
  open: boolean,
  onClose: () => void,
  /** A URL to show while the overlay is up. Omit to keep the current one. The trade sheet passes
   *  `/trades/<id>` so the screen is shareable and survives a reload; Filters passes nothing,
   *  because a staged, uncommitted filter draft is not a place. */
  url?: string
) {
  /* THE CALLBACK IS READ, NOT OBSERVED. `onClose` is almost always an inline arrow, so a fresh
     identity every render - in the deps it would tear the listener down and push a SECOND history
     entry on every re-render of the parent. A ref keeps the effect keyed to `open` alone. */
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  }, [onClose]);

  /** True while an entry we pushed is still waiting to be consumed. */
  const ours = useRef(false);

  useEffect(() => {
    if (!open) return;

    const token = ++counter;
    window.history.pushState({ [TOKEN]: token }, '', url);
    ours.current = true;

    const onPop = () => {
      /* ONLY THE INNERMOST OVERLAY ANSWERS A GIVEN POP, and getting this wrong was visible on the
         first test: one press of Back from the Date Range screen closed the drill-in AND the sheet
         under it. `popstate` is a WINDOW event, so every registered overlay hears every pop - two
         listeners, one press, both closing.
         The tokens are monotonic, so they order the stack. `popstate` reports the entry we LANDED
         on, so anything issued after it has just been discarded and anything issued before it is
         still standing. `>` rather than `!==` for that reason: with three levels open, `!==` would
         be true for the outermost as well and collapse the whole stack in one press.
         Zero when we have landed somewhere with no overlay entry at all, which is the ordinary
         case of the last overlay closing back onto the page. */
      const landed = (window.history.state as Record<string, number> | null)?.[TOKEN] ?? 0;
      if (token <= landed) return;
      /* THE FLAG GOES DOWN BEFORE `onClose` RUNS, not after. `onClose` flips the parent's state,
         which re-runs this effect and fires the cleanup below in the same commit - and a cleanup
         that still saw `ours.current === true` would call `back()` for an entry the OS has already
         popped, sending the trader a screen further back than they asked to go. */
      ours.current = false;
      latest.current();
    };
    window.addEventListener('popstate', onPop);

    return () => {
      window.removeEventListener('popstate', onPop);
      /* CLOSED FROM INSIDE: consume the entry so the stack stays level. Two guards, and both have
         a failure they prevent. `ours.current` means popstate did not already take it. The state
         check means our entry is still the CURRENT one - if the trader left via a link instead,
         ours is buried and `back()` would undo their navigation rather than our overlay. */
      if (
        ours.current &&
        (window.history.state as Record<string, unknown> | null)?.[TOKEN] === token
      ) {
        ours.current = false;
        window.history.back();
      }
      ours.current = false;
    };
  }, [open, url]);
}
