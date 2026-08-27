import 'server-only';
import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import { db, trade, account, importBatch } from '@/lib/db';
import type { TradeState } from '@/lib/db';
import type { AccountStatus, AccountType } from '@/lib/db/schema';
import {
  firmLogoSrc,
  accountRowTitle,
  accountShortTitle,
  accountTitleParts,
  UNLABELLED_FIRM,
} from '@/lib/prop-firms';
import { rootsMatchingName } from '@/lib/instruments';
import type { TradesFilter } from './filter';
import type { FacetRow } from './facets';
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
  /* THE TITLE'S TWO HALVES, split by `accountTitleParts` where `accountRowTitle` joined them.
     Sent rather than re-derived on the client: the tape has to truncate this string and the ONLY
     safe cut is the composition boundary. A client-side split would be arithmetic on a string whose
     shape it cannot see, which is precisely the bug that shipped here once. `accountName` stays
     because the export and the drawer want the whole thing. */
  accountHead: string;
  accountTail: string;
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
  avgWinCents: number | null;
  avgLossCents: number | null;
  /** Null under a result filter: a session with its losers removed is not a session. */
  avgSessionCents: number | null;
  bestSessionCents: number | null;
  worstSessionCents: number | null;
  firstDay: string | null;
  lastDay: string | null;
  /** False when no Cash History has ever been imported, so every figure is gross and must say so. */
  hasFees: boolean;
  /* WHEN THE RECORD BEHIND THESE FIGURES WAS LAST READ (P8). Null before anything has been
     imported for the accounts in view. Scoped to those accounts rather than the trader, or a
     filtered tape would report an import that contributed nothing to it. */
  lastImportAt: Date | null;
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
    /* STATUS AND TYPE ARE THE ACCOUNT'S, SO THEY NARROW THROUGH THE ACCOUNT (2026-08-26). A
       subquery rather than a join: `selectTapeRows` already joins `account` for the row's title,
       but the digest and the day-list queries below do not, and a predicate that only worked on
       one of the three is how a tape and its summary come to disagree. One statement either way -
       Postgres plans this as a semi-join on `account_trader_idx`.
       SCOPED BY `trader_id` INSIDE THE SUBQUERY TOO. The outer `trade.trader_id` already bounds
       the result, so this is redundant for correctness and deliberate anyway: a subquery that
       could match another trader's account row is one refactor away from being the whole
       predicate. */
    f.status.length
      ? inArray(
          trade.accountId,
          db
            .select({ id: account.id })
            .from(account)
            .where(and(eq(account.traderId, traderId), inArray(account.status, f.status)))
        )
      : undefined,
    f.types.length
      ? inArray(
          trade.accountId,
          db
            .select({ id: account.id })
            .from(account)
            .where(and(eq(account.traderId, traderId), inArray(account.accountType, f.types)))
        )
      : undefined,
  ];

  /* A RESULT TOKEN MATCHES ON NET, AND A SCRATCH MATCHES NEITHER. An exactly-zero net is not a
     loss, so `win` and `loss` together are not "every trade" — they are every DECIDED trade, and
     that is the honest reading of both chips being on. */
  if (f.results.length === 1) {
    parts.push(f.results[0] === 'win' ? sql`${NET} > 0` : sql`${NET} < 0`);
  } else if (f.results.length === 2) {
    parts.push(sql`${NET} <> 0`);
  }

  /* THE SEARCH TERM, APPLIED IN SQL LIKE EVERY OTHER NARROWING. v2 matched its term in JavaScript
   * over an index it had already loaded; this build's standing rule is that nothing is filtered in
   * the browser and nothing is filtered after the read, so it is a predicate.
   *
   * FOUR THINGS MATCH, and each is something the chips beside this control cannot ask:
   *   the ROOT      `MNQ` — a chip can ask this, but only by exact pick
   *   the CONTRACT  `MNQU6` — NOT a filter chip at all, deliberately (the month is an expiry, not a
   *                 strategy), so this is the only way to reach one
   *   the PRODUCT   `nasdaq` -> the roots that name resolves to, via `rootsMatchingName`
   *   the ACCOUNT   as a SUBQUERY, not a join. `getDigest` reads `trade` alone, so a join here would
   *                 either break that caller or force every caller to carry a join it does not use.
   *                 `account` is one row per account, so this costs an index probe per row at worst.
   *
   * `%` AND `_` ARE ESCAPED. They are LIKE wildcards, so an unescaped `_` silently matches any
   * character and a lone `%` matches every row — a search that returns everything reads as a broken
   * filter rather than as the trader having typed an operator. */
  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const roots = rootsMatchingName(f.q);
    parts.push(
      sql`(
        ${trade.symbolRoot} ilike ${like}
        or ${trade.contract} ilike ${like}
        ${roots.length ? sql`or ${inArray(trade.symbolRoot, roots)}` : sql``}
        or exists (
          select 1 from ${account}
          where ${account.id} = ${trade.accountId}
            and (
              coalesce(${account.displayName}, '') ilike ${like}
              or coalesce(${account.externalAccountId}, '') ilike ${like}
              or coalesce(${account.propFirm}, '') ilike ${like}
            )
        )
      )`
    );
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
/* ONE SELECT FOR A TAPE ROW, so the first page and every page fetched after it are the same shape
 * by construction rather than by two lists of columns staying in step. A row that arrives from the
 * paging route with a differently-composed account label, or a missing provenance id, is a bug
 * nothing would catch until a trader scrolled far enough to see it.
 *
 * The account label and the firm mark are composed HERE for the same reason: `accountRowTitle` is
 * the one helper that owns what an account is called, and the row component never has to know how
 * logo files are named. */
