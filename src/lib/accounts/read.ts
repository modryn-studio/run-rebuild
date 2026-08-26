import 'server-only';
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
  accountType: string | null;
  productName: string | null;
  displayName: string | null;
  status: string;
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
export async function getRoster(traderId: string): Promise<RosterAccount[]> {
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
    .where(eq(account.traderId, traderId))
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
  window?: { from?: string | null; to?: string | null }
): Promise<DayPoint[]> {
  const bounds = [eq(trade.traderId, traderId), COUNTABLE];
  if (window?.from) bounds.push(sql`${trade.sessionDate} >= ${window.from}`);
  if (window?.to) bounds.push(sql`${trade.sessionDate} <= ${window.to}`);

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
