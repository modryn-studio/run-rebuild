'use client';

/* THE ROSTER'S CONTROL CLUSTER, portalled into the shell's own header band.
 *
 * ONE ACTION, AND IT IS THE ONLY THING WEARING THE ACCENT. `run-trading@v2`: "a roster page has
 * exactly one action that changes what is on it, and it should be the only thing on the screen
 * wearing the accent." Everything else this page can do is on a row.
 *
 * NO REFRESH BUTTON, AND THAT IS A DELIBERATE OMISSION RATHER THAN A GAP. v2 ships one and it is
 * INERT - there is no broker socket to re-read from, tracked there as #57 - and v2's own header
 * comment names the cost: "It was a placeholder for weeks, which is worse than absent: an inert
 * control standing beside two working ones teaches that buttons in this app might not do anything."
 * It arrives with the connection that gives it something to do. Dropping it also removes the reason
 * for v2's phone overflow menu, whose only item was Refresh.
 *
 * FILTERS IS THE SAME OBJECT `/trades` PUTS IN THIS BAND - `HeaderControl` trigger, `usePopover`
 * state, `Head`/`Row`/`Chip`/`PanelFooter` panel - rather than a lookalike. It renders itself away
 * when the roster cannot answer any of its three axes.
 *
 * CLEAR COMES FIRST AND ONLY WHEN IT DOES SOMETHING, matching `/trades`' band exactly. v2 carries
 * the same control on this page (`RosterClear`) and this build had missed it: a filter you have to
 * reopen a panel to undo is a filter you forget you left on, and the roster's narrowing is the one
 * that removes ROWS without naming what it removed.
 */

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { HeaderSlot } from '@/components/shell/header-slot';
import { useAddAccount } from './account-modals';
import { RosterFilters, RosterClear } from './roster-filters';
import type { RosterFilter } from '@/lib/accounts/roster-filter';
import type { RosterAccount } from '@/lib/accounts/read';

export function AccountsHeader({
  filter,
  accounts,
}: {
  filter: RosterFilter;
  /** The UNFILTERED roster — the panel's tree must offer what the filter is currently hiding. */
  accounts: RosterAccount[];
}) {
  const add = useAddAccount();

  return (
    <HeaderSlot slot="controls">
      {/* Clear, then Filters, then the CTA - the order every header in this app uses and v2's too:
          the undo, then chrome, then the one thing wearing the accent. */}
      <RosterClear applied={filter} />
      <RosterFilters applied={filter} accounts={accounts} />
      {/* The label goes below `sm` and the mark carries it, but `aria-label` is UNCONDITIONAL -
          a control whose name disappears at one width is nameless to a screen reader at that
          width. */}
      {/* `size="md"` (h-9), NOT `sm` (h-8), and the header is what decides it. Every other control
          in this band is 36px tall - `HeaderControl` on `/trades` (Search, Date, Filters), every
          `IconButton` including Notifications, and v2's own Add account. At `sm` this button sat
          4px short of the row it lives in, which reads as a slightly sunken CTA rather than as a
          deliberate size. One band, one control height. */}
      <Button size="md" aria-label="Add account" onClick={add}>
        <Icon name="add" size={16} />
        <span className="max-sm:hidden">Add account</span>
      </Button>
    </HeaderSlot>
  );
}
