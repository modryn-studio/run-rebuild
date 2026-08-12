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
