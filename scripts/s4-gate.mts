// S4 GATE — the ingest tables, and the guarantees that make them worth having.
//
// Run: npx tsx --env-file=.env.local --conditions=react-server scripts/s4-gate.mts
//
// Section 2 is the one that matters. `event` being append-only is doctrine everywhere else in
// this repo, which means it is a convention a future writer can forget. Here it is a trigger,
// and the only way to know a trigger works is to try the thing it forbids.
import { readFileSync } from 'node:fs';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { loadEnv } from './load-env.mts';

loadEnv();

const { db, trader, account, importBatch, event, authUser } = await import('../src/lib/db/index.ts');
const { parseTradovateFillsCsv } = await import('../src/lib/csv/fills.ts');
const { parseTradovatePositionHistoryCsv } = await import('../src/lib/csv/position-history.ts');
const { fillEventValues, roundTripEventValues, resolveRoundTripInstant } = await import(
  '../src/lib/intake/write.ts'
);
const { commitImport, markImportCommitted } = await import('../src/lib/intake/commit.ts');
const { preflight } = await import('../src/lib/intake/preflight.ts');
const { groupByAccount, resolveAccount } = await import('../src/lib/intake/accounts.ts');
const { parseCashHistory } = await import('../src/lib/csv/cash-history.ts');

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const ok = String(actual) === String(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        expected ${expected}, got ${actual}`);
};
const rejects = async (label: string, fn: () => Promise<unknown>) => {
  let threw = false;
  let message = '';
  try {
    await fn();
  } catch (e) {
    threw = true;
    /* THE ROOT CAUSE, not the wrapper. Drizzle re-throws as `DrizzleQueryError` whose `.message`
       is the SQL it tried to run; the database's own reason sits on `.cause`. Asserting against
       the wrapper would pass for any failure at all, which is the opposite of what a gate is for. */
    let cur: unknown = e;
    const seen: string[] = [];
    while (cur instanceof Error) {
      seen.push(cur.message);
      cur = (cur as { cause?: unknown }).cause;
    }
    message = seen.join(' | ');
  }
  if (!threw) failures++;
  console.log(`  ${threw ? 'PASS' : 'FAIL'}  ${label}`);
  return message;
};

/* A throwaway trader + account. Everything here writes REAL rows to the real database, so the
   cleanup runs at BOTH ends: a gate that fails midway leaves events behind, and because `event`
   refuses ordinary DELETE those events then block the next run's setup. Idempotent teardown is
   not tidiness here, it is the difference between a gate you can run twice and one you cannot. */
const FIXTURE = 's4-gate-fixture';

async function teardown() {
  /* ONE STATEMENT, and that is the finding rather than the cleanup. `set_config(..., true)` is
     TRANSACTION-local, and neon-http has no interactive transactions — every statement is its own
     implicit transaction, so a `set_config` call followed by a `DELETE` call loses the flag in
     between and the trigger correctly refuses. A DO block is one statement, so the PERFORM and the
     DELETE share a transaction. Whatever builds the real erasure path must do the same; the
     two-call version reads correctly and does not work. */
  await db.execute(sql`
    DO $$
    DECLARE tid uuid;
    BEGIN
      SELECT id INTO tid FROM trader WHERE auth_user_id = 's4-gate-fixture';
      IF tid IS NULL THEN RETURN; END IF;
      PERFORM set_config('run.privileged', 'on', true);
      DELETE FROM "event"  WHERE trader_id = tid;
      DELETE FROM "import" WHERE trader_id = tid;
      DELETE FROM "account" WHERE trader_id = tid;
      DELETE FROM trader WHERE id = tid;
    END $$;
  `);
  await db.delete(authUser).where(eq(authUser.id, FIXTURE));
}

await teardown();
await db.insert(authUser).values({ id: FIXTURE, email: 's4@fixture.invalid', emailVerified: false });
const [t] = await db
  .insert(trader)
  .values({ authUserId: FIXTURE, displayTimezone: 'America/Chicago' })
  .returning();
const [acct] = await db
  .insert(account)
  .values({
    traderId: t.id,
    platform: 'tradovate',
    externalAccountId: 'GATEFIXTURE0001',
    displayName: 'Gate fixture',
    accountType: 'evaluation',
  })
  .returning();

console.log('=== 1. THE SHAPE THE ARCHITECTURE ASKED FOR ===\n');

check('account_type is constrained', acct.accountType, 'evaluation');
check('a new account is active', acct.state, 'active');

await rejects('an unknown account_type is refused by the database', () =>
  db.insert(account).values({
    traderId: t.id,
    platform: 'tradovate',
    externalAccountId: 'BADTYPE',
    displayName: 'x',
    accountType: 'gold_plated',
  }),
);
await rejects('the natural key (trader, platform, external id) is unique', () =>
  db.insert(account).values({
    traderId: t.id,
    platform: 'tradovate',
    externalAccountId: 'GATEFIXTURE0001',
    displayName: 'duplicate',
    accountType: 'funded',
  }),
);

const [imp] = await db
  .insert(importBatch)
  .values({
    traderId: t.id,
    accountId: acct.id,
    filename: 'Fills.csv',
    fileHash: 'sha256-gate-fixture',
    source: 'tradovate_csv',
  })
  .returning();
check('an import starts pending, never committed', imp.status, 'pending');

// The file-level guarantee, distinct from the row-level one below: this stops the WORK.
await rejects('the same bytes cannot be imported twice into one account', () =>
  db.insert(importBatch).values({
    traderId: t.id,
    accountId: acct.id,
    filename: 'Fills (1).csv', // a different NAME, the same bytes
    fileHash: 'sha256-gate-fixture',
    source: 'tradovate_csv',
  }),
);

console.log('\n=== 2. `event` IS APPEND-ONLY, AND THE DATABASE ENFORCES IT ===\n');

const [e1] = await db
  .insert(event)
  .values({
    traderId: t.id,
    accountId: acct.id,
    importId: imp.id,
    type: 'fill',
    source: 'csv',
    payload: { note: 'gate fixture' },
    symbol: 'MNQ',
    qty: 1,
    side: 'buy',
    occurredAt: new Date('2026-08-12T14:30:00Z'),
    dedupeKey: 'f:gate-fixture-1',
  })
  .returning();
check('a fill inserts', e1.type, 'fill');
check('a raw fill has no realised P&L', e1.pnlCents, null);

const updMsg = await rejects('UPDATE on event is blocked', () =>
  db.update(event).set({ symbol: 'NQ' }).where(eq(event.id, e1.id)),
);
check('...and the error names the reason', /append-only/.test(updMsg), true);

const delMsg = await rejects('DELETE on event is blocked', () =>
  db.delete(event).where(eq(event.id, e1.id)),
);
check('...and it names the reason too', /append-only/.test(delMsg), true);

// The row still has to be there after two refused mutations, or the trigger let something through.
const [survivor] = await db.select().from(event).where(eq(event.id, e1.id));
check('the row survived both attempts, unchanged', survivor?.symbol, 'MNQ');

console.log('\n=== 3. CORRECTIONS APPEND, THEY DO NOT MUTATE ===\n');

const [e2] = await db
  .insert(event)
  .values({
    traderId: t.id,
    accountId: acct.id,
    importId: imp.id,
    type: 'fill',
    source: 'csv',
    payload: { note: 'busted, corrects the row above' },
    symbol: 'NQ',
    qty: 1,
    side: 'buy',
    correctsEventId: e1.id,
    occurredAt: new Date('2026-08-12T14:31:00Z'),
    dedupeKey: 'f:gate-fixture-1-bust',
  })
  .returning();
check('a correction points at the original', e2.correctsEventId, e1.id);
check('and the original is still readable', survivor?.payload?.note, 'gate fixture');
check('ids are monotonic, so replay order is recoverable', e2.id > e1.id, true);

console.log('\n=== 4. ROW-LEVEL DEDUPE IS THE DATABASE, NOT THE APP ===\n');

// onConflictDoNothing against the partial unique index: a re-uploaded file re-inserts nothing.
const again = await db
  .insert(event)
  .values({
    traderId: t.id,
    accountId: acct.id,
    type: 'fill',
    source: 'csv',
    payload: { note: 'the same fill, seen again' },
    occurredAt: new Date('2026-08-12T14:30:00Z'),
    dedupeKey: 'f:gate-fixture-1',
  })
  .onConflictDoNothing()
  .returning({ id: event.id });
check('re-seeing a fill inserts nothing', again.length, 0);

// The namespace is what stops a round trip colliding with a fill that shares a numeric id.
const nsp = await db
  .insert(event)
  .values({
    traderId: t.id,
    accountId: acct.id,
    type: 'round_trip',
    source: 'csv',
    payload: { note: 'same id, different namespace' },
    pnlCents: 14_800,
    occurredAt: new Date('2026-08-12T14:35:00Z'),
    dedupeKey: 'p:gate-fixture-1', // same suffix as the fill above
  })
  .onConflictDoNothing()
  .returning({ id: event.id });
check('a namespaced key does NOT collide with the same id as a fill', nsp.length, 1);

console.log('\n=== 5. THE CHUNK BOUNDARY IS REAL, AND IT IS WHERE THE ARITHMETIC SAYS ===\n');

/* Postgres caps a statement at 65,535 bind parameters. `event` binds 14 columns per row, so the
   ceiling should sit at 65535/14 = 4,681 rows — and the two assertions below BRACKET it rather
   than testing one side, because "6,000 fails" is also true of a broken connection.

   Measured 2026-08-13: 4,681 rows (65,534 params) inserts; 5,000 (70,000) does not.

   THE ERROR MESSAGE DOES NOT SAY SO. Neon's http driver reports a generic "Database request
   failed" for both, so the cause is knowable only from WHERE the boundary falls, never from what
   the database says. That is why this is a bracket and not a string match.

   The write path chunks at 1,000: comfortably under, and a round number that survives someone
   adding a column to this table without re-deriving the limit. */
const bulk = (n: number, tag: string) =>
  Array.from({ length: n }, (_, i) => ({
    traderId: t.id,
    accountId: acct.id,
    type: 'fill' as const,
    source: 'csv' as const,
    payload: { i },
    occurredAt: new Date('2026-08-12T15:00:00Z'),
    dedupeKey: `f:${tag}-${i}`,
  }));

let underCapOk = true;
try {
  await db.insert(event).values(bulk(4681, 'under')).onConflictDoNothing();
} catch {
  underCapOk = false;
}
check('4,681 rows (65,534 params) inserts in one statement', underCapOk, true);

await rejects('5,000 rows (70,000 params) does not', () =>
  db.insert(event).values(bulk(5000, 'over')).onConflictDoNothing(),
);


console.log('\n=== 6. THE WRITE PATH, AGAINST THE REAL EXPORT ===\n');

/* Nothing synthetic here. These are the same four files S1 reconciles to the broker at $0.00, run
   through the same parsers and into the real database, because a write path that has only ever
   seen fixtures has not been tested — the interesting failures are all in the shape of real data.
   Account resolution is step 4, so the fixture account stands in for it. */
const D = 'C:/Users/Luke/Downloads/';
const readCsv = (f: string) => readFileSync(D + f).toString();

const fillsText = readCsv('Fills.csv');
const fills = parseTradovateFillsCsv(fillsText);
const rtText = readCsv('Position History (9).csv');
const roundTrips = parseTradovatePositionHistoryCsv(rtText);

const common = {
  traderId: t.id,
  accountId: acct.id,
  source: 'csv' as const,
};

// Fills first, because a round trip's true instant is resolved FROM them.
const fillValues = fillEventValues({ ...common, importId: 'placeholder' }, fills);
const first = await commitImport({
  traderId: t.id,
  accountId: acct.id,
  filename: 'Fills.csv',
  fileText: fillsText,
  source: 'tradovate_csv',
  rowsParsed: fills.length,
  events: fillValues,
});
check('every parsed fill was written the first time', first.rowsWritten, fills.length);
check('...and rowsParsed is reported separately', first.rowsParsed, fills.length);
console.log(`        ${fills.length} fills, ${first.rangeStart} to ${first.rangeEnd}`);

// The range is TRADE dates from the one time module, never a formatted instant.
check('the range is a session date, not a timestamp', /^\d{4}-\d{2}-\d{2}$/.test(first.rangeStart ?? ''), true);

// THE COUNT THAT MATTERS. Same rows, a file the trader renamed, so the file hash differs and the
// file-level guard lets it through — leaving the ROW-level guard as the only thing standing
// between a re-upload and a doubled corpus.
const second = await commitImport({
  traderId: t.id,
  accountId: acct.id,
  filename: 'Fills (1).csv',
  fileText: fillsText + '\n', // one byte different, so the file hash does not match
  source: 'tradovate_csv',
  rowsParsed: fills.length,
  events: fillValues,
});
check('re-importing the same trades writes ZERO rows', second.rowsWritten, 0);
check('...while still reporting what it parsed', second.rowsParsed, fills.length);

/* And the corpus did not grow. Scoped to the two imports above rather than counting every fill on
   the account: sections 2-5 wrote their own synthetic fills, and a count that includes them would
   pass or fail for reasons that have nothing to do with the write path. */
const [{ n: fillCount }] = await db
  .select({ n: sql<number>`count(*)::int` })
  .from(event)
  .where(
    and(
      eq(event.type, 'fill'),
      inArray(event.importId, [first.importId, second.importId])
    )
  );
check('the log holds exactly one copy of each fill', fillCount, fills.length);

console.log('\n=== 7. A ROUND TRIP TAKES ITS INSTANT FROM ITS FILLS ===\n');

// Position History carries local wall-clock with no zone. The fills carry UTC. Resolving from the
// fills is what stops an evening trade landing on the wrong trade date.
const fillInstants = new Map<string, Date>();
for (const f of fills) if (f.externalFillId) fillInstants.set(f.externalFillId, f.filledAt);

const resolved = roundTrips.map((rt) => ({ rt, ...resolveRoundTripInstant(rt, fillInstants) }));
const bySource = resolved.reduce<Record<string, number>>((acc, r) => {
  acc[r.timeSource] = (acc[r.timeSource] ?? 0) + 1;
  return acc;
}, {});
console.log(`        time sources: ${JSON.stringify(bySource)}`);
check('every round trip resolved from its fills, not a fallback', bySource.fills_utc, roundTrips.length);

const rtValues = roundTripEventValues(
  { ...common, importId: 'placeholder' },
  resolved.map(({ rt, at, timeSource }) => ({ rt, occurredAt: at, timeSource }))
);
const rtImport = await commitImport({
  traderId: t.id,
  accountId: acct.id,
  filename: 'Position History (9).csv',
  fileText: rtText,
  source: 'tradovate_csv',
  rowsParsed: roundTrips.length,
  events: rtValues,
});
check('every round trip was written', rtImport.rowsWritten, roundTrips.length);

// GROSS, and the payload says so. Net is derived at read time because at THIS moment the fees do
// not exist yet — the log is append-only, so a row written now can never be revised later.
/* From THIS import, not any round trip on the account: section 4 wrote a synthetic one to prove
   the dedupe namespace, and an unscoped `limit(1)` picked that instead — which is how a test ends
   up asserting against its own fixture rather than the thing it is testing. */
const [oneRt] = await db
  .select()
  .from(event)
  .where(and(eq(event.importId, rtImport.importId), eq(event.type, 'round_trip')))
  .limit(1);
check('a round trip stores GROSS and labels it', oneRt?.payload?.pnlBasis, 'gross');
check('...and records how its instant was resolved', oneRt?.payload?.timeSource, 'fills_utc');

console.log('\n=== 8. THE PROVENANCE ROW IS THE ANSWER TO "WHERE DID THIS COME FROM" ===\n');

const [impRow] = await db.select().from(importBatch).where(eq(importBatch.id, rtImport.importId));
check('the import starts pending', impRow.status, 'pending');
check('it names the file', impRow.filename, 'Position History (9).csv');
check('it carries the trade-date window', impRow.rangeStart, rtImport.rangeStart);

await markImportCommitted(rtImport.importId);
const [afterCommit] = await db.select().from(importBatch).where(eq(importBatch.id, rtImport.importId));
check('and only becomes committed when someone says so', afterCommit.status, 'committed');

// Every event traces back to the upload that produced it.
const [{ n: linked }] = await db
  .select({ n: sql<number>`count(*)::int` })
  .from(event)
  .where(eq(event.importId, rtImport.importId));
check('every row points at its import', linked, roundTrips.length);


// Taken BEFORE any preflight runs, so section 10 can prove the checks are read-only.
const [{ n: eventCountBeforePreflight }] = await db
  .select({ n: sql<number>`count(*)::int` })
  .from(event)
  .where(eq(event.traderId, t.id));

console.log('\n=== 9. THE LOUD FAILURES, EACH ONE PROVOKED ===\n');

/* A guard nobody has watched refuse something is a guard you hope works. Each of these takes the
   REAL export and breaks it in the specific way the check exists to catch, so the assertion is
   that it fires — and, just as importantly, that it does NOT fire on the clean file. */
const feesText = readCsv('Cash History.csv');
const realCash = parseCashHistory(feesText);
const realFees = realCash.fees;
const realPaired = realCash.tradePaired;

// The clean case first. If this ever goes false the guards are miscalibrated, and a false refusal
// costs more than a missed one: it blocks a trader whose files are fine.
const clean = preflight({ fills, roundTrips, fees: realFees, tradePaired: realPaired });
check('the real export passes every check', clean.ok, true);
check('...with no findings at all', clean.findings.length, 0);
console.log(
  `        ${clean.counts.fills} fills · ${clean.counts.roundTripsMatched}/${clean.counts.roundTrips} round trips matched · ${clean.counts.feesMatched} fee buckets matched`
);

// #74a — Position History with no Fills to place it against.
const noFills = preflight({ fills: [], roundTrips, fees: [] });
check('Position History with no Fills is refused', noFills.ok, false);
check('...and names the cause', noFills.findings[0]?.code, 'fills_empty');

// #74b — the two files are from different accounts. Every round trip would ALSO be unmatched, so
// this asserts the cause is reported rather than the symptom.
const otherAccount = roundTrips.map((rt) => ({ ...rt, accountName: 'SOMEONEELSE999' }));
const mismatched = preflight({ fills, roundTrips: otherAccount, fees: [] });
check('files from different accounts are refused', mismatched.ok, false);
check(
  '...naming the accounts, not the symptom',
  mismatched.findings.some((f) => f.code === 'accounts_differ'),
  true
);

/* #74c — the case the previous build shipped without. HALF the round trips lose their fills, which
   is what re-exporting three files over slightly different windows actually looks like. The old
   guard fired only when NOTHING resolved, so this passed straight through. */
const half = Math.floor(roundTrips.length / 2);
const partiallyOrphaned = roundTrips.map((rt, i) =>
  i < half ? { ...rt, buyFillId: `missing-${i}`, sellFillId: `missing-${i}b` } : rt
);
const partial = preflight({ fills, roundTrips: partiallyOrphaned, fees: realFees });
check('a PARTIAL overlap is refused, not only a total one', partial.ok, false);
const orphanFinding = partial.findings.find((f) => f.code === 'round_trips_unmatched');
check('...and says how many, because 12 of 87 is not 87 of 87', orphanFinding?.detail.blocked, half);
check('...out of how many', orphanFinding?.detail.total, roundTrips.length);
check('...and still counts the ones that DID match', partial.counts.roundTripsMatched, roundTrips.length - half);

/* #75 — the dangerous one. Cash History from a window that does not overlap the fills: every
   bucket key misses, every round trip allocates zero fees, and net silently equals gross. On this
   export the fees EXCEED the gross loss, so the flattering answer is roughly half the real one. */
const shiftedFees = realFees.map((f) => ({ ...f, bucketKey: f.bucketKey ? `${f.bucketKey}-SHIFTED` : null }));
const noFeeMatch = preflight({ fills, roundTrips, fees: shiftedFees });
check('fees that match no trade are refused', noFeeMatch.ok, false);
check('...naming the cause', noFeeMatch.findings.some((f) => f.code === 'fees_unmatched'), true);

// And the guard does NOT fire when there are simply no fills to match against — that is a
// different situation, and refusing there would blame the wrong file.
const feesAlone = preflight({ fills: [], roundTrips: [], fees: realFees });
check('fees uploaded alone are NOT blamed for having no fills', feesAlone.ok, true);

/* The fourth loud failure, and the spec is explicit that it belongs HERE rather than in the read:
   "plausibility belongs at ingest, in code". Measured on a 50x column shift, one model run in
   three built a confident breakeven rule on the corrupted number without questioning it. */
const inflated = realFees.map((f) => ({ ...f, deltaCents: f.deltaCents * 50 }));
const implausible = preflight({ fills, roundTrips, fees: inflated });
check('a 50x fee corruption is refused at INGEST', implausible.ok, false);
const feeFinding = implausible.findings.find((f) => f.code === 'fees_implausible');
check('...and states the figure', typeof feeFinding?.detail.perContractCents, 'number');
console.log(`        real fees: ${clean.findings.length === 0 ? 'plausible' : 'FLAGGED'} · corrupted: $${((feeFinding?.detail.perContractCents ?? 0) / 100).toFixed(2)}/contract`);

// And the REAL fees are not flagged, which matters as much: a false refusal blocks a good import.
check('the real export is not flagged as implausible', clean.findings.some((f) => f.code === 'fees_implausible'), false);

/* THE RECONCILIATION. Two files, produced by different parts of Tradovate, stating the same
   quantity. Agreement to the cent is the whole basis for showing the number at all. */
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
check('the real export RECONCILES', clean.findings.some((f) => f.code === 'pnl_unreconciled'), false);
/* IT ABSTAINS ON 3 OF 360, AND THE THREE ARE WORTH NOTHING — measured 2026-08-15, and this is
   the assertion that matters rather than "all 360". Tradovate posts a Trade Paired cash row only
   when cash actually moved, so a SCRATCH TRADE (in and out at the same price, P&L exactly zero)
   has no row to reconcile against. All three unreached round trips are scratches. Asserting
   full coverage would have been asserting a falsehood about the broker's own file; asserting the
   gap is worthless is what actually protects the number. Every one of the 357 rows IS used, so
   nothing is silently dropped on the cash side either. */
const unreconciledValue = roundTrips.length - clean.counts.reconciledRoundTrips;
check('it abstains on exactly the scratch trades', unreconciledValue, 3);
check('...and every Trade Paired row was used', clean.counts.reconciledRoundTrips, realPaired.length);
console.log(`        ${clean.counts.reconciledRoundTrips}/${roundTrips.length} reconciled; the ${unreconciledValue} unreached are $0.00 scratches`);

// One cent moved on ONE row. If this passes, the check is decorative.
const offByOne = realPaired.map((p, i) => (i === 0 ? { ...p, deltaCents: p.deltaCents + 1 } : p));
const drifted = preflight({ fills, roundTrips, fees: realFees, tradePaired: offByOne });
const rec = drifted.findings.find((f) => f.code === 'pnl_unreconciled');
check('a ONE CENT disagreement is caught', rec !== undefined, true);
check('...and states both sources', usd(rec?.detail.diffCents ?? 0), '$0.01');
check('...and does not block the import', drifted.ok, true);

/* SYMMETRY, which is where v2 was wrong: it summed every Trade Paired row against a scoped
   round-trip sum, so a wider Cash History window reads as disagreement when nothing disagrees. */
const widerCash = [
  ...realPaired,
  { ...realPaired[0], bucketKey: 'NOT-IN-THIS-UPLOAD', deltaCents: -999_999 },
];
const wider = preflight({ fills, roundTrips, fees: realFees, tradePaired: widerCash });
check('a WIDER cash window is not a mismatch', wider.findings.some((f) => f.code === 'pnl_unreconciled'), false);

// No Cash History is NO OPINION, never a silent pass and never a false zero.
const noCash = preflight({ fills, roundTrips, fees: realFees });
check('no Trade Paired rows means no opinion', noCash.findings.some((f) => f.code === 'pnl_unreconciled'), false);
check('...and says so in the count', noCash.counts.reconciledRoundTrips, 0);

// Every finding is reported in one pass, so a trader fixing one problem does not then meet another.
const doublyBroken = preflight({ fills, roundTrips: partiallyOrphaned, fees: shiftedFees });
check('two problems are reported together, not one at a time', doublyBroken.findings.length, 2);

console.log('\n=== 10. AND NOTHING WAS WRITTEN BY ANY OF THAT ===\n');

// The whole point of a preflight is that it runs before the log is touched. If any of the checks
// above had written a row, `fees_unmatched` in particular would be worse than useless: storing the
// fees first flips the tape's "I know my costs" flag while every per-trade net is still gross.
const [{ n: afterPreflight }] = await db
  .select({ n: sql<number>`count(*)::int` })
  .from(event)
  .where(eq(event.traderId, t.id));
check('the preflight wrote nothing', afterPreflight, eventCountBeforePreflight);


console.log('\n=== 11. ACCOUNT RESOLUTION — THE COPY-TRADER INVARIANT ===\n');

/* THE FAILURE THIS PREVENTS is not a crash, it is a plausible number. A copy-trader runs one
   strategy across five accounts; if their rows pool into one bucket, a single 1-lot position reads
   as a 5-lot, and every figure derived from position size is wrong in an append-only log. */

// The real export names exactly one account, in every one of its four files.
const realName = 'FTDFYL100183704873';
const grouped = groupByAccount(fills);
check('the real export names exactly one account', grouped.groups.length, 1);
check('...and it is the account NAME, not a numeric id', grouped.groups[0]?.accountName, realName);
check('no row went unnamed', grouped.unnamed.length, 0);

// A copy-trader's file: the same trades split across three accounts.
const spread = fills.map((f, i) => ({ ...f, accountName: `COPYTRADER-${i % 3}` }));
const spreadGroups = groupByAccount(spread);
check('three accounts in one file group into three', spreadGroups.groups.length, 3);
check(
  '...and every row is accounted for',
  spreadGroups.groups.reduce((n, g) => n + g.rows.length, 0),
  fills.length
);

console.log('\n=== 12. RESOLVE CREATES ONCE, THEN FINDS ===\n');

const firstResolve = await resolveAccount({
  traderId: t.id,
  externalAccountId: realName,
  accountType: 'funded',
  propFirm: 'Tradeify',
});
const secondResolve = await resolveAccount({
  traderId: t.id,
  externalAccountId: realName,
  accountType: 'funded',
});
check('resolving twice returns the same account', firstResolve, secondResolve);

const [made] = await db.select().from(account).where(eq(account.id, firstResolve));
check('the display name defaults to the broker name', made.displayName, realName);
check('the account type is what the flow asked for', made.accountType, 'funded');
check('the prop firm is recorded', made.propFirm, 'Tradeify');
check('the platform is the platform, never the firm', made.platform, 'tradovate');

/* CONCURRENT RESOLUTION IS THE REAL CASE, not an edge one: four files arrive together and each
   resolves its own accounts. Two callers see nothing, both insert, and the unique index fails one
   — so `onConflictDoNothing` plus a re-read is what stops an import dying on a race with itself. */
const racers = await Promise.all(
  Array.from({ length: 5 }, () =>
    resolveAccount({ traderId: t.id, externalAccountId: 'RACE-0001', accountType: 'personal' })
  )
);
check('five concurrent resolves agree on one id', new Set(racers).size, 1);
const raceRows = await db
  .select()
  .from(account)
  .where(and(eq(account.traderId, t.id), eq(account.externalAccountId, 'RACE-0001')));
check('...and created exactly one row', raceRows.length, 1);

/* SCOPED BY TRADER. Two traders importing the same account name is legitimate — a shared demo
   account, or one person testing two logins — and without the scope the second one's trades would
   land on the first one's row, which is somebody else's trading history. */
const OTHER = 's4-gate-other-trader';
await db.delete(authUser).where(eq(authUser.id, OTHER));
await db.insert(authUser).values({ id: OTHER, email: 's4-other@fixture.invalid', emailVerified: false });
const [t2] = await db
  .insert(trader)
  .values({ authUserId: OTHER, displayTimezone: 'UTC' })
  .returning();
const otherId = await resolveAccount({
  traderId: t2.id,
  externalAccountId: realName, // the SAME name
  accountType: 'personal',
});
check('the same account name under another trader is a different row', otherId === firstResolve, false);
await db.delete(account).where(eq(account.traderId, t2.id));
await db.delete(authUser).where(eq(authUser.id, OTHER));

console.log('\n=== 13. A ROW THAT NAMES NO ACCOUNT IS REFUSED ===\n');

/* The previous build swept these into a per-trader default so an odd export still landed
   somewhere, and its own comment admits the cost: a junk `default-<traderId>` row that then showed
   up in the roster as a phantom account. Every real export names its account, so an unnamed row
   means the file is not what it claims to be. */
const anonymised = fills.map((f) => ({ ...f, accountName: null }));
const unnamedResult = preflight({ fills: anonymised, roundTrips: [], fees: [] });
check('unnamed rows are refused', unnamedResult.ok, false);
check('...naming the cause', unnamedResult.findings[0]?.code, 'rows_unnamed');
check('...and counting them', unnamedResult.findings[0]?.detail.blocked, fills.length);

// ── teardown ────────────────────────────────────────────────────────────────────────
// `event` cannot be deleted by the app, which is the point of section 2 — so the fixture's
// events are removed through the same privileged path a real erasure would use.
await teardown();
const leftover = await db.select().from(event).where(eq(event.traderId, t.id));
check('fixture cleaned up via the privileged path', leftover.length, 0);

console.log(`\n${failures === 0 ? 'S4 GATE PASSED' : `S4 GATE FAILED — ${failures} assertion(s)`}`);
process.exit(failures === 0 ? 0 : 1);
