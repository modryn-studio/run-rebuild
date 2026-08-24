/* SMART FILTER FACETS: which options each axis should offer, given what the other axes hold.
 * Ported from `run-trading@v2`'s `lib/facets.ts` (2026-08-19, S5c).
 *
 * THE PROBLEM, in Luke's words (v2, 2026-08-05): *"im just trying to avoid selecting an account and
 * then asking myself 'what products did i trade in this account?' ... right now it shows all
 * products traded across all accounts all the time. then if i select a product that i didnt trade in
 * that filtered account, the page says 'No trades match this filter'. so im always guessing."*
 *
 * ─── THE ONE RULE ──────────────────────────────────────────────────────────────────────────────
 *
 * An axis's options are computed against every OTHER axis's selection, and never against its own.
 *
 * The obvious version — narrow every list by the whole filter — breaks in two clicks: pick ES, and
 * the product list now contains only ES, so MNQ can never be added. Excluding an axis from its own
 * narrowing is what keeps every axis fully re-selectable while still honouring the rest. It also
 * fixes the counts: ES reads its real count while ES is selected, because ES is not counted against
 * itself.
 *
 * ─── WHY ONE DENORMALISED TABLE ────────────────────────────────────────────────────────────────
 *
 * Every question the panel asks — which products for these accounts, how many winners across this
 * selection — is a projection of the same fact:
 *
 *     (account, product) -> wins, losses
 *
 * Ship that once and every option list falls out by intersection, with no query per tick. At launch
 * scale (20 accounts x ~10 products) it is 200 rows, a few KB, against the ~13 KB of trade ids the
 * page already sends.
 *
 * ─── WHY IT HAS TO BE CLIENT-SIDE ──────────────────────────────────────────────────────────────
 *
 * The panel stages a DRAFT and commits on Apply. Options that only re-narrowed after Apply would be
 * useless — the guessing described above happens WHILE ticking. So this file is pure, imports
 * nothing that touches the database, and runs in the browser on every tick.
 *
 * The date window and the search box are correctly excluded: they narrow the TAPE, not the roster,
 * and are applied on Apply rather than per tick. The rows are built within whatever window is
 * already applied, so the lists narrow inside it.
 *
 * ─── THREE AXES HERE, NOT v2's FIVE ────────────────────────────────────────────────────────────
 *
 * v2 also carries STATUS and PHASE, which are properties of the ACCOUNT rather than of the tape —
 * so it reads them off the roster and counts them in ACCOUNTS, not trades. Neither column is
 * labelled on any surface in this build yet, so both axes are absent rather than stubbed, and with
 * them goes v2's `AccountMeta` indirection: with no account-level axis left, nothing here needs to
 * ask the roster anything. The shape returns when those columns do.
 */

import type { ResultToken } from './filter';

/** One (account, product) pair and what it holds. The whole input to every narrowing below. */
export type FacetRow = {
  accountId: string;
  /** The product ROOT, e.g. `MNQ` — never a contract month. */
  product: string;
  wins: number;
  losses: number;
};

/** What the trader has ticked. Account ids are full ids, never abbreviations. */
export type FacetSelection = {
  accounts: string[];
  products: string[];
  results: ResultToken[];
};

export type Axis = keyof FacetSelection;

/* Rows surviving every selection EXCEPT `except`. That argument is the whole rule in one parameter,
   and leaving it out is the bug this file exists to prevent. */
function surviving(rows: FacetRow[], sel: FacetSelection, except: Axis): FacetRow[] {
  const accounts = new Set(except === 'accounts' ? [] : sel.accounts);
  const products = new Set(except === 'products' ? [] : sel.products);
  const results = except === 'results' ? [] : sel.results;

  return rows.filter((r) => {
    if (accounts.size && !accounts.has(r.accountId)) return false;
    if (products.size && !products.has(r.product)) return false;
    /* A RESULT SELECTION DROPS ROWS THAT CANNOT ANSWER IT. Filtered to Wins, an (account, product)
       pair with no winners contributes nothing, so the account and product it names stop being
       offered — which is exactly right, and is the case that turns "no trades match this filter"
       into an option that was never there to press. Both ticked means every row qualifies, matching
       this codebase's reading of a complete group elsewhere. */
    if (results.length === 1) {
      if ((results[0] === 'win' ? r.wins : r.losses) === 0) return false;
    }
    return true;
  });
}

/** How many trades a set of rows holds, under the result selection in force. */
function tally(rows: FacetRow[], results: ResultToken[]): number {
  const wins = results.length !== 1 || results[0] === 'win';
  const losses = results.length !== 1 || results[0] === 'loss';
  let n = 0;
  for (const r of rows) n += (wins ? r.wins : 0) + (losses ? r.losses : 0);
  return n;
}

/** A count per key for one axis, already narrowed by every OTHER axis. Zero is a real answer and is
 *  returned as one: the caller decides whether to hide the option or grey it. */
function countBy(
  rows: FacetRow[],
  sel: FacetSelection,
  axis: Axis,
  keyOf: (r: FacetRow) => string
): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of surviving(rows, sel, axis)) {
    const k = keyOf(r);
    out.set(k, (out.get(k) ?? 0) + tally([r], sel.results));
  }
  return out;
}

/** Every axis's counts, keyed by axis. */
export function facetCounts(rows: FacetRow[], sel: FacetSelection) {
  return {
    accounts: countBy(rows, sel, 'accounts', (r) => r.accountId),
    products: countBy(rows, sel, 'products', (r) => r.product),
    /* Results are two numbers rather than a keyed map, and they are counted against everything
       except themselves — so "Wins 41" stays 41 while Wins is ticked instead of becoming the
       total. */
    results: (() => {
      const live = surviving(rows, sel, 'results');
      let wins = 0;
      let losses = 0;
      for (const r of live) {
        wins += r.wins;
        losses += r.losses;
      }
      return new Map<string, number>([
        ['win', wins],
        ['loss', losses],
      ]);
    })(),
  };
}
