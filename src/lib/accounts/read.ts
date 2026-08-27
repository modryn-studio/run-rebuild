import 'server-only';
import type { AccountStatus, AccountType } from '@/lib/db/schema';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { account, importBatch, trade } from '@/lib/db/schema';

/* THE ROSTER'S NUMBERS, READ OFF THE PROJECTION RATHER THAN THE LOG.
 *
 * `run-trading@v2` computed this page's money by scanning `event` — `count(*) filter (type='fill')`,
 * `sum(pnl_cents) filter (type in ('round_trip','fee'))` and `max(recorded_at)`, grouped over EVERY
 * event the trader has ever had, on a `(trader_id)`-only index, unwindowed, twice per render (once
 * for the roster and once for the chart).
 *
 * THIS BUILD DOES NOT HAVE TO, and CLAUDE.md forbids doing it anyway: "Scope every read by account
 * and window from the first query. Free now, unretrofittable once four surfaces depend on it."
 * `trade` is a projection v2 never had. It carries `account_id`, `session_date`, `gross_pnl_cents`,
 * `fee_cents` and `state` as promoted columns, and it already has `trade_account_session_idx` on
 * exactly `(account_id, session_date)` — the index this shape wants, built for the tape.
 *
 * THE SECOND WIN IS THAT THE TWO PAGES CANNOT DISAGREE. `NET` and the `state = 'ok'` exclusion are
 * the same expressions `/trades` uses, spelled once in `lib/trades/read.ts` and imported here, so
 * an account's total on this page is arithmetically the same number the tape would sum. v2 had no
 * such guarantee — and its `netPnlCents` ignores `corrects_event_id` entirely, so a corrected round
 * trip double-counts there.
 *
 * NOTHING HERE READS `event.payload`, per the standing rule for render paths.
 */

/* THE SAME `NET` THE TAPE USES. Re-derived here rather than imported because `read.ts` keeps it
   module-private, and the one thing worse than two spellings is a third file re-deriving it
   differently. If this ever drifts from `lib/trades/read.ts`'s `NET`, the roster and the tape start
   disagreeing about the same account, which is the one failure this file exists to prevent.
   FRICTION 2026-08-25: this wants to be exported from one place. Left as a documented duplicate
   rather than widening `read.ts`'s API mid-slice. */
const NET = sql<number>`(${trade.grossPnlCents} + ${trade.feeCents})`;

/** Only trades Run can reconcile feed a figure. Quarantined and excluded rows stay visible on the
 *  tape and stay out of every total — the same rule `getDigest` applies, for the same reason. */
const COUNTABLE = eq(trade.state, 'ok');

/** One account, plus the two numbers the roster folds up from its trades. */
export interface RosterAccount {
  id: string;
  externalAccountId: string;
  platform: string;
  propFirm: string | null;
  firmSource: string | null;
  sizeDollars: number | null;
  accountType: AccountType | null;
  productName: string | null;
  displayName: string | null;
  status: AccountStatus;
  closedOn: string | null;
  hidden: boolean;
  excludedFromTotals: boolean;
  /** Round trips Run holds for this account. v2 counted FILLS here; this build has no fill
   *  projection on a render path, and "trades" is the figure the rest of the product speaks in. */
  trades: number;
  /** Net of fees, in integer cents. Never gross: a prop account passes or fails on net. */
  netCents: number;
  /** The last session this account realised anything in. Drives the closed-account chart window. */
  lastSessionDate: string | null;
}

/**
 * Every account the trader owns, with its folded numbers.
 *
 * DELIBERATELY NOT FILTERED BY `hidden`. v2 filtered it in SQL and made Hide a one-way door: the
 * roster stopped listing the account, and the roster row was the only route to the modal that could
 * un-hide it. The roster decides what to do with a hidden row; the query hands them all over.
 *
 * DELIBERATELY NOT FILTERED BY `excludedFromTotals` either, and that one is not even close: an
 * excluded account keeps its own real figure and simply does not join a total. Dropping it here
 * would answer a question nobody asked.
 *
 * A LEFT JOIN, SO AN ACCOUNT WITH NO TRADES IS STILL AN ACCOUNT. A hand-added evaluation bought
 * this morning has no fills and has to appear — it is the row the trader's loss line will live on.
 */
