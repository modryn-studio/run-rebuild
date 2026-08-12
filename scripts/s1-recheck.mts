// Re-score both stored runs against the fixed whitelist. Free — no model call. Answers the only
// question that matters about a flag list: how many were the model, and how many were the ruler?
import { readFileSync, readdirSync } from 'node:fs';
const { parseTradovateFillsCsv } = await import('../src/lib/csv/fills');
const { parseTradovatePositionHistoryCsv } = await import('../src/lib/csv/position-history');
const { parseCashHistory } = await import('../src/lib/csv/cash-history');
const { parseTradovateOrdersCsv } = await import('../src/lib/csv/orders');
const { buildTapeFromParsed } = await import('../src/lib/desk/tape');
const { checkNumbers } = await import('../src/lib/desk/read');
const D = 'C:/Users/Luke/Downloads/';
const r = (f: string) => readFileSync(D + f).toString();
const tape = buildTapeFromParsed({
  fills: parseTradovateFillsCsv(r('Fills.csv')),
  roundTrips: parseTradovatePositionHistoryCsv(r('Position History (9).csv')),
  fees: parseCashHistory(r('Cash History.csv')).fees,
  orders: parseTradovateOrdersCsv(r('Orders (10).csv')),
});
for (const f of readdirSync('runs').filter((x) => x.startsWith('deep-full') || x.startsWith('deep-trim'))) {
  const d = JSON.parse(readFileSync(`runs/${f}`, 'utf-8'));
  const before = d.result.numberCheck.unverified;
  const after = checkNumbers(d.result.text, tape).unverified;
  console.log(`${d.arm.toUpperCase().padEnd(8)} before: ${before.length} [${before.join(', ')}]`);
  console.log(`${''.padEnd(8)} after:  ${after.length} [${after.join(', ')}]`);
}
