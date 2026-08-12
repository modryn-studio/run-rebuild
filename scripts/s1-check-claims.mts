// Verify the two figures the number check flagged on the deep run. Free.
//
// A PASS with a fabricated figure is not a pass. The whitelist says these two were not asserted
// verbatim by the tape, which means either the model DERIVED them (true, computed) or INVENTED
// them (class 1, the cardinal sin). Only arithmetic against the tape can tell those apart.
//
//   "That day cost $2,538.84 net, about two-thirds of the entire ten-day loss."
//   "You were up $922 at 11:10."
import { readFileSync } from 'node:fs';

const { parseTradovateFillsCsv } = await import('../src/lib/csv/fills');
const { parseTradovatePositionHistoryCsv } = await import('../src/lib/csv/position-history');
const { parseCashHistory } = await import('../src/lib/csv/cash-history');
const { parseTradovateOrdersCsv } = await import('../src/lib/csv/orders');
const { buildTapeFromParsed, fmtMoney } = await import('../src/lib/desk/tape');
const { sessionDateFor, displayClock } = await import('../src/lib/time/session');

const D = 'C:/Users/Luke/Downloads/';
const r = (f: string) => readFileSync(D + f).toString();
const tape = buildTapeFromParsed({
  fills: parseTradovateFillsCsv(r('Fills.csv')),
  roundTrips: parseTradovatePositionHistoryCsv(r('Position History (9).csv')),
  fees: parseCashHistory(r('Cash History.csv')).fees,
  orders: parseTradovateOrdersCsv(r('Orders (10).csv')),
});

// Claim 1: 07-16's net, and its share of the ten-day loss.
const byDay = new Map<string, number>();
for (const t of tape.roundTrips) {
  if (!t.exitAt || t.netCents === null) continue;
  const d = sessionDateFor(t.exitAt);
  byDay.set(d, (byDay.get(d) ?? 0) + t.netCents);
}
const jul16 = byDay.get('2026-07-16') ?? 0;
console.log(`CLAIM  "that day cost $2,538.84 net"`);
console.log(`  2026-07-16 net, summed from round trips: ${fmtMoney(jul16)}`);
console.log(`  share of the ten-day net (${fmtMoney(tape.totals.netCents)}): ${((jul16 / tape.totals.netCents) * 100).toFixed(1)}%\n`);

// Claim 2: the intraday peak on 07-16. The tape never states a running total, so this is a
// cumulative sum the model would have had to carry itself across 55 round trips.
const day = tape.roundTrips
  .filter((t) => t.exitAt && sessionDateFor(t.exitAt) === '2026-07-16' && t.netCents !== null)
  .sort((a, b) => a.exitAt!.getTime() - b.exitAt!.getTime());
let running = 0;
let peak = { cents: -Infinity, at: '' };
for (const t of day) {
  running += t.netCents!;
  if (running > peak.cents) peak = { cents: running, at: displayClock(t.exitAt!, tape.displayTimezone) };
}
console.log(`CLAIM  "you were up $922 at 11:10"`);
console.log(`  ${day.length} round trips on 07-16`);
console.log(`  peak running net: ${fmtMoney(peak.cents)} at ${peak.at}`);
console.log(`  final: ${fmtMoney(running)}`);