export async function getRoster(
  traderId: string,
  /* NARROWED TO ONE ACCOUNT BY `/accounts/details` (`S6d`), and it is a PARAMETER rather than a
     second function on purpose. The detail page prints the same three folded figures the roster row
     does - trades, net, last session - directly above a tape that has to agree with them. Two
     queries spelling that fold two ways is precisely how this file's own header says v2 came to
     disagree with itself, one render apart. One shape, one `NET`, one `state = 'ok'`.
     It also stays the AUTHORIZATION boundary: `trader_id` is still in the `where`, so an id
     belonging to somebody else comes back empty rather than coming back. */
  opts?: { accountId?: string }
): Promise<RosterAccount[]> {
  const rows = await db
    .select({
      id: account.id,
      externalAccountId: account.externalAccountId,
      platform: account.platform,
      propFirm: account.propFirm,
      firmSource: account.firmSource,
      sizeDollars: account.sizeDollars,
      accountType: account.accountType,
      productName: account.productName,
      displayName: account.displayName,
      status: account.status,
      closedOn: account.closedOn,
      hidden: account.hidden,
      excludedFromTotals: account.excludedFromTotals,
      trades: sql<number>`count(${trade.id}) filter (where ${COUNTABLE})`.mapWith(Number),
      netCents: sql<number>`coalesce(sum(${NET}) filter (where ${COUNTABLE}), 0)`.mapWith(Number),
      lastSessionDate: sql<string | null>`max(${trade.sessionDate}) filter (where ${COUNTABLE})`,
    })
    .from(account)
    .leftJoin(trade, eq(trade.accountId, account.id))
    .where(
      and(
        eq(account.traderId, traderId),
        ...(opts?.accountId ? [eq(account.id, opts.accountId)] : [])
      )
    )
    .groupBy(account.id)
    /* NEWEST FIRST, AND THE TIE-BREAK IS NOT DECORATION. v2 shipped this with no ORDER BY at all,
       which is not insertion order — it is whatever the heap hands back, and an UPDATE moves a row
       to the end of it, so a trader renaming an account watched it jump down the card. `created_at`
       alone is not unique either: one CSV can mint six accounts inside the same millisecond. */
    .orderBy(sql`${account.createdAt} desc`, sql`${account.id} desc`);

  return rows as RosterAccount[];
}

/** One day of one account's realised P&L. `day` is a `session_date`, already stored. */
export interface DayPoint {
  accountId: string;
  day: string;
  cents: number;
}

/**
 * The daily series behind the hero curve and every row's sparkline, in ONE read.
 *
 * ONE QUERY, TWO GRAINS, and v2's reasoning for that holds exactly: the roster's group headers need
 * per-account daily figures over the same window the chart draws. Running a second query "would
 * read the same rows twice, one render apart, with a real chance of the two disagreeing after an
 * import lands between them". Grouping by `(account, day)` once makes them incapable of it.
 *
 * NO RUNTIME BUCKETING. v2 computed the trade date in SQL on every read, with its own `tradeDateSql`
 * re-implementing the 5pm CT roll. Here `session_date` is a STORED column on `trade`, written once
 * by the projector through `lib/time/session.ts` — the one module that owns time buckets. A second
 * bucketer is exactly what CLAUDE.md forbids, and this build does not need one.
 *
 * WINDOWED BY THE CALLER, unlike v2's, which read all time on every render.
 */
export async function getDailySeries(
  traderId: string,
  /* `accountId` NARROWS IT TO ONE, for `/accounts/details` (`S6d`). The roster reads every account
     because it draws every account; a page about ONE must not, and CLAUDE.md is explicit that the
     scoping goes in from the first query rather than being retrofitted. `trade_account_session_idx`
     is on exactly `(account_id, session_date)`, so the narrow read is the one the index was built
     for - it is cheaper than the roster's, not an extra cost. */
  window?: { from?: string | null; to?: string | null; accountId?: string }
): Promise<DayPoint[]> {
  const bounds = [eq(trade.traderId, traderId), COUNTABLE];
  if (window?.from) bounds.push(sql`${trade.sessionDate} >= ${window.from}`);
  if (window?.to) bounds.push(sql`${trade.sessionDate} <= ${window.to}`);
  if (window?.accountId) bounds.push(eq(trade.accountId, window.accountId));

  const rows = await db
    .select({
      accountId: trade.accountId,
      day: trade.sessionDate,
      cents: sql<number>`coalesce(sum(${NET}), 0)`.mapWith(Number),
    })
    .from(trade)
    .where(and(...bounds))
    .groupBy(trade.accountId, trade.sessionDate)
    .orderBy(asc(trade.sessionDate));

  return rows as DayPoint[];
}

/** One realised round trip, for the 1-day curve. `at` is the instant it was REALISED. */
export interface IntradayRow {
  accountId: string;
  at: Date;
  cents: number;
}

