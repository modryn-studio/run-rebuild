/* WHAT THE TRADES PAGE NARROWS TO: the shape, and the reader that turns a URL into it.
 *
 * NO `'use client'`, AND NO DATABASE. The control is a client component and the page applying the
 * filter is a Server Component, which cannot call a function exported from a client module — Next
 * says so plainly when you try. Keeping the shape and the parser here lets both sides import it.
 *
 * THE URL IS THE STATE. A filtered tape is a thing a trader wants to send to themselves, reload,
 * and come back to, and no filter here is worth a database row.
 *
 * Ported from `run-trading@v2`'s `session-filter.ts`, minus the axes v1 has no data for: its
 * status and phase axes read account columns `S6` has not built a surface for yet, and its `q`
 * searched trade notes, which are NOT IN V1 (`spec.md` §6, and issue #10).
 */

import { bucketStartFor, type Grain } from '@/lib/time/session';

/* ─── THE DATE RANGE ─────────────────────────────────────────────────────────────────────────
 *
 * THE CALENDAR UNITS ARE THE POINT FOR THIS AUDIENCE, and they are what a rolling window cannot
 * say: a prop firm assesses payouts, consistency and drawdown resets on a CALENDAR MONTH. "This
 * month" is the question a funded trader actually asks; "last 30 days" is a different question
 * that happens to be a similar length. "Last month" is how they check the period they were paid on.
 *
 * ALL TIME IS THE DEFAULT AND IS NOT AN OPTION (Luke, 2026-08-04: "all time should always be
 * default. that way you dont even need to have 'all time' as a menu option"). A page that opens
 * already narrowed is a page hiding its own corpus, and the trader has to notice the filter before
 * they can trust the number. So the menu offers only NARROWINGS, with no entry that undoes the
 * others — getting back to everything is what Clear is for.
 */
export const RANGES = ['all', 'last7', 'last14', 'last30', 'month', 'lastmonth', 'year', 'lastyear'] as const;
export type Range = (typeof RANGES)[number];

export const DEFAULT_RANGE: Range = 'all';

/** Every range except the default, which is not a narrowing and never renders as a menu row. */
export const RANGE_OPTIONS = RANGES.filter((r) => r !== DEFAULT_RANGE);

export const RANGE_LABEL: Record<Range, string> = {
  all: 'All time',
  last7: 'Last 7 days',
  last14: 'Last 14 days',
  last30: 'Last 30 days',
  month: 'This month',
  lastmonth: 'Last month',
  year: 'This year',
  lastyear: 'Last year',
};

/** 'win' / 'loss'. Both, or neither, mean every trade. A scratch is neither and is matched by
 *  neither token — see `session-stats`' rule, carried through `digest`. */
export const RESULT_TOKENS = ['win', 'loss'] as const;
export type ResultToken = (typeof RESULT_TOKENS)[number];

export type TradesFilter = {
  /* MULTI-SELECT, AND EMPTY MEANS EVERY ONE. "How did I trade the index futures" is ES AND NQ AND
     YM, which a single-select cannot ask. Nothing selected is the resting state, not an edge case.

     PRODUCT, NOT CONTRACT MONTH. `MNQ`, never `MNQU6`: the month is an expiry, not a strategy, and
     offering contracts turns eight instruments into twenty chips. `trade.symbol_root` already holds
     the product, so this is a column rather than a parse. */
  products: string[];
  results: ResultToken[];
  /** Account ids. Empty means every account the trader owns. */
  accounts: string[];
  /** Never null — absent means the default, which is everything. */
  range: Range;
  /* A CUSTOM WINDOW, WHICH OVERRIDES `range` when either end is set. Two fields rather than a
     `range: 'custom'` sentinel, because the dates ARE the state and a sentinel would be a second
     thing to keep in step with them. Either end may stand alone: "everything since March" is a real
     question, and so is "everything up to the day I blew it". */
  from: string | null;
  to: string | null;
  /* THE SEARCH TERM. `wireframes.md` §3 draws `[Search]` in this toolbar and names it in the
     toolbar list, so this is v1 scope rather than a v2 carry-over (#20).
     WHAT IT MATCHES IS DELIBERATELY NARROWER THAN v2'S. v2 matched the note, the account title, the
     symbol and the product name; notes are NOT IN V1 (#10), so the note half does not exist here.
     What remains is still more than the chips can ask: the contract month is not a filter chip at
     all (this panel offers PRODUCT, never `MNQU6`), and an account is a chip you scan rather than a
     string you can type a fragment of. See `where()` in `read.ts` for the columns. */
  q: string | null;
};

export const EMPTY_FILTER: TradesFilter = {
  products: [],
  results: [],
  accounts: [],
  range: DEFAULT_RANGE,
  from: null,
  to: null,
  q: null,
};

