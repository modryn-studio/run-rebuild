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
const byRoot = new Map(rows.map((r) => [r.symbolRoot, r]));

check('the seeded roster', rows.length, 41);
check('currency', [...new Set(rows.map((r) => r.currency))].join(','), 'USD');
// Four exchanges, not one. CBOT holds the Dow pair, NYMEX the energy, COMEX the metals — and it
// is the exchange that drives the session calendar, so filing YM under CME would be wrong.
check(
  'four exchanges, because CME Group is four exchanges',
  [...new Set(rows.map((r) => r.exchange))].sort().join(','),
  'CBOT,CME,COMEX,NYMEX',
);
check('YM is CBOT', byRoot.get('YM')?.exchange, 'CBOT');
check('CL is NYMEX', byRoot.get('CL')?.exchange, 'NYMEX');
check('GC is COMEX', byRoot.get('GC')?.exchange, 'COMEX');

// Spot checks against CME's published Globex OUTRIGHT tick. EMD and the FX pairs are the two
// places the exchange's API also carries a ClearPort tick, which is 10x smaller and would seed
// silently wrong — so both are asserted rather than trusted.
check('MNQ tick', Number(byRoot.get('MNQ')?.tickSize), 0.25);
check('CL tick', Number(byRoot.get('CL')?.tickSize), 0.01);
check('EMD tick is Globex 0.10, not ClearPort 0.01', Number(byRoot.get('EMD')?.tickSize), 0.1);
check('6E tick is Globex 0.000050, not ClearPort 0.000010', Number(byRoot.get('6E')?.tickSize), 0.00005);

// The deliberately absent. A missing row quarantines loudly; a wrong row is a plausible number
// nobody catches. These three families are quoted in units one real export has not settled, and
// SR3's tick is not a constant at all. Absent is the correct state, and it is asserted so that
// nobody "completes" the table from memory.
for (const root of ['ZC', 'ZS', 'ZB', 'ZN', 'LE', 'HE', 'SR3']) {
  check(`${root} is deliberately NOT seeded`, byRoot.has(root), false);
}

console.log('\n=== 4. THE SANITY BOUND IS ON THE TICK, NOT THE POINT ===\n');

// The bound that shipped in S1 was calibrated on a corpus of MNQ and NQ, and would have told a
// crude trader their real $1,000-per-point contract was "not plausible for a listed future".
// These assertions exist so that cannot come back.
const { derivePointValueCents } = await import('../src/lib/desk/tape.ts');

const tickSizes = new Map(rows.map((r) => [r.symbolRoot, Number(r.tickSize)]));

// One synthetic round trip per product, priced at its real point value. `grossCents` is what the
// broker would have paid: points x pointValue x qty, in cents.
const rt = (contract: string, points: number, pointValueCents: number, qty = 1) => ({
  contract,
  entryPriceMicros: 0,
  exitPriceMicros: points * 1_000_000,
  qty,
  grossCents: points * pointValueCents * qty,
});

const REAL = [
  { root: 'MNQ', pv: 200 }, // $2/point   — tick 0.25 -> $0.50
  { root: 'NQ', pv: 2_000 }, // $20       — $5.00
  { root: 'CL', pv: 100_000 }, // $1,000  — tick 0.01 -> $10.00. QUARANTINED BY THE OLD BOUND.
  { root: '6E', pv: 12_500_000 }, // $125,000 — tick 0.00005 -> $6.25. Off by 500x under the old one.
  { root: 'MET', pv: 10 }, // $0.10       — tick 0.50 -> $0.05, the floor of the whole roster
  { root: 'PA', pv: 10_000 }, // $100     — tick 0.50 -> $50.00, the ceiling
];

for (const { root, pv } of REAL) {
  const res = derivePointValueCents(
    [rt(`${root}Z6`, 10, pv)] as never,
    new Map([[`${root}Z6`, root]]),
    tickSizes,
  );
  const q = res.quarantined.get(root);
  check(`${root} at ${(pv / 100).toLocaleString()}/point survives`, q ?? res.byRoot.get(root)?.cents, pv);
}

// And it still catches what it was written to catch. A price column parsed 100x too small makes
// the derived point value 100x too LARGE, which is the shifted-column signature.
const corrupt = derivePointValueCents(
  [rt('CLZ6', 10, 100_000 * 100)] as never,
  new Map([['CLZ6', 'CL']]),
  tickSizes,
);
check('a 100x-corrupted CL still quarantines', corrupt.quarantined.has('CL'), true);
check('...and says tick value, not point value', /tick value/.test(corrupt.quarantined.get('CL') ?? ''), true);

// With no tick size, the wide fallback admits a real product rather than inventing a reason.
const noTick = derivePointValueCents([rt('ZCZ6', 10, 500_000)] as never, new Map([['ZCZ6', 'ZC']]));
check('an unseeded root is not falsely called implausible', noTick.quarantined.has('ZC'), false);

console.log(`\n${failures === 0 ? 'S2 GATE PASSED' : `S2 GATE FAILED — ${failures} assertion(s)`}`);
process.exit(failures === 0 ? 0 : 1);
