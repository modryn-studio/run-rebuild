'use client';

/* ⚠️ THE MINIMUM /accounts THAT MAKES `S4e` TESTABLE, AND NOTHING MORE.
 *
 * THE REAL ACCOUNTS PAGE IS `S6`, and this is not a draft of it. That slice is a hero metric
 * selector, groups by state carrying their own totals, a freshness stamp on every row, `CLOSED` as a
 * permanent group, and a summary rail (`build-plan.md`, `wireframes.md` §1). None of that is here,
 * on purpose.
 *
 * WHY IT EXISTS AT ALL. `S4e`'s whole flow is a modal opened from this page's Add account button, so
 * the slice cannot be exercised or closed without somewhere to put that button. What this page does
 * is exactly two things: open the modal, and list what the corpus actually holds so an import can be
 * seen to have landed. A roster row here is a bare fact, not a designed object.
 *
 * SO `S6` REPLACES THIS BODY RATHER THAN EXTENDING IT. The list below is deliberately not built as
 * a component worth reusing — no sparkline, no per-row total, no grouping — because a half-designed
 * roster that gets extended is how a page ends up with two ideas of what a row is. The header and
 * the modal wiring are the parts meant to survive.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { HeaderSlot, HeaderControl } from '@/components/shell/header-slot';
import { useModalClose } from '@/components/views/accounts/modal-shell';
import { AddAccountModal } from '@/components/views/accounts/add-account-modal';
import { accountRowTitle, ACCOUNT_TYPE_LABELS, type AccountTypeKey } from '@/lib/prop-firms';

export interface RosterAccount {
  id: string;
  externalAccountId: string;
  displayName: string | null;
  propFirm: string | null;
  accountType: string | null;
  sizeDollars: number | null;
  /** Round trips currently filed under this account. The proof an import landed. */
  trades: number;
}

export function AccountsView({ accounts, connected }: { accounts: RosterAccount[]; connected: number }) {
  const [open, setOpen] = useState(false);
  const { closing, requestClose } = useModalClose(() => setOpen(false));

  return (
    <>
      {/* NO TITLE HERE ANY MORE. The shell prints "Accounts" from the route, so a heading on the
          page would print it twice — which is what the second header band did before `S5c` moved
          the controls up into the shell's own. Only the action travels. */}
      <HeaderSlot>
        <HeaderControl onClick={() => setOpen(true)}>
          <Icon name="add" size={15} />
          Add account
        </HeaderControl>
      </HeaderSlot>

      {accounts.length === 0 ? (
        /* THE EMPTY STATE NAMES THE NEXT ACTION IN THE TRADER'S OWN WORDS (P9), never "no data".
           It is also the first screen a new trader sees, so it says what the product wants from
           them rather than describing its own emptiness. */
        <div className="border-border rounded-[var(--radius)] border border-dashed px-6 py-14 text-center">
          <p className="text-body-lg text-text">Upload your Tradovate exports to get started.</p>
          <p className="text-body text-muted mx-auto mt-2 max-w-sm">
            Fills, Position History, Cash History and Orders. They are all in the same Reports tab.
          </p>
          <Button size="sm" className="mt-6" onClick={() => setOpen(true)}>
            Add account
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="border-border bg-surface flex items-center gap-3 rounded-[var(--radius)] border px-4 py-3"
            >
              <span className="min-w-0 flex-1">
                <span className="text-body-lg text-text block truncate font-medium">
                  {accountRowTitle(a)}
                </span>
                {/* AN UNLABELLED ACCOUNT SAYS SO rather than showing a blank, and it is a normal
                    state: the import creates the row before anyone has said what kind it is, and
                    phase cannot be derived from the files at all. The labelling step is what fills
                    this in, and it is a separate slice. */}
                <span className="text-body text-muted block">
                  {a.accountType
                    ? ACCOUNT_TYPE_LABELS[a.accountType as AccountTypeKey]
                    : 'Not labelled yet'}
                </span>
              </span>
              <span className="text-body text-muted shrink-0 tabular-nums">
                {a.trades.toLocaleString()} {a.trades === 1 ? 'trade' : 'trades'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {open && <AddAccountModal onClose={requestClose} closing={closing} connected={connected} />}
    </>
  );
}
