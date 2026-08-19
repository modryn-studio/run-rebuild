import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, trader } from '@/lib/db';
import { SESSION_BOUNDARY_ZONE } from '@/lib/time/session';

/**
 * THE ONE WAY A SURFACE LEARNS WHOSE RECORD IT IS SHOWING.
 *
 * The standing rule is *"every query is scoped by `trader_id` from the session, never from the
 * request"*, and a rule phrased that way is only as good as how easy it is to follow. So there
 * is exactly one function that produces a `trader_id`, it takes no arguments, and the only
 * thing it will read is a signed cookie. There is deliberately no `getTraderById`: a helper
 * that accepts an id is a helper that will eventually be handed one from a URL.
 *
 * This mirrors `require-admin.ts`, and for the same reason — the reference implementation
 * repeated its identity check across six files, and one missed file is the whole hole.
 */

/** The row, or null when nobody is signed in. */
export interface Trader {
  id: string;
  authUserId: string;
  displayTimezone: string;
  displayTimezoneSetByUser: boolean;
}

/**
 * The signed-in trader, creating the row on first sight.
 *
 * CREATED HERE RATHER THAN IN A SIGNUP HOOK, deliberately. A hook fires once, and anything that
 * makes it not fire — an auth user that predates this table, a provider that skips the hook, a
 * transient failure — leaves an account that can sign in and has no record. Resolving on read
 * makes the missing case unreachable instead of merely unlikely, and it costs one indexed
 * lookup on a unique column.
 *
 * The default zone is the MARKET zone, not UTC and not a guess. If detection never runs, the
 * least-wrong clock to show a futures trader is the one their sessions are cut in — never a
 * clock nobody trades on. Detection improves it on first page view; see `setDisplayTimezone`.
 */
/* DEDUPED PER REQUEST, and that is not just an optimisation.
 *
 * A signed-in page resolves the trader TWICE — once in `(app)/layout.tsx`'s gate and once in the
 * page itself — and the App Router renders a layout and its page CONCURRENTLY. Uncached, that is
 * two session lookups and up to four database round trips per navigation, and on a trader's very
 * first sign-in it is two callers racing to create the same row. The insert below is written to
 * survive that race, but the honest fix is for the race not to exist: `cache()` collapses both
 * calls into one resolution that both callers await.
 *
 * React's `cache`, not a module-level variable: the memo is scoped to the request, so it cannot
 * leak one trader's identity into another's request on a warm server. That distinction is the
 * whole reason to reach for this rather than a `Map`.
 */
export const getTrader = cache(async function getTrader(): Promise<Trader | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;

  const authUserId = session.user.id;
  const [existing] = await db.select().from(trader).where(eq(trader.authUserId, authUserId));
  if (existing) return existing;

  // onConflictDoNothing rather than a bare insert: two concurrent requests from one freshly
  // signed-in browser is the normal case, not a rare one, and the unique constraint is the
  // arbiter. The re-select then returns whichever won.
  await db
    .insert(trader)
    .values({ authUserId, displayTimezone: SESSION_BOUNDARY_ZONE })
    .onConflictDoNothing({ target: trader.authUserId });

  const [created] = await db.select().from(trader).where(eq(trader.authUserId, authUserId));
  return created ?? null;
});

/** The signed-in trader, or a thrown error. For surfaces that have already checked auth. */
export async function requireTrader(): Promise<Trader> {
  const t = await getTrader();
  if (!t) throw new Error('No signed-in trader');
  return t;
}

/**
 * Is this a zone the runtime actually knows?
 *
 * VALIDATED BY ASKING `Intl`, not by matching a pattern or carrying a list. The IANA database
 * changes — zones are added, renamed and merged — so a hand-kept list goes stale silently and a
 * regex would happily accept `Foo/Bar`. A stored zone that `Intl` cannot resolve would throw on
 * a render path, which is the worst place to find out.
 */
export function isKnownTimezone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Set the display zone.
 *
 * `byUser: true` is a deliberate choice and wins permanently. `byUser: false` is the browser's
 * detected zone, and it must never overwrite a choice — a trader who set Chicago and then opens
 * the app from an airport in Frankfurt should not find every clock in their record relabelled.
 * That precedence is the entire reason `display_timezone_set_by_user` exists.
 *
 * NOTHING HERE TOUCHES BUCKETING, and it cannot: `lib/time/session.ts` does not import this
 * module, `sessionDateFor` takes no zone argument, and `scripts/s3-gate.mts` asserts both.
 */
export async function setDisplayTimezone(
  traderId: string,
  zone: string,
  byUser: boolean
): Promise<'set' | 'ignored' | 'unknown-zone'> {
  if (!isKnownTimezone(zone)) return 'unknown-zone';

  const [row] = await db.select().from(trader).where(eq(trader.id, traderId));
  if (!row) return 'ignored';
  if (row.displayTimezoneSetByUser && !byUser) return 'ignored';
  if (row.displayTimezone === zone && row.displayTimezoneSetByUser === byUser) return 'ignored';

  await db
    .update(trader)
    .set({ displayTimezone: zone, displayTimezoneSetByUser: byUser })
    .where(eq(trader.id, traderId));

  return 'set';
}
