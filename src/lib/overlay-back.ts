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

import { useCallback, useEffect, useRef } from 'react';

/** Tags the entries this hook issues, so cleanup can tell one of ours from anybody else's. */
const TOKEN = 'runOverlay';
let counter = 0;

/* WHICH OVERLAY ENTRIES ARE LIVE, INNERMOST LAST — and it is a module array rather than a read of
 * `history.state` because that read is not trustworthy (2026-08-28).
 *
 * The original design decided "who answers this pop" by comparing our token to the token on the
 * entry we LANDED on. That works only if no other entry can be carrying our token, and Next's router
 * COPIES the existing history state forward when it pushes or replaces - so the entry underneath
 * could end up wearing the same number, the comparison read `token <= landed`, and the overlay
 * silently declined to answer. It is the same state-copying that made the filter's commit revert.
 * Both bugs looked intermittent because whether the copy had happened depended on what the router
 * had done since.
 *
 * An array we own cannot be copied by anybody. It is module-level for the same reason `counter` is:
 * the ordering is between SEPARATE component instances, which have no other place to meet. */
const live: number[] = [];
/* ─── A POP THIS MODULE CAUSED IS NOT A BACK PRESS ──────────────────────────────────────────────
 *
 * 2026-08-28, postcheck, and it is the cause behind "the back button isn't working correctly with
 * all the pages" on a phone. `live` orders the overlays correctly for a pop the OS starts, because
 * the innermost token is still last when the listeners run. It cannot order the pop an overlay
 * causes when it dismisses ITSELF: the cleanup drops its own token FIRST and only then calls
 * `history.back()`, whose `popstate` arrives a task later - by which time the OUTER overlay's token
 * is last, its listener is still registered, and its guard passes. It answers as if the trader had
 * pressed Back.
 *
 * What that looked like: open Edit on an account, tap Close account, tap Cancel. The confirmation
 * consumed its own entry, and the editor underneath heard the pop and closed too - taking the
 * Reopen button its own copy had just promised. On the SUCCESSFUL close it was worse, because that
 * path is meant to leave the form open showing what was written.
 *
 * SO THE MODULE ANNOUNCES ITS OWN POPS. `selfBacks` is raised immediately before `history.back()`
 * and spent by the first listener to see the event, which marks the event itself so every later
 * listener agrees about the same pop rather than each racing the counter.
 *
 * THE GUARD IS REGISTERED BEFORE ANY OVERLAY'S, because it is armed from the first `useOverlayBack`
 * effect and listeners fire in registration order. Nothing this module adds can run before it.
 *
 * IT CANNOT STRAND A COUNT. The only `back()` here is guarded by `location.href === pushedHref`,
 * which means our entry is the current one - so there is always an entry to pop and always a
 * `popstate` to spend the raise on. */
let selfBacks = 0;
const selfPops = new WeakSet<PopStateEvent>();
let guarded = false;
function armSelfPopGuard(): void {
  if (guarded) return;
  guarded = true;
  window.addEventListener('popstate', (e: PopStateEvent) => {
    if (selfBacks > 0) {
      selfBacks--;
      selfPops.add(e);
    }
  });
}
const isSelfPop = (e: PopStateEvent): boolean => selfPops.has(e);

const drop = (t: number) => {
  const i = live.indexOf(t);
  if (i !== -1) live.splice(i, 1);
};