/**
 * Every realised round trip inside ONE session, in the order it was realised.
 *
 * THE ONE READ THAT IS NOT BUCKETED, and it is the reason the 1-day range needs its own query at
 * all: every other range is a projection of `session_date`, which is a stored column, so
 * `getDailySeries` can group and be done. A day's SHAPE is what happened inside the bucket, and no
 * amount of grouping by the bucket recovers it.
 *
 * SCOPED BY `session_date`, NOT BY AN INSTANT RANGE. `session_date` is the stored answer to "which
 * session is this in", written once by `lib/time/session.ts`; asking the same question again with
 * `exit_at BETWEEN open AND end` would be a second bucketer, which CLAUDE.md forbids and which
 * would disagree with the tape twice a year. The window's instants are for DRAWING - anchoring the
 * line at the open and tailing it to the close - never for selecting.
 *
 * NO AGGREGATION. Every other read here folds; this one hands back rows, because the curve is the
 * sequence and summing it would be the daily figure it already has.
 */
export async function getIntradaySeries(
  traderId: string,
  sessionDate: string,
  /** One account's session, for `/accounts/details`. See `getDailySeries` on why it is a parameter. */
  accountId?: string
): Promise<IntradayRow[]> {
  const rows = await db
    .select({
      accountId: trade.accountId,
      at: trade.exitAt,
      cents: NET,
    })
    .from(trade)
    .where(
      and(
        eq(trade.traderId, traderId),
        COUNTABLE,
        sql`${trade.sessionDate} = ${sessionDate}`,
        ...(accountId ? [eq(trade.accountId, accountId)] : [])
      )
    )
    .orderBy(asc(trade.exitAt));

  return rows.map((r) => ({ accountId: r.accountId, at: r.at, cents: Number(r.cents) }));
}

/**
 * When Run last HEARD from each account — `max(import.uploaded_at)`, keyed by account.
 *
 * THE FRESHNESS STAMP IS ONE QUERY BECAUSE IT APPEARS ON TWO SCREENS. `architecture.md` §6 is
 * explicit: it is the answer to the field's defining failure (P5, "sync dies quietly"), it renders
 * on `/accounts` and again on `/today`, "so it gets one query used by both — not two that can
 * disagree".
 *
 * `committed`, NOT `complete`. That string cost a silent bug on `/trades`: the CHECK permits
 * `pending | committed | rejected` and `commit.ts` writes those three, so a predicate on
 * `'complete'` matched nothing and the field was permanently null (fixed 2026-08-25). Spelling it
 * wrong here would blank the stamp on every row with nothing to point at.
 *
 * UPLOAD TIME, NOT TRADE TIME. A week-old CSV uploaded this morning updated this morning; the
 * question this answers is "when did Run last receive anything", which is the one a figure cannot
 * answer for itself.
 */
export async function getFreshness(traderId: string): Promise<Map<string, Date>> {
  const rows = await db
    .select({
      accountId: importBatch.accountId,
      at: sql<Date>`max(${importBatch.uploadedAt})`,
    })
    .from(importBatch)
    .where(and(eq(importBatch.traderId, traderId), eq(importBatch.status, 'committed')))
    .groupBy(importBatch.accountId);

  const out = new Map<string, Date>();
  for (const r of rows) if (r.accountId && r.at) out.set(r.accountId, new Date(r.at));
  return out;
}


/**
 * ONE ACCOUNT, or null.
 *
 * NULL COVERS BOTH "NO SUCH ID" AND "NOT YOURS", and the route must answer them identically. A
 * `404` for a stranger's id and a `403` for one that exists would make this endpoint an oracle: try
 * ids, and the status code tells you which accounts are real. `getRoster` keeps `trader_id` in the
 * `where`, so the distinction never reaches this function to be leaked.
 *
 * A uuid COLUMN REJECTS A NON-uuid STRING AT THE DATABASE, not in TypeScript - `/accounts/details/x`
 * would throw from the driver rather than return nothing. Guarded here so a hand-typed URL is a 404
 * like any other miss. Same rule `readTradesFilter` applies to `?accounts=`.
 */
