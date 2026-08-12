import { readFileSync } from 'node:fs';
const { parseTradovateFillsCsv } = await import('../src/lib/csv/fills');
const { parseTradovatePositionHistoryCsv } = await import('../src/lib/csv/position-history');
const { parseCashHistory } = await import('../src/lib/csv/cash-history');
const { parseTradovateOrdersCsv } = await import('../src/lib/csv/orders');
const { buildTapeFromParsed, fmtMoney } = await import('../src/lib/desk/tape');
const D = 'C:/Users/Luke/Downloads/';
const r = (f: string) => readFileSync(D + f).toString();
const t = buildTapeFromParsed({
  fills: parseTradovateFillsCsv(r('Fills.csv')),
  roundTrips: parseTradovatePositionHistoryCsv(r('Position History (9).csv')),
  fees: parseCashHistory(r('Cash History.csv')).fees,
  orders: parseTradovateOrdersCsv(r('Orders (10).csv')),
});
const bad = new Set(['2026-07-13', '2026-07-16']);
const others = t.sessions.filter((s) => !bad.has(s.sessionDate));
console.log(`CLAIM  "the other eight days made about $3,300 between them"`);
console.log(`  days counted: ${others.length}`);
console.log(`  their NET:   ${fmtMoney(others.reduce((a, s) => a + s.netCents, 0))}`);
console.log(`  their GROSS: ${fmtMoney(others.reduce((a, s) => a + s.grossCents, 0))}`);
console.log(`  sum of only the POSITIVE days, net:   ${fmtMoney(others.filter(s=>s.netCents>0).reduce((a, s) => a + s.netCents, 0))}`);
console.log(`  sum of only the POSITIVE days, gross: ${fmtMoney(others.filter(s=>s.grossCents>0).reduce((a, s) => a + s.grossCents, 0))}`);
console.log(`\n  "8:38" in verifiedNumbers: ${t.verifiedNumbers.has('8:38')}   "08:38": ${t.verifiedNumbers.has('08:38')}`);
