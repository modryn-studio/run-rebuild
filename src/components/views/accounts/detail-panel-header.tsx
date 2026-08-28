'use client';

/* THE PHONE'S BAR FOR AN ACCOUNT, and it picks which of its two shapes to wear from the route.
 *
 * `/accounts/details/<id>`        back to the roster, the account's name, Edit.
 * `/accounts/details/<id>/trades` back to the account, the same name, the summary toggle.
 *
 * ONE COMPONENT, CHOSEN BY SEGMENT, because both bars live in the same segment layout - which is
 * what keeps the bar mounted while the body under it changes (`detail-panel.tsx` argues why). Two
 * files would have to be swapped by the same `useSelectedLayoutSegment` call anyway, one level up.
 *
 * IT IS `SheetHeader`, which answers Luke's own objection from 2026-08-28: "but we do not have
 * buttons in the header for mobile. so i dont know what to do with this." We do now - that component
 * gained a `trail` slot when the /accounts flows needed a bar with two exits. One phone header bar
 * in this product, wearing a different pair of controls per screen.
 *
 * EDIT IS A PENCIL, NOT A CHIP (2026-08-28, Luke: "i dont want to use a button in the header").
 * It shipped as `HeaderControl`, which is the desktop band's chip: a bordered, lifted, label-width
 * control. Two problems, and the second is the one that showed. It was the only chrome-bearing
 * control in any phone bar in the product - every other one is a bare 22px `IconButton` - and its
 * width is the label's, so `SheetHeader`'s `px-12` title clearance (measured for a 44px control) was
 * wrong and a long account name ran into it. An icon button is 44px like the arrow opposite it, so
 * the centred title is symmetric again and the truncation has the room it was measured for.
 *
 * NO LOGO BESIDE THE TITLE, unlike the desktop breadcrumb. A centred title has two 44px controls to
 * clear and a name like "My Funded Futures 100K (...4470)" to fit between them; a 24px mark buys
 * recognition the trader does not need on a screen they just tapped into, at the cost of the digits
 * that say WHICH account.
 *
 * BACK IS A LINK, NOT `router.back()`. Back depends on how the trader ARRIVED, and these URLs can be
 * pasted, bookmarked or refreshed - all of which would send them wherever they were before Run. Same
 * call the desktop breadcrumb makes, and `/trades/[id]` before it.
 */

import Link from 'next/link';
import { SheetHeader, SHEET_CONTROL_ICON } from '@/components/ui/sheet-header';
import { Icon } from '@/components/ui/icon';
import { IconButton, ICON_BUTTON } from '@/components/ui/icon-button';
import { useLabelAccount } from './account-modals';
import type { RosterAccount } from '@/lib/accounts/read';

/** Where `WithSummaryRail` portals its toggle, and where `TradesSearchPill` portals its row. Ids
 *  rather than refs, matching `header-slot.tsx`: the controls stay in the page's tree and only
 *  their paint moves. */
export const ACCOUNT_TRADES_BAR_HOST = 'account-trades-bar';
export const ACCOUNT_TRADES_BAND_HOST = 'account-trades-band';

export function DetailPanelHeader({
  account,
  title,
  onTrades,
}: {
  account: RosterAccount;
  title: string;
  /** True on the `/trades` child. Decides where Back goes and what sits opposite it. */
  onTrades: boolean;
}) {
  const detailHref = `/accounts/details/${account.id}`;
  return (
    <SheetHeader
      className="shrink-0 md:hidden"
      title={title}
      lead={
        /* A LINK WEARING THE ICON BUTTON, not an `IconButton` with an onClick: this NAVIGATES, so it
           owes middle-click, cmd-click and "copy link address", none of which a button gives.
           `ICON_BUTTON` is exported for exactly this - same circle, same mechanic, one definition. */
        <Link
          href={onTrades ? detailHref : '/accounts'}
          aria-label={onTrades ? 'Back to the account' : 'Back to accounts'}
          className={ICON_BUTTON}
        >
          <Icon name="back" size={SHEET_CONTROL_ICON} />
        </Link>
      }
      trail={
        onTrades ? (
          /* THE TOGGLE PORTALS IN HERE. `WithSummaryRail` owns the control, its `]` shortcut, its
             stored preference and its two icons; this only says where it paints. A second toggle
             defined locally would be the same job twice, and they would drift on the first change. */
          <div id={ACCOUNT_TRADES_BAR_HOST} className="flex items-center" />
        ) : (
          <EditAccountControl account={account} />
        )
      }
    />
  );
}

/** Edit, for the details bar. Its own component because it needs the modal opener, which is context
 *  the layout establishes and the bar above is otherwise free of. */
function EditAccountControl({ account }: { account: RosterAccount }) {
  const label = useLabelAccount();
  return (
    <IconButton onClick={() => label(account)} aria-label="Edit account">
      <Icon name="edit" size={SHEET_CONTROL_ICON} />
    </IconButton>
  );
}
