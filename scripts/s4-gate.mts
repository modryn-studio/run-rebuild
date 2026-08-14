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

// ── teardown ────────────────────────────────────────────────────────────────────────
// `event` cannot be deleted by the app, which is the point of section 2 — so the fixture's
// events are removed through the same privileged path a real erasure would use.
await teardown();
const leftover = await db.select().from(event).where(eq(event.traderId, t.id));
check('fixture cleaned up via the privileged path', leftover.length, 0);

console.log(`\n${failures === 0 ? 'S4 GATE PASSED' : `S4 GATE FAILED — ${failures} assertion(s)`}`);
process.exit(failures === 0 ? 0 : 1);
