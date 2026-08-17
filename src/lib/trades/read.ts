import 'server-only';
import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import { db, trade, account } from '@/lib/db';
import type { TradeState } from '@/lib/db';
import { firmLogoSrc, accountRowTitle } from '@/lib/prop-firms';
import type { TradesFilter } from './filter';
import { isResultFiltered } from './filter';

/* WHAT THE TRADES PAGE READS. Every figure on it comes from here, and every one comes from SQL.
 *
 * FROM THE PROJECTION, NEVER FROM `event`. That is the whole reason `S5a` exists: `trade` carries
 * entry, exit, direction and fee as columns, so nothing on this path touches `payload` and nothing
 * re-derives a number the projector already settled. A row's net here is the same net the account
 * page will show, by construction rather than by luck — the fees were allocated once, per account,
 * at projection time.
 *
 * SCOPED BY TRADER FROM THE SESSION, AND BY ACCOUNT AND WINDOW FROM THE FIRST QUERY. Not narrowed
 * afterwards in JavaScript: the record is somebody's trading history, and an unbounded read of it
 * is the whole corpus.
 *
 * THE DIGEST IS COMPUTED OVER THE WHOLE FILTERED SET, NEVER OVER THE PAGE. `spec.md` §S3 requires
 * it (P6) and `run-trading@v2` learned why the hard way: its rail folded the rows the tape had
 * WINDOWED, so the summary silently described the first 60 trades and called itself a summary. A
 * summary of one page is not a summary. Here the digest is its own aggregate query against the same
 * `where`, so paging cannot narrow it by construction.
 */

/** One row of the tape. Exactly what the wireframe's row prints, and nothing else. */
export interface TapeRow {
  id: string;
  accountId: string;
  accountName: string;
  /** The firm's mark, resolved here so the row does not have to know how logos are addressed.
   *  Null when the account is unlabelled, which is a normal state until the labelling step lands. */
  firmLogo: string | null;
  symbolRoot: string;
  contract: string | null;
  direction: 'long' | 'short' | null;
  qty: number;
  entryPrice: string;
  exitPrice: string;
  entryAt: Date;
  exitAt: Date;
  sessionDate: string;
  grossCents: number;
  feeCents: number;
  netCents: number;
  state: TradeState;
  quarantineReason: string | null;
  exclusionReason: string | null;
  /** Tradovate's own ids. The only strings the drawer carries that also appear in an export. */
  pairId: string | null;
  buyFillId: string | null;
  sellFillId: string | null;
}

/** A session header, carrying that session's own totals. */
export interface SessionGroup {
  sessionDate: string;
  netCents: number;
  feesCents: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  /** Null when nothing in the session was decided — a rate off zero is a divide, not a fact. */
  winRatePct: number | null;
  trades: TapeRow[];
}

/** The right-rail digest, over the FILTERED set. */
export interface TradesDigest {
  trades: number;
  sessions: number;
  accounts: number;
  netCents: number;
  feesCents: number;
  wins: number;
  losses: number;
  /** Null when a result filter makes it meaningless, or when nothing is decided. See below. */
  winRatePct: number | null;
  largestWinCents: number | null;
  largestLossCents: number | null;
  /** Null under a result filter: a session with its losers removed is not a session. */
  bestSessionCents: number | null;
  worstSessionCents: number | null;
  firstDay: string | null;
  lastDay: string | null;
  /** False when no Cash History has ever been imported, so every figure is gross and must say so. */
  hasFees: boolean;
}

/* NET IS AN EXPRESSION, NOT A COLUMN, and it is written once here so no caller can spell it
   differently. `architecture.md` is explicit that net is never stored; this is what "derived on
   every extraction" means in practice. */
const NET = sql<number>`(${trade.grossPnlCents} + ${trade.feeCents})`;

/**
 * The `where` a filter selects. Everything narrows here, in SQL, before a row is read.
 *
 * `ok` ONLY FOR FIGURES, but this predicate deliberately does NOT filter state — the tape must show
 * quarantined and excluded trades (spec §S3: shown as excluded, never omitted), while every computed
 * figure must skip them. So state is applied by the caller: the digest adds it, the tape does not.
 */
