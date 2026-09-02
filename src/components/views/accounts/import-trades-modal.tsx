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
 * AND IT IS A BARE UPLOAD STEP AGAIN AS OF 2026-09-02 — by a GATE rather than an assumption, which
 * is the difference the paragraph above was actually objecting to. `AddAccountModal` skips the doors
 * while `TRADOVATE_CONNECT_LIVE` is false, so nothing is thrown away: the Brokers row is wired to the
 * switch that decides whether it has anything to offer, and flipping that one constant brings the
 * doors back here and on every other import opener at once.
 *
 * WHAT FORCED IT was the phone. Its account bar's `⋯` opens the upload step directly - the row that
 * opens it says "Import trades · Import from CSV", so a doors screen would re-ask a question the
 * label just answered - and that left ONE PAGE with two depths for one action, depending on which
 * of its two controls you pressed. Luke's question settled which way to close it: "when the broker
 * sync is available, do we want the sync and upload csv option to both be available on the path A
 * and path B options?" Yes - so the shape has to follow the number of live sources rather than be
 * chosen once, or the menu would quietly hide sync from the trader on the surface they use daily.
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
