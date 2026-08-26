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
 * FILTERS ARRIVES IN `S6f`, with the panel behind it.
 */

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { HeaderSlot } from '@/components/shell/header-slot';
import { useAddAccount } from './account-modals';

export function AccountsHeader() {
  const add = useAddAccount();

  return (
    <HeaderSlot slot="controls">
      {/* The label goes below `sm` and the mark carries it, but `aria-label` is UNCONDITIONAL -
          a control whose name disappears at one width is nameless to a screen reader at that
          width. */}
      <Button size="sm" aria-label="Add account" onClick={add}>
        <Icon name="add" size={16} />
        <span className="max-sm:hidden">Add account</span>
      </Button>
    </HeaderSlot>
  );
}