function where(traderId: string, f: TradesFilter, window: { from: string | null; to: string | null }): SQL {
  const parts: (SQL | undefined)[] = [
    // From the session, never from the request. The record is somebody's trading history.
    eq(trade.traderId, traderId),
    window.from ? gte(trade.sessionDate, window.from) : undefined,
    window.to ? lte(trade.sessionDate, window.to) : undefined,
    f.accounts.length ? inArray(trade.accountId, f.accounts) : undefined,
    f.products.length ? inArray(trade.symbolRoot, f.products) : undefined,
  ];

  /* A RESULT TOKEN MATCHES ON NET, AND A SCRATCH MATCHES NEITHER. An exactly-zero net is not a
     loss, so `win` and `loss` together are not "every trade" — they are every DECIDED trade, and
     that is the honest reading of both chips being on. */
  if (f.results.length === 1) {
    parts.push(f.results[0] === 'win' ? sql`${NET} > 0` : sql`${NET} < 0`);
  } else if (f.results.length === 2) {
    parts.push(sql`${NET} <> 0`);
  }

  return and(...parts.filter((p): p is SQL => Boolean(p)))!;
}

/**
 * The tape, grouped into sessions, newest session first.
 *
 * ORDERED BY THE ENTRY WITHIN A SESSION, NOT THE EXIT, and that is `run-trading@v2`'s finding
 * rather than a preference: a position scaled out in three pieces closes on one exit stamp, so
 * ordering by the exit stamps several rows with one time and the list reads as random. The entry is
 * the decision, and the decision is what a tape is a record of.
 *
 * The SESSION a trade belongs to still comes from the exit — money is realised at the close — so
 * the two keys are deliberately different and each is right for its own job.
 */
export async function getTape(
  traderId: string,
  f: TradesFilter,
  window: { from: string | null; to: string | null },
  { limit = 500 }: { limit?: number } = {}
): Promise<SessionGroup[]> {
  const rows = await db
    .select({
      id: trade.id,
      accountId: trade.accountId,
      displayName: account.displayName,
      externalAccountId: account.externalAccountId,
      propFirm: account.propFirm,
      sizeDollars: account.sizeDollars,
      symbolRoot: trade.symbolRoot,
      contract: trade.contract,
      direction: trade.direction,
      qty: trade.qty,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      entryAt: trade.entryAt,
      exitAt: trade.exitAt,
      sessionDate: trade.sessionDate,
      grossCents: trade.grossPnlCents,
      feeCents: trade.feeCents,
      state: trade.state,
      quarantineReason: trade.quarantineReason,
      exclusionReason: trade.exclusionReason,
      pairId: trade.pairId,
      buyFillId: trade.buyFillId,
      sellFillId: trade.sellFillId,
    })
    .from(trade)
    .innerJoin(account, eq(account.id, trade.accountId))
    .where(where(traderId, f, window))
    .orderBy(desc(trade.sessionDate), desc(trade.entryAt))
    .limit(limit);

  /* GROUPED IN CODE, TOTALLED IN SQL. The grouping is free here because the rows arrive sorted by
     session already; the session's own FIGURES are not computed from this array, because this array
     is capped by `limit` and a header built from a truncated session would state a total for trades
     it cannot see. `sessionTotals` answers that separately, over the same `where`. */
  const groups = new Map<string, TapeRow[]>();
  for (const r of rows) {
    const net = r.grossCents + r.feeCents;
    /* THE ROW'S ACCOUNT LABEL IS COMPOSED HERE, by the one helper that owns that decision. The tape
       used to take `display_name` straight off the row, which is how it printed a raw
       `FTDFYL100183704873` on an account whose firm is known: `accountRowTitle` returns the
       trader's own name first, then falls back to firm + size + last four. The mark is resolved
       here too, so the row component never has to know how logo files are named. */
    const { displayName, externalAccountId, propFirm, sizeDollars, ...rest } = r;
    const row: TapeRow = {
      ...rest,
      netCents: net,
      accountName: accountRowTitle({ displayName, externalAccountId, propFirm, sizeDollars }),
      firmLogo: propFirm ? firmLogoSrc(propFirm) : null,
    };
    const bucket = groups.get(r.sessionDate);
    if (bucket) bucket.push(row);
    else groups.set(r.sessionDate, [row]);
  }

  const totals = await sessionTotals(traderId, f, window, [...groups.keys()]);

  return [...groups].map(([sessionDate, trades]) => {
    const t = totals.get(sessionDate);
    const decided = (t?.winCount ?? 0) + (t?.lossCount ?? 0);
    return {
      sessionDate,
      netCents: t?.netCents ?? 0,
      feesCents: t?.feesCents ?? 0,
      tradeCount: t?.tradeCount ?? 0,
      winCount: t?.winCount ?? 0,
      lossCount: t?.lossCount ?? 0,
      // A rate off zero decided trades is a divide, not a fact.
      winRatePct: decided ? Math.round(((t?.winCount ?? 0) / decided) * 100) : null,
      trades,
    };
  });
}

