/* THE ARITHMETIC BEHIND THE ACCOUNTS CHART. Pure — no database, no `server-only`, no React.
 *
 * IT IS ITS OWN FILE FOR A REASON THIS CODEBASE HAS ALREADY BEEN BITTEN BY. `lib/accounts/read.ts`
 * imports `@/lib/db`, which reaches `@/lib/env`, which imports `server-only` as a deliberate
 * build-time tripwire. The chart's view provider is a CLIENT component and needs `windowChange`, so
 * importing it from the read module fails the build outright — exactly what happened to
 * `run-trading@v2` on 2026-07-30, and the same rule CLAUDE.md states as "a `'use client'` file may
 * import TYPES from a db-backed module, never VALUES".
 *
 * `day` IS A SESSION DATE, ALWAYS. v2's equivalent allowed a `PnlPoint.day` to be either a
 * `YYYY-MM-DD` or an ISO instant, so that one type could serve both the daily chart and the
 * intraday one. That overloading is not carried across: this build has no intraday range yet (see
 * `chart-view.tsx`), and a field that is sometimes a day and sometimes a timestamp is the kind of
 * thing that reads fine and sorts wrong.
 */

import { bucketStartFor, sessionWindow, type Grain } from '@/lib/time/session';

/** One point on a cumulative line. `cents` is the running total AT `day`, not that day's change. */
export interface Point {
  day: string;
  cents: number;
}

/** What one account, or the whole roster, did each day it traded. */
export interface DayCents {
  day: string;
  cents: number;
}

const DAY_MS = 86_400_000;

/** The session date one day before `day`. Used only for the zero anchor. */
function dayBefore(day: string): string {
  const at = new Date(`${day}T00:00:00Z`);
  return new Date(at.getTime() - DAY_MS).toISOString().slice(0, 10);
}

/**
 * A day-by-day list of changes becomes a cumulative line.
 *
 * IT OPENS WITH A ZERO ANCHOR, dated the day before the first one that moved. Cumulative P&L before
 * you have traded IS zero, by definition, so the line starts at the axis rather than at its first
 * result — without it a trader's first winning day draws a line that begins partway up with no
 * baseline to read it against. (v2 records Luke's instinct to anchor on opening BALANCE instead, and
 * why it was rejected: this plots P&L, not balance.)
 *
 * IT DOES NOT TAIL FORWARD TO TODAY, and that is a deliberate departure. v2 appends a flat point at
 * today's trade date so every series ends "now". That is right for a live roster and wrong for a
 * closed account, and v2 needed a second function (`fitToSubject`) to undo it per subject. Here the
 * line ends where the trading ended, and the CALLER decides what window to draw — which is the same
 * answer without the round trip.
 */
export function cumulate(days: DayCents[]): Point[] {
  if (days.length === 0) return [];
  const sorted = [...days].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

  const out: Point[] = [{ day: dayBefore(sorted[0].day), cents: 0 }];
  let running = 0;
  for (const d of sorted) {
    running += d.cents;
    out.push({ day: d.day, cents: running });
  }
  return out;
}

/**
 * Merge N cumulative series that do NOT share a day grid.
 *
 * NOT A POINTWISE ADD, and v2's note is the clearest statement of why: "account A has a point on the
 * 3rd and account B does not. Adding index-by-index would pair unrelated dates and draw a line
 * describing nothing."
 *
 * So every day any series moved becomes a day on the merged grid, and each series contributes the
 * last value it held at or before that day. Carrying forward is not smoothing — it is what
 * "cumulative P&L on a day you did not trade" literally means.
 */
export function sumSeries(all: Point[][]): Point[] {
  const live = all.filter((s) => s.length > 0);
  if (live.length === 0) return [];
  if (live.length === 1) return live[0];

  const days = [...new Set(live.flatMap((s) => s.map((p) => p.day)))].sort();
  const cursor = new Array(live.length).fill(0);
  const held = new Array(live.length).fill(0);

  return days.map((day) => {
    let total = 0;
    for (let i = 0; i < live.length; i++) {
      const s = live[i];
      while (cursor[i] < s.length && s[cursor[i]].day <= day) {
        held[i] = s[cursor[i]].cents;
        cursor[i]++;
      }
      total += held[i];
    }
    return { day, cents: total };
  });
}

/**
 * What the line moved by inside a window, and the level it started from.
 *
 * THE BASE IS THE LAST VALUE BEFORE THE WINDOW, which is what makes the answer a CHANGE rather than
 * a running total. `start` of `null` means all time, where the base is zero by definition.
 *
 * A window entirely after the last point returns a change of zero against the final level — an
 * account that stopped trading in March has not lost anything in August, and printing its all-time
 * total as "this month" would be the chart lying about a period it has no data for.
 */
