/* ERASURE (#42, beta scope). Proves `eraseTrader` removes every row a trader owns - through the
 * append-only trigger - and nothing anybody else owns.
 *
 * WHY A GATE: the block runs with `run.privileged` on, which is the one context in the product where
 * a wrong WHERE clause deletes the wrong person's record with no trigger to stop it. So a SECOND
 * fixture trader sits beside the one being erased, and the assertion that matters is that their
 * rows are still there afterwards.
 *
 * Run: npx tsx --env-file=.env.local --conditions=react-server scripts/erase-gate.mts
 */
import { count, eq, sql } from 'drizzle-orm';
import { loadEnv } from './load-env.mts';

loadEnv();

const { db, trader, account, importBatch, event, authUser } = await import('../src/lib/db/index.ts');
const { commitImport, markImportCommitted } = await import('../src/lib/intake/commit.ts');
const { eraseTrader } = await import('../src/lib/erase.ts');

const GONE = 'erase-gate-fixture-gone';
const STAYS = 'erase-gate-fixture-stays';

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const ok = String(actual) === String(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        expected ${expected}, got ${actual}`);
};

/* Idempotent teardown for BOTH fixtures, through the privileged path, inlined ids (a DO block takes
   no bind parameters; both are constants in this file). */
async function teardown() {
  for (const id of [GONE, STAYS]) {
    await db.execute(
      sql.raw(`
      DO $$
      DECLARE tid uuid;
      BEGIN
        SELECT id INTO tid FROM trader WHERE auth_user_id = '${id}';
        IF tid IS NULL THEN RETURN; END IF;
        PERFORM set_config('run.privileged', 'on', true);
        DELETE FROM "event"  WHERE trader_id = tid;
        DELETE FROM "import" WHERE trader_id = tid;
        DELETE FROM "account" WHERE trader_id = tid;
        DELETE FROM trader WHERE id = tid;
      END $$;`)
    );
    await db.delete(authUser).where(eq(authUser.id, id));
  }
}

const PREFLIGHT_PASSED = {
  ok: true as const,
  findings: [],
  counts: {
    fills: 0, roundTrips: 0, fees: 0, roundTripsMatched: 0, reconciledPairedRows: 0,
    feeRowsMatched: 0, feeBucketsMatched: 0, reconciledRoundTrips: 0, statementDays: 0,
    unbucketedFeeCents: 0,
  },
};

async function seed(authUserId: string, tag: string) {
  await db.insert(authUser).values({ id: authUserId, email: `${tag}@fixture.invalid`, emailVerified: false });
  const [t] = await db.insert(trader).values({ authUserId, displayTimezone: 'America/Chicago' }).returning();
  const [acct] = await db
    .insert(account)
    .values({ traderId: t!.id, platform: 'tradovate', externalAccountId: `ERASE${tag.toUpperCase()}`, displayName: tag, accountType: 'personal' })
    .returning();
  const events = [1, 2, 3].map((n) => ({
    traderId: t!.id, accountId: acct!.id, importId: 'placeholder', type: 'fill' as const, source: 'csv' as const,
    payload: { n }, occurredAt: new Date(`2026-07-2${n}T15:30:00Z`), dedupeKey: `erase-gate:${tag}:${n}`,
  }));
  const r = await commitImport({
    traderId: t!.id, accountId: acct!.id, filename: `${tag}.csv`, fileText: `erase,${tag}\n`,
    source: 'tradovate_csv', preflight: PREFLIGHT_PASSED, rowsParsed: 3, events,
  });
  await markImportCommitted(r.importId);
  return t!.id;
}

const rowsFor = async (traderId: string) => {
  const n = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  return {
    events: await n(db.select({ n: count() }).from(event).where(eq(event.traderId, traderId))),
    imports: await n(db.select({ n: count() }).from(importBatch).where(eq(importBatch.traderId, traderId))),
    accounts: await n(db.select({ n: count() }).from(account).where(eq(account.traderId, traderId))),
    traders: await n(db.select({ n: count() }).from(trader).where(eq(trader.id, traderId))),
  };
};

await teardown();
const goneId = await seed(GONE, 'gone');
const staysId = await seed(STAYS, 'stays');

console.log('\n1. Both fixtures exist');
const before = await rowsFor(goneId);
check('the trader to erase has events', before.events, 3);
check('...and an import, an account, a trader row', `${before.imports}/${before.accounts}/${before.traders}`, '1/1/1');
check('the bystander has events too', (await rowsFor(staysId)).events, 3);

console.log('\n2. Erase one');
const { elapsedMs } = await eraseTrader(GONE);
console.log(`        took ${elapsedMs}ms`);

console.log('\n3. Everything of theirs is gone, through the append-only trigger');
const after = await rowsFor(goneId);
check('events', after.events, 0);
check('imports', after.imports, 0);
check('accounts', after.accounts, 0);
check('trader row', after.traders, 0);
const [u] = await db.select({ id: authUser.id }).from(authUser).where(eq(authUser.id, GONE));
check('auth user', u ? 1 : 0, 0);

console.log('\n4. Nothing of anybody else\'s moved');
const bystander = await rowsFor(staysId);
check('bystander events', bystander.events, 3);
check('bystander import/account/trader', `${bystander.imports}/${bystander.accounts}/${bystander.traders}`, '1/1/1');

console.log('\n5. The charset guard refuses what it should');
let refused = false;
try { await eraseTrader("x'; DROP TABLE trader; --"); } catch { refused = true; }
check('a quote in the id is refused before any SQL', refused, true);
check('...and the bystander is still here', (await rowsFor(staysId)).traders, 1);

console.log('\n6. Erasing a trader who does not exist is a no-op, not an error');
let noop = true;
try { await eraseTrader('erase-gate-nobody'); } catch { noop = false; }
check('unknown id returns quietly', noop, true);

await teardown();
console.log(`\n${failures === 0 ? 'GATE PASSED' : `GATE FAILED - ${failures} assertion(s)`}\n`);
process.exit(failures === 0 ? 0 : 1);
