import 'server-only';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, event, trade, tradingSession, contractSpec } from '@/lib/db';
import { allocateFees, type NetPnlRow } from '@/lib/fees/allocate';
import { sessionDateFor } from '@/lib/time/session';
import { PRICE_SCALE } from '@/lib/csv/shared';

/* THE PROJECTOR: `event` in, `trade` and `session` out.
 *
 * This is the one place allowed to read `event.payload`, and the reason the render path never has
 * to. A tape row needs an entry price, an exit price, a direction and a fee; `event` promotes none
 * of those, so without this file every one of them would be a jsonb extraction inside a query that
 * draws a screen. `run-trading@v2` did exactly that and measured the bill in its own comments: a
 * 9,530ms page load and a 1.1MB payload, which then needed an index-and-paging subsystem to work
 * around. Reading payload HERE is not the violation; reading it on a render path is.
 *
 * IDEMPOTENT BY CONSTRUCTION. Every write is an upsert keyed on the round trip's own event id, so
 * running this twice over the same account produces the same rows rather than twice as many. That
 * is what makes it safe to call after every import and by hand from a script.
 *
 * NOTHING HERE IS PRECIOUS. `trade` and `session` are projections: drop both, run this, and the
 * corpus is unchanged. That is the property that licenses storing derived values a `round_trip`
 * event could never carry — see the `fee_cents` note in `architecture.md`.
 */

