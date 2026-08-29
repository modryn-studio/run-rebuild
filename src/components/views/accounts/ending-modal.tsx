'use client';

/* "HOW DID IT END?" — asked again, when a type change leaves the stored ending behind.
 *
 * A SECOND MODAL, NOT A BLOCK IN THE FORM (2026-08-28, Luke: "i think that was lazy. for an open
 * eval, when user goes into the edit modal and selects 'close', a second modal opens with the
 * question. that is better"). The first version grew a "How did it end?" section at the bottom of
 * the editor's Actions list, which put a question the trader had not asked for underneath two rows
 * about things they had. `close-account-modal.tsx` had already settled the shape: a question that
 * interrupts, gets one answer, and hands control straight back to the form sitting underneath.
 *
 * IT DOES NOT WRITE, and that is the one way it differs from its sibling. Close is a moment of
 * intent - a trader reads what will change and presses the red button - so it commits on confirm.
 * This is not that: nothing is ending here, a label is being corrected, and the correction belongs
 * to the same Save as the type that forced it. So it hands the outcome back and `save()` sends both
 * columns in one request. v2 states the same rule for the same reason: "Every value on this screen
 * goes in one request, `status` included. One commit point, no races to reason about."
 *
 * NO EXPLANATION UNDER THE QUESTION, and this is v2's own scar (Luke, 2026-07-31: "traders know what
 * they mean"), re-earned one level up on 2026-08-28: "this is unnecessary copy... we dont need to
 * harp on the user about what closed means." The first version printed "An evaluation is passed or
 * failed. This one is closed", which is the database's vocabulary read back to the person. An
 * evaluation IS closed, in the only sense a trader means it - closed as passed, or closed as failed.
 * `passed`/`failed`/`closed` are storage tokens, and which one a row carries is not the trader's
 * problem. The question is the whole screen.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmHeader, EndingChoice } from './shared';
import { ModalActions } from './modal-shell';
import { ConfirmShell, ConfirmFooter } from './confirm-shell';
import { ACCOUNT_ENDINGS } from '@/lib/prop-firms';
import type { AccountStatus } from '@/lib/db/schema';
import type { AccountTypeKey } from '@/lib/prop-firms';

export function EndingModal({
  type,
  onCancel,
  onPicked,
}: {
  /* THE TYPE ON SCREEN, which is the whole reason this is up. Reading the stored one would offer
     the endings the account is leaving rather than the ones it is moving to. */
  type: AccountTypeKey;
  onCancel: () => void;
  /** Hands the answer back. The form saves it alongside the type, in one request. */
  onPicked: (status: AccountStatus) => void;
}) {
  const endings = ACCOUNT_ENDINGS[type];
  const [outcome, setOutcome] = useState<AccountStatus | null>(null);

  return (
    <ConfirmShell onCancel={onCancel} label="How did it end?">
      {(dismiss) => (
        <>
          <ConfirmHeader title="How did it end?" onCancel={dismiss} />

          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-5">
            <div className="flex flex-col gap-2">
              {endings.map((o) => (
                <EndingChoice
                  key={o.value}
                  label={o.label}
                  on={outcome === o.value}
                  onPick={() => setOutcome(o.value)}
                />
              ))}
            </div>
          </div>

          <ConfirmFooter error={null}>
            <ModalActions>
              <Button variant="secondary" size="sm" onClick={dismiss}>
                Cancel
              </Button>
              {/* SAVE, NOT "Confirm". This button finishes the save the trader already pressed, so
                  it wears that word - a second verb would read as a second commit. */}
              <Button size="sm" disabled={!outcome} onClick={() => outcome && onPicked(outcome)}>
                Save
              </Button>
            </ModalActions>
          </ConfirmFooter>
        </>
      )}
    </ConfirmShell>
  );
}
