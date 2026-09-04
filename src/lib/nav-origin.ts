'use client';

/* WHERE THE TRADER CAME FROM, for a drill-down with more than one honest parent.
 *
 * `/accounts/details/<id>` is reached from the roster AND, since the tape's account cell became a
 * link, from `/trades`. Its breadcrumb said "Accounts" either way, which is a true statement about
 * where the screen BELONGS and a false one about the trail the trader just walked. A crumb is the
 * way back; a way back that does not go where you came from is chrome.
 *
 * READ LIVE OFF MONARCH (2026-09-04), which is where the shape came from. Its crumb says
 * "Transactions" arriving from `/transactions` and "Accounts" arriving from `/accounts`, with the
 * URL identical in both cases — no `?from=`, nothing in `history.state`. Refresh that page and it
 * says "Accounts" again. So the origin lives in memory for exactly as long as the journey does,
 * and a cold entry has no journey to describe.
 *
 * WHY NOT A QUERY PARAM, which this build reaches for elsewhere and which would survive a refresh.
 * Two reasons, and the second is the one that decided it. A pasted link would tell its recipient a
 * journey that was not theirs. And the URL is the one thing on this screen that is NOT supposed to
 * move: `/accounts/details/<id>` is the address of an account, not of a route between two screens.
 * The crumb is allowed to know something the URL does not.
 *
 * WHY NOT `history.state`. CLAUDE.md: Next copies it forward onto neighbouring entries, which is
 * why `useOverlayBack` refuses to read it either. The same trap applies here and for the same
 * reason.
 *
 * MODULE STATE, NOT CONTEXT — the only writer is the shell and the only reader is one crumb. A
 * provider would be a store with one subscriber, plus a re-render of the whole tree every time the
 * route changed, to update a word that is read exactly once at mount.
 *
 * TWO VARIABLES, WRITTEN ONLY IN AN EFFECT, AND THE READER DISAMBIGUATES. Both halves are forced:
 *
 *   THE WRITE CANNOT HAPPEN DURING RENDER. React Compiler is on, and `react-hooks/globals` refuses
 *   it by name — reassigning a module variable during render is a side effect, and a memoised
 *   render would skip it. `npm run lint` fails the build on it, correctly: that rule is not a style
 *   preference, it is the compiler telling you the write may not happen.
 *
 *   AND THE READER CANNOT ASSUME WHEN THE WRITE RAN. This file's first version kept ONE variable
 *   and leaned on "all of a tree's rendering happens before any of its effects", so the shell's
 *   effect would still be holding the old route when the page below it rendered. That is true
 *   within one commit and FALSE across a navigation, because `(app)/loading.tsx` puts a Suspense
 *   boundary in between: the router commits the shell and its fallback first — firing the shell's
 *   effect with the NEW pathname — and streams the real page in a later commit. Measured on the
 *   real app 2026-09-04: arriving at an account from `/trades`, the crumb said "Accounts".
 *
 * So the reader is written to be correct under BOTH orderings, by asking a question that answers
 * itself: `current` either already names the page doing the asking (the effect has run — the origin
 * is `previous`) or it still names the route before it (the effect has not — `current` IS the
 * origin). There is no third case, and neither branch depends on a timing guarantee.
 *
 * MODULE STATE, NOT CONTEXT — the only writer is the shell and the only reader is one crumb. A
 * provider would be a store with one subscriber, plus a re-render of the whole tree on every route
 * change to update a word that is read once at mount.
 *
 * NOTHING HERE RUNS ON THE SERVER. `'use client'` plus module state would otherwise be a
 * cross-request leak — one visitor's trail read by the next. The tracker is called from `AppShell`
 * and the reader from a portalled crumb, both of which are client-only and neither of which is
 * rendered during SSR.
 */

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/** The route of the most recent navigation the shell has SEEN. `null` before the first. */
let current: string | null = null;
/** The one before that. */
let previous: string | null = null;

/**
 * Records each route the shell renders. Called ONCE, from the shell, because the shell is the one
 * component that re-renders on every navigation. The `!==` guard is what makes a filter change on
 * the current screen — same pathname, new search params — leave the trail alone.
 */
export function useTrackNavOrigin() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === current) return;
    previous = current;
    current = pathname;
  }, [pathname]);
}

/**
 * The route visited immediately before this one, or `null` on a cold entry — a refresh, a pasted
 * URL, a new tab from a cmd-click. Captured at MOUNT and then frozen: a filter change on the screen
 * you are already on must not rewrite the trail that led you to it.
 */
export function useNavOrigin(): string | null {
  const pathname = usePathname();
  const [origin] = useState(() => (current === pathname ? previous : current));
  return origin;
}

/* ─── THE DOORS ONTO ONE ACCOUNT, AND WHAT THE WAY BACK IS CALLED FROM EACH ──────────────────────
 *
 * `/accounts/details/<id>` is drawn by two headers - the desktop breadcrumb and, below `md`, the
 * full-screen panel's own bar - and they must never disagree about which door the trader came
 * through. So the mapping lives here once and both read it, rather than each carrying a copy that
 * drifts the first time a third door is added.
 *
 * THE ROSTER IS THE DEFAULT AND NOT A FALLBACK. On a cold entry there is no trail, and `/accounts`
 * is where this screen belongs when nothing led to it. */
export type NavParent = { href: string; label: string };

const TAPE: NavParent = { href: '/trades', label: 'Trades' };
const ROSTER: NavParent = { href: '/accounts', label: 'Accounts' };

/**
 * Where an account page's way back should point, and what to call it.
 *
 * `/trades/<id>` COUNTS AS THE TAPE, and that prefix is the whole reason this is a function rather
 * than a lookup table. On a desktop the trade detail is a drawer and the URL never leaves `/trades`,
 * so an exact match was enough. On a phone the same detail is a full-screen sheet that owns
 * `/trades/<id>` — so the route immediately before the account page is the TRADE, not the tape, and
 * an exact match sent every phone trader back to the roster. Measured 2026-09-04.
 *
 * Sending them to `/trades` rather than back to the trade they came from is deliberate and is what
 * the reference does: Monarch's detail panel lives at `/transactions/<id>` and its account crumb
 * still reads "Transactions". The trail names the LIST the trader was working in, not the row they
 * happened to have open on the way past.
 */
export function useAccountParent(): NavParent {
  const origin = useNavOrigin();
  if (origin === TAPE.href || origin?.startsWith(`${TAPE.href}/`)) return TAPE;
  return ROSTER;
}