async function selectTapeRows(
  predicate: SQL,
  extra?: SQL,
  limit?: number
): Promise<TapeRow[]> {
  const q = db
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
    .where(extra ? and(predicate, extra) : predicate)
    /* `trade.id` IS A TIE-BREAK, NOT DECORATION (2026-08-25). `(session_date, entry_at)` is not
       unique: two contracts entered on the same stamp and paired into two round trips share both
       columns, and SQL leaves the order of ties undefined. Two queries with this same ORDER BY may
       therefore disagree about which came first - and `getTapeIds` below IS that second query, so
       the ordered id list the client pages through could interleave differently from the rows
       rendered here. A trade shown twice, or skipped, in a product whose one claim is that its
       numbers reconcile. Any keyset cursor over this ordering needs the unique column too. */
    .orderBy(desc(trade.sessionDate), desc(trade.entryAt), desc(trade.id));

  const rows = await (limit === undefined ? q : q.limit(limit));

  return rows.map((r) => {
    const { displayName, externalAccountId, propFirm, sizeDollars, ...rest } = r;
    return {
      ...rest,
      netCents: r.grossCents + r.feeCents,
      accountName: accountRowTitle({ displayName, externalAccountId, propFirm, sizeDollars }),
      ...(() => {
        const parts = accountTitleParts({ displayName, externalAccountId, propFirm, sizeDollars });
        return { accountHead: parts.head, accountTail: parts.tail };
      })(),
      firmLogo: propFirm ? firmLogoSrc(propFirm) : null,
    };
  });
}

/**
 * THE ORDERED IDS OF EVERY TRADE THE FILTER SELECTS, and nothing else.
 *
 * IDS RATHER THAN AN OFFSET, which is the choice that makes paging safe. An offset would mean the
 * server re-deriving the filter and re-running this query on every trip, and any drift between the
 * two derivations shows as a row appearing twice or not at all. Handing the client the ordered ids
 * costs bytes instead — a uuid is 36 of them, so 20,000 trades is ~740KB against roughly 10MB for
 * those rows in full, and the client then asks for exactly the rows it wants.
 *
 * The order is the tape's own: session descending, entry descending inside one.
 */
export async function getTapeIds(
  traderId: string,
  f: TradesFilter,
  window: { from: string | null; to: string | null }
): Promise<string[]> {
  const rows = await db
    .select({ id: trade.id })
    .from(trade)
    .where(where(traderId, f, window))
    /* THE SAME THREE COLUMNS AS THE TAPE, and they have to be the same three. This list is what the
       client pages through; the tape above is what it renders. A tie broken differently by the two
       is a row fetched twice or never. See the note there. */
    .orderBy(desc(trade.sessionDate), desc(trade.entryAt), desc(trade.id));
  return rows.map((r) => r.id);
}

/**
 * Full rows for exactly the ids asked for, in the order asked for.
 *
 * THE IDS ARE NOT TRUSTED. Every read is scoped to the signed-in trader, so a hand-crafted body can
 * only ever ask for rows that trader already owns — a wrong id returns nothing rather than somebody
 * else's tape. The caller's order is the tape's order, so it is preserved rather than re-derived.
 */