export function windowChange(
  series: Point[],
  start: string | null
): { change: number; base: number } {
  if (series.length === 0) return { change: 0, base: 0 };
  const last = series[series.length - 1].cents;
  if (start === null) return { change: last, base: 0 };

  const i = series.findIndex((p) => p.day >= start);
  if (i < 0) return { change: 0, base: last };
  const base = i > 0 ? series[i - 1].cents : 0;
  return { change: last - base, base };
}

/**
 * THE PERCENTAGE'S DENOMINATOR, OR NULL - and null the moment ONE account in the set is unsized,
 * rather than quietly summing the ones that are. A percentage against a partial base is a WRONG
 * number, not a partial one, and it would drift toward looking right as more accounts got labelled.
 *
 * HERE RATHER THAN BESIDE `TrendIndicator`, WHICH IS WHERE IT LIVED UNTIL 2026-09-03. `/today`
 * folds its own series on the server, and every export of a `'use client'` module becomes a client
 * reference - so importing this from `trend-indicator.tsx` in a server component yields something
 * that cannot be called, and `CLAUDE.md` says re-exporting does not launder it. It is a pure fold,
 * so the plain module wins.
 */
export function sizeBase(accounts: { sizeDollars: number | null }[]): number | null {
  if (accounts.length === 0) return null;
  let sum = 0;
  for (const a of accounts) {
    if (a.sizeDollars === null) return null;
    sum += a.sizeDollars;
  }
  return sum > 0 ? sum : null;
}

/**
 * The window a range asks for, sliced out of a cumulative series WITH ONE POINT OF LEAD-IN.
 *
 * THE LEAD-IN IS THE WHOLE REASON THIS IS A FUNCTION. A window sliced at its own first day draws
 * that day from wherever the slice happened to open rather than from the level the line was
 * actually at, so the first session inside a month appears to start at whatever it closed at - a
 * chart reporting a move that never happened. Keeping the last point BEFORE the window anchors it.
 *
 * ONE IMPLEMENTATION, TWO HOSTS (2026-09-03). This was inline in `pnl-chart.tsx` until `/today`'s
 * `Net P&L` widget needed the same window off the same series. Two copies of a lead-in rule is
 * exactly the drift `CLAUDE.md` names - "two code paths computing one derived value is how a
 * product disagrees with itself" - and the reference's own answer is the same shape: one
 * `NetWorthPerformanceChart`, two wrappers.
 *
 * `1d` IS NOT ANSWERABLE HERE and callers must not ask. That range is keyed by INSTANTS and comes
 * from its own read (`getIntradaySeries` + `foldIntraday`); string-comparing a session open against
 * a calendar date silently lands on the last two DAILY points and draws a two-point line that looks
 * like a chart. `PnlChart` branches before this call; the widget does not offer the range at all.
 */
export function windowSlice(
  series: Point[],
  range: Range
): { points: Point[]; start: string | null } {
  if (series.length === 0) return { points: [], start: null };
  const start = windowStart(range, series[series.length - 1].day);
  if (!start) return { points: series, start: null };
  const from = series.findIndex((p) => p.day >= start);
  return { points: series.slice(from > 0 ? from - 1 : 0), start };
}

/**
 * The last day the line actually MOVED.
 *
 * THE TEST IS MOVEMENT, NOT PRESENCE, and v2 shipped the wrong one first: because every series is
 * padded — here with a leading anchor, there with a trailing one too — "has a point in this window"
 * is true for series that did nothing in it. Twenty of thirty-three sparklines came back flat and
 * the first fix never fired.
 */
export function lastMovementDay(series: Point[]): string | null {
  for (let i = series.length - 1; i > 0; i--) {
    if (series[i].cents !== series[i - 1].cents) return series[i].day;
  }
  return null;
}

/**
 * A cumulative line becomes per-bucket CHANGES, for the Breakdown view.
 *
 * DIFFERENCE FIRST, THEN BUCKET. Bucketing the running totals and taking the last of each would
 * give the LEVEL at each bucket's end, not what the bucket earned — the two agree only when every
 * bucket is a single day.
 *
 * BUCKETS COME FROM `lib/time/session.ts`, the one module that owns them. v2 re-implemented the
 * grain arithmetic inside the chart, which is the second-bucketer trap CLAUDE.md forbids: two code
 * paths computing one derived value is how a product disagrees with itself about "your worst week".
 *
 * `quarter` ARRIVED 2026-08-27, in `lib/time/session.ts` beside the other four, which is where this
 * comment said it belonged. The Breakdown's grain menu offers it because v2's does.
 */