export function useOverlayBack(
  open: boolean,
  /* RETURN `true` TO RE-ARM: "I consumed a level and the overlay is still up, give me another
   * entry" (2026-08-28). A surface with screens INSIDE it - the filter sheet's axis pages - used to
   * register once per level, which meant two live entries and a commit that had to unwind one of
   * them before it could write. It never reliably could: `history.back()` dispatches its `popstate`
   * as a separate task, so a write issued in the same task was undone by it, and whether that
   * happened depended on timing. The filter came back "sometimes".
   * One entry, re-armed on the way out, removes the race rather than sequencing it. */
  onClose: () => void | boolean,
  /** A URL to show while the overlay is up. Omit to keep the current one. The trade sheet passes
   *  `/trades/<id>` so the screen is shareable and survives a reload; Filters passes nothing,
   *  because a staged, uncommitted filter draft is not a place. */
  url?: string
): (() => void) {
  /* ─── THE MARKER THIS RETURNS ────────────────────────────────────────────────────────────────
   *
   * Call it just before a surface commits a navigation that will REPLACE this overlay's history
   * entry, and the cleanup below will leave that entry standing instead of consuming it.
   *
   * IT EXISTS BECAUSE OF A RACE NO GUARD COULD WIN (2026-08-28). The filter sheet commits by writing
   * the URL and closing in one gesture. Both land in ONE React commit, and inside a commit every
   * effect CLEANUP runs before anything else - so this hook's `history.back()` went first, the
   * router's write landed second, and the popstate from that `back()` arrived last and reverted it.
   * `Clear all` wrote a cleared address and then unwrote it, which is exactly what "the clear all
   * button seems to not be working" looks like. Apply had it too, on both surfaces, since the day
   * this sheet learned to answer the device Back button.
   * Ordering could not fix it, and neither could a smarter guard: at the instant the cleanup runs,
   * nothing observable distinguishes a navigation-in-flight from a plain dismissal. So the surface
   * SAYS which it is.
   *
   * A FUNCTION RATHER THAN A REF PARAMETER, which is what this was for about ten minutes. The React
   * Compiler refuses a component that mutates a ref it has handed to a hook ("This value cannot be
   * modified"), correctly - the ref is a value flowing in, not state the component owns. Owning the
   * flag here and handing back a setter satisfies both the compiler and the reader. */

  /* THE CALLBACK IS READ, NOT OBSERVED. `onClose` is almost always an inline arrow, so a fresh
     identity every render - in the deps it would tear the listener down and push a SECOND history
     entry on every re-render of the parent. A ref keeps the effect keyed to `open` alone. */
  const latest = useRef<() => void | boolean>(onClose);
  useEffect(() => {
    latest.current = onClose;
  }, [onClose]);

  /** True while an entry we pushed is still waiting to be consumed. */
  const ours = useRef(false);

  /** True while a commit is in flight: the entry is being overwritten, not dismissed. */
  const replacing = useRef(false);

  useEffect(() => {
    if (!open) return;

    armSelfPopGuard();

    /* LOWERED ON EVERY OPEN, because the next dismissal is far more likely to be an ordinary one. */
    replacing.current = false;
    let token = ++counter;
    live.push(token);
    window.history.pushState({ [TOKEN]: token }, '', url);
    ours.current = true;
    /* THE ADDRESS THIS ENTRY WAS PUSHED AT, so the cleanup can tell "the overlay closed" from "the
       app navigated while the overlay was open". Captured AFTER the push, because `url` may be
       relative or absent.
       IT EXISTS BECAUSE THE TOKEN GUARD IS NOT ENOUGH (2026-08-28). Next's router carries the
       PREVIOUS history state forward when it pushes, so after `router.push` the state object still
       held this token - the guard below passed, the cleanup called `back()`, and it undid the
       NAVIGATION rather than the overlay. That is what made `Clear all` in the filter sheet look
       broken: it wrote a cleared URL, the sheet closed, and the closing put the filter straight
       back. Two guards that can both be true at once are one guard; this is the one that is
       actually about our entry. */
    const pushedHref = window.location.href;

    const onPop = (e: PopStateEvent) => {
      /* A POP WE CAUSED IS NOT A BACK PRESS, and this line is the whole of finding #1 (2026-08-28,
         postcheck). See `armSelfPopGuard` for the failure it prevents. */
      if (isSelfPop(e)) return;
      /* ONLY THE INNERMOST OVERLAY ANSWERS A GIVEN POP, and getting this wrong was visible on the
         first test: one press of Back from the Date Range screen closed the drill-in AND the sheet
         under it. `popstate` is a WINDOW event, so every registered overlay hears every pop - two
         listeners, one press, both closing.
         `live` IS THE ORDER, and it is ours. See its own note for why the entry's own state could
         not be trusted to say the same thing. */
      if (live[live.length - 1] !== token) return;
      drop(token);
      /* THE FLAG GOES DOWN BEFORE `onClose` RUNS, not after. `onClose` flips the parent's state,
         which re-runs this effect and fires the cleanup below in the same commit - and a cleanup
         that still saw `ours.current === true` would call `back()` for an entry the OS has already
         popped, sending the trader a screen further back than they asked to go. */
      ours.current = false;
      /* RE-ARMED IN THE POP ITSELF, which is where it has to happen: the effect will not re-run,
         because `open` has not changed - the overlay is still up, it is just one screen shallower. */
      if (latest.current() === true) {
        token = ++counter;
        live.push(token);
        window.history.pushState({ [TOKEN]: token }, '', url);
        ours.current = true;
      }
    };

    window.addEventListener('popstate', onPop);

    return () => {
      window.removeEventListener('popstate', onPop);
      drop(token);
      /* THE APP IS NAVIGATING, so this entry is not ours to take back - the `replace` is overwriting
         it. Consuming it here is what reverted the very write that closed us. */
      if (replacing.current) {
        ours.current = false;
        return;
      }
      /* CLOSED FROM INSIDE: consume the entry so the stack stays level. Two guards, and both have
         a failure they prevent. `ours.current` means popstate did not already take it. The state
         check means our entry is still the CURRENT one - if the trader left via a link instead,
         ours is buried and `back()` would undo their navigation rather than our overlay. */
      /* `ours.current` means popstate did not already take it. The ADDRESS check means the app has
         not navigated since - if the trader left via a link instead, ours is buried and `back()`
         would undo their navigation rather than our overlay. The entry's own state is deliberately
         NOT consulted: Next copies it forward, so it can say yes when the answer is no. */
      if (ours.current && window.location.href === pushedHref) {
        ours.current = false;
        /* DECLARED BEFORE IT IS CAUSED, so the overlay UNDERNEATH does not read it as a press. */
        selfBacks++;
        window.history.back();
      }
      ours.current = false;
    };
  }, [open, url]);

  /* STABLE, so a caller may put it in a dependency array without re-registering the overlay. */
  return useCallback(() => {
    replacing.current = true;
  }, []);
}
