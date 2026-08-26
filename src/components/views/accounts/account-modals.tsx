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
 */

import { createContext, useContext, useMemo, useState } from 'react';
import { AddAccountModal } from './add-account-modal';

type Openers = {
  add: () => void;
};

const AccountModals = createContext<Openers>({ add: () => {} });

export function useAddAccount() {
  return useContext(AccountModals).add;
}

export function AccountModalsProvider({
  children,
  connectedBrokers = 0,
}: {
  children: React.ReactNode;
  connectedBrokers?: number;
}) {
  const [adding, setAdding] = useState(false);
  const openers = useMemo<Openers>(() => ({ add: () => setAdding(true) }), []);

  /* THE ROSTER IS NEVER PATCHED LOCALLY. `/accounts` is a Server Component that re-reads the corpus,
     and `AddAccountModal` already calls `router.refresh()` itself when an import commits - so there
     is one source of truth for what the trader owns and this provider does not need a second. */
  return (
    <AccountModals.Provider value={openers}>
      {children}
      {adding && <AddAccountModal onClose={() => setAdding(false)} connected={connectedBrokers} />}
    </AccountModals.Provider>
  );
}
