/* IMPORT RECOVERY (#5). Proves that re-uploading a file whose first import DIED before it was
 * confirmed adopts the events already in the log, rather than colliding with the
 * `(account_id, file_hash)` unique index and stranding the trader forever.
 *
 * WHY IT NEEDS A DATABASE AND CANNOT BE A UNIT TEST. The whole failure lives in the interaction
 * between an atomic `db.batch`, a unique index, and a row left at `status: 'pending'`. Every part
 * of that is the database's behaviour, not this codebase's, and the bug it replaces was invisible
 * precisely because each piece looked correct in isolation.
 *
 * IT USES ITS OWN FIXTURE TRADER AND TEARS DOWN FIRST, following `s4-gate.mts`. The teardown is a
 * single DO block because `set_config(..., true)` is TRANSACTION-local and neon-http has no
 * interactive transactions - two calls would lose the flag in between and the append-only trigger
 * would correctly refuse the delete. `s4-gate.mts` records that finding, and it is the pattern the
 * real erasure path (#42) will have to use as well.
 *
 * Run: npx tsx --env-file=.env.local --conditions=react-server scripts/import-recovery-gate.mts
 */
import { and, count, eq, sql } from 'drizzle-orm';
import { loadEnv } from './load-env.mts';

loadEnv();

const { db, trader, account, importBatch, event, authUser } = await import('../src/lib/db/index.ts');
const { commitImport, markImportCommitted } = await import('../src/lib/intake/commit.ts');

const FIXTURE = 'import-recovery-gate-fixture';

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const ok = String(actual) === String(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        expected ${expected}, got ${actual}`);
};

async function teardown() {
  await db.execute(sql`
    DO $$
    DECLARE tid uuid;
    BEGIN
      -- Inlined, not bound: a DO block is one statement to Postgres and takes no bind
      -- parameters: "bind message supplies 1 parameters, but prepared statement requires 0".
      -- Safe because FIXTURE is a constant in this file, never input. s4-gate.mts does the same.
      SELECT id INTO tid FROM trader WHERE auth_user_id = 'import-recovery-gate-fixture';
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
await db.insert(authUser).values({ id: FIXTURE, email: 'recovery@fixture.invalid', emailVerified: false });
const [t] = await db
  .insert(trader)
  .values({ authUserId: FIXTURE, displayTimezone: 'America/Chicago' })
  .returning();
const [acct] = await db
  .insert(account)
  .values({
    traderId: t!.id,
    platform: 'tradovate',
    externalAccountId: 'RECOVERYFIXTURE1',
    displayName: 'Recovery gate fixture',
    accountType: 'personal',
  })
  .returning();

const PREFLIGHT_PASSED = {
  ok: true as const,
  findings: [],
  counts: {
    fills: 0, roundTrips: 0, fees: 0, roundTripsMatched: 0, reconciledPairedRows: 0,
    feeRowsMatched: 0, feeBucketsMatched: 0, reconciledRoundTrips: 0, statementDays: 0,
    unbucketedFeeCents: 0,
  },
};

const FILE_TEXT = 'fixture,file\nfor,recovery\n';
const events = [1, 2, 3].map((n) => ({
  traderId: t!.id,
  accountId: acct!.id,
  importId: 'placeholder',
  type: 'fill' as const,
  source: 'csv' as const,
  payload: { n, accountName: 'RECOVERY-FIXTURE' },
  occurredAt: new Date(`2026-07-1${n}T15:30:00Z`),
  dedupeKey: `recovery-gate:${n}`,
}));

const args = {
  traderId: t!.id,
  accountId: acct!.id,
  filename: 'Recovery.csv',
  fileText: FILE_TEXT,
  source: 'tradovate_csv' as const,
  preflight: PREFLIGHT_PASSED,
  rowsParsed: events.length,
  events,
};

console.log('\n1. The first import writes');
const first = await commitImport(args);
check('outcome is `written`', first.outcome, 'written');
check('every event landed', first.rowsWritten, events.length);

console.log('\n2. THE STRAND. The request dies here: nothing marks it committed.');
const [pendingRow] = await db.select({ status: importBatch.status }).from(importBatch).where(eq(importBatch.id, first.importId));
check('the import is left pending', pendingRow?.status, 'pending');
const [{ n: eventsAfterStrand } = { n: 0 }] = await db
  .select({ n: count() })
  .from(event)
  .where(and(eq(event.traderId, t!.id), eq(event.importId, first.importId)));
check('...but its events are already in the log', eventsAfterStrand, events.length);

console.log('\n3. The trader retries the same file. This used to fail forever.');
const retry = await commitImport(args);
check('outcome is `recovered`', retry.outcome, 'recovered');
check('it adopts the ORIGINAL import, not a new one', retry.importId, first.importId);
check('it claims no new rows, honestly', retry.rowsWritten, 0);
check('the date range survives the adoption', retry.rangeStart, first.rangeStart);

await markImportCommitted(retry.importId);
const [committedRow] = await db.select({ status: importBatch.status }).from(importBatch).where(eq(importBatch.id, retry.importId));
check('the retry can now confirm it', committedRow?.status, 'committed');

console.log('\n4. A genuine duplicate is still a duplicate.');
const third = await commitImport(args);
check('outcome is `duplicate`', third.outcome, 'duplicate');
check('still the same import row', third.importId, first.importId);
check('and still no new rows', third.rowsWritten, 0);

console.log('\n5. Nothing was doubled by any of it.');
const [{ n: totalEvents } = { n: 0 }] = await db
  .select({ n: count() })
  .from(event)
  .where(eq(event.traderId, t!.id));
check('the log holds exactly what the first import wrote', totalEvents, events.length);
const [{ n: totalImports } = { n: 0 }] = await db
  .select({ n: count() })
  .from(importBatch)
  .where(eq(importBatch.traderId, t!.id));
check('one import row across three commit calls', totalImports, 1);

await teardown();
console.log(`\n${failures === 0 ? 'GATE PASSED' : `GATE FAILED - ${failures} assertion(s)`}\n`);
process.exit(failures === 0 ? 0 : 1);