/** What one pass did. Returned rather than logged so a gate can assert on it. */
export interface ProjectionResult {
  trades: number;
  quarantined: number;
  sessions: number;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

/** Postgres caps a statement at 65,535 bind parameters; `trade` binds ~18 columns, so the real
 *  ceiling is near 3,600. 1,000 is the house number (CLAUDE.md) and leaves the margin. */
const CHUNK = 1000;

/** Micros to a `numeric(19,6)` literal. A QUOTE, NOT MONEY: 6E trades at 1.08500 and storing that
 *  as cents rounds it to 109, which prints a real 1.08500 → 1.08600 winner as an unmoved trade. */
const priceFrom = (micros: number): string => (micros / PRICE_SCALE).toFixed(6);

/* A fill id as a number, for ordering only. `BigInt` because these are 12 digits today and nothing
 *  promises they stay inside a float's exact range; `null` when the id is not numeric, which is how
 *  a non-Tradovate source degrades to "cannot order" instead of throwing. */
const idOf = (id: string | null): bigint | null => {
  if (!id || !/^\d+$/.test(id)) return null;
  try {
    return BigInt(id);
  } catch {
    return null;
  }
};

/**
 * Which leg opened: negative if the buy did, positive if the sell did, 0 if it cannot be told.
 *
 * The clock first, then the broker's own fill id as the tiebreak. Returning 0 rather than guessing
 * is the whole contract — the caller quarantines on it, because a default here is the entry/exit
 * swap wearing a different hat.
 */
function compareLegs(buyAt: Date, buyId: string | null, sellAt: Date, sellId: string | null): number {
  const byTime = buyAt.getTime() - sellAt.getTime();
  if (byTime !== 0) return byTime;
  const b = idOf(buyId);
  const s = idOf(sellId);
  if (b === null || s === null || b === s) return 0;
  return b > s ? 1 : -1;
}

/**
 * Rebuild `trade` and `session` for one account.
 *
 * THE WHOLE ACCOUNT, NEVER A WINDOW, and that is a correctness requirement rather than laziness.
 * Fee rates are derived from the fills and fees in the row set handed to `allocateFees`, so a
 * windowed pass would charge a round trip whose ENTRY fill sits outside the window only half its
 * fees — `architecture.md`'s `[#90.2]`, and a live case now that accounts holding overnight are in
 * scope. Cutting the window to save work would silently understate cost, which is the one direction
 * this product may not be wrong in.
 *
 * It is affordable because this is an ingest-time job, not a render path: it runs once per import
 * and once per manual rebuild, never while somebody waits on a page. Scale is issue #4's problem
 * and it is the write path's, not this one's.
 */
export async function projectAccount(traderId: string, accountId: string): Promise<ProjectionResult> {
  /* One read, three uses: the allocator needs fills and fees, the entry instant needs the fills'
     own UTC, and the round trips are what becomes a row. Reading them separately would be three
     passes over the same index for the same bytes. */
  const rows = await db
    .select({
      id: event.id,
      type: event.type,
      pnlCents: event.pnlCents,
      payload: event.payload,
      symbol: event.symbol,
      qty: event.qty,
      occurredAt: event.occurredAt,
    })
    .from(event)
    .where(
      and(
        eq(event.traderId, traderId),
        eq(event.accountId, accountId),
        inArray(event.type, ['fill', 'fee', 'round_trip'])
      )
    );

  const alloc = allocateFees(rows as unknown as NetPnlRow[]);

  /* A FILL'S TRUE UTC, BY ITS BROKER ID. Position History carries local wall-clock with no zone, so
     the fills are the only rows in the batch that can date anything. `event.occurred_at` on a fill
     is already that resolved instant. */
  const fillInstant = new Map<string, Date>();
  for (const r of rows) {
    if (r.type !== 'fill') continue;
    const id = str((r.payload as Record<string, unknown>).externalFillId);
    if (id) fillInstant.set(id, r.occurredAt);
  }

  // An unknown root quarantines. It no longer carries the multiplier, but it carries the currency
  // and the calendar, and guessing either is the same failure in a different field.
  const known = new Set((await db.select({ root: contractSpec.symbolRoot }).from(contractSpec)).map((r) => r.root));

  const values: (typeof trade.$inferInsert)[] = [];

  for (const r of rows) {
    if (r.type !== 'round_trip') continue;
    const p = r.payload as Record<string, unknown>;

    const symbolRoot = r.symbol ?? str(p.symbol) ?? '';
    const buyFillId = str(p.buyFillId);
    const sellFillId = str(p.sellFillId);
    const buyAt = buyFillId ? fillInstant.get(buyFillId) : undefined;
    const sellAt = sellFillId ? fillInstant.get(sellFillId) : undefined;

    const buyMicros = num(p.buyPriceMicros);
    const sellMicros = num(p.sellPriceMicros);

    /* ── WHICH SIDE OPENED. Everything below depends on this one question ──────────────────────
       Direction is "did you buy first or sell first", never price arithmetic: deriving it from
       price ordering plus the P&L sign silently guesses on a scratch trade, where the P&L is zero
       and the two prices are equal.

       Both instants come from FILLS, which carry real UTC, rather than from Position History's own
       zoneless strings. `run-trading@v2` compared the local strings, which is sound for ORDERING
       two stamps from one source, but it cannot produce the instant `entry_at` has to store. */
    const resolvable = buyAt instanceof Date && sellAt instanceof Date && buyMicros !== null && sellMicros !== null;
    /* TWO FILLS CAN SHARE A MILLISECOND, and one in the real ten-day export does: an NQ pair pinned
       at 17:42:35.090, sold 29243.5 and bought 29241 for +$100 — a profitable short that the
       timestamp alone cannot tell from a losing long.
       THE BROKER ALREADY ORDERED THEM. Tradovate's fill ids are monotonic with time: measured
       across all 612 fills of that export, 43 same-millisecond ties and ZERO id inversions against
       the clock. So the id is not our inference about sequence, it is Tradovate's own record of it,
       which is exactly the kind of answer this product is supposed to prefer. It agrees with the
       arithmetic here independently — the lower id is the sell, and the P&L says short. */
    const order = resolvable ? compareLegs(buyAt!, buyFillId, sellAt!, sellFillId) : 0;
    const ordered = order !== 0;
    const short = order > 0; // the buy came later, so the sell opened

    let quarantineReason: string | null = null;
    if (!symbolRoot) quarantineReason = 'No product on this trade.';
    else if (!known.has(symbolRoot)) quarantineReason = `${symbolRoot} is not in the contract spec.`;
    else if (!resolvable) quarantineReason = 'Its fills are not in this account, so it cannot be dated.';
    else if (!ordered) quarantineReason = 'Its two fills cannot be put in order, so which side opened is unknown.';

    /* A QUARANTINED ROW IS STILL A ROW. It stays visible and countable (spec S3) and is excluded
       from every computed figure by `state`, never by being absent. When the instants are missing
       the columns still have to hold something: the event's own `occurred_at` is the exit by
       definition, and the prices fall back to the raw sides — neither is trusted, because `state`
       is what decides whether anything reads them. */
    const entryAt = ordered ? (short ? sellAt! : buyAt!) : r.occurredAt;
    const exitAt = ordered ? (short ? buyAt! : sellAt!) : r.occurredAt;

    /* ENTRY AND EXIT FOLLOW THE SEQUENCE, NOT THE SIDE. A short OPENS on the sell and CLOSES on the
       buy. Mapping buy→entry is right for a long and exactly backwards for a short, which is how
       every winning short once rendered as a loser that made money (Luke, 2026-08-01). */
    const entryMicros = short ? sellMicros : buyMicros;
    const exitMicros = short ? buyMicros : sellMicros;

    const net = alloc.byRoundTrip.get(r.id);

    values.push({
      traderId,
      accountId,
      eventId: r.id,
      symbolRoot: symbolRoot || 'UNKNOWN',
      contract: str(p.contract),
      entryAt,
      exitAt,
      // A trade belongs to the session it was REALISED in, so this derives from the exit and from
      // the one module that owns time buckets. Never from `entry_at`.
      sessionDate: sessionDateFor(exitAt),
      qty: r.qty ?? num(p.qty) ?? 0,
      direction: ordered ? (short ? 'short' : 'long') : null,
      entryPrice: priceFrom(entryMicros ?? 0),
      exitPrice: priceFrom(exitMicros ?? 0),
      grossPnlCents: r.pnlCents ?? 0,
      // Negative, and 0 when no Cash History covers this account at all.
      feeCents: net?.feeCents ?? 0,
      state: quarantineReason ? 'quarantined' : 'ok',
      quarantineReason,
      projectedAt: new Date(),
    });
  }

  /* UPSERT ON THE EVENT ID, which is what makes re-projection safe. A second import that brings
     Cash History for an earlier window re-runs this and the fees land on the rows that already
     exist, rather than beside them.

     `exclusion_reason` and its `excluded` state are deliberately NOT overwritten below: those are
     the trader's own words from S9b, they live only here, and a re-projection must not erase them.
     The state is only forced back when this pass has its own reason to quarantine. */
  for (let i = 0; i < values.length; i += CHUNK) {
    const slice = values.slice(i, i + CHUNK);
    await db
      .insert(trade)
      .values(slice)
      .onConflictDoUpdate({
        target: trade.eventId,
        set: {
          symbolRoot: sql`excluded.symbol_root`,
          contract: sql`excluded.contract`,
          entryAt: sql`excluded.entry_at`,
          exitAt: sql`excluded.exit_at`,
          sessionDate: sql`excluded.session_date`,
          qty: sql`excluded.qty`,
          direction: sql`excluded.direction`,
          entryPrice: sql`excluded.entry_price`,
          exitPrice: sql`excluded.exit_price`,
          grossPnlCents: sql`excluded.gross_pnl_cents`,
          feeCents: sql`excluded.fee_cents`,
          // An excluded trade STAYS excluded across a rebuild. Only a fresh quarantine reason from
          // this pass may move it, and a clean row never silently un-excludes itself.
          state: sql`case
            when excluded.quarantine_reason is not null then excluded.state
            when ${trade.state} = 'excluded' then 'excluded'
            else excluded.state end`,
          quarantineReason: sql`excluded.quarantine_reason`,
          projectedAt: sql`excluded.projected_at`,
        },
      });
  }

  const sessions = await rebuildSessions(traderId);

  return {
    trades: values.length,
    quarantined: values.filter((v) => v.state === 'quarantined').length,
    sessions,
  };
}

/**
 * Recompute the trader's session rollups from `trade`.
 *
 * KEYED ON THE TRADER, NOT THE ACCOUNT (`architecture.md`), which is why this is a separate pass
 * and why it spans every account rather than the one just projected. A trader working two accounts
 * in one session has one day, and summing only the account that happened to import last would
 * report half of it.
 *
 * `ok` ONLY. A quarantined or excluded trade stays visible on the tape and countable in its own
 * right, and never reaches a computed figure — `state` is the whole mechanism.
 *
 * A WIN IS NET, NOT GROSS. Fees are what decide whether a scratch was really a scratch, and a
 * win-rate computed before costs is the flattering number this product exists to refuse.
 */
export async function rebuildSessions(traderId: string): Promise<number> {
  /* ENTIRELY IN SQL, and not only for speed. Selecting the rollup out and inserting it back would
     marshal every `min()`/`max()` through the driver, which hands back a STRING for a timestamptz
     and then fails on the way in — the aggregate never has to leave the database, so it doesn't.
     What crosses the wire here is one statement and a row count.

     WIPE THEN REBUILD, as one batch. An upsert alone cannot be right: a day whose every trade was
     just excluded still HAS a session row, and leaving it behind would keep reporting figures for
     trades that no longer count. The delete is what makes this a projection rather than an
     accumulator. `db.batch` because neon-http has no interactive transactions — the pair has to
     travel as one unit or a failure between them leaves the trader with no sessions at all. */
  await db.batch([
    db.delete(tradingSession).where(eq(tradingSession.traderId, traderId)),
    db.execute(sql`
      insert into "session" (
        trader_id, session_date, net_pnl_cents, fees_cents,
        trade_count, win_count, first_trade_at, last_trade_at, projected_at
      )
      select
        ${traderId}::uuid,
        ${trade.sessionDate},
        sum(${trade.grossPnlCents} + ${trade.feeCents}),
        sum(${trade.feeCents}),
        count(*),
        -- A WIN IS NET, NOT GROSS. Fees decide whether a scratch was really a scratch, and a win
        -- rate computed before costs is the flattering number this product exists to refuse.
        count(*) filter (where ${trade.grossPnlCents} + ${trade.feeCents} > 0),
        min(${trade.entryAt}),
        max(${trade.exitAt}),
        now()
      from ${trade}
      where ${trade.traderId} = ${traderId}::uuid and ${trade.state} = 'ok'
      group by ${trade.sessionDate}
    `),
  ]);

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(tradingSession)
    .where(eq(tradingSession.traderId, traderId));

  return n;
}