/* EACH SESSION'S OWN TOTALS, over the filtered set and over `ok` rows only.
 *
 * NOT READ FROM THE `session` TABLE, deliberately, and the distinction matters. That table is the
 * trader's WHOLE day across every account and every product; this header sits above a FILTERED
 * tape, and printing the unfiltered day's net over a tape narrowed to one product would be two
 * numbers on one screen disagreeing — the fault this codebase forbids everywhere else. The
 * `session` rollup is for surfaces whose subject IS the day (Today, the read); this is for a tape.
 */
async function sessionTotals(
  traderId: string,
  f: TradesFilter,
  window: { from: string | null; to: string | null },
  days: string[]
): Promise<Map<string, { netCents: number; feesCents: number; tradeCount: number; winCount: number; lossCount: number }>> {
  if (days.length === 0) return new Map();

  const rows = await db
    .select({
      sessionDate: trade.sessionDate,
      netCents: sql<number>`sum(${NET})`.mapWith(Number),
      feesCents: sql<number>`sum(${trade.feeCents})`.mapWith(Number),
      tradeCount: sql<number>`count(*)`.mapWith(Number),
      winCount: sql<number>`count(*) filter (where ${NET} > 0)`.mapWith(Number),
      lossCount: sql<number>`count(*) filter (where ${NET} < 0)`.mapWith(Number),
    })
    .from(trade)
    .where(and(where(traderId, f, window), eq(trade.state, 'ok'), inArray(trade.sessionDate, days)))
    .groupBy(trade.sessionDate);

  return new Map(rows.map((r) => [r.sessionDate, r]));
}

/**
 * The right-rail digest, over the whole filtered set.
 *
 * TWO AGGREGATES, NOT A FOLD OVER THE PAGE. One over trades, one over sessions, both against the
 * same `where` the tape uses. The page's `limit` cannot reach either.
 *
 * FOUR FIGURES GO NULL UNDER A RESULT FILTER, and this is a defect Luke found in the previous build
 * (2026-08-05: "when i add on one more filter like the wins, then it doesn't display the stats
 * properly"). They do not become narrow, they become UNTRUE:
 *
 *   win rate            100% by construction. It is not a statistic, it is the filter read back.
 *   best / worst day    "Worst -$51.20" reads as the worst day this tape ever had, which is flatly
 *                       untrue when the losses were filtered out. This is the one that misleads
 *                       rather than merely bores.
 *   (average day)       a session with its losers removed is not a session — not offered here.
 *
 * The first fix attempted in that build was to summarise the set BEFORE the result filter, which
 * kept every figure honest and produced a worse bug: the card said 18 trades while the tape under
 * it showed 3. So the rule is: narrow EVERYTHING, and refuse to print what narrowing makes false.
 * Counts and net stay, because each is a true statement about what is on screen.
 */
