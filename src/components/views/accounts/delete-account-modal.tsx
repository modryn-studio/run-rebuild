'use client';

/* "DELETE THIS ACCOUNT?" — the confirmation that sits ON TOP of the Edit modal (`S6e`).
 *
 * WHY IT EXISTS AT ALL (v2, Luke 2026-08-03). Delete used to fire on the FIRST CLICK, with no moment
 * of intent in it: he pressed it while testing, the account went, and the page he was standing on
 * 404'd because it was still trying to render the row that had just been removed. Two bugs in one
 * gesture. This is the first half of the fix; the second half is the navigation, and it lives in
 * whatever opened this - on `/accounts/details` the page IS the account, so it must leave.
 *
 * A SECOND MODAL, NOT A SECOND SCREEN, for the reason `close-account-modal.tsx` sets out: the Edit
 * modal's other screens are questions you walk THROUGH, and this one interrupts, gets an answer, and
 * hands control back to the form still sitting underneath.
 *
 * ─── THE TWO STATES, AND WHY THE SECOND IS NOT A DEAD BRANCH ───────────────────────────────────
 *
 * DELETABLE - nothing was ever imported, so there is genuinely nothing to lose. This is the normal
 * path and the only one the control offers, since the form renders Delete only at zero trades.
 *
 * REFUSED - the account holds a record. Reachable two ways and both are real: an import can land
 * between this modal opening and the button being pressed, and the API is a URL anyone can call. The
 * route answers 409 with the sentence to show, so the refusal arrives from the one place that can
 * actually know - and it lands HERE, in the modal that asked, rather than as a red line on a form
 * the trader has already stopped reading.
 *
 * WHAT IT DELIBERATELY DOES NOT DO is offer to delete an account that has trades. The reference
 * deletes everything - transactions, balances, the lot - and that is right for a ledger a human
 * curates. It is wrong here: the whole claim of this product is that it keeps the tape, especially
 * the blown-account sessions the broker erases within hours, and a menu item that erases it is
 * arguing against the thing being sold. The database agrees underneath the route: `import.account_id`
 * and `event.account_id` carry no cascade, so a delete that would orphan a record fails on the
 * foreign key even if the check above it were ever removed.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmHeader } from './shared';
import { ConfirmShell, ConfirmFooter } from './confirm-shell';
import { ModalActions } from './modal-shell';

export function DeleteAccountModal({
  accountId,
  title,
  onCancel,
  onDeleted,
}: {
  accountId: string;
  /** What the row is called, so the question names the thing rather than "this account". */
  title: string;
  onCancel: () => void;
  /** Fired after the row is gone. The CALLER navigates — see the note at the top. */
  onDeleted: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* SET WHEN THE ROUTE REFUSES. Separate from `error` because it is not a failure to retry - it is a
     different ANSWER to the question, so the modal changes shape rather than showing a warning above
     a button that will never work. */
  const [refused, setRefused] = useState<string | null>(null);

  /* `markReplacing` ARRIVES AS AN ARGUMENT rather than being closed over, because it is the shell's
     render-prop value and this function is declared above it. One parameter is cheaper than moving
     the whole write into the JSX. */
  async function confirm(markReplacing: () => void) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/accounts', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: accountId }),
      });
      if (res.status === 409) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setRefused(
          body?.error ||
            'This account holds imported trades, so it cannot be deleted. Close it instead to mark how it ended.'
        );
        setSaving(false);
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || 'Could not delete this account. Try again.');
      }
      /* THE ENTRY IS LEFT FOR THE `replace`, not taken back. `onDeleted` navigates. */
      markReplacing();
      onDeleted();
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : 'Could not delete this account. Try again.');
    }
  }

  return (
    /* THE CONTAINER IS `ConfirmShell`'S CALL: a centred alert on a desktop, a full-screen sheet on a
       phone. `dismiss` is the wrapped cancel, so every control that backs out uses it. */
    <ConfirmShell
      onCancel={onCancel}
      busy={saving}
      label={refused ? 'This one keeps its record' : 'Delete this account?'}
    >
      {(dismiss, markReplacing) => (
        <>
          <ConfirmHeader
            title={refused ? 'This one keeps its record' : 'Delete this account?'}
            onCancel={dismiss}
          />

          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-5">
            {refused ? (
              <>
                <p className="text-body-lg text-text">{refused}</p>
                {/* THE WAY FORWARD, NOT JUST THE REFUSAL. A trader who wanted this account gone
                    still wants it gone; the honest offer is the one that does what they meant
                    without destroying what they did not mean. */}
                <p className="text-body text-muted mt-2">
                  Closing it marks how it ended and keeps every trade in your totals.
                </p>
              </>
            ) : (
              <>
                <p className="text-body-lg text-text">
                  {title} will be removed. This cannot be undone.
                </p>
                {/* WHY IT IS SAFE TO OFFER AT ALL, said plainly: the only accounts that reach this
                    button are the ones holding nothing. */}
                <p className="text-body text-muted mt-2">
                  Nothing has been imported into it, so no trades are lost.
                </p>
              </>
            )}
          </div>

          <ConfirmFooter error={error}>
            <ModalActions>
              {refused ? (
                /* ONE BUTTON WHEN THERE IS ONE THING LEFT TO DO. A Cancel beside a Close in the
                   refused state would offer a choice between "go back" and "go back", since neither
                   deletes anything. */
                <Button size="sm" onClick={dismiss}>
                  Got it
                </Button>
              ) : (
                <>
                  <Button variant="secondary" size="sm" onClick={dismiss} disabled={saving}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="danger" loading={saving} onClick={() => void confirm(markReplacing)}>
                    Delete account
                  </Button>
                </>
              )}
            </ModalActions>
          </ConfirmFooter>
        </>
      )}
    </ConfirmShell>
  );
}
