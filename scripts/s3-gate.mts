// S3a GATE — auth and identity.
//
// Run: npx tsx --env-file=.env.local --conditions=react-server scripts/s3-gate.mts
//
// Section 1 is the one that matters, and it is a SOURCE check rather than a behavioural one.
// `display_timezone` reaching the bucketing code would not throw, would not fail a type check,
// and would not look wrong in a render — it would quietly file an hour of every evening session
// under a date that depends on where the trader happened to be sitting. There is no output to
// assert against, so the assertion is on the shape of the code: the module that buckets cannot
// import the module that holds the trader's zone, and the bucketing function takes no zone at
// all. Both are cheap to check and both are load-bearing.
import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { loadEnv } from './load-env.mts';

loadEnv();

const { db, trader, authUser } = await import('../src/lib/db/index.ts');
const { isKnownTimezone, setDisplayTimezone } = await import('../src/lib/trader.ts');
const { sessionDateFor, SESSION_BOUNDARY_ZONE } = await import('../src/lib/time/session.ts');

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const ok = String(actual) === String(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        expected ${expected}, got ${actual}`);
};

console.log('=== 1. display_timezone CANNOT REACH THE BUCKETING CODE ===\n');

const sessionSrc = readFileSync('src/lib/time/session.ts', 'utf8');

// The import guard. If this ever fails, the fix is never to "be careful" — it is to move
// whatever needed the trader's zone out of the time module.
check(
  'lib/time/session.ts does not import the trader module',
  /from\s+['"](@\/lib\/trader|\.\/trader|\.\.\/trader)['"]/.test(sessionSrc),
  false,
);
check(
  'lib/time/session.ts does not import the database',
  /from\s+['"]@\/lib\/db['"]/.test(sessionSrc),
  false,
);

// The signature guard. `sessionDateFor(instant)` takes one argument and there is nowhere to put
// a zone even by accident. `displayClock(instant, zone)` takes two, and the asymmetry is the
// design: the one that can be given a zone is the one that must never decide a date.
check('sessionDateFor accepts exactly one argument', sessionDateFor.length, 1);

// And the behavioural corollary, in case somebody adds a default parameter later: the same
// instant must produce the same session date no matter who is looking at it.
const evening = new Date('2026-08-11T22:30:00Z'); // 17:30 CT, past the roll
check('the boundary zone is the market zone', SESSION_BOUNDARY_ZONE, 'America/Chicago');
check('an evening fill rolls, regardless of any trader', sessionDateFor(evening), '2026-08-12');

console.log('\n=== 2. ZONE VALIDATION ASKS Intl, NOT A LIST ===\n');

check('a real zone', isKnownTimezone('America/Chicago'), true);
check('another real zone', isKnownTimezone('Europe/London'), true);
check('UTC', isKnownTimezone('UTC'), true);
check('a plausible-looking fake', isKnownTimezone('America/Chicago_Heights'), false);
check('a regex would have accepted this', isKnownTimezone('Foo/Bar'), false);
check('an offset is not a zone', isKnownTimezone('UTC-5'), false);
check('empty', isKnownTimezone(''), false);

console.log('\n=== 3. A CHOICE OUTRANKS DETECTION, PERMANENTLY ===\n');

// Against the real database, on a throwaway auth user that is deleted at the end. The precedence
// rule is the whole reason the extra column exists, so it is proven rather than described.
const TEST_AUTH_ID = 's3-gate-fixture-user';
await db.delete(authUser).where(eq(authUser.id, TEST_AUTH_ID)); // cascades to trader
await db
  .insert(authUser)
  .values({ id: TEST_AUTH_ID, email: 's3-gate@fixture.invalid', emailVerified: false });
const [row] = await db
  .insert(trader)
  .values({ authUserId: TEST_AUTH_ID, displayTimezone: SESSION_BOUNDARY_ZONE })
  .returning();

const zoneNow = async () => (await db.select().from(trader).where(eq(trader.id, row.id)))[0];

check('detection sets a zone when none was chosen', await setDisplayTimezone(row.id, 'Europe/London', false), 'set');
check('...and it landed', (await zoneNow()).displayTimezone, 'Europe/London');
check('...flagged as detected', (await zoneNow()).displayTimezoneSetByUser, false);

check('a human choosing wins', await setDisplayTimezone(row.id, 'America/Denver', true), 'set');
check('...and it landed', (await zoneNow()).displayTimezone, 'America/Denver');

// THE ONE THAT MATTERS: the airport case. Opening the app in Frankfurt must not relabel every
// clock in the record.
check('detection is IGNORED once a human has chosen', await setDisplayTimezone(row.id, 'Europe/Berlin', false), 'ignored');
check('...and the choice survived', (await zoneNow()).displayTimezone, 'America/Denver');

check('a human can still change their mind', await setDisplayTimezone(row.id, 'Asia/Tokyo', true), 'set');
check('...and it landed', (await zoneNow()).displayTimezone, 'Asia/Tokyo');

check('an unknown zone is refused, not stored', await setDisplayTimezone(row.id, 'Foo/Bar', true), 'unknown-zone');
check('...and the last good zone survived', (await zoneNow()).displayTimezone, 'Asia/Tokyo');

check('setting the same value twice is a no-op', await setDisplayTimezone(row.id, 'Asia/Tokyo', true), 'ignored');

console.log('\n=== 4. THE ROW SHAPE ===\n');

const fresh = await zoneNow();
check('key_id ships null, and nothing reads it in v1', fresh.keyId, null);
check('the trader is linked, not a copy of the email', 'authUserId' in fresh, true);
check('there is no email column on trader', 'email' in fresh, false);

await db.delete(authUser).where(eq(authUser.id, TEST_AUTH_ID));
const [leftover] = await db.select().from(trader).where(eq(trader.id, row.id));
check('deleting the auth user cascades the trader row', leftover, undefined);

console.log(`\n${failures === 0 ? 'S3a GATE PASSED' : `S3a GATE FAILED — ${failures} assertion(s)`}`);
process.exit(failures === 0 ? 0 : 1);
