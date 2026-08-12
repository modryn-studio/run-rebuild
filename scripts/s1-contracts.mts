// Is 883 a real figure, and where does it come from? Free.
import { readFileSync } from 'node:fs';
const { parseTradovateFillsCsv } = await import('../src/lib/csv/fills');
const { parseTradovatePositionHistoryCsv } = await import('../src/lib/csv/position-history');
const { parseCashHistory } = await import('../src/lib/csv/cash-history');
const { parseTradovateOrdersCsv } = await import('../src/lib/csv/orders');
const { buildTapeFromParsed, fmtMoney } = await import('../src/lib/desk/tape');
const { renderTape } = await import('../src/lib/desk/render');

const D = 'C:/Users/Luke/Downloads/';
const r = (f: string) => readFileSync(D + f).toString();
const tape = buildTapeFromParsed({
  fills: parseTradovateFillsCsv(r('Fills.csv')),
  roundTrips: parseTradovatePositionHistoryCsv(r('Position History (9).csv')),
  fees: parseCashHistory(r('Cash History.csv')).fees,
  orders: parseTradovateOrdersCsv(r('Orders (10).csv')),
});

const contracts = tape.roundTrips.reduce((s, t) => s + t.qty, 0);
const text = renderTape(tape);
console.log(`contracts round-tripped (sum of qty): ${contracts}`);
console.log(`fees ${fmtMoney(tape.totals.feeCents)} / ${fmtMoney(tape.totals.feePerContractCents)} per contract = ${(Math.abs(tape.totals.feeCents) / tape.totals.feePerContractCents).toFixed(1)}`);
console.log(`"883" as a standalone token in the render: ${/(^|\s)883(\s|$)/m.test(text)}`);
console.log(`in verifiedNumbers: ${tape.verifiedNumbers.has('883')}`);
