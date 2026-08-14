// S4 GATE — the ingest tables, and the guarantees that make them worth having.
//
// Run: npx tsx --env-file=.env.local --conditions=react-server scripts/s4-gate.mts
//
// Section 2 is the one that matters. `event` being append-only is doctrine everywhere else in
// this repo, which means it is a convention a future writer can forget. Here it is a trigger,
// and the only way to know a trigger works is to try the thing it forbids.
import { eq, sql } from 'drizzle-orm';
import { loadEnv } from './load-env.mts';

loadEnv();

const { db, trader, account, importBatch, event, authUser } = await import('../src/lib/db/index.ts');

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

// ── teardown ────────────────────────────────────────────────────────────────────────
// `event` cannot be deleted by the app, which is the point of section 2 — so the fixture's
// events are removed through the same privileged path a real erasure would use.
await teardown();
const leftover = await db.select().from(event).where(eq(event.traderId, t.id));
check('fixture cleaned up via the privileged path', leftover.length, 0);

console.log(`\n${failures === 0 ? 'S4 GATE PASSED' : `S4 GATE FAILED — ${failures} assertion(s)`}`);
process.exit(failures === 0 ? 0 : 1);
