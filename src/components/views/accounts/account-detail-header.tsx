'use client';

/* THE DETAILS PAGE'S HEADER CLUSTER: a breadcrumb back to the roster, and this page's controls.
 *
 * THE BREADCRUMB REPLACES THE ROUTE TITLE. Every other route lets the shell name it from `NAV`
 * (derived synchronously from the pathname, so it is never a frame late), but this one is not a nav
 * destination - it is a row you drilled into, and the useful thing in that band is the way back plus
 * which row you are on. So the page portals its own trail into the same slot, which is exactly what
 * `HEADER_TITLE_SLOT_ID` was built for and what `/trades/[id]` already does.
 *
 * PORTED FROM `run-trading@v2` (`account-detail-header.tsx`), including the two calls it records:
 *
 * EDIT IS A BUTTON, NOT A MENU (v2, 2026-07-31). The reference opens a nine-item dropdown - edit
 * account, institution settings, download/import transactions, four balance-history operations.
 * Exactly one of those maps onto something Run can do, which is naming the account, and the rest
 * would be a menu of promises. A chevron promises a menu; one real action gets a button that says
 * what it does. It becomes a menu the day a second item is real.
 *
 * That also settles the renaming question: this IS the rename. In v2 the label modal used to open
 * when a ROSTER ROW was clicked, which was an accident of the row having nothing else to do. The row
 * now navigates here, and Edit opens the modal deliberately.
 *
 * BOTH CONTROLS ARE REAL AS OF C3. Nothing here was ever rendered as a dead button waiting for its
 * handler; Edit arrived with the modal and the write path in the same commit.
 */

import Link from 'next/link';
import { HeaderSlot } from '@/components/shell/header-slot';
import { Icon } from '@/components/ui/icon';
import { ICON_BUTTON } from '@/components/ui/icon-button';
import { AccountLogo } from './account-logo';
import { DetailFilters, type Option } from './detail-filters';
import { HeaderControl } from '@/components/shell/header-slot';
import { useLabelAccount } from './account-modals';
import type { RosterAccount } from '@/lib/accounts/read';
import type { FacetRow } from '@/lib/trades/facets';
import type { ResultToken } from '@/lib/trades/filter';

export function AccountDetailHeader({
  account,
  title,
  applied,
  products,
  results,
  facetRows,
}: {
  account: RosterAccount;
  title: string;
  applied: { products: string[]; results: ResultToken[]; q: string | null };
  products: Option[];
  results: Option[];
  facetRows: FacetRow[];
}) {
  const label = useLabelAccount();
  return (
    <>
      <Breadcrumb account={account} title={title} />
      {/* THE BAND'S RIGHT-HAND SIDE. `Edit` will sit BEFORE this when C3 lands - it is the only
          control here that changes the ACCOUNT rather than the view of it, and the reference orders
          it first for that reason.
          NO DATE CONTROL, deliberately: this page's chart carries its own period menu, and two
          controls saying "which days" is the page arguing with itself. `/trades` is where a
          particular day is found. */}
      <HeaderSlot>
        {/* EDIT FIRST, because it is the only control here that changes the ACCOUNT rather than the
            view of it. v2 orders it the same way and the reference does too. */}
        <HeaderControl onClick={() => label(account)}>Edit</HeaderControl>
        <DetailFilters
          accountId={account.id}
          applied={applied}
          products={products}
          results={results}
          facetRows={facetRows}
        />
      </HeaderSlot>
    </>
  );
}

function Breadcrumb({ account, title }: { account: RosterAccount; title: string }) {
  return (
    <HeaderSlot slot="title">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
        {/* TWO WAYS BACK, AND THEY ARE FOR TWO DIFFERENT PEOPLE. Above `sm` the word "Accounts" is
            the trail - it says where you are as much as how to leave. Below it the word costs a
            third of a 390px band to duplicate what the phone's own back gesture already does, so it
            collapses to a mark, which is the same swap `/trades/[id]` makes.
            A LINK, NOT `router.back()`. Back depends on how the trader ARRIVED, and this URL can be
            pasted, bookmarked or refreshed - all of which would send them wherever they were before
            Run. `/accounts` is where this screen belongs regardless of the route in. */}
        <Link
          href="/accounts"
          aria-label="Back to accounts"
          className={`${ICON_BUTTON} shrink-0 sm:hidden`}
        >
          <Icon name="back" size={18} />
        </Link>
        <Link
          href="/accounts"
          className="text-title text-muted hover:text-text hidden shrink-0 transition-colors sm:inline"
        >
          Accounts
        </Link>
        {/* The separator is the chevron laid on its side. `aria-hidden`, because the `<nav>` label
            and the link text already say what this is; a screen reader announcing "chevron" between
            two crumbs is noise. */}
        <Icon
          name="chevron"
          size={16}
          className="text-muted hidden shrink-0 -rotate-90 sm:block"
          aria-hidden
        />
        {/* THE ACCOUNT'S OWN MARK, sized down to the band. It is the same component the roster row
            uses, so the thing you tapped and the thing you landed on wear the same face - which is
            most of what makes a drill-down feel like the same object rather than a new screen. */}
        <AccountLogo propFirm={account.propFirm} size={24} />
        <h1 className="text-title text-text min-w-0 truncate font-medium">{title}</h1>
      </nav>
    </HeaderSlot>
  );
}
