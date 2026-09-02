'use client';

/* THE LINK IN THE RAIL'S DATA CARD THAT OPENS AN IMPORT SCOPED TO THIS ACCOUNT.
 *
 * IT EXISTS SO `AccountRail` CAN STAY A SERVER COMPONENT. That card only reads and formats, which
 * is worth keeping — it ships no JS — and one row in it needs to open a modal, which is context. So
 * the client boundary is this button and nothing else. `edit-account-link.tsx` in v2 is the same
 * shape for the same reason.
 *
 * A BUTTON, NOT AN ANCHOR, because it goes nowhere: it opens a dialog over the page you are already
 * on. Styled as a link because that is what it reads as in a list of stated values.
 *
 * WHY IT LIVES IN THE DATA CARD and not the header band. The band's two controls change the ACCOUNT
 * (Edit) and the VIEW (Filters). This changes neither: it adds to the record, and the Data card is
 * the one place on the page that already talks about where the record came from. It sits directly
 * under "Last import", which for a hand-added account reads "Never" — so the row that states the
 * gap is the row that offers to close it.
 */

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Icon } from '@/components/ui/icon';
import { useImportTrades } from './account-modals';

export function ImportIntoAccount({
  accountId,
  label,
}: {
  accountId: string;
  /** "Import trades" normally; the empty case says something more direct. */
  label: string;
}) {
  const open = useImportTrades();
  return (
    <button
      type="button"
      onClick={() => open(accountId)}
      // `-my-2 py-2` grows the tap target without moving the row it sits in.
      className="text-link -my-2 py-2"
    >
      {label}
    </button>
  );
}

/* THE SAME ACTION AS A BUTTON, in the two shapes the pages that fill a tape actually need
 * (2026-09-02). The link above stays what it is: a value inside a row of stated values.
 *
 * WHY IT IS THE ACCENT. The roster's rule, quoted in `accounts-header.tsx` from v2: "a page has
 * exactly one action that changes what is on it, and it should be the only thing on the screen
 * wearing the accent." On an account's page `Edit` changes the ACCOUNT and `Filters` changes the
 * VIEW; this is the only control that changes what is IN the tape. The band's two controls are
 * `HeaderControl` chips, so nothing is competing with it.
 *
 * TWO SHAPES, ONE CONCEPT, because the two surfaces that need it are not the same box. The tape
 * card's header is a 36px control row; the phone's empty state is a card with a full-width pill in
 * its gutter. Splitting these into two components would put one action behind two names.
 *
 * `size="md"` (36px) BECAUSE THE HEADER IS 36px OF CONTROL EVERYWHERE ELSE - `HeaderControl`,
 * `IconButton`, and `accounts-header.tsx`'s own CTA, which records the same measurement and why it
 * is not `sm`: at h-8 it sat 4px short of the row it lives in and read as sunken rather than as a
 * deliberate size. The tape header is `min-h-15` with `py-2`, so 36px clears it.
 *
 * `size="lg"` (48px) FOR THE CTA, which is `RecentTrades`' own "View all trades" height and the
 * modals' footer height - the same object the trader has already pressed, not a new one invented
 * for one table.
 *
 * NO MARK ON EITHER LABELLED SHAPE (2026-09-02, Luke: "remove the icon from the 'import trades'
 * button"), AND THE DIVERGENCE FROM `/trades` IS THE ARGUMENT FOR IT. That button sits in the
 * shell's band among `HeaderControl` chips - Search, Date, Filters - every one of which carries an
 * `Icon` before its label, so a bare label there would be the one mark-less control in a row of
 * marked ones. THIS one sits in a card's own header beside an `h2`, where the only other content
 * is type. A mark there is decoration: it is not distinguishing this control from peers, because
 * it has none. Two bands, two answers, and the rule is the row you are in rather than the action.
 *
 * The disc keeps its mark for the obvious reason - it IS the mark - and keeps `aria-label` with it.
 * The labelled shapes drop `aria-label` along with the icon: their text is the accessible name
 * now, and a redundant `aria-label` repeating it is one more string to leave stale.
 */
export function ImportIntoAccountButton({
  accountId,
  /** The full-width pill under an empty table, rather than the control in a header row. */
  cta = false,
}: {
  accountId: string;
  cta?: boolean;
}) {
  const open = useImportTrades();

  if (cta) {
    return (
      <Button size="lg" className="w-full" onClick={() => open(accountId)}>
        Import trades
      </Button>
    );
  }

  return (
    <>
      {/* THE DISC BELOW `md` IS `accounts-header.tsx`'s CALL, NOT A NEW ONE: in a band of bare
          36px discs an accent-filled box reads as a control from another screen rather than as
          emphasis. It is unreachable today, since the only header this shape sits in is
          `max-md:hidden` - but the component cannot depend on that staying true.
          `aria-label` IS UNCONDITIONAL. A control whose name disappears at one width is nameless
          to a screen reader at that width. */}
      <IconButton className="md:hidden" aria-label="Import trades" onClick={() => open(accountId)}>
        <Icon name="upload" size={22} />
      </IconButton>
      <Button size="md" className="max-md:hidden" onClick={() => open(accountId)}>
        Import trades
      </Button>
    </>
  );
}
