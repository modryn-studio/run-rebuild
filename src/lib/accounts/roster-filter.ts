/* WHAT NARROWS THE ROSTER, and it is the URL that holds it.
 *
 * THE SAME CONTRACT `/trades` KEEPS: the filter lives in the query string, is parsed here with a
 * guard per axis, and is applied on the SERVER before anything renders — so the chart, the roster
 * and the summary rail all receive one narrowed set and cannot disagree about what "your accounts"
 * means. `run-trading@v2` states the rule and this follows it.
 *
 * TWO AXES, NOT THREE. v2 offers Status, Phase and Accounts. The account list is the one this build
 * deliberately drops for now: v2 needed it because a copy-trader's roster runs to 33 rows, and it
 * carried a whole searchable firm tree plus 8-character id prefixes in the URL to stay addressable.
 * That is `S6f`'s problem. Status and Type are the two that change what a number MEANS, and they
 * are answerable from the roster the page already read.
 *
 * NOTHING SELECTED MEANS EVERYTHING, which is what makes the resting state the empty case rather
 * than an edge case — v2 shipped the inverse first, opening its panel with all 33 boxes ticked, and
 * unticking the last one then ticked every box back on.
 */

import type { AccountStatus, AccountType } from '@/lib/db/schema';
import { ACCOUNT_STATUSES, ACCOUNT_TYPES } from '@/lib/db/schema';

export type RosterFilter = {
  status: AccountStatus[];
  types: AccountType[];
};

export const EMPTY_ROSTER_FILTER: RosterFilter = { status: [], types: [] };

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

export function readRosterFilter(params: {
  status?: string;
  types?: string;
}): RosterFilter {
  return {
    status: readTokens(params.status, ACCOUNT_STATUSES),
    types: readTokens(params.types, ACCOUNT_TYPES),
  };
}

/** How many axes are narrowing. The dot on the trigger is a DOT, not a count of ticks — it answers
 *  "is anything applied", which is one question however many boxes are ticked. */
export function activeCount(f: RosterFilter): number {
  return (f.status.length > 0 ? 1 : 0) + (f.types.length > 0 ? 1 : 0);
}

/** AND across the axes, each empty axis passing everything. */
export function applyRosterFilter<
  T extends { status: AccountStatus; accountType: AccountType | null },
>(accounts: T[], f: RosterFilter): T[] {
  return accounts.filter((a) => {
    if (f.status.length > 0 && !f.status.includes(a.status)) return false;
    if (f.types.length > 0 && !(a.accountType && f.types.includes(a.accountType))) return false;
    return true;
  });
}

/* WHAT THE PANEL MAY OFFER, counted off the UNFILTERED roster.
 *
 * NOTHING IS OFFERED UNLESS THE ROSTER CAN ANSWER IT, and the gate is TWO OR MORE: an axis with one
 * distinct value is a statement, not a choice, and a control that cannot change anything is
 * furniture. v2 states this rule and then implements the gate in its view rather than here, so its
 * own comment is a lie about its own function — this puts the gate where the options are made. */
export function rosterOptions<
  T extends { status: AccountStatus; accountType: AccountType | null },
>(accounts: T[]) {
  const count = <K extends string>(vals: readonly K[], pick: (a: T) => K | null) => {
    const n = new Map<K, number>();
    for (const a of accounts) {
      const v = pick(a);
      if (v !== null) n.set(v, (n.get(v) ?? 0) + 1);
    }
    return vals.filter((v) => n.has(v)).map((v) => ({ value: v, count: n.get(v)! }));
  };

  const status = count(ACCOUNT_STATUSES, (a) => a.status);
  const types = count(ACCOUNT_TYPES, (a) => a.accountType);
  return {
    status,
    types,
    /** The axis is only worth a control when the roster holds more than one answer to it. */
    hasStatus: status.length > 1,
    hasTypes: types.length > 1,
  };
}