export async function getAccount(traderId: string, id: string): Promise<RosterAccount | null> {
  if (!UUID.test(id)) return null;
  const [row] = await getRoster(traderId, { accountId: id });
  return row ?? null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What one account's figures are made of — `spec.md` P8's four facts, plus the one the label needs. */
export interface Provenance {
  /** The first and last session Run HOLDS for this account. Null when it holds nothing yet. */
  firstDay: string | null;
  lastDay: string | null;
  /** The most recent committed import that landed here, and what it was. */
  lastImportAt: Date | null;
  filename: string | null;
  source: string | null;
  /** How many committed imports this account is built from. */
  imports: number;
  /* WHETHER A FEE LINE COVERS THIS ACCOUNT AT ALL, which decides whether its headline may be called
     NET. `/trades` makes the same call for its window (`getDigest`'s `hasFees`) and `accounts-rail.tsx`
     explicitly defers the per-account answer to this page: a roster rollup spans accounts whose fee
     coverage can differ, so only here is there one account to answer for. */
  hasFees: boolean;
}

/**
 * THE PROVENANCE CARD'S FACTS. `spec.md` P8: "the product states what its own output depends on,
 * every time" - for Run that is which file, which account, which range, last read when.
 *
 * RANGE COVERED IS `session_date` ON THE TRADES, NOT `range_start`/`range_end` ON THE IMPORTS, and
 * the two are different claims. The import columns say what a FILE covered; these say what Run
 * HOLDS. A file whose rows were all duplicates of an earlier upload widens the first and not the
 * second, and P8 is about the output's dependencies, so it is the second that is true. `s6-plan.md`
 * §4 called this "cheap - a min/max on sessionDate, no new query"; it is one query, and it rides
 * along with the count that the fee label needs anyway.
 *
 * COUNTABLE ROWS ONLY, so the range matches the figures printed above it. A quarantined trade stays
 * visible on the tape and out of every total (see `COUNTABLE`), and a range that included its day
 * would describe a window the headline does not cover.
 */
export async function getProvenance(traderId: string, accountId: string): Promise<Provenance> {
  const [[span], [last]] = await Promise.all([
    db
      .select({
        firstDay: sql<string | null>`min(${trade.sessionDate}) filter (where ${COUNTABLE})`,
        lastDay: sql<string | null>`max(${trade.sessionDate}) filter (where ${COUNTABLE})`,
        /* `<> 0` RATHER THAN `> 0`. Fees are stored NEGATIVE (they sum straight into `NET`), so a
           `> 0` test would report "no fees imported" on every account that has them - and the label
           it drives would say GROSS over a figure that was net. */
        feeRows: sql<number>`count(*) filter (where ${COUNTABLE} and ${trade.feeCents} <> 0)`.mapWith(
          Number
        ),
      })
      .from(trade)
      .where(and(eq(trade.traderId, traderId), eq(trade.accountId, accountId))),
    db
      .select({
        at: importBatch.uploadedAt,
        filename: importBatch.filename,
        source: importBatch.source,
        /* THE COUNT RIDES ON THE SAME ROW rather than taking a third query: a window function over
           a set this small (one account's imports) costs nothing next to a round trip. */
        imports: sql<number>`count(*) over ()`.mapWith(Number),
      })
      .from(importBatch)
      .where(
        and(
          eq(importBatch.traderId, traderId),
          eq(importBatch.accountId, accountId),
          /* `committed`, and see `getFreshness` for what the other spelling cost. A pending or
             rejected batch wrote nothing, so naming it as the source of these figures would be
             false. */
          eq(importBatch.status, 'committed')
        )
      )
      .orderBy(sql`${importBatch.uploadedAt} desc`)
      .limit(1),
  ]);

  return {
    firstDay: span?.firstDay ?? null,
    lastDay: span?.lastDay ?? null,
    lastImportAt: last?.at ? new Date(last.at) : null,
    filename: last?.filename ?? null,
    source: last?.source ?? null,
    imports: last?.imports ?? 0,
    hasFees: (span?.feeRows ?? 0) > 0,
  };
}


/**
 * HOW MANY OTHER ACCOUNTS SHARE THIS ONE'S LOGIN PREFIX.
 *
 * Each prop firm issues its own Tradovate username, and every account under that login carries the
 * same account-name prefix — which is the whole basis of the label form's "apply to your other
 * TDFY accounts" offer. This is the number that decides whether that switch appears at all.
 *
 * ONE INTEGER RATHER THAN THE ROSTER. `run-trading@v2` ships every account to the client so its
 * modal provider can count them in memory; that is correct and it moves a lot of rows to answer a
 * question with one number in it. `/accounts/details` is a page about ONE account and has no other
 * reason to hold the roster.
 *
 * THE PREFIX IS LETTERS ONLY AND CAPPED, for the reason the write path states: this value reaches a
 * `LIKE` pattern, and `_` or `%` inside it would silently widen the match. A caller that hands over
 * something else gets 0 rather than a surprise.
 */
export async function countPrefixSiblings(
  traderId: string,
  prefix: string,
  excludeAccountId: string
): Promise<number> {
  if (!/^[A-Z]{2,16}$/.test(prefix)) return 0;
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(account)
    .where(
      and(
        eq(account.traderId, traderId),
        sql`${account.externalAccountId} like ${`${prefix}%`}`,
        sql`${account.id} <> ${excludeAccountId}`
      )
    );
  return row?.n ?? 0;
}
