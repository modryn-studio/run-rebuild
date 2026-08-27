'use client';

/* THE ACCOUNTS MODALS, AND THE ONE PLACE THAT OPENS THEM.
 *
 * WHY A PROVIDER AND NOT LOCAL STATE, straight from `run-trading@v2` and true here for the same
 * reason: the controls that open these sit in unrelated subtrees. The header cluster is PORTALLED
 * out of the page into the shell's band (`header-slot.tsx`), the empty-roster call to action is
 * inside a card, and every roster row is inside a collapsible group. Their nearest common ancestor
 * is the page, and the page is a Server Component that cannot hold state.
 *
 * The alternative - a modal per control - puts one copy per roster row on the page, each with its
 * own request in flight. Once is enough.
 *
 * ONE OPENER TODAY, TWO WHEN THERE IS SOMEWHERE TO PUT THE SECOND. v2 exposes `add()` and
 * `importTrades(accountId)`, and the distinction is real: `add` asks WHICH ACCOUNT TO CREATE, while
 * `importTrades` brings fills into an account that already exists - "a question with no meaning
 * when the trader is standing on one". That second opener is what makes v2's adoption path
 * trustworthy, because an import launched from a specific account's own page carries the context
 * that the file belongs to it rather than inferring it.
 *
 * It is deliberately NOT declared here yet. There is no per-account page to launch it from until
 * `S6d`, and an opener nothing can call is the same mistake as an inert button: it teaches the next
 * reader that this API has a working path it does not have. It arrives with its call site.
 *
 * `label(account)` ARRIVED WITH ITS OWN CALL SITE (`S6d` C3, 2026-08-27) - the detail page's Edit
 * button - which is the same rule stated the other way round. It is the first opener here that
 * carries an argument, because unlike `add` it is about a row that already exists.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AddAccountModal } from './add-account-modal';
import { LabelAccountModal } from './label-account-modal';
import type { RosterAccount } from '@/lib/accounts/read';

type Openers = {
  add: () => void;
  label: (account: RosterAccount) => void;
};

const AccountModals = createContext<Openers>({ add: () => {}, label: () => {} });

export function useAddAccount() {
  return useContext(AccountModals).add;
}

/** Opens the label editor on one account. See `LabelAccountForm`. */
export function useLabelAccount() {
  return useContext(AccountModals).label;
}

export function AccountModalsProvider({
  children,
  connectedBrokers = 0,
  siblingsFor,
}: {
  children: React.ReactNode;
  connectedBrokers?: number;
  /* HOW MANY OTHER ACCOUNTS SHARE AN ACCOUNT'S LOGIN PREFIX, asked of the caller rather than
     computed here, because only the caller knows what it holds. `/accounts/details` knows one
     account and gets the number from the server as a single integer; the roster page holds every
     account and can answer from memory. v2 solved this by shipping the WHOLE ROSTER to the client
     so the provider could count it - correct, and a lot of rows to move for one integer.
     Absent means "I know of no siblings", and the form correctly does not offer the switch. */
  siblingsFor?: (account: RosterAccount) => number;
}) {
  const [adding, setAdding] = useState(false);
  const [labelling, setLabelling] = useState<RosterAccount | null>(null);

  const label = useCallback((a: RosterAccount) => setLabelling(a), []);
  const openers = useMemo<Openers>(() => ({ add: () => setAdding(true), label }), [label]);

  const siblingCount = labelling && siblingsFor ? siblingsFor(labelling) : 0;

  /* THE ROSTER IS NEVER PATCHED LOCALLY. `/accounts` is a Server Component that re-reads the corpus,
     and `AddAccountModal` already calls `router.refresh()` itself when an import commits - so there
     is one source of truth for what the trader owns and this provider does not need a second. */
  return (
    <AccountModals.Provider value={openers}>
      {children}
      {adding && <AddAccountModal onClose={() => setAdding(false)} connected={connectedBrokers} />}
      {labelling && (
        <LabelAccountModal
          account={labelling}
          siblingCount={siblingCount}
          onClose={() => setLabelling(null)}
        />
      )}
    </AccountModals.Provider>
  );
}
