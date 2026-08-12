// S1 GATE. No model calls, no cost, no database.
//
// Ported from run-trading@desk-call `scripts/desk-gate.mts`. Every assertion is a fact the desk
// established BY HAND on a real tape, which code has to reproduce before a single dollar is spent
// on inference — running a read against a wrong tape spends the budget measuring a model's
// reaction to bad data.
//
// It also proves the three bugs fixed during the port are actually fixed, and that fixing them
// did not move the money.
//
// Run: npx tsx --env-file=.env.local --conditions=react-server scripts/s1-gate.mts
import { readFileSync } from 'node:fs';

const { parseTradovateFillsCsv } = await import('../src/lib/csv/fills');
const { parseTradovatePositionHistoryCsv } = await import('../src/lib/csv/position-history');
const { parseCashHistory } = await import('../src/lib/csv/cash-history');
const { parseTradovateOrdersCsv } = await import('../src/lib/csv/orders');
const { buildTapeFromParsed, fmtMoney, fmtPrice, derivePointValueCents } = await import('../src/lib/desk/tape');
const { sessionDateFor } = await import('../src/lib/time/session');
const { toMicros } = await import('../src/lib/csv/shared');

const D = 'C:/Users/Luke/Downloads/';
const read = (f: string) => readFileSync(D + f).toString();

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const ok = String(actual) === String(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        expected ${expected}, got ${actual}`);
};

// ── the ten-day tape ──────────────────────────────────────────────────────────────────────
const deep = buildTapeFromParsed({
  fills: parseTradovateFillsCsv(read('Fills.csv')),
  roundTrips: parseTradovatePositionHistoryCsv(read('Position History (9).csv')),
  fees: parseCashHistory(read('Cash History.csv')).fees,
  orders: parseTradovateOrdersCsv(read('Orders (10).csv')),
});

console.log('=== 1. THE MONEY, against the broker\'s own statement ===\n');

// Account Balance History is Tradovate's own daily statement — an INDEPENDENT source. The tape is
// built from fills, position history and cash history; this file is none of those. If the two
// agree to the cent, the parse, the pairing and the fee allocation are all correct together.
const balRows = read('Account Balance History.csv').trim().split(/\r?\n/).slice(1);
const balNet = balRows.reduce((s, line) => {
  const m = line.match(/"?([-\d,.]+)"?\s*$/);
  return s + (m ? Math.round(Number(m[1].replace(/,/g, '')) * 100) : 0);
}, 0);

console.log(`        tape:   ${fmtMoney(deep.totals.grossCents)} gross  ${fmtMoney(deep.totals.feeCents)} fees  ${fmtMoney(deep.totals.netCents)} net`);
console.log(`        broker: ${fmtMoney(balNet)} net (Account Balance History, summed)`);
console.log(`        difference: ${fmtMoney(deep.totals.netCents - balNet)}\n`);
check('the tape reconciles to the broker to the CENT', deep.totals.netCents - balNet, 0);
check('fees were actually allocated, not skipped', deep.totals.hasFees, true);
check('every fee belongs to a round trip', deep.totals.unallocatedFeeCents, 0);
check('real fees are NOT flagged implausible', deep.totals.feesImplausible, false);

console.log('\n=== 2. FIX: the fee plausibility check still catches a corrupted export ===\n');
const badFees = buildTapeFromParsed({
  fills: parseTradovateFillsCsv(read('Fills.csv')),
  roundTrips: parseTradovatePositionHistoryCsv(read('Position History (9).csv')),
  fees: parseCashHistory(read('Cash History.csv')).fees.map((f) => ({ ...f, deltaCents: f.deltaCents * 47 })),
  orders: parseTradovateOrdersCsv(read('Orders (10).csv')),
});
check('a 47x fee corruption IS flagged', badFees.totals.feesImplausible, true);

console.log('\n=== 3. FIX: point value is derived, by ROOT, with agreement not a median ===\n');
// The published contract specs: MNQ is $2.00 per point, NQ is $20.00. Nothing in the code knows
// that — these are solved from the trader's own realised P&L. The assertion is that solving from
// the broker's numbers lands on the exchange's numbers.
const pv = deep.pointValue;
for (const [root, v] of [...pv.byRoot].sort()) {
  console.log(`        ${root} = ${fmtMoney(v.cents)} per point  (${v.samples} round trips${v.lowConfidence ? ', LOW CONFIDENCE' : ''})`);
}
for (const [root, why] of pv.quarantined) console.log(`        ${root} QUARANTINED: ${why}`);
check('MNQ derives to $2.00 per point', pv.byRoot.get('MNQ')?.cents, 200);
check('NQ derives to $20.00 per point', pv.byRoot.get('NQ')?.cents, 2000);
check('keyed by ROOT, so no contract month leaked in', [...pv.byRoot.keys()].some((k) => /[FGHJKMNQUVXZ]\d$/.test(k)), false);
check('nothing quarantined on a clean tape', pv.quarantined.size, 0);

// A median would silently absorb this. Agreement must reject it.
const poisoned = deep.roundTrips.map((r, i) => (i === 0 ? { ...r, grossCents: r.grossCents * 9 } : r));
const rootOf = new Map(deep.roundTrips.map((r) => [r.contract!, r.contract!.replace(/[FGHJKMNQUVXZ]\d$/, '')]));
const { byRoot: pByRoot, quarantined: pQuar } = derivePointValueCents(poisoned, rootOf);
check('one poisoned row QUARANTINES its root rather than being averaged away', pQuar.size > 0, true);
check('and it does not silently emit a wrong value for it', pByRoot.has([...pQuar.keys()][0] ?? ''), false);

console.log('\n=== 4. FIX: the trading day is the CME trade date, not a UTC calendar slice ===\n');
console.log(`        ${deep.meta.tradingDays.length} trading days: ${deep.meta.tradingDays.join(', ')}`);
// 17:00 America/Chicago is the roll. In July that is 22:00Z, so a fill at 22:30Z belongs to the
// NEXT trade date while a UTC slice would file it under the current one. This is the exact hour
// that used to be filed wrong, and it is a large share of a futures trader's evening.
check('22:30Z on Jul 16 files under trade date Jul 17', sessionDateFor(new Date('2026-07-16T22:30:00Z')), '2026-07-17');
check('21:30Z on Jul 16 (16:30 CT, before the roll) stays on Jul 16', sessionDateFor(new Date('2026-07-16T21:30:00Z')), '2026-07-16');
check('22:00Z exactly — the boundary itself — rolls forward', sessionDateFor(new Date('2026-07-16T22:00:00Z')), '2026-07-17');
// In January the same wall-clock hour is 23:00Z, because CST is UTC-6. A fixed offset would get
// one of these two wrong; a named IANA zone gets both right.
check('DST: 23:30Z on Jan 15 files under trade date Jan 16', sessionDateFor(new Date('2026-01-15T23:30:00Z')), '2026-01-16');
check('DST: 22:30Z on Jan 15 (16:30 CST) stays on Jan 15', sessionDateFor(new Date('2026-01-15T22:30:00Z')), '2026-01-15');

console.log('\n=== 5. FIX: a quote survives parse and render at instrument precision ===\n');
// The old scale was round(price x 100), which is why these two were silently identical.
check('6E 1.08500 and 1.08600 are DIFFERENT numbers', toMicros('1.08500') === toMicros('1.08600'), false);
check('6E 1.08500 round-trips through the formatter', fmtPrice(toMicros('1.08500')), '1.085');
check('6A 0.65430 keeps five decimals', fmtPrice(toMicros('0.65430')), '0.6543');
check('an index future still reads with two', fmtPrice(toMicros('19204.25')), '19204.25');
check('a whole number keeps two decimals', fmtPrice(toMicros('19204')), '19204.00');
check('MNQ prices in the real tape are unchanged by the new scale', fmtPrice(deep.roundTrips[0].entryPriceMicros).includes('.'), true);

console.log('\n=== 6. sessions total to the same money as the tape ===\n');
// A second grain computing the same money is a second chance to disagree with the broker. This
// is the assertion that stops the Trades page and the read ever telling different stories about
// the same day, which is the failure S5 and S7 would otherwise discover separately.
const sessSum = (k: 'grossCents' | 'feeCents' | 'netCents') => deep.sessions.reduce((s, x) => s + x[k], 0);
check('session gross sums to the tape gross', sessSum('grossCents'), deep.totals.grossCents);
check('session net sums to the tape net', sessSum('netCents'), deep.totals.netCents);
check('session round trips sum to the tape count', deep.sessions.reduce((s, x) => s + x.roundTrips, 0), deep.meta.roundTrips);
check('session contracts sum to the tape count', deep.sessions.reduce((s, x) => s + x.contracts, 0), deep.meta.contractsTraded);
check('one session row per trading day', deep.sessions.length, deep.meta.tradingDays.length);
// The figures three separate reads got wrong by deriving them. Now stated, so they are quotable.
const jul16 = deep.sessions.find((s) => s.sessionDate === '2026-07-16')!;
check('07-16 net is stated, not derived', fmtMoney(jul16.netCents), '-$2,538.84');
check('and its NQ round trips are stated as 56, not 55', jul16.byRoot.find((r) => r.root === 'NQ')?.roundTrips, 56);

console.log('\n=== 7. the tape resolves what a model must never infer ===\n');
check('every round trip has a direction', deep.roundTrips.every((r) => r.direction === 'long' || r.direction === 'short'), true);
check('every round trip has a stated outcome', deep.roundTrips.every((r) => !!r.outcome), true);
check('cancels are classified trader vs platform', deep.meta.traderCancels + deep.meta.ocoCancels, deep.meta.cancels);
check('positions are counted by code, not tallied by a reader', deep.meta.positions.total, deep.episodes.length);
console.log(`        ${deep.meta.fills} fills, ${deep.meta.roundTrips} round trips, ${deep.meta.orders} orders`);
console.log(`        ${deep.meta.positions.total} positions: ${deep.meta.positions.closedByStopFiring} closed by a stop firing, ${deep.meta.positions.noStopFound} with no stop found`);
console.log(`        cancels: ${deep.meta.traderCancels} trader, ${deep.meta.ocoCancels} platform auto-cancel`);

console.log(`\n${failures === 0 ? 'GATE PASSED' : `GATE FAILED — ${failures} assertion(s)`}\n`);
process.exit(failures === 0 ? 0 : 1);