export async function getTradesByIds(traderId: string, ids: string[]): Promise<TapeRow[]> {
  if (ids.length === 0) return [];
  const rows = await selectTapeRows(inArray(trade.id, ids), eq(trade.traderId, traderId));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is TapeRow => Boolean(r));
}

export async function getTape(
  traderId: string,
  f: TradesFilter,
  window: { from: string | null; to: string | null },
  { limit = 500 }: { limit?: number } = {}
): Promise<SessionGroup[]> {
  const rows = await selectTapeRows(where(traderId, f, window), undefined, limit);

  /* GROUPED IN CODE, TOTALLED IN SQL. The grouping is free here because the rows arrive sorted by
     session already; the session's own FIGURES are not computed from this array, because this array
     is capped by `limit` and a header built from a truncated session would state a total for trades
     it cannot see. `sessionTotals` answers that separately, over the same `where`. */
  const groups = new Map<string, TapeRow[]>();
  for (const row of rows) {
    const bucket = groups.get(row.sessionDate);
    if (bucket) bucket.push(row);
    else groups.set(row.sessionDate, [row]);
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
/**
 * THE DAILY SERIES FOR WHATEVER THE FILTER SELECTS — the chart's half of "one page, one answer".
 *
 * WHY IT LIVES HERE AND NOT IN `lib/accounts/read.ts`. It has to narrow by exactly the same rule the
 * tape does, and that rule is `where()` in this file: products, results, the search term, the
 * account, the window. A second spelling in the accounts module would be two `where`s over one
 * question, which is how `/accounts/details` would come to draw a line that disagrees with the rows
 * underneath it. v2 shipped that defect in the other direction and Luke caught it (2026-08-03:
 * *"i dont think that filter changes are appling to the chart. just the trade table rows. shouldn't
 * it apply to the chart as well?"*).
 *
 * IT IS A SQL AGGREGATE, WHERE v2 HAD TO FOLD IN THE BROWSER, and the difference is this build's
 * projection rather than a preference. v2 could not filter its chart in SQL because a `fee` event
 * carries the CONTRACT where a round trip carries the PRODUCT, so any product-filtered aggregate
 * dropped every fee and the line went gross while the tape stayed net. Here `fee_cents` is a
 * promoted column ON the round trip, so narrowing cannot separate a trade from its costs, and the
 * fold has no reason to exist. Same `NET`, same `state = 'ok'`, same `where` - three fewer places
 * for the two surfaces to drift apart.
 */
export async function getDailySeriesFor(
  traderId: string,
  f: TradesFilter,
  window: { from: string | null; to: string | null }
): Promise<{ accountId: string; day: string; cents: number }[]> {
  const rows = await db
    .select({
      accountId: trade.accountId,
      day: trade.sessionDate,
      cents: sql<number>`coalesce(sum(${NET}), 0)`.mapWith(Number),
    })
    .from(trade)
    /* `state = 'ok'` ON TOP OF THE FILTER, exactly as `getDigest` does it. A quarantined trade stays
       visible and countable on the tape and out of every FIGURE, and a chart is a figure. */
    .where(and(where(traderId, f, window), eq(trade.state, 'ok')))
    .groupBy(trade.accountId, trade.sessionDate)
    .orderBy(asc(trade.sessionDate));

  return rows;
}

/**
 * THE SAME NARROWING, INSIDE ONE SESSION — what the 1-day range draws.
 *
 * IT EXISTS BECAUSE THE DEFECT IS PER-RANGE, NOT PER-CHART. `getDailySeriesFor` makes the daily
 * curve obey the filter; leaving the intraday one reading every product would ship exactly the bug
 * it fixes, visible only to a trader who narrowed and then picked 1 day. One `where`, both ranges.
 *
 * SCOPED BY `session_date`, NOT BY AN INSTANT RANGE, like the accounts module's own version:
 * `session_date` is the stored answer to "which session is this in", and asking again with
 * `exit_at BETWEEN open AND close` would be a second bucketer, which CLAUDE.md forbids and which
 * would disagree with the tape twice a year. The window's instants are for DRAWING.
 *
 * NO AGGREGATION: the curve IS the sequence, so this hands back rows.
 */
export async function getIntradaySeriesFor(
  traderId: string,
  f: TradesFilter,
  sessionDate: string
): Promise<{ accountId: string; at: Date; cents: number }[]> {
  const rows = await db
    .select({ accountId: trade.accountId, at: trade.exitAt, cents: NET })
    .from(trade)
    .where(
      and(
        where(traderId, f, { from: sessionDate, to: sessionDate }),
        eq(trade.state, 'ok')
      )
    )
    .orderBy(asc(trade.exitAt));

  return rows.map((r) => ({ accountId: r.accountId, at: r.at, cents: Number(r.cents) }));
}

export async function getDigest(
  traderId: string,
  f: TradesFilter,
  window: { from: string | null; to: string | null }
): Promise<TradesDigest> {
  const scoped = and(where(traderId, f, window), eq(trade.state, 'ok'))!;

  /* THE ACCOUNTS THESE FIGURES ACTUALLY COVER. An empty `accounts` filter means every account, so
     the import lookup below is scoped by the trader alone in that case - matching what the tape
     itself did. */
  const accountScope =
    f.accounts.length > 0
      ? and(eq(importBatch.traderId, traderId), inArray(importBatch.accountId, f.accounts))!
      : eq(importBatch.traderId, traderId);

  const [[totals], days, [lastImport]] = await Promise.all([
    db
      .select({
        trades: sql<number>`count(*)`.mapWith(Number),
        accounts: sql<number>`count(distinct ${trade.accountId})`.mapWith(Number),
        netCents: sql<number>`coalesce(sum(${NET}), 0)`.mapWith(Number),
        feesCents: sql<number>`coalesce(sum(${trade.feeCents}), 0)`.mapWith(Number),
        wins: sql<number>`count(*) filter (where ${NET} > 0)`.mapWith(Number),
        losses: sql<number>`count(*) filter (where ${NET} < 0)`.mapWith(Number),
        /* THE AVERAGES, NOT THE EXTREMES (2026-08-19, matching v2). This was `max`/`min` — largest
           win and largest loss — which are the same KIND of figure as best/worst session directly
           above them in the rail: four extremes stacked, two of them single trades. The averages
           are what pair against win rate, and those three together are the expectancy triangle
           (win rate x avg win against avg loss) that decides whether an edge survives. A largest
           loss is one bad afternoon; an average loss is the habit, which is what `psychology.md`
           exists to name.
           ROUNDED IN SQL, because these stay integer cents all the way to the formatter — `avg()`
           returns numeric and a fractional cent is not money in this codebase. */
        avgWinCents: sql<number | null>`round(avg(${NET}) filter (where ${NET} > 0))`,
        avgLossCents: sql<number | null>`round(avg(${NET}) filter (where ${NET} < 0))`,
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
    /* WHEN THE RECORD WAS LAST READ (P8). One row: the newest completed import touching the
       accounts in view.
       `status = 'complete'` MATTERS. A pending or failed import contributed no trades, so dating
       the tape by it would claim a freshness the figures do not have - which is the exact failure
       P8 exists to prevent, told backwards.
       Deliberately NOT filtered by the date window: the question is when the DATA was last read,
       not when the trades in it happened. A trader looking at March wants to know their last import
       was Tuesday, not that nothing was imported in March. */
    db
      .select({ uploadedAt: importBatch.uploadedAt })
      .from(importBatch)
      /* `'committed'`, NOT `'complete'` (2026-08-25). `'complete'` is not a value this column can
         hold: the CHECK permits `pending | committed | rejected` and `commit.ts` writes exactly
         those three. So this predicate matched nothing, ever, and `lastImportAt` was permanently
         null - invisibly, because the `Last import` row that rendered it was cut the same week.
         `S6` is where it would have surfaced: P5 requires a freshness stamp on EVERY account row,
         and it would have been blank on every one of them with nothing to point at. */
      .where(and(accountScope, eq(importBatch.status, 'committed')))
      .orderBy(desc(importBatch.uploadedAt))
      .limit(1),
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
    avgWinCents: totals.avgWinCents === null ? null : Number(totals.avgWinCents),
    avgLossCents: totals.avgLossCents === null ? null : Number(totals.avgLossCents),
    /* THE SESSION FIGURES ARE ALL THREE OR NONE. `avgSession` joins best and worst under the same
       `resultFiltered` guard for the same reason they carry it: a session with its losers filtered
       out is not a session, so its average is as misleading as its worst. Rounded to whole cents
       on the same rule as the win/loss averages above. */
    avgSessionCents:
      resultFiltered || !sessionNets.length
        ? null
        : Math.round(sessionNets.reduce((a, b) => a + b, 0) / sessionNets.length),
    bestSessionCents: resultFiltered || !sessionNets.length ? null : Math.max(...sessionNets),
    worstSessionCents: resultFiltered || !sessionNets.length ? null : Math.min(...sessionNets),
    firstDay: totals.firstDay,
    lastDay: totals.lastDay,
    hasFees: totals.feeRows > 0,
    lastImportAt: lastImport?.uploadedAt ?? null,
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
/** One account as the filter panel needs it: the composed title for chips and search, the firm it
 *  groups under, and the title WITHOUT the firm for the row nested beneath it. */
export interface FacetAccount {
  id: string;
  name: string;
  firm: string;
  short: string;
  /* THE ACCOUNT'S OWN TWO AXES, carried to the panel so it can offer them and narrow the tree by
     them without a second read. They are counted in ACCOUNTS rather than trades - see
     `facets.ts`' `AccountMeta`. */
  status: AccountStatus;
  accountType: AccountType | null;
}

export async function getFacets(
  traderId: string
): Promise<{ products: string[]; accounts: FacetAccount[] }> {
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
        status: account.status,
        accountType: account.accountType,
      })
      .from(trade)
      .innerJoin(account, eq(account.id, trade.accountId))
      .where(eq(trade.traderId, traderId))
      .orderBy(asc(account.externalAccountId)),
  ]);
  return {
    products: products.map((p) => p.root),
    // The same composed title the tape prints, so a filter chip and the rows it selects never
    // disagree about what an account is called. `firm` and `short` come along for the panel's tree:
    // it groups by firm and prints the account WITHOUT the firm under it, since the row above
    // already says it.
    accounts: accounts.map((a) => ({
      id: a.id,
      name: accountRowTitle(a),
      firm: a.propFirm ?? UNLABELLED_FIRM,
      short: accountShortTitle(a),
      status: a.status,
      accountType: a.accountType,
    })),
  };
}

/**
 * `(account, product) -> wins, losses` over everything the trader has ever traded.
 *
 * THE WHOLE INPUT TO THE FILTER PANEL'S NARROWING, and it is one query rather than one per tick —
 * see `lib/trades/facets.ts` for why the intersection happens in the browser.
 *
 * DELIBERATELY NOT WINDOW-SCOPED, exactly like `getFacets` above and for the same reason: what the
 * panel may OFFER is the full roster, so a selection can always survive a date change. v2's issue
 * #92 is the bug that rule exists to prevent.
 *
 * `ok` ONLY. A quarantined trade is visible on the tape and countable in the notice above it, but a
 * filter option reading "MNQ 12" that resolves to 9 usable rows would be a number that cannot be
 * reconciled against the tape it filters.
 */
export async function getFacetRows(traderId: string): Promise<FacetRow[]> {
  const rows = await db
    .select({
      accountId: trade.accountId,
      product: trade.symbolRoot,
      wins: sql<number>`count(*) filter (where ${NET} > 0)`.mapWith(Number),
      /* A SCRATCH COUNTS HERE, and that is not a judgement about the trade - it is the only way the
         number reconciles (2026-08-25, postcheck). Both consumers render `wins + losses` as a row's
         trailing count, so a net-zero trade counted in NEITHER made the filter panel read 358 beside
         a tape and a rail that both said 360.
         NOT RARE: with no Cash History imported every fee is 0, so every flat trade is net exactly
         zero. This function's own note says a count resolving to a different number of rows "would
         be a number that cannot be reconciled against the tape it filters" - which is this.
         `<= 0` rather than a third bucket, because these two exist to be SUMMED into a row count.
         The win/loss split that feeds a FIGURE is `getDigest`'s, which keeps scratches out of both
         and must go on doing so. */
      losses: sql<number>`count(*) filter (where ${NET} <= 0)`.mapWith(Number),
    })
    .from(trade)
    .where(and(eq(trade.traderId, traderId), eq(trade.state, 'ok')))
    .groupBy(trade.accountId, trade.symbolRoot);
  return rows;
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
