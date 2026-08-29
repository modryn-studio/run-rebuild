'use client';

/* "CLOSE THIS ACCOUNT?" — the confirmation that sits ON TOP of the Edit modal (`S6e`).
 *
 * A SECOND MODAL, NOT A SECOND SCREEN, and the distinction is the whole point. The Edit modal's
 * other screens are questions you walk THROUGH - type, firm - and Back returns to where you were.
 * This is not part of that flow: it interrupts it, gets an answer, and hands control straight back
 * to the form still sitting underneath. Rendering it as a screen would mean the Edit modal loses
 * its own state to something that is not one of its steps.
 *
 * IT WRITES ON CONFIRM, and Save/Cancel do not touch it afterwards. That looks like a contradiction
 * of the rule that the form never auto-saves, and it is not: the rule exists because in v2 a single
 * tap on "Mark passed" retired an account - an irreversible-feeling act with no moment of intent in
 * it. THIS SCREEN IS THAT MOMENT. Once a trader has read what will change and pressed the red
 * button, staging the result would be worse: they would have confirmed something that had not
 * happened, and Cancel would silently undo a decision they believe they made.
 *
 * ─── THE OUTCOMES ARE NOT v2'S, AND THE SCHEMA IS WHY ──────────────────────────────────────────
 *
 * v2 offers passed/failed for BOTH prop types - "Ended in good standing" writes `passed` on a
 * sim-funded account. This build's CHECK constraint refuses that pair outright: an evaluation may be
 * `passed` or `failed`, a SIM-FUNDED account may be `failed` or `closed`, a personal one may only be
 * `closed` (`schema.ts`). Porting v2's map verbatim would have produced a write the database
 * rejects, on the one path a trader reaches least often and would trust most.
 *
 * The constraint is also RIGHT about the vocabulary, which is what makes this a port rather than a
 * workaround. Luke made the same point about v2's copy on 2026-07-31: *"sim funded you dont pass
 * really"*. There is no target on a funded account. It ends by breaching, by finishing its payout
 * ladder, or by being retired - so `closed` is the honest token and "Ended in good standing" is the
 * honest label for it.
 *
 * NO FIRM-SPECIFIC NUMBERS anywhere below. Targets, drawdown types and consistency rules differ per
 * firm AND per product and change without notice - the same reason `account-fields.tsx` refuses to
 * ask a trader to transcribe their rulebook.
 *
 * NO SUB-COPY UNDER THE OPTIONS (Luke, 2026-07-31: "traders know what they mean"). They each had a
 * line of explanation, which was teaching a trader their own vocabulary back to them.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmHeader, EndingChoice } from './shared';
import { ModalActions } from './modal-shell';
import { ConfirmShell, ConfirmFooter } from './confirm-shell';
import { ACCOUNT_ENDINGS, ACCOUNT_TYPE_LABELS } from '@/lib/prop-firms';
import type { AccountStatus, AccountType } from '@/lib/db/schema';

/* THE OUTCOMES MOVED TO `prop-firms.ts` (2026-08-28) and this file now reads them. They were
 * declared here first, which was right while this was the only screen that knew what an ending is -
 * and stopped being right the moment the EDITOR had to ask the same question, when a type change
 * leaves a stored ending the new type cannot hold. Two copies of "a sim-funded account is closed or
 * blown" is how one of them eventually offers an ending the CHECK constraint refuses.
 * A PERSONAL ACCOUNT NOW CARRIES ONE OUTCOME rather than none. `asks` below is what decides whether
 * a question appears, and it reads the LENGTH - so the single value is still there to be written,
 * where the empty array used to mean "do not ask" and lose the answer at the same time. */

