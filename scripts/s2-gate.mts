// S2 GATE — the two primitives everything else is wrong without.
//
// Run: npx tsx --env-file=.env.local --conditions=react-server scripts/s2-gate.mts
//
// S1's gate (`scripts/s1-gate.mts`) already proves the session boundary itself, including the
// roll in both DST directions, against the real ten-day tape. This one covers what S1 did not:
// the COARSER buckets, and `contract_spec` after the multiplier came out of it.
//
// Section 2 is the one worth reading. It runs the same dates through the TypeScript bucketer and
// through Postgres `date_trunc` and requires them to agree, because `#97` — a TS bucketer and a
// SQL `date_trunc` both called "grain" while meaning different things — is the exact failure
// this module exists to make impossible. Asserting it against the real database is the
// difference between "these should agree" and "these do."
import { sql } from 'drizzle-orm';
import { loadEnv } from './load-env.mts';

loadEnv();

const { bucketStartFor, yearToDateWindow, sessionDateFor } = await import(
  '../src/lib/time/session.ts'
);
const { db, contractSpec } = await import('../src/lib/db/index.ts');

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const ok = String(actual) === String(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        expected ${expected}, got ${actual}`);
};
const throws = (label: string, fn: () => unknown) => {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) failures++;
  console.log(`  ${threw ? 'PASS' : 'FAIL'}  ${label}`);
};

console.log('=== 1. THE BUCKETS, against hand-computed answers ===\n');

// Hand-computed, not read off the implementation. 2026-08-12 is a Wednesday; 2026-01-01 is a
// Thursday, so its week starts in the PREVIOUS YEAR, which is the case a naive
// "subtract to the first Monday of this month" would get wrong.
check("day is not a special case", bucketStartFor('2026-08-12', 'day'), '2026-08-12');
check('week of a Wednesday walks back to Monday', bucketStartFor('2026-08-12', 'week'), '2026-08-10');
check('week of a Monday is itself', bucketStartFor('2026-08-10', 'week'), '2026-08-10');
check('week of a Friday is the same Monday', bucketStartFor('2026-08-14', 'week'), '2026-08-10');
check('a week may start in the previous YEAR', bucketStartFor('2026-01-01', 'week'), '2025-12-29');
check('month', bucketStartFor('2026-08-12', 'month'), '2026-08-01');
check('year', bucketStartFor('2026-12-31', 'year'), '2026-01-01');

const ytd = yearToDateWindow('2026-08-12');
check('year to date starts at the year', ytd.from, '2026-01-01');
check('year to date ends at the as-of date, inclusive', ytd.to, '2026-08-12');

// A malformed date must THROW, never bucket. `new Date('2026-02-30')` silently becomes March
// 2nd, which is a plausible answer to a question that had no answer — the same failure class as
// a default multiplier.
throws('February 30th throws', () => bucketStartFor('2026-02-30', 'week'));
throws('month 13 throws', () => bucketStartFor('2026-13-01', 'month'));
throws('an unpadded date throws', () => bucketStartFor('2026-8-12', 'day'));
throws('a date with no dashes throws', () => bucketStartFor('20260812', 'day'));
throws('a two-digit year throws rather than landing in 1999', () =>
  bucketStartFor('0099-01-01', 'year'),
);

console.log('\n=== 1b. THE TRADING WEEK LANDS IN ONE BUCKET ===\n');

// The claim the Monday-start choice rests on: a session date is always Mon-Fri, because Sunday
// evening carries MONDAY's trade date. Both ends of one trading week must fall in one bucket.
// CME Globex: Sunday 17:00 CT open, Friday 16:00 CT close (read from CME's own spec pages
// 2026-08-12). August is CDT, so CT is UTC-5.
const sundayOpen = sessionDateFor(new Date('2026-08-09T22:30:00Z')); // Sun 17:30 CT
const fridayClose = sessionDateFor(new Date('2026-08-14T20:00:00Z')); // Fri 15:00 CT
check('Sunday evening files under Monday', sundayOpen, '2026-08-10');
check('Friday afternoon files under Friday', fridayClose, '2026-08-14');
check(
  'both ends of the trading week share one week bucket',
  `${bucketStartFor(sundayOpen, 'week')} ${bucketStartFor(fridayClose, 'week')}`,
  '2026-08-10 2026-08-10',
);

console.log('\n=== 2. TypeScript and Postgres MUST agree — this is #97 ===\n');

// Chosen to break a bucketer that is only accidentally right: DST in both directions, a year
// boundary, a leap day, a month that starts on a Sunday, and the first and last day of a month.
const DATES = [
  '2026-01-01', // Thursday, week starts in 2025
  '2026-02-28',
  '2026-03-01', // a Sunday — never a real session date, and it must still bucket correctly
  '2026-03-08', // US DST spring forward
  '2026-03-09',
  '2026-08-12',
  '2026-11-01', // US DST fall back
  '2026-11-02',
  '2026-12-31',
  '2028-02-29', // leap day
];

const dateList = sql.join(
  DATES.map((d) => sql`(${d}::date)`),
  sql`, `,
);

for (const grain of ['week', 'month', 'year'] as const) {
  // `grain` is raw only because it is a literal union, never input. date_trunc's first argument
  // has to be a literal here — as a bind parameter it arrives typed `unknown` and Postgres
  // cannot resolve the overload.
  const res = await db.execute<{ d: string; trunc: string }>(sql`
    SELECT d::text AS d, date_trunc('${sql.raw(grain)}', d)::date::text AS trunc
    FROM (VALUES ${dateList}) AS t(d)
  `);
  const fromSql = new Map(res.rows.map((r) => [r.d, r.trunc]));
  for (const d of DATES) {
    check(`${grain} of ${d}`, bucketStartFor(d, grain), fromSql.get(d));
  }
}

console.log('\n=== 3. contract_spec, after the multiplier came out of it ===\n');

const cols = await db.execute<{ column_name: string }>(sql`
  SELECT column_name FROM information_schema.columns WHERE table_name = 'contract_spec'
`);
const names = cols.rows
  .map((c) => c.column_name)
  .sort()
  .join(',');
check(
  'the columns are exactly what cannot be derived',
  names,
  'currency,exchange,symbol_root,tick_size',
);

const rows = await db.select().from(contractSpec).orderBy(contractSpec.symbolRoot);
check('seeded narrow: two roots, and only what has been traded', rows.length, 2);
check('roots', rows.map((r) => r.symbolRoot).join(','), 'MNQ,NQ');
// 0.25 index points, outright, from CME's published spec for both products.
check('tick sizes are in QUOTE units', rows.map((r) => Number(r.tickSize)).join(','), '0.25,0.25');
check('currency', [...new Set(rows.map((r) => r.currency))].join(','), 'USD');
check('exchange, which drives the session calendar', [...new Set(rows.map((r) => r.exchange))].join(','), 'CME');

console.log(`\n${failures === 0 ? 'S2 GATE PASSED' : `S2 GATE FAILED — ${failures} assertion(s)`}`);
process.exit(failures === 0 ? 0 : 1);
