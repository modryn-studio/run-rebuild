// Did the model INVENT those timestamps, or is the checker blind to them?
//
// The small run flagged 08:25:21, 08:32 and 08:37 as unverified. Those are two different
// findings with opposite consequences — a fabricated figure is the cardinal sin, a checker gap
// is housekeeping — and the flag list alone cannot tell them apart. That ambiguity is exactly
// what the number check's own record warns about: of 100 flags across 15 runs, zero were
// fabrications and nearly all were the instrument measuring itself.
//
// Free. No model call.
import { readFileSync } from 'node:fs';

const { parseTradovateFillsCsv } = await import('../src/lib/csv/fills');
const { parseTradovatePositionHistoryCsv } = await import('../src/lib/csv/position-history');
const { parseCashHistory } = await import('../src/lib/csv/cash-history');
const { parseTradovateOrdersCsv } = await import('../src/lib/csv/orders');
const { buildTapeFromParsed } = await import('../src/lib/desk/tape');
const { renderTape } = await import('../src/lib/desk/render');

const D = 'C:/Users/Luke/Downloads/';
const r = (f: string) => readFileSync(D + f).toString();

const tape = buildTapeFromParsed({
  fills: parseTradovateFillsCsv(r('Fills (1).csv')),
  roundTrips: parseTradovatePositionHistoryCsv(r('Position History (1) 1.csv')),
  fees: parseCashHistory(r('Cash History (1).csv')).fees,
  orders: parseTradovateOrdersCsv(r('Orders (1) 1.csv')),
});
const text = renderTape(tape, 'America/Chicago');

for (const tok of process.argv.slice(2).length ? process.argv.slice(2) : ['08:25:21', '08:32', '08:37']) {
  const inTape = text.includes(tok);
  console.log(
    `${tok.padEnd(10)} in rendered tape: ${String(inTape).padEnd(5)}  in verifiedNumbers: ${tape.verifiedNumbers.has(tok)}` +
      `   => ${inTape ? 'CHECKER GAP (the figure is real, the whitelist cannot see it)' : 'NOT IN THE TAPE — investigate'}`
  );
}
