'use client';

/* THE SHELL AROUND `LabelAccountForm` — the exit animation, the dismissal rules, and nothing else.
 *
 * WHY IT IS A SEPARATE FILE from the form. `useModalClose` has to live in the component that OUTLIVES
 * the modal, because the whole point of the exit transition is that the modal is still mounted while
 * it plays. Putting it inside the form would mean the thing running the animation is the thing being
 * unmounted, and `modal-shell.tsx` records what that cost the first time (2026-07-30: a `closing`
 * left true made the next open render at opacity-0 and pointer-events-none, so the button appeared
 * dead until a refresh). The provider owns "is it open"; this owns "is it leaving"; the form owns
 * the questions.
 *
 * `onDismiss` GOES TO THE SAME PLACE AS THE X, DELIBERATELY. Escape and a backdrop click walk out of
 * the whole dialog rather than back one screen. The form's own Back arrow walks the screen stack -
 * that is a different gesture with a different meaning, and collapsing the two would make Escape
 * unpredictable partway through a three-screen flow.
 *
 * IT REFUSES TO DISMISS WHILE SAVING. A PATCH is in flight and the row is about to change under the
 * page; a backdrop click that closed the dialog mid-write would leave the trader looking at a roster
 * that is one refresh behind with nothing on screen saying so.
 */

import { useState } from 'react';
import { ModalShell, useModalClose } from './modal-shell';
import { useSheet } from './account-sheet';
import { LabelAccountForm } from './label-account-form';
import { usePhone } from '@/lib/use-phone';
import type { RosterAccount } from '@/lib/accounts/read';

export function LabelAccountModal({
  account,
  siblingCount,
  onClose,
}: {
  account: RosterAccount;
  siblingCount: number;
  onClose: () => void;
}) {
  const phone = usePhone();
  const { closing, requestClose } = useModalClose(onClose);
  const sheet = useSheet(onClose);
  const [busy, setBusy] = useState(false);

  /* TWO CONTAINERS, TWO CLOCKS. A modal fades out in 160ms and a sheet travels the height of the
     screen in 200, and each hook owns the delay before the owner above unmounts anything. Both are
     called unconditionally because hooks must be; only one of them is ever driven. */
  const close = phone ? sheet.requestClose : requestClose;

  const form = (
    <LabelAccountForm
      account={account}
      siblingCount={siblingCount}
      onClose={close}
      /* SAVED AND CLOSING ARE THE SAME GESTURE HERE. The form has already called
         `router.refresh()`, so by the time this runs the surfaces behind are being re-read;
         closing on top of that is what makes the change appear to happen "in" the page rather
         than after it. */
      onSaved={close}
      onBusyChange={setBusy}
      /* ON A PHONE THE FORM IS THE CONTAINER. It has to be: its three screens become three layers,
         and the confirmations have to sit OUTSIDE the panel that holds them — neither of which a
         wrapper around it could arrange. See the `sheet` prop's own note. */
      sheet={phone ? { open: sheet.open } : null}
    />
  );

  if (phone) return form;

  return (
    <ModalShell onDismiss={() => !busy && requestClose()} busy={busy} closing={closing}>
      {form}
    </ModalShell>
  );
}
