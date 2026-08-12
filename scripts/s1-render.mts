// Prints the rendered tape — the exact text a lens is handed, and nothing else.
//
// No model call, no cost. Worth having as its own script: the tape is the input every claim in a
// read has to be traceable to, and it is the one artefact nobody looks at because it sits between
// two things that are more interesting. If a read is wrong, this is where the answer is.
//
// Run: npx tsx --env-file=.env.local --conditions=react-server scripts/s1-render.mts
import { readFileSync } from 'node:fs';

const { parseTradovateFillsCsv } = await import('../src/lib/csv/fills');
const { parseTradovatePositionHistoryCsv } = await import('../src/lib/csv/position-history');
const { parseCashHistory } = await import('../src/lib/csv/cash-history');
const { parseTradovateOrdersCsv } = await import('../src/lib/csv/orders');
const { buildTapeFromParsed } = await import('../src/lib/desk/tape');
const { renderTape } = await import('../src/lib/desk/render');

const D = 'C:/Users/Luke/Downloads/';
const read = (f: string) => readFileSync(D + f).toString();

const tape = buildTapeFromParsed({
  fills: parseTradovateFillsCsv(read('Fills.csv')),
  roundTrips: parseTradovatePositionHistoryCsv(read('Position History (9).csv')),
  fees: parseCashHistory(read('Cash History.csv')).fees,
  orders: parseTradovateOrdersCsv(read('Orders (10).csv')),
});

const text = renderTape(tape, 'America/Chicago');
console.log(text);
console.log(`\n[${text.length} chars, ${tape.verifiedNumbers.size} verified figures]`);
