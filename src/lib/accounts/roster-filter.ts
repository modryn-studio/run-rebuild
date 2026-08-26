/* WHAT NARROWS THE ROSTER, and it is the URL that holds it.
 *
 * THE SAME CONTRACT `/trades` KEEPS: the filter lives in the query string, is parsed here with a
 * guard per axis, and is applied on the SERVER before anything renders — so the chart, the roster
 * and the summary rail all receive one narrowed set and cannot disagree about what "your accounts"
 * means. `run-trading@v2` states the rule and this follows it.
 *
 * THREE AXES, MATCHING v2's PANEL: Accounts, Status, Type (v2 calls the third one Phase and stores
 * it as `phase`; this build's column is `account_type` and the label follows the column). An
 * earlier pass here shipped two of the three and argued the account tree was `S6f`'s problem — but
 * the tree IS the axis a roster is filtered by, it is v2's DEFAULT axis, and `prop-firms.ts`'
 * `UNLABELLED_FIRM` already carried a comment naming "the filter panel's tree" as its reason to
 * exist. It was missing, not deferred.
 *
 * NOTHING SELECTED MEANS EVERYTHING, which is what makes the resting state the empty case rather
 * than an edge case — v2 shipped the inverse first, opening its panel with all 33 boxes ticked, and
 * unticking the last one then ticked every box back on.
 */

import type { AccountStatus, AccountType } from '@/lib/db/schema';
import { ACCOUNT_STATUSES, ACCOUNT_TYPES } from '@/lib/db/schema';
import { UNLABELLED_FIRM } from '@/lib/prop-firms';

export type RosterFilter = {
  /** Full account ids. Empty means every account the trader owns. */
  accounts: string[];
  status: AccountStatus[];
  types: AccountType[];
};

export const EMPTY_ROSTER_FILTER: RosterFilter = { accounts: [], status: [], types: [] };

/** The label a status wears on a row and in the panel. `closed` reads differently by type — a
 *  personal account was never in an evaluation to fail — but the STORED value is one word, so the
 *  panel filters the stored value and the row renders the label. */
export const STATUS_LABELS: Record<AccountStatus, string> = {
  active: 'Active',
  passed: 'Passed',
  failed: 'Failed',
  closed: 'Closed',
};

export const TYPE_LABELS: Record<AccountType, string> = {
  evaluation: 'Evaluation',
  sim_funded: 'Sim Funded',
  personal: 'Personal',
};

/* A COMMA LIST, GUARDED PER AXIS. An unknown token is dropped rather than carried: the URL is
   attacker-supplied and a value that reaches a `WHERE ... IN` unchecked is how `/trades` produced a
   raw 500 from a hand-edited address. */
function readTokens<T extends string>(raw: string | undefined, allowed: readonly T[]): T[] {
  if (!raw) return [];
  const ok = new Set<string>(allowed);
  return [...new Set(raw.split(',').map((s) => s.trim()))].filter((s): s is T => ok.has(s));
}

/* AN ACCOUNT ID IS A UUID OR IT IS NOT AN ACCOUNT ID. `/trades`' own filter carries this check with
   a postcheck note recording the live 500 it prevents: `account.id` is a `uuid` column, so an
   unguarded `?accounts=x` makes Postgres answer "invalid input syntax for type uuid" and the
   Server Component throw onto Next's bare error screen. This axis narrows in memory rather than in
   SQL, so it cannot produce that exact failure — the guard is here anyway, because the difference
   between the two paths is one refactor wide and the note would not travel with it. */