export function bucketize(series: Point[], grain: Grain): DayCents[] {
  if (series.length < 2) return [];

  const buckets = new Map<string, number>();
  for (let i = 1; i < series.length; i++) {
    const delta = series[i].cents - series[i - 1].cents;
    const key = bucketStartFor(series[i].day, grain);
    buckets.set(key, (buckets.get(key) ?? 0) + delta);
  }

  return [...buckets.entries()]
    .map(([day, cents]) => ({ day, cents }))
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

/* Every range the period control offers.
 *
 * `1d` IS THE ODD ONE AND IT IS ODD ALL THE WAY DOWN. Every other range is a window over
 * `session_date` and its points are DAYS; 1d is a window INSIDE one session and its points are
 * INSTANTS. It reads a different query (`getIntradaySeries`), folds through `foldIntraday` rather
 * than `cumulate`, and its `Point.day` carries an ISO timestamp instead of `YYYY-MM-DD`.
 * Sharing the `Point` shape rather than inventing a second one is deliberate - the chart, the
 * hover, the change and the sparklines all keep working unchanged, and the only code that has to
 * know is whatever FORMATS a key. `isInstantKey` below is that one test. */
export const RANGES = ['1d', '1w', '1m', '3m', 'ytd', '1y', 'all'] as const;
export type Range = (typeof RANGES)[number];

/** True for a 1-day point, whose key is an instant rather than a calendar date. */
export const isInstantKey = (key: string) => key.includes('T');

export const RANGE_LABELS: Record<Range, string> = {
  '1d': '1 day',
  '1w': '1 week',
  '1m': '1 month',
  '3m': '3 months',
  ytd: 'Year to date',
  '1y': '1 year',
  all: 'All time',
};

/** What a window's change is CALLED once it is on screen, beside the figure. */
export const CHANGE_LABELS: Record<Range, string> = {
  '1d': '1 day change',
  '1w': '1 week change',
  '1m': '1 month change',
  '3m': '3 month change',
  ytd: 'Year to date',
  '1y': '1 year change',
  all: 'All time',
};

/**
 * The first session date a range covers, anchored on the subject's own last day.
 *
 * `endsOn` IS THE SUBJECT'S LAST TRADING DAY, NOT TODAY, whenever the subject is finished. v2 got
 * this wrong first and Luke caught it: "1 month" on an account that closed in March asked for a
 * window in the current month, "so the chart came back blank under a headline still reading
 * $6,240.08". A range is a question about the account, and a closed account's last month is the
 * last month it was alive.
 */
export function windowStart(range: Range, endsOn: string): string | null {
  if (range === 'all') return null;
  /* 1d RETURNS THE SESSION'S OPEN INSTANT, not the session date, and the difference is load-bearing.
     `windowChange` finds the window's base by STRING-COMPARING keys against this value, and a 1-day
     series is keyed by ISO instants: the open of session `2026-07-21` is `2026-07-20T22:00:00Z`,
     which sorts BEFORE the string "2026-07-21". Returning the date would put the base at whichever
     trade first crossed midnight UTC - a boundary that means nothing to anyone - instead of at the
     session's own anchor. Returning the open makes the base the zero point the fold planted there,
     so the change IS the day's P&L. */
  if (range === '1d') return sessionWindow(endsOn).open.toISOString();

  const at = new Date(`${endsOn}T00:00:00Z`);
  if (range === 'ytd') return `${endsOn.slice(0, 4)}-01-01`;
  if (range === '1w') return new Date(at.getTime() - 6 * DAY_MS).toISOString().slice(0, 10);

  /* THE DAY IS CLAMPED TO THE TARGET MONTH, and skipping that was a real bug this file's own gate
     caught. `Date.UTC(2025, 1, 31)` is February 31st, which JavaScript silently rolls forward to
     March 3rd - so "one month back from March 31st" returned a date AFTER the month it was supposed
     to open, making the window shorter than the range it names. Clamping gives February 28th, which
     is what a month back from the 31st means everywhere outside a date library. */
  const months = range === '1m' ? 1 : range === '3m' ? 3 : 12;
  const y = at.getUTCFullYear();
  const m = at.getUTCMonth() - months;
  // Day 0 of the following month is the last day of the one we want.
  const lastOfTarget = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const back = new Date(Date.UTC(y, m, Math.min(at.getUTCDate(), lastOfTarget)));
  return back.toISOString().slice(0, 10);
}

/* THE BREAKDOWN'S OWN CONTROL (`S6d`, 2026-08-27, ported from `run-trading@v2`'s `chart-grain.ts`).
 *
 * IT SUPERSEDES `grainFor` FOR THE BREAKDOWN VIEW, and the argument underneath `grainFor` with it.
 * That argument - the trader picks how far back and lets the bar width fall out - was right while
 * ONE control had to serve both kinds. Once the two views are allowed to differ (Luke, 2026-08-06:
 * "the two views carry different controls"), a bar chart's honest control IS the grain, because a
 * BAR IS A PERIOD, and a range menu cannot express "the same eight weeks, one page earlier".
 *
 * The objection `grainFor` raises is real and is answered by PAGING rather than by derivation:
 * picking Yearly on three weeks of tape gives one bar, and one bar is a fine answer to "what did
 * this year do" - what used to make it useless was a whole-corpus axis with no way to move along it.
 *
 * `grainFor` STAYS, and is still what the CUMULATIVE view uses to decide how it summarises. */
export const GRAINS: readonly { value: Grain; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'quarter', label: 'Quarterly' },
  { value: 'year', label: 'Yearly' },
];

