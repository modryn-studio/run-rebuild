const { byStoredOrder, mergeRowOrder } = await import('../src/lib/accounts/order.ts');

let bad = 0;
const eq = (l: string, a: unknown, b: unknown) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) bad++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${l}`);
  if (!ok) console.log(`        want ${JSON.stringify(b)}\n        got  ${JSON.stringify(a)}`);
};

const id = (s: string) => s;

console.log('\n=== STORED ORDER FIRST, THEN WHATEVER IT DOES NOT MENTION ===\n');
eq('no stored order leaves the natural one alone',
  byStoredOrder(['a', 'b', 'c'], null, id), ['a', 'b', 'c']);
eq('a stored order is applied', byStoredOrder(['a', 'b', 'c'], ['c', 'a', 'b'], id), ['c', 'a', 'b']);
/* THE CASE THAT MAKES A SAVED ORDER SURVIVE THE PRODUCT CHANGING UNDER IT. A trader who arranged
   their roster last month and has since opened an account must get the new one APPENDED, never
   swallowed or silently promoted to the top. */
eq('an item the order never saw is appended, not swallowed',
  byStoredOrder(['a', 'b', 'new'], ['b', 'a'], id), ['b', 'a', 'new']);
eq('two unknown items keep their natural order between them',
  byStoredOrder(['x', 'a', 'y'], ['a'], id), ['a', 'x', 'y']);
eq('an order naming something gone is simply not matched',
  byStoredOrder(['a', 'b'], ['deleted', 'b', 'a'], id), ['b', 'a']);
eq('the input array is not mutated',
  (() => { const src = ['a', 'b', 'c']; byStoredOrder(src, ['c', 'b', 'a'], id); return src; })(),
  ['a', 'b', 'c']);

console.log('\n=== ONE GROUP REORDERS WITHOUT DISTURBING ANY OTHER ===\n');
/* The flat row list interleaves groups. Reordering inside one must write back into the positions
   that group already held and leave every other id exactly where it was. */
const stored = ['e1', 's1', 'e2', 's2', 'e3'];
eq('the moved group takes its own slots back, in its new order',
  mergeRowOrder(stored, ['e3', 'e1', 'e2']), ['e3', 's1', 'e1', 's2', 'e2']);
eq('...and the other group is untouched at its own indices',
  mergeRowOrder(stored, ['e3', 'e1', 'e2']).filter((k) => k.startsWith('s')), ['s1', 's2']);
eq('a no-op reorder is a no-op', mergeRowOrder(stored, ['e1', 'e2', 'e3']), stored);

console.log('\n=== THE FIRST DRAG ON A ROSTER THAT HAS NEVER BEEN ARRANGED ===\n');
/* Nothing stored yet: the whole group has to land, not just the pair that swapped, or the next
   read would re-sort the group back to natural order and the drag would look like it was lost. */
eq('no stored list means the group is written whole',
  mergeRowOrder(null, ['b', 'a', 'c']), ['b', 'a', 'c']);
eq('ids the stored list has never seen are appended in order',
  mergeRowOrder(['a'], ['a', 'b', 'c']), ['a', 'b', 'c']);
eq('a partially-known group keeps the known slots and appends the rest',
  mergeRowOrder(['x', 'b', 'y', 'a'], ['a', 'b', 'new']), ['x', 'a', 'y', 'b', 'new']);

console.log('\n=== AN ACCOUNT THAT CHANGES TYPE NEEDS NO MIGRATION ===\n');
/* The row list is flat precisely so this works: only an account's position among its OWN group's
   members is read, so an evaluation that passes and becomes sim-funded arrives in its new card in
   the place the trader had already put it. */
const flat = mergeRowOrder(['e1', 'e2', 'e3', 's1'], ['e3', 'e1', 'e2']);
eq('the id keeps its rank in the flat list after the group is re-sorted',
  byStoredOrder(['e1', 'e3'], flat, id), ['e3', 'e1']);
eq('...and reads correctly from its NEW group too',
  byStoredOrder(['s1', 'e3'], flat, id), ['e3', 's1']);

console.log(bad === 0 ? '\nORDER GATE PASSED\n' : `\nFAILED (${bad})\n`);
process.exit(bad === 0 ? 0 : 1);
