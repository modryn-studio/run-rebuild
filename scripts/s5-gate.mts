// S5 GATE — the `trade` projection, and the one bug it exists to make impossible.
//
// Run: npx tsx --env-file=.env.local --conditions=react-server scripts/s5-gate.mts
//
// SECTION 3 IS THE ONE THAT MATTERS. Entry and exit are a SEQUENCE, not a side, and the previous
// build shipped the other version: every winning short rendered as a loser that made money, because
// buy→entry is correct for a long and exactly backwards for a short. That is a bug you cannot see
// by reading the projector — the code looks right either way — so it is asserted here against real
// shorts out of the real export.
//
// Everything runs against the SAME ten-day export S1 reconciles to the broker at $0.00, through the
// real parsers into the real database. A projection that has only ever seen fixtures has not been
// tested: the interesting failures are all in the shape of real data.
import { readFileSync } from 'node:fs';
import { and, eq, sql } from 'drizzle-orm';
import { loadEnv } from './load-env.mts';

loadEnv();

const { db, trader, account, event, authUser, trade, tradingSession, contractSpec } = await import(
  '../src/lib/db/index.ts'
);
const { parseTradovateFillsCsv } = await import('../src/lib/csv/fills.ts');
const { parseTradovatePositionHistoryCsv } = await import('../src/lib/csv/position-history.ts');
const { parseCashHistory } = await import('../src/lib/csv/cash-history.ts');
const { fillEventValues, roundTripEventValues, feeEventValues } = await import(
  '../src/lib/intake/write.ts'
);
const { resolveRoundTripInstant } = await import('../src/lib/intake/round-trip-instant.ts');
const { commitImport, markImportCommitted } = await import('../src/lib/intake/commit.ts');
const { preflight } = await import('../src/lib/intake/preflight.ts');
const { projectAccount } = await import('../src/lib/trades/project.ts');
const { sessionDateFor } = await import('../src/lib/time/session.ts');

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const ok = String(actual) === String(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        expected ${expected}, got ${actual}`);
};
const ok = (label: string, condition: boolean, detail = '') => {
  if (!condition) failures++;
  console.log(`  ${condition ? 'PASS' : 'FAIL'}  ${label}`);
  if (!condition && detail) console.log(`        ${detail}`);
};

const FIXTURE = 's5-gate-fixture';

/* The same privileged teardown S4 uses, and for the same reason: `event` refuses ordinary DELETE,
   so a gate that fails midway would leave rows that block the next run's setup. `trade` and
   `session` are ordinary projections and delete normally — they cascade off the trader anyway,
   which is itself a small proof that they are disposable. */
async function teardown() {
  await db.execute(sql`
    DO $$
    DECLARE tid uuid;
    BEGIN
      SELECT id INTO tid FROM trader WHERE auth_user_id = 's5-gate-fixture';
      IF tid IS NULL THEN RETURN; END IF;
      PERFORM set_config('run.privileged', 'on', true);
      DELETE FROM "trade"   WHERE trader_id = tid;
      DELETE FROM "session" WHERE trader_id = tid;
      DELETE FROM "event"   WHERE trader_id = tid;
      DELETE FROM "import"  WHERE trader_id = tid;
      DELETE FROM "account" WHERE trader_id = tid;
      DELETE FROM "trader"  WHERE id = tid;
      DELETE FROM "auth_user" WHERE id = 's5-gate-fixture';
    END $$;
  `);
}

await teardown();

const D = (process.env.RUN_FIXTURES ?? 'C:/Users/Luke/Downloads/').replace(/\/?$/, '/');
const readCsv = (f: string) => {
  try {
    return readFileSync(D + f).toString();
  } catch {
    throw new Error(
      `Fixture not found: ${D}${f}\nThis gate runs against the REAL ten-day export. ` +
        `Point RUN_FIXTURES at a directory holding it.`
    );
  }
};

console.log('\n=== 1. SETUP — the real export, through the real write path ===\n');

const fills = parseTradovateFillsCsv(readCsv('Fills.csv'));
const roundTrips = parseTradovatePositionHistoryCsv(readCsv('Position History (9).csv'));
const cash = parseCashHistory(readCsv('Cash History.csv'));

await db.insert(authUser).values({ id: FIXTURE, email: 's5@fixture.invalid', emailVerified: false });
const [t] = await db.insert(trader).values({ authUserId: FIXTURE, displayTimezone: 'UTC' }).returning();
const [acct] = await db
  .insert(account)
  .values({
    traderId: t.id,
    platform: 'tradovate',
    externalAccountId: `S5GATE-${Date.now()}`,
    displayName: 'S5 gate fixture',
  })
  .returning();

const checks = preflight({ fills, roundTrips, fees: cash.fees, tradePaired: cash.tradePaired });
check('the real export passes preflight', checks.ok, true);

// Fills first: a round trip's true instant is resolved FROM them, and so is its entry.
const instantByFillId = new Map<string, Date>();
const fillByBucket = new Map<string, (typeof fills)[number]>();
for (const f of fills) {
  if (f.externalFillId) instantByFillId.set(f.externalFillId, f.filledAt);
  if (f.feeBucketKey && !fillByBucket.has(f.feeBucketKey)) fillByBucket.set(f.feeBucketKey, f);
}

const common = { traderId: t.id, accountId: acct.id, importId: '', source: 'csv' as const };
const events = [
  ...fillEventValues(common, fills),
  ...roundTripEventValues(
    common,
    roundTrips.map((rt) => {
      const { at, timeSource } = resolveRoundTripInstant(rt, instantByFillId);
      return { rt, occurredAt: at, timeSource };
    })
  ),
  ...feeEventValues(
    common,
    cash.fees
      .map((fee) => ({ fee, fill: fee.bucketKey ? fillByBucket.get(fee.bucketKey) : undefined }))
      .filter((x): x is { fee: (typeof cash.fees)[number]; fill: (typeof fills)[number] } => !!x.fill)
      .map(({ fee, fill }) => ({ fee, occurredAt: fill.filledAt }))
  ),
];

const committed = await commitImport({
  traderId: t.id,
  accountId: acct.id,
  filename: 's5-gate',
  fileText: `s5-gate-${Date.now()}`,
  source: 'tradovate_csv',
  rowsParsed: events.length,
  events,
  preflight: checks,
});
await markImportCommitted(committed.importId);
check('the corpus is in place', committed.rowsWritten > 0, true);

console.log('\n=== 2. THE PROJECTION RECONCILES TO ITS OWN SOURCE ===\n');

const first = await projectAccount(t.id, acct.id);
check('every round trip became a trade', first.trades, roundTrips.length);

const [totals] = await db
  .select({
    rows: sql<number>`count(*)`.mapWith(Number),
    gross: sql<number>`sum(${trade.grossPnlCents})`.mapWith(Number),
    fees: sql<number>`sum(${trade.feeCents})`.mapWith(Number),
  })
  .from(trade)
  .where(eq(trade.traderId, t.id));

const sourceGross = roundTrips.reduce((n, rt) => n + rt.pnlCentsGross, 0);
check('gross survives the projection to the cent', totals.gross, sourceGross);

/* THE FEES ARE THE HALF THAT MATTERS. On this export they exceed the gross loss, so a projection
   that dropped them would report roughly half the real loss — in the flattering direction. */
ok('fees were allocated, not silently zero', totals.fees < 0, `fee total was ${totals.fees}`);
const cashFeeTotal = cash.fees.reduce((n, f) => n + f.deltaCents, 0);
ok(
  'allocated fees do not exceed what Cash History actually charged',
  Math.abs(totals.fees) <= Math.abs(cashFeeTotal),
  `allocated ${totals.fees} against ${cashFeeTotal} charged`
);

console.log('\n=== 3. ENTRY AND EXIT ARE A SEQUENCE, NOT A SIDE ===\n');
console.log('  (the bug that shipped: every winning short read as a loser that made money)\n');

const rows = await db
  .select({
    direction: trade.direction,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    entryAt: trade.entryAt,
    exitAt: trade.exitAt,
    gross: trade.grossPnlCents,
    sessionDate: trade.sessionDate,
    state: trade.state,
  })
  .from(trade)
  .where(eq(trade.traderId, t.id));

const longs = rows.filter((r) => r.direction === 'long');
const shorts = rows.filter((r) => r.direction === 'short');
ok('the export contains real longs', longs.length > 0, `${longs.length} longs`);
ok('the export contains real shorts', shorts.length > 0, `${shorts.length} shorts`);
check('no trade has an unknown direction', rows.filter((r) => r.direction === null).length, 0);

/* THE HEADLINE ASSERTION. A short opens high and closes low to make money; a long does the
   opposite. If entry and exit were mapped from the SIDE instead of the sequence, every one of
   these flips and this is the line that goes red. */
const badShorts = shorts.filter(
  (r) => r.gross > 0 && Number(r.entryPrice) <= Number(r.exitPrice)
);
check('a WINNING SHORT entered above its exit', badShorts.length, 0);

const badLongs = longs.filter((r) => r.gross > 0 && Number(r.entryPrice) >= Number(r.exitPrice));
check('a WINNING LONG entered below its exit', badLongs.length, 0);

const losingShorts = shorts.filter((r) => r.gross < 0 && Number(r.entryPrice) >= Number(r.exitPrice));
check('a LOSING SHORT entered at or below its exit', losingShorts.length, 0);

/* Ordering by side rather than by sequence reports a negative hold time on every short, which is
   the same bug seen from the other end. */
const negativeHold = rows.filter((r) => r.exitAt.getTime() < r.entryAt.getTime());
check('no trade exits before it enters', negativeHold.length, 0);

console.log('\n=== 4. SESSION DATE DERIVES FROM THE EXIT, THROUGH THE ONE BUCKETER ===\n');

const misfiled = rows.filter((r) => r.sessionDate !== sessionDateFor(r.exitAt));
check('every session_date matches the bucketer applied to exit_at', misfiled.length, 0);

/* A trade belongs to the session it was REALISED in (CLAUDE.md). Deriving from the ENTRY would
   file every overnight trade a day early, so this proves the two are not accidentally identical
   on this corpus — if they are, the assertion above is not testing anything. */
const straddling = rows.filter((r) => sessionDateFor(r.entryAt) !== sessionDateFor(r.exitAt));
console.log(`  (${straddling.length} trades straddle a session boundary on this export)`);

console.log('\n=== 5. THE SESSION ROLLUP AGREES WITH THE TRADES IT SUMS ===\n');

const [sessTotals] = await db
  .select({
    days: sql<number>`count(*)`.mapWith(Number),
    net: sql<number>`sum(${tradingSession.netPnlCents})`.mapWith(Number),
    fees: sql<number>`sum(${tradingSession.feesCents})`.mapWith(Number),
    trades: sql<number>`sum(${tradingSession.tradeCount})`.mapWith(Number),
    wins: sql<number>`sum(${tradingSession.winCount})`.mapWith(Number),
  })
  .from(tradingSession)
  .where(eq(tradingSession.traderId, t.id));

check('every session became a row', sessTotals.days, first.sessions);
check('session net equals the sum of its trades', sessTotals.net, totals.gross + totals.fees);
check('session fees equal the trades fees', sessTotals.fees, totals.fees);
check('session trade counts add up', sessTotals.trades, totals.rows);
ok('some sessions were winners and some were not', sessTotals.wins < sessTotals.trades, '');

console.log('\n=== 6. RE-PROJECTION IS AN UPSERT, NOT A SECOND COPY ===\n');

const second = await projectAccount(t.id, acct.id);
const [afterTwice] = await db
  .select({
    rows: sql<number>`count(*)`.mapWith(Number),
    gross: sql<number>`sum(${trade.grossPnlCents})`.mapWith(Number),
    fees: sql<number>`sum(${trade.feeCents})`.mapWith(Number),
  })
  .from(trade)
  .where(eq(trade.traderId, t.id));

check('projecting twice does not duplicate a row', afterTwice.rows, totals.rows);
check('...and the gross is unchanged', afterTwice.gross, totals.gross);
check('...and the fees are unchanged', afterTwice.fees, totals.fees);
check('...and the session count is unchanged', second.sessions, first.sessions);

console.log('\n=== 7. AN UNKNOWN ROOT QUARANTINES, AND STAYS COUNTABLE ===\n');

/* Provoked by removing a root from `contract_spec` rather than by inventing a trade, so the
   quarantine fires on real rows through the real path. The spec table is seeded data, not a
   migration, so putting it back is a plain insert.

   THE EXPORT CARRIES TWO ROOTS (MNQ and NQ), which is the whole reason the kill signal fired in
   phase 1 — so this pulls ONE of them and asserts that exactly that root's trades quarantine.
   An earlier version of this section assumed a single root and read the partial result as a bug. */
const roots = await db
  .select({ root: trade.symbolRoot, n: sql<number>`count(*)`.mapWith(Number) })
  .from(trade)
  .where(eq(trade.traderId, t.id))
  .groupBy(trade.symbolRoot);
ok('the export spans more than one product', roots.length > 1, roots.map((r) => `${r.root}=${r.n}`).join(' '));

const target = roots[0];
const [spec] = await db.select().from(contractSpec).where(eq(contractSpec.symbolRoot, target.root));
ok('the traded root was in the contract spec to begin with', !!spec, `root ${target.root}`);

await db.delete(contractSpec).where(eq(contractSpec.symbolRoot, target.root));
const quarantined = await projectAccount(t.id, acct.id);
await db.insert(contractSpec).values(spec).onConflictDoNothing();

check('exactly that root quarantines, and only it', quarantined.quarantined, target.n);
check('...and the rows are still there, not dropped', quarantined.trades, totals.rows);

const [afterQ] = await db
  .select({ trades: sql<number>`coalesce(sum(${tradingSession.tradeCount}), 0)`.mapWith(Number) })
  .from(tradingSession)
  .where(eq(tradingSession.traderId, t.id));
check('...and no quarantined trade reaches a computed figure', afterQ.trades, totals.rows - target.n);

// Put the corpus back the way it was, so the exclusion test below runs on `ok` rows.
await projectAccount(t.id, acct.id);
const [restored] = await db
  .select({ trades: sql<number>`sum(${tradingSession.tradeCount})`.mapWith(Number) })
  .from(tradingSession)
  .where(eq(tradingSession.traderId, t.id));
check('re-seeding the spec un-quarantines them', restored.trades, totals.rows);

console.log('\n=== 8. AN EXCLUSION IS THE TRADER’S, AND A REBUILD MAY NOT ERASE IT ===\n');

/* S9b writes `excluded` plus a reason, and that reason exists NOWHERE ELSE — it is not in the
   event log, because it is not broker truth. A projection that overwrote it would lose the one
   piece of this table the trader authored. */
const [victim] = await db.select({ id: trade.id }).from(trade).where(eq(trade.traderId, t.id)).limit(1);
await db
  .update(trade)
  .set({ state: 'excluded', exclusionReason: 'Fees missing from the export.' })
  .where(eq(trade.id, victim.id));

await projectAccount(t.id, acct.id);
const [after] = await db.select().from(trade).where(eq(trade.id, victim.id));
check('an excluded trade survives a rebuild', after.state, 'excluded');
check('...and keeps the reason the trader gave', after.exclusionReason, 'Fees missing from the export.');

const [excludedRollup] = await db
  .select({ trades: sql<number>`sum(${tradingSession.tradeCount})`.mapWith(Number) })
  .from(tradingSession)
  .where(eq(tradingSession.traderId, t.id));
check('...and it leaves the computed figures', excludedRollup.trades, totals.rows - 1);

const [stillThere] = await db
  .select({ n: sql<number>`count(*)`.mapWith(Number) })
  .from(trade)
  .where(and(eq(trade.traderId, t.id), eq(trade.state, 'excluded')));
check('...while staying visible and countable on the tape', stillThere.n, 1);

// ── teardown ────────────────────────────────────────────────────────────────────────
await teardown();
const leftover = await db.select().from(trade).where(eq(trade.traderId, t.id));
check('fixture cleaned up', leftover.length, 0);

console.log(`\n${failures === 0 ? 'S5 GATE PASSED' : `S5 GATE FAILED — ${failures} assertion(s)`}`);
process.exit(failures === 0 ? 0 : 1);
