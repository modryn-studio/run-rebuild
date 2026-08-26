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
 * ─── FIVE AXES, AND TWO OF THEM BELONG TO THE ACCOUNT ──────────────────────────────────────────
 *
 * STATUS and TYPE are properties of the ACCOUNT rather than of the tape, so they are read off the
 * account and COUNTED IN ACCOUNTS, not trades — "Failed 3" means three accounts, and counting the
 * trades on them would answer a question nobody asked. v2 does exactly this, through the same
 * `AccountMeta` indirection.
 *
 * THIS FILE PREDICTED ITS OWN CHANGE. It used to say both axes were "absent rather than stubbed"
 * because no surface had labelled those columns, "and with them goes v2's `AccountMeta`
 * indirection... The shape returns when those columns do." `S6` labelled them; the shape is back.
 * (2026-08-26.)
 */

import type { ResultToken } from './filter';
import type { AccountStatus, AccountType } from '@/lib/db/schema';

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
  status: AccountStatus[];
  types: AccountType[];
};

export type Axis = keyof FacetSelection;

/* WHAT AN ACCOUNT IS, asked one id at a time. A lookup rather than a table so the caller keeps
   owning the roster it already holds, and this file keeps importing nothing that touches the
   database. Returning `null` for an unknown id is deliberate: a `FacetRow` can name an account the
   panel was not given (a trade on an account since deleted), and that row must fall out of a status
   narrowing rather than throw. */
export type AccountMeta = {
  status: (id: string) => AccountStatus | null;
  type: (id: string) => AccountType | null;
};

const NO_META: AccountMeta = { status: () => null, type: () => null };

/* Rows surviving every selection EXCEPT `except`. That argument is the whole rule in one parameter,
   and leaving it out is the bug this file exists to prevent. */
function surviving(
  rows: FacetRow[],
  sel: FacetSelection,
  except: Axis,
  meta: AccountMeta
): FacetRow[] {
  const accounts = new Set(except === 'accounts' ? [] : sel.accounts);
  const products = new Set(except === 'products' ? [] : sel.products);
  const results = except === 'results' ? [] : sel.results;
  const status = except === 'status' ? [] : sel.status;
  const types = except === 'types' ? [] : sel.types;

  return rows.filter((r) => {
    if (accounts.size && !accounts.has(r.accountId)) return false;
    if (products.size && !products.has(r.product)) return false;
    if (status.length) {
      const v = meta.status(r.accountId);
      if (!v || !status.includes(v)) return false;
    }
    /* AN ACCOUNT WITH NO STATED TYPE IS MATCHED BY NO TYPE TOKEN, which is the same rule
       `applyRosterFilter` keeps. "Unlabelled" is an absence, not a fourth type. */
    if (types.length) {
      const v = meta.type(r.accountId);
      if (!v || !types.includes(v)) return false;
    }
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
  keyOf: (r: FacetRow) => string,
  meta: AccountMeta
): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of surviving(rows, sel, axis, meta)) {
    const k = keyOf(r);
    out.set(k, (out.get(k) ?? 0) + tally([r], sel.results));
  }
  return out;
}

/* AN ACCOUNT AXIS COUNTS ACCOUNTS, NOT TRADES, and that is why it cannot reuse `countBy`. "Failed
   3" means three accounts; summing their trades would put a four-figure number beside a word that
   describes an account. Distinct account ids, because one account contributes many `FacetRow`s. */
function countAccountsBy(
  rows: FacetRow[],
  sel: FacetSelection,
  axis: Axis,
  keyOf: (id: string) => string | null,
  meta: AccountMeta
): Map<string, number> {
  const seen = new Map<string, Set<string>>();
  for (const r of surviving(rows, sel, axis, meta)) {
    const k = keyOf(r.accountId);
    if (k === null) continue;
    if (!seen.has(k)) seen.set(k, new Set());
    seen.get(k)!.add(r.accountId);
  }
  return new Map([...seen].map(([k, ids]) => [k, ids.size]));
}

/** Every axis's counts, keyed by axis. */
export function facetCounts(rows: FacetRow[], sel: FacetSelection, meta: AccountMeta = NO_META) {
  return {
    accounts: countBy(rows, sel, 'accounts', (r) => r.accountId, meta),
    products: countBy(rows, sel, 'products', (r) => r.product, meta),
    status: countAccountsBy(rows, sel, 'status', (id) => meta.status(id), meta),
    types: countAccountsBy(rows, sel, 'types', (id) => meta.type(id), meta),
    /* Results are two numbers rather than a keyed map, and they are counted against everything
       except themselves — so "Wins 41" stays 41 while Wins is ticked instead of becoming the
       total. */
    results: (() => {
      const live = surviving(rows, sel, 'results', meta);
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
