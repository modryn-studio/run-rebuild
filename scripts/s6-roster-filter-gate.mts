const { rosterOptions, applyRosterFilter, readRosterFilter, activeCount } = await import(
  '../src/lib/accounts/roster-filter.ts'
);
let bad = 0;
const eq = (l: string, a: unknown, b: unknown) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) bad++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${l}`);
  if (!ok) console.log(`        want ${JSON.stringify(b)}\n        got  ${JSON.stringify(a)}`);
};
const A = (status: string, accountType: string | null) => ({ status, accountType }) as never;

console.log('\n=== THE GATE: an axis with one answer is a statement, not a choice ===\n');
eq('one account, no type -> neither axis offered',
  (() => { const o = rosterOptions([A('active', null)]); return [o.hasStatus, o.hasTypes]; })(), [false, false]);
eq('two accounts, same status and type -> still neither',
  (() => { const o = rosterOptions([A('active','evaluation'), A('active','evaluation')]); return [o.hasStatus, o.hasTypes]; })(), [false, false]);
eq('two types -> type axis opens, status stays shut',
  (() => { const o = rosterOptions([A('active','evaluation'), A('active','personal')]); return [o.hasStatus, o.hasTypes]; })(), [false, true]);
eq('two statuses -> status axis opens',
  (() => { const o = rosterOptions([A('active','evaluation'), A('failed','evaluation')]); return [o.hasStatus, o.hasTypes]; })(), [true, false]);

console.log('\n=== COUNTS ARE OFF THE UNFILTERED ROSTER, IN CANONICAL ORDER ===\n');
eq('counted per value',
  rosterOptions([A('active','evaluation'), A('failed','evaluation'), A('failed','personal')]).status,
  [{ value: 'active', count: 1 }, { value: 'failed', count: 2 }]);
eq('a value nobody holds is not offered',
  rosterOptions([A('active','personal')]).types, [{ value: 'personal', count: 1 }]);

console.log('\n=== APPLY: empty passes everything, axes AND together ===\n');
const roster = [A('active','evaluation'), A('failed','evaluation'), A('active','personal')];
eq('nothing selected is the resting state', applyRosterFilter(roster, { status: [], types: [] }).length, 3);
eq('one axis narrows', applyRosterFilter(roster, { status: ['active'], types: [] }).length, 2);
eq('both axes AND', applyRosterFilter(roster, { status: ['active'], types: ['personal'] }).length, 1);
eq('an untyped account is dropped by a type filter',
  applyRosterFilter([A('active', null)], { status: [], types: ['personal'] }).length, 0);

console.log('\n=== THE URL IS GUARDED ===\n');
eq('a junk token is dropped, not carried',
  readRosterFilter({ status: 'active,gold_plated', types: 'nonsense' }), { status: ['active'], types: [] });
eq('duplicates collapse', readRosterFilter({ status: 'active,active' }), { status: ['active'], types: [] });
eq('absent params are empty', readRosterFilter({}), { status: [], types: [] });
eq('the dot counts AXES, not ticks', activeCount({ status: ['active','failed'], types: [] }), 1);
eq('...and both axes count two', activeCount({ status: ['active'], types: ['personal'] }), 2);

console.log(bad === 0 ? '\nROSTER FILTER GATE PASSED\n' : `\nFAILED (${bad})\n`);
process.exit(bad === 0 ? 0 : 1);
