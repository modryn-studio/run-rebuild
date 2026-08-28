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