const isRange = (v: unknown): v is Range => RANGES.includes(v as Range);
/** `YYYY-MM-DD` or nothing. Guards the URL, so a hand-edited param cannot reach the SQL as a date.
 *  Session dates are plain calendar strings throughout this codebase and compare correctly as text,
 *  which is why the window below never needs to build a `Date`. */
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

const list = (v: string | string[] | undefined): string[] =>
  (Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []).map((s) => s.trim()).filter(Boolean);

/** Read a filter out of `searchParams`. Everything unrecognised falls back to the resting state,
 *  so a hand-edited URL narrows nothing rather than erroring. */
export function readTradesFilter(params: Record<string, string | string[] | undefined>): TradesFilter {
  const range = params.range;
  const from = params.from;
  const to = params.to;
  return {
    products: list(params.products),
    results: list(params.results).filter((r): r is ResultToken => RESULT_TOKENS.includes(r as ResultToken)),
    accounts: list(params.accounts),
    range: isRange(range) ? range : DEFAULT_RANGE,
    from: isDay(from) ? from : null,
    to: isDay(to) ? to : null,
    /* TRIMMED, AND EMPTY BECOMES NULL, so `?q=` and `?q=%20%20` both mean "not searching" rather
       than "match every row against a blank string". A single value only: `?q=a&q=b` arrives as an
       array and there is no sensible reading of two search terms, so it falls back to no search. */
    q: (typeof params.q === 'string' ? params.q.trim() : '') || null,
  };
}

/**
 * The session-date window a filter selects, as two inclusive calendar days or nulls.
 *
 * IN SESSION DATES, NOT INSTANTS, which is what makes it safe. `trade.session_date` is already
 * bucketed by the one module that owns time, so a window expressed in the same unit cannot put a
 * boundary in a different place than the grouping does — and no fee can straddle it, because fees
 * were allocated to the trade before this ever runs.
 *
 * `asOf` is passed in rather than read from the clock. A pure function is testable, and the caller
 * is the one that knows which session "today" is — which is a market fact, never the browser's.
 */
export function rangeWindow(
  f: Pick<TradesFilter, 'range' | 'from' | 'to'>,
  asOfSessionDate: string
): { from: string | null; to: string | null } {
  // A custom window OVERRIDES the range, and either end may stand alone.
  if (f.from || f.to) return { from: f.from, to: f.to };

  const back = (days: number): string => {
    const d = new Date(`${asOfSessionDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
  };
  // Calendar buckets come from the one time module, so "this month" means the same thing here as
  // it does everywhere else in the product.
  const startOf = (g: Grain): string => bucketStartFor(asOfSessionDate, g);
  const previous = (g: Grain): { from: string; to: string } => {
    const start = new Date(`${startOf(g)}T00:00:00Z`);
    // One day before this bucket starts is inside the previous one, whatever its length.
    start.setUTCDate(start.getUTCDate() - 1);
    const insidePrevious = start.toISOString().slice(0, 10);
    return { from: bucketStartFor(insidePrevious, g), to: insidePrevious };
  };

  switch (f.range) {
    case 'last7':
      return { from: back(6), to: asOfSessionDate };
    case 'last14':
      return { from: back(13), to: asOfSessionDate };
    case 'last30':
      return { from: back(29), to: asOfSessionDate };
    case 'month':
      return { from: startOf('month'), to: asOfSessionDate };
    case 'lastmonth':
      return previous('month');
    case 'year':
      return { from: startOf('year'), to: asOfSessionDate };
    case 'lastyear':
      return previous('year');
    default:
      return { from: null, to: null };
  }
}

/** How many narrowings are active, for the Filters button's badge. The range is counted separately
 *  because it has its own control. */
export const activeCount = (f: TradesFilter): number =>
  f.products.length + f.results.length + f.accounts.length;

/** Whether anything at all is narrowing the tape, which decides the empty state's wording: "no
 *  trades in this range" is a different sentence from "no trades yet". */
export const isNarrowed = (f: TradesFilter): boolean =>
  // `q` counts here but NOT in `activeCount`: it has its own control, the same way the range does,
  // so a term must not light the Filters button's dot.
  activeCount(f) > 0 || f.range !== DEFAULT_RANGE || Boolean(f.from || f.to) || Boolean(f.q);

/* WHETHER A RESULT FILTER IS NARROWING THE SET, which the digest needs and which is not cosmetic:
 * four of its figures become UNTRUE rather than merely narrow. See `digest` in `read.ts`. */
export const isResultFiltered = (f: TradesFilter): boolean =>
  f.results.length > 0 && f.results.length < RESULT_TOKENS.length;
