'use client';

/* IMPORT INTO **THIS** ACCOUNT — the second opener, and the one that makes adoption trustworthy.
 *
 * WHY IT IS A DIFFERENT MODAL FROM `AddAccountModal` rather than a mode of it. v2 states the
 * distinction and it is the whole reason this file exists: `add()` asks WHICH ACCOUNT TO CREATE,
 * and that is "a question with no meaning when the trader is standing on one". This flow has its
 * answer already — the account whose page it was launched from — so it skips the doors entirely
 * and opens on the upload step.
 *
 * AND THAT SKIP IS THE SIGNAL. An import launched from an account's own page is the trader
 * ASSERTING that the file belongs to that row. Nothing inside a Tradovate CSV points back at a
 * hand-added `pending:<uuid>` account, so without this assertion the import mints a second row and
 * leaves the hand-made one empty forever. It is a far better signal than any inference the server
 * could draw from firm and size: two hand-added "TradeDay 100K" rows are indistinguishable from
 * there, and picking wrong is permanent in an append-only log.
 *
 * THE ID IS NOT TRUSTED BECAUSE IT CAME FROM HERE. It rides to the route as a form field and is
 * re-checked in the UPDATE itself against the trader, the platform and `pending:%` — see the four
 * conditions in `lib/intake/accounts.ts`. This component is where the trader's intent enters, not
 * where it is authorised.
 */

import { useState } from 'react';
import { ModalShell, useModalClose } from './modal-shell';
import { FileUploadStep, type Picked } from './file-upload-step';
import type { Source } from './shared';

export function ImportTradesModal({
  accountId,
  source,
  onClose,
}: {
  accountId: string;
  source: Source;
  onClose: () => void;
}) {
  const { closing, requestClose } = useModalClose(onClose);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<Picked[]>([]);

  return (
    <ModalShell onDismiss={() => !busy && requestClose()} busy={busy} closing={closing}>
      <FileUploadStep
        source={source}
        adoptAccountId={accountId}
        /* BACK IS CLOSE HERE, and that is the point of the modal rather than an omission: there are
           no doors behind this one to go back to. `FileUploadStep` takes both because the
           Add-account flow genuinely has a screen behind it. */
        onBack={requestClose}
        onClose={requestClose}
        onDone={requestClose}
        onBusyChange={setBusy}
        files={files}
        setFiles={setFiles}
      />
    </ModalShell>
  );
}
