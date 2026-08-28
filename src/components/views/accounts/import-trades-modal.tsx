'use client';

/* IMPORT INTO **THIS** ACCOUNT — the second opener, and the one that makes adoption trustworthy.
 *
 * IT IS LITERALLY `AddAccountModal`, MINUS THE ONE DOOR THAT DOES NOT APPLY. Same doors, same
 * broker row, same upload step, same shell. `manual` is off because the trader is standing on the
 * account: "Add manually" creates an account, and they already have one.
 *
 * THIS WAS A BARE UPLOAD STEP FOR ABOUT AN HOUR (2026-08-28) and that was the wrong shape. Skipping
 * the doors assumed CSV, which threw away the Brokers row and would have needed re-adding the day
 * the vendor connection lands. v2 records the same lesson from the other direction: its first
 * version reused ONBOARDING's method modal here, and Luke's objection was "onboarding is NOT the
 * app" — a screen from another flow dropped into the middle of this one. Consistency here means the
 * modal the trader already knows from the roster, which is this one, with one switch flipped.
 *
 * WHY THE OPENER IS SEPARATE FROM `add()` AT ALL. `add()` asks WHICH ACCOUNT TO CREATE, which is "a
 * question with no meaning when the trader is standing on one". This flow has its answer already —
 * the account whose page it was launched from — and THAT is the signal: an import launched here is
 * the trader asserting the file belongs to that row. Nothing inside a Tradovate CSV points back at a
 * hand-added `pending:<uuid>` account, so without the assertion the import mints a second row and
 * leaves the hand-made one empty forever.
 *
 * THE ID IS NOT TRUSTED BECAUSE IT CAME FROM HERE. It rides to the route as a form field and is
 * re-checked in the UPDATE against the trader, the platform and `pending:%` — the four conditions in
 * `lib/intake/accounts.ts`. This component is where the trader's intent ENTERS, not where it is
 * authorised.
 */

import { AddAccountModal } from './add-account-modal';

export function ImportTradesModal({
  accountId,
  onClose,
}: {
  accountId: string;
  onClose: () => void;
}) {
  return (
    <AddAccountModal
      onClose={onClose}
      connected={0}
      manual={false}
      adoptAccountId={accountId}
      title="Import trades"
    />
  );
}
