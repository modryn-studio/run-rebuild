'use client';

/* THE PHONE'S BAR FOR AN ACCOUNT: back on the left, the account's name centred and truncated, Edit
 * on the right (2026-08-28, Luke: "the header changes to have just a back arrow on the left and the
 * edit button on the right side ... the center title of the header should be the account name such
 * as 'Apex Trader Funding 50K (...4021)'").
 *
 * IT IS `SheetHeader`, WHICH ANSWERS HIS OWN OBJECTION - "but we do not have buttons in the header
 * for mobile. so i dont know what to do with this." We do now: that component gained a `trail` slot
 * on 2026-08-28 when /accounts' flows needed a bar with two exits. One phone header bar in this
 * product, wearing a different pair of controls per screen.
 *
 * EDIT IS A WORD, NOT A GLYPH. Every other control in this bar is a 22px icon, so a pencil would
 * be the consistent choice and the wrong one: there is no conventional mark for "rename this
 * account", and the desktop band already says the word. A label that matches across the two widths
 * costs 40px of a bar that has room for it.
 *
 * NO LOGO BESIDE THE TITLE, unlike the desktop breadcrumb. A centred title has two 44px controls to
 * clear and a name like "Apex Trader Funding 50K (...4021)" to fit between them; a 24px mark buys
 * recognition the trader does not need on a screen they just tapped into, at the cost of the digits
 * that say WHICH account.
 *
 * BACK IS A LINK TO `/accounts`, NOT `router.back()`. Back depends on how the trader ARRIVED, and
 * this URL can be pasted, bookmarked or refreshed - all of which would send them wherever they were
 * before Run. Same call the desktop breadcrumb makes, and `/trades/[id]` before it.
 */

import Link from 'next/link';
import { SheetHeader } from '@/components/ui/sheet-header';
import { Icon } from '@/components/ui/icon';
import { ICON_BUTTON } from '@/components/ui/icon-button';
import { HeaderControl } from '@/components/shell/header-slot';
import { useLabelAccount } from './account-modals';
import type { RosterAccount } from '@/lib/accounts/read';

export function DetailPanelHeader({
  account,
  title,
  backHref,
  backLabel,
  trail,
}: {
  account: RosterAccount;
  title: string;
  /** Where the arrow goes. `/accounts` from the details page; the details page from its tape. */
  backHref: string;
  backLabel: string;
  /* WHAT SITS ON THE RIGHT. Edit on the details page; the summary toggle on the tape route, which
     is a different control belonging to a different screen. Passed in rather than switched on here,
     so this component never has to know which of its two callers it is serving. */
  trail?: React.ReactNode;
}) {
  return (
    <SheetHeader
      className="shrink-0 md:hidden"
      title={title}
      lead={
        /* A LINK WEARING THE ICON BUTTON, not an `IconButton` with an onClick: this NAVIGATES, so it
           owes middle-click, cmd-click and "copy link address", none of which a button gives.
           `ICON_BUTTON` is exported for exactly this. */
        <Link href={backHref} aria-label={backLabel} className={ICON_BUTTON}>
          <Icon name="back" size={22} />
        </Link>
      }
      trail={trail}
    />
  );
}

/** Edit, for the details page's bar. Its own component because it needs the modal opener, which is
 *  context the layout establishes and the bar above is otherwise free of. */
export function EditAccountControl({ account }: { account: RosterAccount }) {
  const label = useLabelAccount();
  return (
    /* `min-h-11` (44px) OVER `HeaderControl`'S OWN 36. The chip is measured for a mouse in the
       desktop band; this one is thumbed. Same control, same label, one floor added - the pattern
       `ModalActions` and the editor's own rows already use below `sm`. */
    <HeaderControl onClick={() => label(account)} className="min-h-11">
      Edit
    </HeaderControl>
  );
}
