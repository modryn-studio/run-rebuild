/* THE ORDER THE TRADER PUT THINGS IN, and it is a PREFERENCE rather than a fact.
 *
 * WHY `localStorage` AND NOT A COLUMN. Which order someone likes their cards in says nothing about
 * their trading, and `event` is the log of what happened. Writing it to the corpus would put a
 * cosmetic choice in the same table as the fills it is arranged over. The cost is stated rather
 * than hidden: the order does not follow the trader to another browser, and the server's natural
 * order paints for one frame before the stored one lands. v2 made the same call and tracks the same
 * two costs as its own issue.
 *
 * TWO LISTS, AND THE ROW LIST IS FLAT. Group order is a handful of type keys. Row order is ONE list
 * of every account id in the roster, not a list per group — which is what makes it survive an
 * account changing type. Only an account's position among its OWN group's members is ever read, so
 * where the other groups' ids sit in the array is irrelevant: an evaluation that passes and becomes
 * sim-funded arrives in its new card already in the place the trader had put it, with nothing to
 * migrate.
 *
 * STORED ORDER FIRST, THEN EVERYTHING IT DOES NOT MENTION. That second half is what makes a saved
 * order survive the product changing under it: a trader who arranged their accounts last month and
 * has since opened another gets the new one appended rather than swallowed, and one that no longer
 * exists simply finds no match. The sort is STABLE, so the unmentioned keep their natural order.
 */

export const GROUP_ORDER_KEY = 'accounts.groupOrder';
export const ROW_ORDER_KEY = 'accounts.rowOrder';

/* ANYTHING COULD BE SITTING UNDER THESE KEYS — another tab, an older shape, a hand-edited value —
   and a bad read has to leave the natural order alone rather than throw inside an effect that runs
   on every page load. Storage itself can throw before `JSON.parse` ever runs (Safari private mode),
   so the whole body is guarded, not just the parse. */
export function readOrder(key: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return Array.isArray(parsed) && parsed.every((k) => typeof k === 'string')
      ? (parsed as string[])
      : null;
  } catch {
    return null;
  }
}

export function writeOrder(key: string, keys: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(keys));
  } catch {
    // Private mode or blocked storage. The reorder still holds for this session.
  }
}

/** Apply a stored order to a list, appending anything the order does not mention. */
export function byStoredOrder<T>(
  items: T[],
  order: string[] | null,
  keyOf: (item: T) => string
): T[] {
  if (!order) return items;
  const rank = new Map(order.map((k, i) => [k, i]));
  return [...items].sort(
    (a, b) => (rank.get(keyOf(a)) ?? Infinity) - (rank.get(keyOf(b)) ?? Infinity)
  );
}

/* ONE GROUP'S NEW ROW ORDER, MERGED BACK INTO THE FLAT LIST. The drag only ever reports the order
   of the group it happened in, so the ids of every OTHER group have to come through untouched —
   otherwise reordering inside Evaluation would silently drop the arrangement of Sim Funded.
   The moved ids are written back into the positions they already occupied, so nothing outside the
   group shifts. Ids not previously stored are appended, which is what makes the first drag on a
   fresh roster persist the whole group rather than just the two rows that swapped. */
export function mergeRowOrder(
  stored: string[] | null,
  groupIds: string[]
): string[] {
  const base = stored ?? [];
  const inGroup = new Set(groupIds);
  const slots: number[] = [];
  base.forEach((id, i) => {
    if (inGroup.has(id)) slots.push(i);
  });

  const next = [...base];
  // Fill the positions this group already held, in the group's new order.
  slots.forEach((slot, i) => {
    next[slot] = groupIds[i];
  });
  // Anything the stored list had never seen goes on the end, in order.
  for (const id of groupIds.slice(slots.length)) next.push(id);
  return next;
}
