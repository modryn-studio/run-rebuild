// Runs the desk call and reports what it cost. THIS ONE SPENDS MONEY.
//
//   npx tsx --env-file=.env.local --conditions=react-server scripts/s1-read.mts --small
//   npx tsx --env-file=.env.local --conditions=react-server scripts/s1-read.mts --deep
//
// `--small` is the 07-02 session (10 fills, 7 round trips) and exists to MEASURE, not to find
// anything: it replaces a token estimate with real numbers so the ten-day cost is arithmetic
// rather than a guess, and it proves the cache counters are non-zero rather than silently doing
// nothing, which is the documented failure mode.
//
// `--deep` is the ten-day tape and is the regression: does the ported pipeline still find the
// MNQ-to-NQ multiplier change that cleared the kill signal?
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const { parseTradovateFillsCsv } = await import('../src/lib/csv/fills');
const { parseTradovatePositionHistoryCsv } = await import('../src/lib/csv/position-history');
const { parseCashHistory } = await import('../src/lib/csv/cash-history');
const { parseTradovateOrdersCsv } = await import('../src/lib/csv/orders');
const { buildTapeFromParsed, fmtMoney } = await import('../src/lib/desk/tape');
const { renderTape } = await import('../src/lib/desk/render');
const { deskRead, costOf, DESK_MODEL, DESK_EFFORT } = await import('../src/lib/desk/read');
const { NATHAN_LENS, HOLLIS_LENS } = await import('../src/lib/desk/lenses');

const D = 'C:/Users/Luke/Downloads/';
const read = (f: string) => readFileSync(D + f).toString();
const small = process.argv.includes('--small');

// The 07-02 session is a genuinely separate export set, on a DIFFERENT account from the ten-day
// corpus. Using it rather than slicing one day out of the deep files keeps the small run a real
// end-to-end exercise of the parsers, not a filtered subset of an already-parsed tape.
const FILES = small
  ? { fills: 'Fills (1).csv', pos: 'Position History (1) 1.csv', cash: 'Cash History (1).csv', orders: 'Orders (1) 1.csv' }
  : { fills: 'Fills.csv', pos: 'Position History (9).csv', cash: 'Cash History.csv', orders: 'Orders (10).csv' };

const tape = buildTapeFromParsed({
  fills: parseTradovateFillsCsv(read(FILES.fills)),
  roundTrips: parseTradovatePositionHistoryCsv(read(FILES.pos)),
  fees: parseCashHistory(read(FILES.cash)).fees,
  orders: parseTradovateOrdersCsv(read(FILES.orders)),
});

const rendered = renderTape(tape, 'America/Chicago');
console.log(`tape: ${small ? 'SMALL (07-02)' : 'DEEP (ten days)'}`);
console.log(`  ${tape.meta.tradingDays.length} day(s), ${tape.meta.roundTrips} round trips, ${tape.meta.orders} orders`);
console.log(`  net ${fmtMoney(tape.totals.netCents)}, ${rendered.length} chars rendered, ${tape.verifiedNumbers.size} verified figures`);
console.log(`  model ${DESK_MODEL}, effort ${DESK_EFFORT}\n`);

const result = await deskRead(tape, [
  { name: 'Nathan', prompt: NATHAN_LENS },
  { name: 'Hollis', prompt: HOLLIS_LENS },
]);

const row = (label: string, u: { inputTokens: number | null; cacheReadTokens: number | null; cacheWriteTokens: number | null; outputTokens: number | null; ms: number }) =>
  `  ${label.padEnd(12)} in ${String(u.inputTokens ?? '?').padStart(7)}  cacheR ${String(u.cacheReadTokens ?? '?').padStart(7)}  ` +
  `cacheW ${String(u.cacheWriteTokens ?? '?').padStart(7)}  out ${String(u.outputTokens ?? '?').padStart(6)}  ` +
  `${(u.ms / 1000).toFixed(1)}s  $${costOf(u).toFixed(4)}`;

console.log('USAGE AND COST');
for (const l of result.lenses) console.log(row(l.name, l));
console.log(row('Synthesizer', result.synthesis));
console.log(`\n  TOTAL $${result.costUsd.toFixed(4)}   ${(result.totalMs / 1000).toFixed(1)}s\n`);

console.log('NUMBER CHECK');
console.log(`  ${result.numberCheck.checked} figures checked, ${result.numberCheck.unverified.length} unverified`);
if (result.numberCheck.unverified.length) console.log(`  ${result.numberCheck.unverified.join(', ')}`);

console.log('\n─────────────── THE READ ───────────────\n');
console.log(result.text);
console.log('\n────────────────────────────────────────\n');

// Kept, because a read is a thing the product SAID and the whole architecture rests on being able
// to check a past claim against the tape it was drawn from.
mkdirSync('runs', { recursive: true });
const stamp = `${small ? 'small' : 'deep'}-${result.totalMs}`;
writeFileSync(
  `runs/${stamp}.json`,
  JSON.stringify({ model: DESK_MODEL, effort: DESK_EFFORT, tape: FILES, result }, null, 2)
);
console.log(`saved runs/${stamp}.json`);
