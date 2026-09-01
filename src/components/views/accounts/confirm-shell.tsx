'use client';

/* THE FRAME AROUND A CONFIRMATION — a centred alert on a desktop, a full-screen sheet on a phone.
 *
 * Both /accounts confirmations (Close, Delete) hand-rolled this same overlay: a `fixed inset-0`, a
 * scrim, and a `pop-in-center` card with `max-h-[85dvh] max-w-md`. Two copies of one object, which
 * only survived because nothing had ever needed to change it. The phone did.
 *
 * ─── WHY A CONFIRMATION IS A SHEET TOO ───────────────────────────────────────────────────────────
 *
 * "basically no modals on mobile is the rule" (Luke, 2026-08-28), and this is the case with the best
 * argument against it: iOS and Android both keep a centred ALERT for a destructive yes/no, and
 * `close-account-modal.tsx` opens by insisting this is "A SECOND MODAL, NOT A SECOND SCREEN".
 *
 * It is still a sheet here, for a reason specific to these two: neither is a yes/no. Close asks how
 * the account ENDED, takes a date, and states three things that will change — a screenful on a
 * phone, which is what an alert is exactly wrong for. Delete is smaller, and shipping it as the one
 * centred card in a product with no other centred cards would make it look like a bug rather than
 * like emphasis.
 *
 * WHAT CARRIES THE INTERRUPTION INSTEAD, now that the shape cannot: no back arrow in the bar (there
 * is nothing to go back TO — see `ConfirmHeader`), and the sheet underneath goes `busy`, so one
 * Escape closes exactly one thing.
 *
 * IT STACKS BY DOM ORDER, NOT BY A HIGHER z. Both sheets are `z-[70]` and this one is rendered after
 * the form that opened it, so it paints on top. A second z-index would have to be kept in step with
 * a first one by memory, and the ordering is already guaranteed by where the element is.
 *
 * THE CHILD IS A FUNCTION because the exit belongs to the container. On a phone dismissing has to
 * travel for 200ms before the owner unmounts anything, so every control that cancels must call the
 * WRAPPED dismiss rather than the raw prop — passing it down is how that becomes impossible to
 * forget, where a context would be one more thing a new call site has to know to read.
 */

import { useCallback, useState, type ReactNode } from 'react';
import { AccountSheet, useSheet } from './account-sheet';
import { ModalShell, useModalClose } from '@/components/ui/modal-shell';
import { CONFIRM_TITLE_ID } from './shared';
import { usePhone } from '@/lib/use-phone';

export function ConfirmShell({
  onCancel,
  busy,
  label,
  role = 'alertdialog',
  width = 'max-w-md',
  labelledBy = CONFIRM_TITLE_ID,
  ground,
  children,
}: {
  onCancel: () => void;
  /** True while the confirmation's own write is in flight. Blocks Escape and the Back button. */
  busy?: boolean;
  /** Names the dialog for a screen reader on the sheet path, where the title is portalled away. */
  label: string;
  /* CONTENT RATHER THAN A QUESTION gets `dialog` and a wider card. `Your Daily Recap` opens through
     this shell so that every overlay in the product arrives and leaves the same way; what it is not
     is an alert, and a screen reader should not be told it is one. */
  role?: 'dialog' | 'alertdialog';
  width?: string;
  /* WHICH ELEMENT NAMES THE DIALOG, because this shell no longer only frames confirmations. A
     confirmation draws `ConfirmHeader`, whose `<h2>` carries `CONFIRM_TITLE_ID`; `/today`'s recap
     draws `ModalHeader`, the same header Add account and Edit account use, whose `<h2>` carries
     `MODAL_TITLE_ID`. Pointing at the wrong one is not a cosmetic miss - `aria-labelledby` that
     resolves to nothing leaves the dialog unnamed, which is the whole reason the two ids exist
     separately (2026-08-28: Delete announced itself as "Edit account"). */
  labelledBy?: string;
  /* THE CARD'S GROUND, forwarded to whichever container this resolves to so the two cannot drift.
     One name, two mechanisms: the desktop card's class and the sheet layer's. */
  ground?: string;
  /* THE SECOND ARGUMENT IS FOR A CONFIRMATION THAT NAVIGATES (2026-08-28, postcheck). Delete is the
     one: it answers by leaving for `/accounts`, and on a phone this shell owns a history entry whose
     cleanup would otherwise `history.back()` into the URL of the account just deleted - the exact
     "v2 delete bug" `label-account-form.tsx` says it is avoiding. Call it BEFORE the write's
     callback, and the entry is left standing for `router.replace` to overwrite. A no-op on the
     desktop path, which pushes no entry. */
  children: (dismiss: () => void, markReplacing: () => void) => ReactNode;
}) {
  const phone = usePhone();
  const sheet = useSheet(onCancel);
  /* THE DESKTOP PATH ANIMATES OUT NOW, and it did not before. `useModalClose` holds the card
     mounted for `MODAL_EXIT_MS` while the whole overlay fades, which is what `ModalShell` has
     always done for `Add account` - the confirmations simply never asked for it. */
  const modal = useModalClose(onCancel);
  const dismiss = phone ? sheet.requestClose : modal.requestClose;
  /* HELD AS STATE, not a ref: the sheet hands its marker up once, and a ref crossing that boundary
     is what the React Compiler refuses. `setMark(() => fn)` because a bare function argument to a
     setter is read as an updater. */
  const [mark, setMark] = useState<(() => void) | null>(null);
  const receiveMark = useCallback((fn: () => void) => setMark(() => fn), []);
  const markReplacing = useCallback(() => mark?.(), [mark]);

  if (phone) {
    return (
      <AccountSheet
        open={sheet.open}
        onClose={dismiss}
        /* ONE LAYER, so Back and Close are the same gesture. There is no screen beneath this one
           inside this sheet — the thing beneath it is the form, in a sheet of its own. */
        onBack={dismiss}
        busy={busy}
        label={label}
        onMark={receiveMark}
        layerClassName={ground}
        layers={[children(dismiss, markReplacing)]}
      />
    );
  }

  /* IT IS `ModalShell` NOW, not a second copy of it (2026-08-31). The copy this replaced drew its
     own scrim with no `.backdrop-fade`, its own card with `pop-in-center` and NO exit at all, and
     carried neither the Escape handler nor the body-scroll lock. So a confirmation appeared in one
     frame and vanished in one, three feet from an `Add account` modal that faded both ways.
     `z-[70]` OVER THE EDIT MODAL'S `z-[60]` still holds and is `ModalShell`'s own base plus the
     class below: the shell underneath is put in `busy` while this is up, so one Escape closes
     exactly one thing and the form cannot be dismissed out from under its own confirmation. */
  return (
    <ModalShell
      onDismiss={dismiss}
      busy={busy}
      closing={modal.closing}
      role={role}
      labelledBy={labelledBy}
      width={width}
      className="z-[70]"
      cardClassName={ground}
    >
      {children(dismiss, markReplacing)}
    </ModalShell>
  );
}

/* The footer both confirmations share: the error above the actions, on the card's own gutter.
 * `shrink-0` keeps it out of the scrolling middle, which is what stops the commit button scrolling
 * away on a short viewport. */
export function ConfirmFooter({ error, children }: { error: string | null; children: ReactNode }) {
  return (
    <div className="shrink-0 px-6 py-4">
      {error && <p className="text-body text-neg mb-3 text-center">{error}</p>}
      {children}
    </div>
  );
}
