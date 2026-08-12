// Is "$922 at 11:10" a derived-and-true figure, or a fabrication?
//
// My first reconstruction (cumulative NET, ordered by exit) gave $597.40 at 09:43. That is one
// reading of the claim and not necessarily the model's. Before calling a figure invented — the
// cardinal sin in this architecture — every reasonable basis has to be tried, because a check
// that is merely DIFFERENT from the model's arithmetic proves nothing about the model.
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

const day = tape.roundTrips.filter((t) => t.exitAt && sessionDateFor(t.exitAt) === '2026-07-16');
const tz = tape.displayTimezone;

for (const [label, basis, order] of [
  ['NET, by exit', 'net', 'exit'],
  ['GROSS, by exit', 'gross', 'exit'],
  ['NET, by entry', 'net', 'entry'],
  ['GROSS, by entry', 'gross', 'entry'],
] as const) {
  const rows = [...day].sort((a, b) => {
    const k = order === 'exit' ? 'exitAt' : 'entryAt';
    return (a[k]?.getTime() ?? 0) - (b[k]?.getTime() ?? 0);
  });
  let run = 0;
  let peak = { c: -Infinity, at: '' };
  for (const t of rows) {
    run += basis === 'net' ? (t.netCents ?? 0) : t.grossCents;
    if (run > peak.c) peak = { c: run, at: displayClock((order === 'exit' ? t.exitAt : t.entryAt)!, tz) };
  }
  console.log(`  ${label.padEnd(16)} peak ${fmtMoney(peak.c).padStart(10)} at ${peak.at}   final ${fmtMoney(run)}`);
}

// And the read's other unwhitelisted count: "55 round trips in a bit over two hours" on NQ.
const nq = day.filter((t) => (t.contract ?? '').startsWith('NQ'));
const mnq = day.filter((t) => (t.contract ?? '').startsWith('MNQ'));
console.log(`\n  07-16: ${day.length} round trips total — ${mnq.length} MNQ, ${nq.length} NQ`);
if (nq.length) {
  const times = nq.map((t) => t.entryAt!).sort((a, b) => a.getTime() - b.getTime());
  console.log(`  NQ window: ${displayClock(times[0], tz)} to ${displayClock(times[times.length - 1], tz)}`);
  console.log(`  NQ net: ${fmtMoney(nq.reduce((s, t) => s + (t.netCents ?? 0), 0))}`);
}
