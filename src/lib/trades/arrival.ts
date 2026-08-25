/* HOW THE TRADER GOT TO `/trades/[id]`, so the way back can be the right one.
 *
 * A module-level flag rather than state, because the two components that need to agree about it are
 * on OPPOSITE SIDES OF A NAVIGATION - the tape sets it, the sheet reads it after the route changed -
 * and nothing survives that except the module graph itself. Both live in one client runtime, since
 * this is a single-page navigation.
 *
 * WHY IT EXISTS. `router.push('/trades')` always builds the page again; `router.back()` restores it
 * from the router's client cache, instantly, at the scroll position it was left at. Back is what a
 * trader who tapped a row wants. But back is WRONG for someone who opened the URL from a message or
 * a bookmark: their previous entry is wherever they were before Run, and this would eject them.
 *
 * `document.referrer` cannot answer it (empty on a client navigation) and `history.length` cannot
 * either (any tab with a page of history looks the same). Only the app knows, so the app records it.
 */
let fromTape = false;

/** Called by the tape when a row navigates. */
export function markArrivedFromTape() {
  fromTape = true;
}

/** True once, then false: leaving consumes it, so a reload cannot re-use a stale yes. */
export function consumeArrivedFromTape() {
  const was = fromTape;
  fromTape = false;
  return was;
}
