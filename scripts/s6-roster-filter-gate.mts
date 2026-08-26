const {
  rosterOptions,
  rosterFacets,
  applyRosterFilter,
  readRosterFilter,
  activeCount,
  isNarrowed,
  firmTree,
  filterTree,
} = await import('../src/lib/accounts/roster-filter.ts');

let bad = 0;
const eq = (l: string, a: unknown, b: unknown) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) bad++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${l}`);
  if (!ok) console.log(`        want ${JSON.stringify(b)}\n        got  ${JSON.stringify(a)}`);
};

type Acct = { id: string; status: never; accountType: never; propFirm: string | null };

let n = 0;
/* `as never` on the two UNION columns only, never on the row. The gate deliberately feeds values
   the unions do not admit (see the junk-token cases), so the cast is what lets it test the RUNTIME
   guards - but casting the whole row to `never` would erase `id` and `propFirm` too, and then every
   assertion below reads a property off `never` instead of off an account. */
const A = (status: string, accountType: string | null, propFirm: string | null = null): Acct => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  status: status as never,
  accountType: accountType as never,
  propFirm,
});
const F = (o: Partial<{ accounts: string[]; status: string[]; types: string[] }> = {}) =>
  ({ accounts: [], status: [], types: [], ...o }) as never;

console.log('\n=== THE GATE: an axis with one answer is a statement, not a choice ===\n');
eq('one account -> no axis is offered at all',
  (() => { const o = rosterOptions([A('active', null)]); return [o.hasAccounts, o.hasStatus, o.hasTypes]; })(),
  [false, false, false]);
eq('two accounts, same status and type -> only the Accounts axis opens',
  (() => { const o = rosterOptions([A('active','evaluation'), A('active','evaluation')]); return [o.hasAccounts, o.hasStatus, o.hasTypes]; })(),
  [true, false, false]);
eq('two types -> type axis opens, status stays shut',
  (() => { const o = rosterOptions([A('active','evaluation'), A('active','personal')]); return [o.hasStatus, o.hasTypes]; })(), [false, true]);
eq('two statuses -> status axis opens',
  (() => { const o = rosterOptions([A('active','evaluation'), A('failed','evaluation')]); return [o.hasStatus, o.hasTypes]; })(), [true, false]);

console.log('\n=== OPTION VALUES ARE OFF THE UNFILTERED ROSTER, IN CANONICAL ORDER ===\n');
eq('canonical order, not first-seen',
  rosterOptions([A('failed','evaluation'), A('active','evaluation')]).status, ['active', 'failed']);
eq('a value nobody holds is not offered',
  rosterOptions([A('active','personal')]).types, ['personal']);
eq('a null type contributes no option',
  rosterOptions([A('active', null), A('active', null)]).types, []);

console.log('\n=== APPLY: empty passes everything, axes AND together ===\n');
const roster = [A('active','evaluation'), A('failed','evaluation'), A('active','personal')];
eq('nothing selected is the resting state', applyRosterFilter(roster, F()).length, 3);
eq('one axis narrows', applyRosterFilter(roster, F({ status: ['active'] })).length, 2);
eq('both axes AND', applyRosterFilter(roster, F({ status: ['active'], types: ['personal'] })).length, 1);
eq('an untyped account is dropped by a type filter',
  applyRosterFilter([A('active', null)], F({ types: ['personal'] })).length, 0);
eq('the accounts axis narrows to the picked ids',
  applyRosterFilter(roster, F({ accounts: [roster[1].id] })).map((a) => a.status), ['failed']);
eq('accounts AND the token axes',
  applyRosterFilter(roster, F({ accounts: [roster[1].id], status: ['active'] })).length, 0);

console.log('\n=== THE FACETS NARROW EACH OTHER, NEVER THEMSELVES ===\n');
/* The rule this exists to protect: pick Evaluation and the TYPE list must still offer Personal, or
   a second type can never be added. Everything else may narrow. */
eq('an axis is never narrowed by its own selection',
  [...rosterFacets(roster, F({ types: ['evaluation'] })).types.entries()].sort(),
  [['evaluation', 2], ['personal', 1]]);
eq('...but the OTHER axes are',
  [...rosterFacets(roster, F({ types: ['evaluation'] })).status.entries()].sort(),
  [['active', 1], ['failed', 1]]);
eq('a status pick greys the accounts that cannot answer it',
  (() => { const c = rosterFacets(roster, F({ status: ['failed'] })).accounts;
           return roster.map((a) => c.get(a.id) ?? 0); })(), [0, 1, 0]);
eq('nothing selected leaves every account live',
  (() => { const c = rosterFacets(roster, F()).accounts;
           return roster.map((a) => c.get(a.id) ?? 0); })(), [1, 1, 1]);
eq('a null type is counted by no type key',
  [...rosterFacets([A('active', null)], F()).types.entries()], []);

console.log('\n=== THE TREE ===\n');
const treed = [A('active','evaluation','Tradeify'), A('active','evaluation','Apex'), A('active', null, null)];
eq('grouped by firm, named firms sorted, unlabelled last',
  firmTree(treed).map((g) => g.firm), ['Apex', 'Tradeify', 'Unlabelled']);
eq('every account survives the grouping',
  firmTree(treed).reduce((t, g) => t + g.accounts.length, 0), 3);
eq('a firm-name hit keeps the whole group',
  filterTree(firmTree(treed), 'apex', () => 'zzz').map((g) => g.firm), ['Apex']);
eq('an account hit keeps only that account',
  filterTree(firmTree(treed), 'match', (a) => (a === treed[0] ? 'match me' : 'no')).map((g) => g.firm),
  ['Tradeify']);
eq('no match is an empty tree, not the whole one',
  filterTree(firmTree(treed), 'zzzz', () => 'no').length, 0);
eq('an empty query is the whole tree', filterTree(firmTree(treed), '   ', () => 'no').length, 3);

console.log('\n=== THE URL IS GUARDED ===\n');
eq('a junk token is dropped, not carried',
  readRosterFilter({ status: 'active,gold_plated', types: 'nonsense' }), { accounts: [], status: ['active'], types: [] });
eq('duplicates collapse', readRosterFilter({ status: 'active,active' }), { accounts: [], status: ['active'], types: [] });
eq('absent params are empty', readRosterFilter({}), { accounts: [], status: [], types: [] });
/* A NON-UUID NEVER REACHES A QUERY. `/trades` met a live 500 from exactly this - an unguarded id
   against a `uuid` column - and its filter carries the same check with the same note. */
eq('a non-uuid account id is dropped',
  readRosterFilter({ accounts: 'not-an-id,../../etc' }).accounts, []);
eq('a real uuid survives',
  readRosterFilter({ accounts: '11111111-2222-4333-8444-555555555555' }).accounts,
  ['11111111-2222-4333-8444-555555555555']);
eq('the dot counts AXES, not ticks', activeCount(F({ status: ['active','failed'] })), 1);
eq('...and three axes count three',
  activeCount(F({ accounts: ['x'], status: ['active'], types: ['personal'] })), 3);
eq('the band Clear hides at rest', isNarrowed(F()), false);
eq('...and shows on any one axis', isNarrowed(F({ accounts: ['x'] })), true);

console.log(bad === 0 ? '\nROSTER FILTER GATE PASSED\n' : `\nFAILED (${bad})\n`);
process.exit(bad === 0 ? 0 : 1);
