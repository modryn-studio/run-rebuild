/* The chart's arithmetic, asserted. Pure functions, no database — runnable with plain tsx. */
const {
  cumulate, sumSeries, windowChange, lastMovementDay, bucketize, windowStart, grainFor,
} = await import('../src/lib/accounts/series.ts');

let bad = 0;
const eq = (label: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) bad++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}\n        got      ${JSON.stringify(actual)}`);
};

console.log('\n=== 1. CUMULATE OPENS AT ZERO, THE DAY BEFORE ===\n');
const c = cumulate([{ day: '2026-03-02', cents: 100 }, { day: '2026-03-04', cents: -30 }]);
eq('anchors at zero on the day before the first move', c[0], { day: '2026-03-01', cents: 0 });
eq('accumulates', c.map((p) => p.cents), [0, 100, 70]);
eq('an empty input is an empty line, not an anchor', cumulate([]), []);
eq('unsorted input still cumulates in date order',
  cumulate([{ day: '2026-03-04', cents: -30 }, { day: '2026-03-02', cents: 100 }]).map((p) => p.cents),
  [0, 100, 70]);

console.log('\n=== 2. SUMSERIES MERGES GRIDS THAT DO NOT MATCH ===\n');
const a = cumulate([{ day: '2026-03-02', cents: 100 }]);
const b = cumulate([{ day: '2026-03-05', cents: 50 }]);
const merged = sumSeries([a, b]);
eq('every day either series moved appears once', merged.map((p) => p.day),
  ['2026-03-01', '2026-03-02', '2026-03-04', '2026-03-05']);
eq('a series that has not started yet contributes zero, not its future value',
  merged.find((p) => p.day === '2026-03-02')!.cents, 100);
eq('a series that has finished carries its last value forward',
  merged[merged.length - 1].cents, 150);
eq('one series passes through untouched', sumSeries([a]), a);
eq('no series is an empty line', sumSeries([[], []]), []);

console.log('\n=== 3. WINDOWCHANGE IS A CHANGE, NOT A TOTAL ===\n');
const line = cumulate([
  { day: '2026-01-10', cents: 1000 }, { day: '2026-02-10', cents: 500 }, { day: '2026-03-10', cents: -200 },
]);
eq('all time is the final level', windowChange(line, null), { change: 1300, base: 0 });
eq('a window starts from the level before it', windowChange(line, '2026-02-01'), { change: 300, base: 1000 });
eq('a window after every point changed nothing', windowChange(line, '2026-09-01'), { change: 0, base: 1300 });
eq('an empty line has no change', windowChange([], '2026-01-01'), { change: 0, base: 0 });

console.log('\n=== 4. MOVEMENT, NOT PRESENCE ===\n');
eq('a flat line never moved', lastMovementDay(cumulate([{ day: '2026-03-02', cents: 0 }])), null);
eq('finds the last day the level changed', lastMovementDay(line), '2026-03-10');
eq('an empty line has no movement', lastMovementDay([]), null);

console.log('\n=== 5. BUCKETIZE DIFFERENCES, THEN GROUPS ===\n');
const week = bucketize(line, 'month');
eq('one bucket per month that moved', week.map((d) => d.day), ['2026-01-01', '2026-02-01', '2026-03-01']);
eq('a bucket holds what it EARNED, not the level it ended at', week.map((d) => d.cents), [1000, 500, -200]);
const daily = bucketize(cumulate([{ day: '2026-03-02', cents: 100 }, { day: '2026-03-03', cents: 100 }]), 'week');
eq('two days in one week collapse into one bucket', daily.length, 1);
eq('...carrying their sum', daily[0].cents, 200);
eq('a line with no movement has no buckets', bucketize([], 'day'), []);

console.log('\n=== 6. THE WINDOW ANCHORS ON THE SUBJECT, NOT ON TODAY ===\n');
eq('all time has no start', windowStart('all', '2026-03-10'), null);
eq('ytd is January 1st of the subject\u2019s own year', windowStart('ytd', '2026-03-10'), '2026-01-01');
eq('1w is seven days inclusive', windowStart('1w', '2026-03-10'), '2026-03-04');
eq('1m steps a calendar month', windowStart('1m', '2026-03-10'), '2026-02-10');
eq('3m steps three', windowStart('3m', '2026-03-10'), '2025-12-10');
eq('1y steps twelve', windowStart('1y', '2026-03-10'), '2025-03-10');
eq('a closed account gets ITS last month, not this one', windowStart('1m', '2025-03-31'), '2025-02-28');

console.log('\n=== 7. GRAIN FALLS OUT OF THE RANGE ===\n');
eq('a week is drawn daily', grainFor('1w', 7), 'day');
eq('three months is weekly', grainFor('3m', 90), 'week');
eq('a year is monthly', grainFor('1y', 365), 'month');
eq('all time over two years is monthly', grainFor('all', 900), 'month');
eq('all time over a short corpus stays daily', grainFor('all', 60), 'day');

console.log(bad === 0 ? '\nS6c SERIES GATE PASSED\n' : `\nS6c SERIES GATE FAILED (${bad})\n`);
process.exit(bad === 0 ? 0 : 1);
