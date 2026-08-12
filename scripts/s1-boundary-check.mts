// Does THIS corpus actually exercise the session-boundary fix?
//
// The bug was real, but a fix nothing exercises is a fix nobody has seen work. If no fill in the
// ten days lands at or after 17:00 America/Chicago, then the UTC-calendar bucketing and the CME
// trade date agree on every row here — the old code was wrong and produced the right answer
// anyway, and the gate's boundary assertions are synthetic by necessity.
//
// Worth knowing before three model runs are read as evidence that the fix works.
import { readFileSync } from 'node:fs';
const { parseTradovateFillsCsv } = await import('../src/lib/csv/fills');
const { sessionDateFor } = await import('../src/lib/time/session');

const fills = parseTradovateFillsCsv(readFileSync('C:/Users/Luke/Downloads/Fills.csv').toString());

const hourCT = (d: Date) =>
  Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: '2-digit', hour12: false }).format(d)) % 24;

const afterRoll = fills.filter((f) => hourCT(f.filledAt) >= 17);
const disagree = fills.filter((f) => sessionDateFor(f.filledAt) !== f.filledAt.toISOString().slice(0, 10));

const hours = [...new Set(fills.map((f) => hourCT(f.filledAt)))].sort((a, b) => a - b);
console.log(`fills: ${fills.length}`);
console.log(`hours traded (America/Chicago): ${hours.join(', ')}`);
console.log(`fills at or after the 17:00 CT roll: ${afterRoll.length}`);
console.log(`fills where the CME trade date DIFFERS from the UTC calendar date: ${disagree.length}`);
console.log(
  disagree.length === 0
    ? '\n=> This corpus does NOT exercise the boundary fix. Old and new bucketing agree on every row.\n   The fix is still correct; its evidence here is the synthetic assertions in s1-gate.mts.'
    : `\n=> ${disagree.length} fills change trade date under the fix.`
);