export async function getDigest(
  traderId: string,
  f: TradesFilter,
  window: { from: string | null; to: string | null }
): Promise<TradesDigest> {
  const scoped = and(where(traderId, f, window), eq(trade.state, 'ok'))!;

  const [[totals], days] = await Promise.all([
    db
      .select({
        trades: sql<number>`count(*)`.mapWith(Number),
        accounts: sql<number>`count(distinct ${trade.accountId})`.mapWith(Number),
        netCents: sql<number>`coalesce(sum(${NET}), 0)`.mapWith(Number),
        feesCents: sql<number>`coalesce(sum(${trade.feeCents}), 0)`.mapWith(Number),
        wins: sql<number>`count(*) filter (where ${NET} > 0)`.mapWith(Number),
        losses: sql<number>`count(*) filter (where ${NET} < 0)`.mapWith(Number),
        largestWinCents: sql<number | null>`max(${NET}) filter (where ${NET} > 0)`,
        largestLossCents: sql<number | null>`min(${NET}) filter (where ${NET} < 0)`,
        firstDay: sql<string | null>`min(${trade.sessionDate})`,
        lastDay: sql<string | null>`max(${trade.sessionDate})`,
        // Whether any fee was ever imported for this set. Zero is a real answer meaning "gross",
        // and a page showing gross must say so rather than labelling it net.
        feeRows: sql<number>`count(*) filter (where ${trade.feeCents} <> 0)`.mapWith(Number),
      })
      .from(trade)
      .where(scoped),
    /* THE SESSION EXTREMES, as a grouped aggregate rather than a second pass in JavaScript. v2
       folded these client-side and hit a real ceiling doing it: `Math.max(...rows)` passes every
       element as an argument, and a busy scalper's tape is exactly the shape that overflows the
       call stack — silently, as a RangeError on a page that worked all year. */
    db
      .select({ net: sql<number>`sum(${NET})`.mapWith(Number) })
      .from(trade)
      .where(scoped)
      .groupBy(trade.sessionDate),
  ]);

  const resultFiltered = isResultFiltered(f);
  const decided = totals.wins + totals.losses;
  const sessionNets = days.map((d) => d.net);

  return {
    trades: totals.trades,
    sessions: sessionNets.length,
    accounts: totals.accounts,
    netCents: totals.netCents,
    feesCents: totals.feesCents,
    wins: totals.wins,
    losses: totals.losses,
    winRatePct: resultFiltered || !decided ? null : Math.round((totals.wins / decided) * 100),
    largestWinCents: totals.largestWinCents === null ? null : Number(totals.largestWinCents),
    largestLossCents: totals.largestLossCents === null ? null : Number(totals.largestLossCents),
    bestSessionCents: resultFiltered || !sessionNets.length ? null : Math.max(...sessionNets),
    worstSessionCents: resultFiltered || !sessionNets.length ? null : Math.min(...sessionNets),
    firstDay: totals.firstDay,
    lastDay: totals.lastDay,
    hasFees: totals.feeRows > 0,
  };
}

/* Which products and accounts the trader has ever traded, for the filter's own options.
 *
 * DELIBERATELY NOT SCOPED TO THE WINDOW, and this is a correctness decision rather than an
 * oversight — do not "optimise" it by passing the filter in.
 *
 * `run-trading@v2` scoped its equivalent to the accounts that traded inside the current date range
 * (its issue #92), which silently discards a filter the trader set: pick three accounts, then narrow
 * the dates to a window where one of them did not trade, and that account vanishes from the panel.
 * The next Apply writes back the reduced set, dropping a selection nobody removed.
 *
 * The rule that resolves it, from v2's own note: what the panel may OFFER is the full roster, so a
 * selection can always survive; what the panel COUNTS is the in-range set, which is the informative
 * number. Those are two different lists and collapsing them into one is the bug.
 */
export async function getFacets(
  traderId: string
): Promise<{ products: string[]; accounts: { id: string; name: string }[] }> {
  const [products, accounts] = await Promise.all([
    db
      .selectDistinct({ root: trade.symbolRoot })
      .from(trade)
      .where(eq(trade.traderId, traderId))
      .orderBy(asc(trade.symbolRoot)),
    db
      .selectDistinct({
        id: account.id,
        displayName: account.displayName,
        externalAccountId: account.externalAccountId,
        propFirm: account.propFirm,
        sizeDollars: account.sizeDollars,
      })
      .from(trade)
      .innerJoin(account, eq(account.id, trade.accountId))
      .where(eq(trade.traderId, traderId))
      .orderBy(asc(account.externalAccountId)),
  ]);
  return {
    products: products.map((p) => p.root),
    // The same composed title the tape prints, so a filter chip and the rows it selects never
    // disagree about what an account is called.
    accounts: accounts.map((a) => ({ id: a.id, name: accountRowTitle(a) })),
  };
}

/** Quarantined and excluded trades in scope, for the notice above the tape. Counted separately
 *  because the notice states a fact the figures deliberately exclude. */
export async function getExcluded(
  traderId: string,
  f: TradesFilter,
  window: { from: string | null; to: string | null }
): Promise<{ quarantined: number; excluded: number }> {
  const [row] = await db
    .select({
      quarantined: sql<number>`count(*) filter (where ${trade.state} = 'quarantined')`.mapWith(Number),
      excluded: sql<number>`count(*) filter (where ${trade.state} = 'excluded')`.mapWith(Number),
    })
    .from(trade)
    .where(where(traderId, f, window));
  return row;
}
