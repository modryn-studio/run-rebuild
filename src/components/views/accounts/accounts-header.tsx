'use client';

/* THE ROSTER'S CONTROL CLUSTER, portalled into the shell's own header band.
 *
 * ONE ACTION, AND ON A DESKTOP IT IS THE ONLY THING WEARING THE ACCENT. `run-trading@v2`: "a roster
 * page has exactly one action that changes what is on it, and it should be the only thing on the
 * screen wearing the accent." Everything else this page can do is on a row. BELOW `md` the accent
 * comes off it - the band there is icon-only chrome and an accent box among discs reads as foreign
 * rather than as emphasis. The argument is at the call site.
 *
 * REFRESH IS BACK, AND IT WORKS (2026-08-26, Luke: "why dont we have the refresh button in the
 * header of the /accounts page? add that"). This file used to argue it out on the grounds that v2's
 * is inert - true of v2, and the wrong conclusion here: this page is a Server Component, so
 * `router.refresh()` genuinely re-reads the roster, the freshness stamps and the chart series from
 * Postgres. See `refresh-roster.tsx`, which carries the argument at the point of use.
 *
 * FILTERS IS THE SAME OBJECT `/trades` PUTS IN THIS BAND - `HeaderControl` trigger, `usePopover`
 * state, `Head`/`Row`/`Chip`/`PanelFooter` panel - rather than a lookalike. It renders itself away
 * when the roster cannot answer any of its three axes, and it is DESKTOP-ONLY: its panel is a
 * three-column rail and a phone needs the sheet `/trades` has, not a shrunk rail.
 *
 * CLEAR COMES FIRST AND ONLY WHEN IT DOES SOMETHING, matching `/trades`' band exactly. v2 carries
 * the same control on this page (`RosterClear`) and this build had missed it: a filter you have to
 * reopen a panel to undo is a filter you forget you left on, and the roster's narrowing is the one
 * that removes ROWS without naming what it removed.
 */

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Icon, ICON_TOUCH } from '@/components/ui/icon';
import { HeaderSlot } from '@/components/shell/header-slot';
import { useAddAccount } from './account-modals';
import { RosterFilters, RosterClear } from './roster-filters';
import { RefreshRoster } from './refresh-roster';
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
      {/* CLEAR STAYS AT EVERY WIDTH, and on a phone it is the ONLY way out of a narrowed roster now
          that Filters is gone from this band - a filter set on a desktop travels in the URL, so the
          phone can arrive already narrowed. It renders itself away when there is nothing to undo,
          so at rest it costs the band nothing. */}
      <RosterClear applied={filter} />
      {/* FILTERS IS DESKTOP-ONLY (2026-08-27, Luke: "first, remove the filters button on mobile. not
          needed"). Its panel is a three-column rail anchored to a chip and none of that survives
          390px - `/trades` answered the same problem with a full-screen `FilterSheet`, which is a
          slice of its own rather than something to half-build here. `contents` so the wrapper adds
          no box to the header's flex row; `max-md:hidden` beats it because `display:none` wins over
          `display:contents`. Same shape `summary-rail.tsx` uses. */}
      <div className="contents max-md:hidden">
        <RosterFilters applied={filter} accounts={accounts} />
      </div>
      {/* Clear, Filters, Refresh, then the CTA - v2's own order in this band. */}
      <RefreshRoster />
      {/* THE CTA IS A DISC ON A PHONE TOO, and that is a deliberate loss (2026-08-27, Luke: "update
          the refresh and add accounts buttons to icons and match the sizing of the other header
          icons"). This page's rule has been "one action, and it is the only thing wearing the
          accent" - which holds on a desktop and stops holding in a 390px band where every other
          control is a bare 36px disc. An accent-filled box beside three discs does not read as
          emphasis there, it reads as a control from a different screen. The accent stays where the
          page can afford it: from `md` up, and on the empty state's own call to action.
          The label goes below `md` and the mark carries it, but `aria-label` is UNCONDITIONAL - a
          control whose name disappears at one width is nameless to a screen reader at that width. */}
      <IconButton className="md:hidden" aria-label="Add account" onClick={add}>
        <Icon name="add" size={ICON_TOUCH} />
      </IconButton>
      {/* `size="md"` (h-9), NOT `sm` (h-8), and the header is what decides it. Every other control
          in this band is 36px tall - `HeaderControl` on `/trades` (Search, Date, Filters), every
          `IconButton` including Notifications, and v2's own Add account. At `sm` this button sat
          4px short of the row it lives in, which reads as a slightly sunken CTA rather than as a
          deliberate size. One band, one control height. */}
      <Button size="md" className="max-md:hidden" aria-label="Add account" onClick={add}>
        <Icon name="add" size={16} />
        Add account
      </Button>
    </HeaderSlot>
  );
}
