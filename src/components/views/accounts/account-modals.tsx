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
 * `importTrades(accountId)` ARRIVED 2026-08-28 WITH ITS CALL SITE, which is the rule this comment
 * was stating: an opener nothing can call is the same mistake as an inert button. `S6d` built the
 * per-account page, `D5` built the hand-add flow that creates `pending:` rows, and this is the
 * opener that lets one meet its own fills.
 *
 * `label(account)` ARRIVED WITH ITS OWN CALL SITE (`S6d` C3, 2026-08-27) - the detail page's Edit
 * button - which is the same rule stated the other way round. It is the first opener here that
 * carries an argument, because unlike `add` it is about a row that already exists.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AddAccountModal } from './add-account-modal';
import { LabelAccountModal } from './label-account-modal';
import { ImportTradesModal } from './import-trades-modal';
import type { RosterAccount } from '@/lib/accounts/read';

type Openers = {
  add: () => void;
  label: (account: RosterAccount) => void;
  /* IMPORT INTO ONE ACCOUNT, as distinct from `add`. See `import-trades-modal.tsx`: `add` asks
     which account to create, which is a question with no meaning when the trader is standing on
     one. */
  importTrades: (accountId: string) => void;
  /* HOW MANY OTHER ACCOUNTS SHARE THIS ONE'S LOGIN PREFIX. On the context because the phone's
     actions sheet hosts the edit flow itself (`account-actions-sheet.tsx`) rather than going
     through `label()`, so it needs the same integer this provider already computes for
     `LabelAccountModal`. Zero when the caller supplied no counter, which the form reads as "I know
     of no siblings" and correctly does not offer the switch. */
  siblings: (account: RosterAccount) => number;
};

const AccountModals = createContext<Openers>({
  add: () => {},
  label: () => {},
  importTrades: () => {},
  siblings: () => 0,
});

export function useAddAccount() {
  return useContext(AccountModals).add;
}

/** Opens the label editor on one account. See `LabelAccountForm`. */
export function useLabelAccount() {
  return useContext(AccountModals).label;
}

/** Opens the upload step already scoped to one account. See `ImportTradesModal`. */
export function useImportTrades() {
  return useContext(AccountModals).importTrades;
}

/** The sibling count for one account, for a caller hosting the edit flow itself. */
export function useAccountSiblings() {
  return useContext(AccountModals).siblings;
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

  const [importingInto, setImportingInto] = useState<string | null>(null);

  const label = useCallback((a: RosterAccount) => setLabelling(a), []);
  const importTrades = useCallback((id: string) => setImportingInto(id), []);
  const siblings = useCallback(
    (a: RosterAccount) => (siblingsFor ? siblingsFor(a) : 0),
    [siblingsFor]
  );
  const openers = useMemo<Openers>(
    () => ({ add: () => setAdding(true), label, importTrades, siblings }),
    [label, importTrades, siblings]
  );

  const siblingCount = labelling && siblingsFor ? siblingsFor(labelling) : 0;

  /* THE ROSTER IS NEVER PATCHED LOCALLY. `/accounts` is a Server Component that re-reads the corpus,
     and `AddAccountModal` already calls `router.refresh()` itself when an import commits - so there
     is one source of truth for what the trader owns and this provider does not need a second. */
  return (
    <AccountModals.Provider value={openers}>
      {children}
      {adding && <AddAccountModal onClose={() => setAdding(false)} connected={connectedBrokers} />}
      {importingInto && (
        <ImportTradesModal accountId={importingInto} onClose={() => setImportingInto(null)} />
      )}
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
