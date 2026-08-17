// THE ONE MODULE THAT OWNS EVERY TIME BUCKET. Session date, day, week, month, year to date —
// all of them come from here, under one vocabulary. See docs/architecture.md §4.
//
// Two code paths computing the same derived value is how a product disagrees with itself about
// "your worst day", and it has already happened once in a form nobody would predict: a
// TypeScript bucketer and a SQL `date_trunc` both called "grain" while meaning different things.
// A shared name is not a shared definition.
//
// ── WHY THIS FILE EXISTS AS A BUG FIX ─────────────────────────────────────────────────────
// The ported tape computed its trading days as:
//
//     [...new Set(fills.map((f) => f.filledAt.toISOString().slice(0, 10)))]
//
// That is a UTC CALENDAR date, and it is not the date the exchange or the broker files a trade
// under. CME's trade date rolls at 17:00 America/Chicago: a fill at 17:29 CT on the 16th belongs
// to trade date the 17th, while a UTC slice files it under the 16th (22:29Z). Tradovate computes
// its daily figures from 17:00 CT, and a prop firm resets the daily loss limit there, so a
// calendar-day bucket disagrees with the broker for every evening session — a number Run cannot
// reconcile, which is the exact failure this product is built against.
//
// It also bucketed on EVERY FILL rather than the exit. A trade belongs to the session it was
// realised in (spec.md §8), so a position opened before the roll and closed after it must count
// once, on the later date.
//
// ── AND THE OLD CODEBASE HELD TWO RIVAL DEFINITIONS AT ONCE, NEITHER CORRECT ─────────────
// Checked 2026-08-12 across run-trading's desk-call worktree and its dev branch:
//
//   tape.ts        `fills.map(f => f.filledAt.toISOString().slice(0, 10))`   a UTC calendar date
//   aggregate.ts   `d.toLocaleDateString('en-CA', { timeZone: CT })`         a CHICAGO calendar date
//
// The second looks right and is not: a calendar date in Chicago still rolls at midnight, so a
// 17:30 CT fill files under the day it started rather than the trade date the exchange and the
// broker file it under. Two functions, two answers, three when you count the exchange's, and
// nothing named the disagreement — the same failure recorded as `#97`, where a TypeScript
// bucketer and a SQL `date_trunc` were both called "grain" while meaning different things.
//
// That is why this module exists and why the rule is that NOTHING else may compute a time
// bucket. A shared name is not a shared definition, and two of them agree right up until the
// evening session.

/**
 * The boundary zone and hour TRAVEL TOGETHER and must never be separated.
 *
 * `America/New_York` + 18 expresses the same instant, because New York and Chicago observe DST
 * transitions simultaneously and are always exactly one hour apart. But pairing one zone with
 * the other's hour silently files an hour of every evening session under the wrong trade date.
 * Pick one pair, name it once, and never inline the other.
 *
 * A NAMED IANA ZONE, NEVER A FIXED OFFSET. An offset is wrong twice a year.
 */
export const SESSION_BOUNDARY_ZONE = 'America/Chicago' as const;
export const SESSION_BOUNDARY_HOUR = 17 as const;

// Intl is the only correct way to do this: it carries the IANA database, so DST is handled by
// definition rather than by arithmetic. Built once — constructing a DateTimeFormat per call is
// measurably slow across hundreds of thousands of fills.
const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone: SESSION_BOUNDARY_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hour12: false,
});

/**
 * The CME trade date an instant belongs to, as `YYYY-MM-DD`.
 *
 * The session runs 17:00 CT to 17:00 CT and **carries the date of the day it ends**, matching the
 * exchange's own roll. So anything at or after 17:00 CT belongs to the NEXT calendar date.
 *
 * Pass the moment a trade was REALISED (`exit_at`). Passing an entry silently re-buckets every
 * position that spans the roll.
 */
