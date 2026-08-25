/* WHAT ONE TRADE IS CALLED, in the one place both sides of the boundary can reach.
 *
 * IT LIVES IN A PLAIN MODULE BECAUSE IT IS CALLED FROM A SERVER COMPONENT, and it briefly did not:
 * exported from `trade-sheet.tsx`, which carries `'use client'`, the route's `generateMetadata` got
 *
 *   Attempted to call tradeTitle() from the server but tradeTitle is on the client.
 *
 * CLAUDE.md states the rule this broke - "Every export of a `'use client'` module becomes a client
 * reference" - and `src/lib/shell.ts` exists for the same reason. A function shared across the
 * boundary needs a file with no directive on it; re-exporting from one that has one does not
 * launder it.
 *
 * `import type` FOR `TapeRow` KEEPS THIS SAFE. `read.ts` is db-backed, so a value import here would
 * drag the database into every client bundle that renders a trade. Types are erased at compile.
 */

import { productName } from '@/lib/instruments';
import type { TapeRow } from '@/lib/trades/read';

/** The contract's product name, falling back to the raw contract when the root is not seeded.
 *  Never the symbol root alone where a name exists: "Micro Nasdaq-100" is what the trader chose,
 *  "MNQ" is how the exchange spells it. */
export function tradeTitle(t: TapeRow): string {
  const contract = t.contract ?? t.symbolRoot;
  return productName(contract) ?? contract;
}