/** Just the values, for anything validating a grain without pulling the labels. */
export const GRAIN_TOKENS: readonly Grain[] = GRAINS.map((g) => g.value);

/** The grain a range is drawn at, so the trader picks HOW FAR BACK and never picks a grain that
 *  produces one bar. v2: an explicit grain "lets a trader pick 'yearly' on three weeks of tape and
 *  get one bar, which is a control that can produce a useless chart."
 *  CUMULATIVE ONLY since `S6d`. The Breakdown view carries `GRAINS` above. */
export function grainFor(range: Range, span: number): Grain {
  /* A 1-day BREAKDOWN is one bar, which is the useless control `grainFor` exists to prevent - so
     the chart refuses the Breakdown view at 1d rather than drawing it. See `pnl-chart.tsx`. */
  if (range === '1d' || range === '1w' || range === '1m') return 'day';
  if (range === '3m') return 'week';
  if (range === 'ytd' || range === '1y') return 'month';
  // All time: the corpus decides. Two years of daily bars is 500 columns nobody can read.
  if (span > 730) return 'month';
  if (span > 180) return 'week';
  return 'day';
}


/* ─── THE DAY'S OWN SHAPE ───────────────────────────────────────────────────────────────────────
 *
 * One session's realised round trips, cumulated in the order they happened, per account and in
 * total. This is the 1-day range's `cumulate`, and it differs in three ways that all come from the
 * x axis being TIME rather than dates.
 *
 * IT IS ANCHORED AT THE SESSION OPEN, at zero. A line that began at the first trade would claim the
 * trader started the day already up or down, and would silently rescale: one trade at 09:31 would
 * draw a full-width line across a session that had barely begun.
 *
 * IT IS TAILED TO THE CLOSE, so every account's series ends on one x and the chart's own span logic
 * needs no special case. Skipped when a trade lands exactly on the close, which would duplicate the
 * key.
 *
 * AN ACCOUNT THAT DID NOT TRADE GETS NO SERIES, not a flat zero line. The page sums the accounts it
 * counts, so an empty array contributes nothing - where a zero line would contribute a point at the
 * open competing with the real ones.
 */
export function foldIntraday(
  rows: { accountId: string; at: Date; cents: number }[],
  win: { open: Date; end: Date }
): { total: Point[]; byAccount: Map<string, Point[]> } {
  const openKey = win.open.toISOString();
  const endKey = win.end.toISOString();

  const ordered = [...rows].sort((a, b) => a.at.getTime() - b.at.getTime());

  const byAccount = new Map<string, Point[]>();
  const running = new Map<string, number>();
  for (const r of ordered) {
    if (byAccount.has(r.accountId)) continue;
    byAccount.set(r.accountId, [{ day: openKey, cents: 0 }]);
    running.set(r.accountId, 0);
  }

  /* THE SAME INSTANT TWICE IS ONE POINT. Two exits can share a timestamp to the millisecond - a
     four-lot leaving as two round trips does exactly that - and a duplicate key would draw a
     vertical segment the hover could land on either side of. The last write wins, which is the
     running total after both, so the point is right and there is only one of it. */
  const push = (series: Point[], key: string, cents: number) => {
    const last = series[series.length - 1];
    if (last && last.day === key) last.cents = cents;
    else series.push({ day: key, cents });
  };

  let total = 0;
  const totalSeries: Point[] = [{ day: openKey, cents: 0 }];
  for (const r of ordered) {
    total += r.cents;
    const key = r.at.toISOString();
    push(totalSeries, key, total);
    const own = byAccount.get(r.accountId)!;
    const n = (running.get(r.accountId) ?? 0) + r.cents;
    running.set(r.accountId, n);
    push(own, key, n);
  }

  const tail = (s: Point[]) => {
    const last = s[s.length - 1];
    if (last && last.day !== endKey) s.push({ day: endKey, cents: last.cents });
    return s;
  };

  tail(totalSeries);
  for (const s of byAccount.values()) tail(s);

  /* NOTHING TRADED. The anchor and its tail are two points on a flat zero line, which is the honest
     picture of a session that has not produced anything yet - and it is a DIFFERENT statement from
     an empty array, which is what an account with no trades gets. */
  return { total: totalSeries, byAccount };
}