export function sessionDateFor(instantUtc: Date): string {
  const f = parts.formatToParts(instantUtc);
  const get = (t: Intl.DateTimeFormatPartTypes) => f.find((p) => p.type === t)!.value;

  const y = Number(get('year'));
  const m = Number(get('month'));
  const d = Number(get('day'));
  // `hour12: false` yields 24 rather than 0 for midnight in some engines; normalise it.
  const hour = Number(get('hour')) % 24;

  if (hour < SESSION_BOUNDARY_HOUR) return iso(y, m, d);

  // Roll to the next calendar date. Date.UTC handles month and year ends, and using UTC here is
  // safe because only the Y/M/D triple is being advanced — no zone conversion is happening.
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return iso(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * The trader's own wall clock, for DISPLAY ONLY.
 *
 * The third time layer (docs/spec.md §8): store in UTC, bucket in the market's fixed zone,
 * display in the trader's. The ported render printed `toISOString().slice(11, 19)` — a UTC clock
 * shown to a human — so a trade at 12:29 CT was labelled `17:29`. Every timestamp a read quoted
 * was five hours off to the only person who would notice.
 *
 * This must never be used for bucketing. `sessionDateFor` above is the only thing that buckets.
 */
export function displayClock(instantUtc: Date, displayTimezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: displayTimezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(instantUtc);
}

/* A TAPE ROW'S CLOCK: `9:28 AM`, in the trader's own display zone.
 *
 * TWELVE-HOUR, and it is not a style preference. This renders beside a product name in a row a
 * trader scans, and `displayClock`'s `HH:MM:SS` carries a seconds field nothing on the tape needs
 * plus a 24-hour reading most US futures traders do not think in. Ported from `run-trading@v2`,
 * whose rows read `9:28 AM`.
 *
 * SAME ZONE RULE AS EVERY OTHER CLOCK HERE. `display_timezone` decides how an instant is WRITTEN;
 * it never decides which session it belongs to. That is `sessionDateFor`'s job and it must not
 * reach this function's input. */
export function displayTime(instantUtc: Date, displayTimezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: displayTimezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(instantUtc);
}

/* A SESSION BAND'S DATE: `Friday, August 7, 2026`.
 *
 * THE WEEKDAY IS NOT DECORATION FOR THIS AUDIENCE. "You don't trade Mondays" and every weekday
 * pattern the read might name are questions about which day of the week a session was, and a date
 * without one makes the trader compute it from a number.
 *
 * TAKES A SESSION DATE, NOT AN INSTANT, and formats it in UTC on purpose. A session date is a plain
 * calendar string that already went through the bucketer; turning it into a local instant to format
 * it would re-introduce the zone this value exists to have settled, and near midnight that shifts
 * the printed day by one. */
export function displaySessionDate(sessionDate: string): string {
  const [y, m, d] = sessionDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

// ── THE COARSER BUCKETS — week, month, year to date ──────────────────────────────────────
// S2, 2026-08-12. `architecture.md` §4 names day, week, month and year-to-date as belonging to
// this module; until now only the session date existed, which is the half that would have made
// somebody write `date_trunc` somewhere else.
//
// TWO DESIGN DECISIONS DO ALL THE WORK HERE, and both exist to make disagreement impossible
// rather than merely forbidden.
//
// 1. EVERY BUCKET TAKES A SESSION DATE, NEVER AN INSTANT. If `bucketStartFor` accepted a `Date`
//    it would have to answer the zone question a second time, and a second answer is the whole
//    failure. The session date has already resolved the boundary; a week is then plain calendar
//    arithmetic on that string and cannot drift from the day it was built from.
//
// 2. THE WEEK STARTS MONDAY, which is ISO 8601 **and** what Postgres `date_trunc('week', …)`
//    returns, by definition, with no configuration. `date_trunc` on 'month' and 'year' agree
//    trivially. So the two code paths that produced `#97` — a TypeScript bucketer and a SQL
//    `date_trunc` both called "grain" — are here defined to return the same answer, and
//    `scripts/s2-gate.mts` proves it against the real database rather than asserting it.
//
//    Monday also happens to be the trading week: the session runs Sunday 17:00 CT to Friday
//    16:00 CT (CME's own published hours, read 2026-08-12), and Sunday evening carries MONDAY's
//    trade date. So one Monday-start week holds exactly one trading week.
//
//    WITH ONE EXCEPTION, and it is worth knowing rather than discovering: CME's crypto futures
//    (BTC, MBT, ETH, MET) are 24/7, so a crypto session date CAN be a Saturday or a Sunday. It
//    groups into the Monday-start week that began five days earlier, which is the right reading
//    — Saturday crypto continues Friday's tape rather than starting the next week. See
//    docs/market-hours.md §4; spec.md §8's "the weekend has no bucket" carries the same
//    qualifier now.
export type Grain = 'day' | 'week' | 'month' | 'year';

const SESSION_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

// A malformed date must throw rather than bucket. Silently coercing `2026-02-30` into March 2nd
// is the same class of failure as a default multiplier: a plausible answer to a question that
// had no answer. `new Date(str)` does exactly that coercion, which is why it is not used here.
function utcOf(sessionDate: string): Date {
  const m = SESSION_DATE.exec(sessionDate);
  if (!m) {
    throw new Error(
      `Not a session date: ${JSON.stringify(sessionDate)}. Expected YYYY-MM-DD from sessionDateFor().`,
    );
  }
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const at = new Date(Date.UTC(y, mo - 1, d));
  // The round trip catches every overflow at once: month 13, February 30th, and the two-digit
  // year that `Date.UTC` maps into the 1900s.
  if (at.getUTCFullYear() !== y || at.getUTCMonth() + 1 !== mo || at.getUTCDate() !== d) {
    throw new Error(`Not a real date: ${sessionDate}`);
  }
  return at;
}

/**
 * The first session date of the bucket a session date falls in — the grouping key for every
 * rollup in the product.
 *
 * `day` returns the input, deliberately: a day is not a special case with its own code path, it
 * is the finest grain of one vocabulary.
 *
 * UTC arithmetic throughout, which is correct precisely BECAUSE no zone conversion is happening.
 * Only the Y/M/D triple moves, and UTC is the one calendar with no DST to skip an hour across.
 */
export function bucketStartFor(sessionDate: string, grain: Grain): string {
  const at = utcOf(sessionDate);

  switch (grain) {
    case 'day':
      return sessionDate;
    case 'week': {
      // getUTCDay: 0 = Sunday. Shift so Monday is 0 and Sunday is 6.
      const backToMonday = (at.getUTCDay() + 6) % 7;
      return isoOf(new Date(at.getTime() - backToMonday * DAY_MS));
    }
    case 'month':
      return iso(at.getUTCFullYear(), at.getUTCMonth() + 1, 1);
    case 'year':
      return iso(at.getUTCFullYear(), 1, 1);
  }
}

/**
 * Year to date, as a half-open-free inclusive window.
 *
 * **YTD is a WINDOW, not a bucket**, and keeping the two words apart is the point of a separate
 * function. A bucket is fixed by the date inside it; a window depends on when you ask. Two reads
 * of "year to date" a week apart are different ranges over the same year, and a `bucketStartFor`
 * that quietly meant "to now" would make that difference invisible.
 *
 * Both ends are inclusive, because `session_date` is a date and every query over it is
 * `BETWEEN from AND to`. There is no partial last day to exclude.
 */
export function yearToDateWindow(asOfSessionDate: string): { from: string; to: string } {
  return { from: bucketStartFor(asOfSessionDate, 'year'), to: asOfSessionDate };
}

const isoOf = (d: Date) => iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