export function CloseAccountModal({
  accountId,
  accountType,
  onCancel,
  onClosed,
}: {
  accountId: string;
  /* THE TYPE ON SCREEN, not the one in the database. A trader who switched the type row to
     Evaluation and then pressed Close is looking at an evaluation, so it must be an evaluation this
     asks about - reading the saved value here would silently skip the passed/failed question on the
     exact account that needs it. The write carries the type too, for the CHECK constraint's sake. */
  accountType: AccountType | null;
  onCancel: () => void;
  /* HANDS BACK WHAT IT COMMITTED, so the form underneath can repaint without a round trip - its
     Actions row flips to "Account is closed" and states this date. Passing nothing would mean the
     form either re-reads the server or shows a stale row, and it stays open either way. */
  onClosed: (status: AccountStatus, closedOn: string) => void;
}) {
  const outcomes = accountType ? ACCOUNT_ENDINGS[accountType] : [];
  /* ONE OUTCOME IS NOT A QUESTION. A personal account only closes, so offering a list of one asks a
     trader to pick the only thing that could happen. */
  const asks = outcomes.length > 1;
  const [outcome, setOutcome] = useState<AccountStatus | null>(
    asks ? null : (outcomes[0]?.value ?? 'closed')
  );
  /* TODAY IN THE BROWSER'S CLOCK, which is the trader's - and `new Date()` is safe here where it is
     not in a server-rendered component, because this only ever mounts on a click. `sv-SE` is the
     shortest way to a YYYY-MM-DD that respects the local day rather than UTC's. */
  const [closedOn, setClosedOn] = useState(() => new Date().toLocaleDateString('sv-SE'));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    // `closedOn` too: a native date input can be cleared, and an empty one would 400 at the route
    // with a message about a bad date - a worse way to learn the field is required than the button
    // simply not being pressable.
    if (!outcome || !closedOn || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: accountId, status: outcome, closedOn, accountType }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || 'Could not close this account. Try again.');
      }
      onClosed(outcome, closedOn);
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : 'Could not close this account. Try again.');
    }
  }

  return (
    /* THE CONTAINER IS `ConfirmShell`'S CALL, not this file's: a centred alert on a desktop, a
       full-screen sheet on a phone. `dismiss` is the wrapped cancel - on a phone it lets the sheet
       travel before the owner unmounts it - so every control that backs out must use it rather than
       `onCancel`, including the header's X. */
    <ConfirmShell onCancel={onCancel} busy={saving} label="Close this account?">
      {(dismiss) => (
        <>
          <ConfirmHeader title="Close this account?" onCancel={dismiss} />

          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-5">
            {asks && (
              <div className="mb-5">
                <p className="text-body text-muted mb-2 font-medium">How did it end?</p>
                <div className="flex flex-col gap-2">
                  {outcomes.map((o) => (
                    <EndingChoice
                      key={o.value}
                      label={o.label}
                      on={outcome === o.value}
                      onPick={() => setOutcome(o.value)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-body text-muted mb-2 font-medium">Date closed</p>
              {/* A NATIVE DATE INPUT rather than a picker component. It is keyboard-operable, it is
                  localised by the browser, and it is the one field on this screen a trader will
                  usually leave alone - building a calendar for it would be the most code in the
                  modal spent on the least-touched control. */}
              <Input
                type="date"
                value={closedOn}
                max={new Date().toLocaleDateString('sv-SE')}
                onChange={(e) => setClosedOn(e.target.value)}
                aria-label="Date closed"
              />
            </div>

            {/* WHAT WILL CHANGE, stated before the button rather than discovered after it. Every
                line is here because a trader closing an account is worried about exactly one thing -
                that they are about to lose the record - and the second line is the answer.
                v2's first line PROMISED TWO THINGS THAT DO NOT HAPPEN: "it comes off the active
                roster and stops taking new fills". Closing writes `status` and `closed_on` and
                nothing else, so the row stays exactly where it was wearing a chip; and an import
                naming a closed account still files to it, which is the RIGHT behaviour - refusing a
                historical backfill because the account has since ended would drop exactly the
                sessions this product exists to keep. */}
            <div className="bg-surface-2 mt-5 rounded-[var(--radius-sm)] p-4">
              <p className="text-body-lg text-text font-medium">What changes</p>
              <ul className="mt-2 flex flex-col gap-2">
                {[
                  /* "Hide takes it off your list" IS TRUE AGAIN. v2 fixed this line once, from a
                     version claiming closing removed the row and stopped new fills - it does
                     neither. I then shipped "It stays on your list", which was true but pointed at
                     nothing, because Hide had no control in this build yet. It does now, one section
                     up in the editor behind this modal, so v2's wording is both accurate and
                     useful. */
                  'It shows as closed. Hide takes it off your list.',
                  `Every trade stays, and its P&L stays in your ${ACCOUNT_TYPE_LABELS[accountType ?? 'personal'].toLowerCase()} total.`,
                  /* THE ONE A TRADER CLOSING AN ACCOUNT MOST NEEDS. Reopen is a button in the editor
                     behind this, needing no confirmation of its own, so this promise is one press
                     away rather than a claim. */
                  'You can reopen it at any time.',
                ].map((line) => (
                  <li key={line} className="text-body text-muted flex gap-2">
                    <span aria-hidden>&bull;</span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <ConfirmFooter error={error}>
            <ModalActions>
              <Button variant="secondary" size="sm" onClick={dismiss} disabled={saving}>
                Cancel
              </Button>
              {/* RIGHTMOST, where Save sits everywhere else. Moving the commit position for the
                  dangerous case is the version of "are you sure" that makes people mis-click the
                  thing they were trying to avoid. */}
              <Button
                size="sm"
                variant="danger"
                disabled={!outcome || !closedOn}
                loading={saving}
                onClick={() => void confirm()}
              >
                Close account
              </Button>
            </ModalActions>
          </ConfirmFooter>
        </>
      )}
    </ConfirmShell>
  );
}