const isUuid = (v: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export function readRosterFilter(params: {
  accounts?: string;
  status?: string;
  types?: string;
}): RosterFilter {
  return {
    accounts: params.accounts
      ? [...new Set(params.accounts.split(',').map((s) => s.trim()))].filter(isUuid)
      : [],
    status: readTokens(params.status, ACCOUNT_STATUSES),
    types: readTokens(params.types, ACCOUNT_TYPES),
  };
}

/** How many axes are narrowing. The dot on the trigger is a DOT, not a count of ticks — it answers
 *  "is anything applied", which is one question however many boxes are ticked. The account list
 *  counts as ONE however many are picked, because it answers one question. */
export function activeCount(f: RosterFilter): number {
  return (
    (f.accounts.length > 0 ? 1 : 0) + (f.status.length > 0 ? 1 : 0) + (f.types.length > 0 ? 1 : 0)
  );
}

/** Whether anything is narrowed at all — what the band's Clear renders on. */
export const isNarrowed = (f: RosterFilter): boolean => activeCount(f) > 0;

/** The shape every function below reads. `RosterAccount` satisfies it; so does anything else that
 *  can answer the three questions, which is what keeps this module free of a server import. */
export type FilterableAccount = {
  id: string;
  status: AccountStatus;
  accountType: AccountType | null;
};

/** AND across the axes, each empty axis passing everything. */
export function applyRosterFilter<T extends FilterableAccount>(
  accounts: T[],
  f: RosterFilter
): T[] {
  const picked = new Set(f.accounts);
  return accounts.filter((a) => {
    if (picked.size > 0 && !picked.has(a.id)) return false;
    if (f.status.length > 0 && !f.status.includes(a.status)) return false;
    if (f.types.length > 0 && !(a.accountType && f.types.includes(a.accountType))) return false;
    return true;
  });
}

/* ─── WHAT THE PANEL MAY OFFER ──────────────────────────────────────────────────────────────────
 *
 * The option VALUES, counted off the UNFILTERED roster, plus the gate per axis. An axis with one
 * distinct value is a statement, not a choice, and a control that cannot change anything is
 * furniture. v2 states this rule and then implements the gate in its view rather than here, so its
 * own comment is a lie about its own function — this puts the gate where the options are made.
 *
 * ACCOUNTS GATES AT TWO AS WELL. With one account, "all" and "that one" select the same roster, so
 * the axis cannot narrow anything. This is the one place `/trades` deliberately differs: its
 * Accounts axis shows at ONE account because its header's `AccountSelect` names an account the
 * panel would otherwise have no row for. This page has no such selector, so nothing breaks by
 * dropping it and a rail row that cannot change the page is worse than an absent one.
 */
export function rosterOptions<T extends FilterableAccount>(accounts: T[]) {
  const present = <K extends string>(vals: readonly K[], pick: (a: T) => K | null) => {
    const seen = new Set<K>();
    for (const a of accounts) {
      const v = pick(a);
      if (v !== null) seen.add(v);
    }
    return vals.filter((v) => seen.has(v));
  };

  const status = present(ACCOUNT_STATUSES, (a) => a.status);
  const types = present(ACCOUNT_TYPES, (a) => a.accountType);
  return {
    status,
    types,
    /** The axis is only worth a control when the roster holds more than one answer to it. */
    hasStatus: status.length > 1,
    hasTypes: types.length > 1,
    hasAccounts: accounts.length > 1,
  };
}

/* ─── THE FACETS NARROW EACH OTHER ──────────────────────────────────────────────────────────────
 *
 * Ported from `lib/trades/facets.ts`, which was itself ported from v2's `lib/facets.ts`, and it is
 * the same one rule: an axis's options are computed against every OTHER axis's selection, and never
 * against its own. The obvious version — narrow every list by the whole filter — breaks in two
 * clicks: pick Evaluation, and the Type list now contains only Evaluation, so Personal can never be
 * added.
 *
 * WHAT IT BUYS ON A ROSTER is one direction and it is the useful one: tick Status = Failed and the
 * account tree greys everything that did not fail. Narrowing Status by a ticked account is close to
 * pointless — one account has one status — but it costs nothing and comes free with the rule.
 *
 * COUNTS ARE ACCOUNTS, NOT TRADES. This panel filters a ROSTER, so an account with no fills is
 * still an account worth filtering to. That is the opposite of `/trades`, which filters TRADES and
 * where an account with nothing in range has nothing to offer.
 *
 * IT RUNS ON EVERY TICK, in the browser, against the DRAFT — options that only re-narrowed after
 * Apply would arrive after the guessing is over.
 */
type Axis = 'accounts' | 'status' | 'types';

function surviving<T extends FilterableAccount>(
  rows: T[],
  sel: RosterFilter,
  except: Axis
): T[] {
  return applyRosterFilter(rows, {
    accounts: except === 'accounts' ? [] : sel.accounts,
    status: except === 'status' ? [] : sel.status,
    types: except === 'types' ? [] : sel.types,
  });
}

/** Every axis's counts, keyed by axis. Zero is a real answer and is returned as one: the caller
 *  decides whether to hide the option or grey it. */
export function rosterFacets<T extends FilterableAccount>(rows: T[], sel: RosterFilter) {
  const countBy = (axis: Axis, keyOf: (a: T) => string | null) => {
    const out = new Map<string, number>();
    for (const a of surviving(rows, sel, axis)) {
      const k = keyOf(a);
      if (k !== null) out.set(k, (out.get(k) ?? 0) + 1);
    }
    return out;
  };

  return {
    accounts: countBy('accounts', (a) => a.id),
    status: countBy('status', (a) => a.status),
    types: countBy('types', (a) => a.accountType),
  };
}

/* ─── THE TREE ──────────────────────────────────────────────────────────────────────────────────
 *
 * Accounts grouped under their firm, which is the whole structure of the panel's centre column. A
 * firm with no stated name groups under `UNLABELLED_FIRM` and sorts last — the honest heading is
 * the absence rather than a guess, the same call the roster's own "Not yet labelled" group makes.
 */
export type FirmGroup<T> = { firm: string; accounts: T[] };

export function firmTree<T extends { propFirm: string | null }>(accounts: T[]): FirmGroup<T>[] {
  const by = new Map<string, T[]>();
  for (const a of accounts) {
    const key = a.propFirm ?? '';
    by.set(key, [...(by.get(key) ?? []), a]);
  }
  const named = [...by.entries()]
    .filter(([firm]) => firm)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([firm, rows]) => ({ firm, accounts: rows }));
  const rest = by.get('');
  return rest ? [...named, { firm: UNLABELLED_FIRM, accounts: rest }] : named;
}

/** Search matches the FIRM or the account, and a firm hit keeps all of its accounts — typing "apex"
 *  should show the Apex group whole rather than an empty heading. Matching runs over the same string
 *  the row renders, so what you type is what you see. */
export function filterTree<T>(
  tree: FirmGroup<T>[],
  query: string,
  label: (a: T) => string
): FirmGroup<T>[] {
  const q = query.trim().toLowerCase();
  if (!q) return tree;
  return tree
    .map((g) =>
      g.firm.toLowerCase().includes(q)
        ? g
        : { ...g, accounts: g.accounts.filter((a) => label(a).toLowerCase().includes(q)) }
    )
    .filter((g) => g.accounts.length > 0);
}
