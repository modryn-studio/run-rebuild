'use client';

/* ADD AN ACCOUNT BY HAND — the door for a trader who bought an evaluation this morning and has
 * nothing to import yet (`D5`, 2026-08-28).
 *
 * WHY IT EXISTS, given two intakes already do. Both of those work BACKWARDS from data that has
 * already happened. A brand-new account has no fills, and telling that trader to come back after
 * they have traded gets the order exactly wrong: the account row is where their loss line will
 * live, and the whole ritual is to arm that line WHILE CALM — before the first trade, not after the
 * bad one.
 *
 * THREE STEPS, ONE QUESTION EACH. Type, then firm, then size. Each screen asks one thing and the
 * answer advances, which is the pattern `LabelAccountForm` already uses — and v2 records the two
 * shapes it had to try first:
 *
 *   v1 put all three on one screen as chips floating in an empty card. A chip is a FILTER
 *      affordance, a thing you toggle beside other things, and this is "pick one, continue".
 *   v2 split type off but left the firm list and the size chips together, so a trader scrolling
 *      twenty-three firms could see a Size row underneath, offering to answer a question they had
 *      not been asked yet.
 *
 * TYPE FIRST is Jobs' call and survived both rewrites: firm and size are CONSEQUENCES of the type,
 * not peers of it. A personal account has no prop firm at all, so asking for one first meant the
 * form asked you to name a firm and then offered the answer "there isn't one".
 *
 * NO ASSET CLASS, deliberate rather than deferred. Tradovate is a futures broker, so every account
 * that can reach Run is a futures account. A picker offering options/forex/crypto would promise
 * three things the rail cannot deliver. THE SCOPE IS SET BY WHAT RUN CONNECTS TO, not by a field.
 *
 * IT DOES NOT ASK FOR THE TRADOVATE ACCOUNT NAME, and that omission is the feature. The row is
 * written with a `pending:` placeholder, and the ADOPTION PATH in `lib/intake/accounts.ts` is what
 * later gives it the real name — from an import the trader launches on this account's own page.
 * Asking someone to copy `FTDFYL100183704873` out of Tradovate is the chore this product ends.
 */

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ModalHeader } from './shared';
import { ModalBody, ModalFooter } from './modal-shell';
import { FirmPicker } from './firm-picker';
import { TypeRows, SizeField } from './account-fields';
import { AccountLogo } from './account-logo';
import { ACCOUNT_TYPE_LABELS, PERSONAL_FIRM, findPropFirm } from '@/lib/prop-firms';
import type { AccountType } from '@/lib/db/schema';

/* A COPY-TRADER BUYS THE SAME SKU SEVERAL TIMES OVER — five Apex 50Ks is the normal case, not an
 * edge one. Capped low because past a handful the honest answer is an import, not a form. */
const MAX_QTY = 10;

export function ManualAccountForm({
  onBack,
  onClose,
  onCreated,
  onBusyChange,
}: {
  onBack: () => void;
  onClose: () => void;
  onCreated: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [type, setType] = useState<AccountType | null>(null);
  const [firm, setFirm] = useState('');
  const [size, setSize] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* THE REAL REENTRANCY GUARD. `saving` state can read false in two handlers before either commits
     on a fast double-click, and this one creates ROWS. */
  const savingRef = useRef(false);

  const isProp = type !== null && type !== 'personal';

  /* WHICH SCREEN, DERIVED rather than stored — one source of truth, and no way for a step counter
     to disagree with the answers it is supposed to describe. This is the OPPOSITE call from
     `LabelAccountForm`, which holds its position in state, and the difference is real: that one is
     also an EDITOR, where going back must not mean erasing an answer. This is a one-way wizard with
     nothing behind it, so the answers genuinely are the position.
     PERSONAL NEVER LEAVES THE TYPE STEP: it has no firm and no size, so the screen after the
     question would hold one sentence of filler over a button. Picking it creates the account. */
  const step = type === null || type === 'personal' ? 'type' : !firm ? 'firm' : 'detail';
  const ready = type !== null && (!isProp || (Boolean(firm) && size !== null));

  // Back unwinds one answer at a time, in the order they were given.
  const back = () => {
    if (step === 'detail' && isProp) return setFirm('');
    if (step !== 'type') return setType(null);
    onBack();
  };

  /* `typeOverride` because Personal creates straight from the type row, and `setType` has not
     committed by the time this runs. */
  async function save(typeOverride?: AccountType) {
    const nextType = typeOverride ?? type;
    if (nextType === null) return;
    const nextProp = nextType !== 'personal';
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    onBusyChange(true);
    setError(null);
    try {
      /* SEQUENTIAL, NOT `Promise.all`. The route mints a `pending:` uuid per row, and firing ten at
         once only trades a slower loop for a thicker burst on one Neon connection.
         A PERSONAL ACCOUNT IS NEVER A BATCH — the quantity control belongs to prop SKUs a trader
         buys several of, and it never renders on that path. */
      const count = nextProp ? qty : 1;
      for (let i = 0; i < count; i++) {
        const res = await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            /* A PERSONAL ACCOUNT HAS NO PROP FIRM AT ALL, and the route requires one — so it
               carries the honest sentinel rather than a blank or a fabricated name.
               `isPersonalFirm` is what every reader tests, and storing null instead would be
               indistinguishable from "not answered yet", which the roster draws as `Unlabelled`. */
            propFirm: nextProp ? firm : PERSONAL_FIRM,
            accountType: nextType,
            sizeDollars: nextProp ? size : null,
          }),
        });
        if (!res.ok) throw new Error('create failed');
      }
      onBusyChange(false);
      onCreated();
    } catch {
      savingRef.current = false;
      setSaving(false);
      onBusyChange(false);
      setError('Could not add the account. Try again.');
    }
  }

  /* STEP 1 — WHICH KIND. No footer: every row IS the action, so a CTA underneath would be a second
     thing to press for a choice already made. */
  if (step === 'type') {
    return (
      <>
        <ModalHeader title="Add manually" onBack={back} onClose={onClose} />
        <ModalBody className="px-6 pt-1 pb-5">
          {/* SHARED WITH THE LABEL FORM (`account-fields`). Two forms asking the identical question
              in two shapes is how they drift, which is the whole reason those fields are a module.
              NO SUB-TEXT ON THE ROWS (v2, Luke 2026-07-30): "Evaluation" and "Sim Funded" are the
              prop industry's own glossary terms, not jargon Run invented, and explaining them to a
              trader who owns one is condescension wearing the costume of helpfulness. */}
          <TypeRows
            current={type}
            busy={saving ? 'personal' : null}
            onPick={(t) => (t === 'personal' ? void save('personal') : setType(t))}
          />
          {error && <p className="text-neg text-body mt-4">{error}</p>}
        </ModalBody>
      </>
    );
  }

  /* STEP 2 — WHICH FIRM. Nothing else on the screen: a Size row visible under a list of
     twenty-three firms was offering to answer a question the trader had not reached. */
  if (step === 'firm') {
    return (
      <>
        <ModalHeader title={ACCOUNT_TYPE_LABELS[type!]} onBack={back} onClose={onClose} />
        <ModalBody className="px-6 pt-4 pb-5">
          <FirmPicker onPick={setFirm} autoFocus />
        </ModalBody>
      </>
    );
  }

  /* STEP 3 — HOW BIG, AND HOW MANY. The chosen firm is restated as a ROW, not as a filled-in search
     field: a search box holding an answer reads as still-editable and still-searching, when the
     choice is made and the only way to change it is to go back. */
  return (
    <>
      <ModalHeader title={ACCOUNT_TYPE_LABELS[type!]} onBack={back} onClose={onClose} />

      <ModalBody className="px-6 pt-4">
        <div className="bg-hover flex items-center gap-3 rounded-[var(--radius)] px-4 py-2">
          <AccountLogo propFirm={firm} size={32} />
          <span className="min-w-0 flex-1">
            <span className="text-body-lg text-text block truncate font-medium">{firm}</span>
            {findPropFirm(firm) && (
              <span className="text-body text-muted block truncate">{findPropFirm(firm)!.domain}</span>
            )}
          </span>
        </div>

        <SizeField value={size} onChange={setSize} />

        {/* HOW MANY. The copy-trader case, and it is the normal one: traders buy the same SKU
            several times and run one strategy across all of them. Without this they would walk three
            screens per account, five times over. Shown only once a SIZE exists, so it cannot be
            answered before the thing it counts. */}
        {size !== null && (
          <div className="mt-5">
            <p className="text-body text-muted mb-2 font-medium">How many</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                aria-label="Fewer"
                disabled={qty <= 1}
                onClick={() => setQty((n) => Math.max(1, n - 1))}
                className="h-9 w-9 p-0"
              >
                {/* The icon set's `add` rotated is its CLOSE mark, and there is no minus glyph — so
                    this one is the button's own text rather than an inline svg the house rule
                    forbids. */}
                <span className="text-body-lg leading-none">&minus;</span>
              </Button>
              <span className="text-body-lg text-text w-8 text-center font-medium tabular-nums">
                {qty}
              </span>
              <Button
                variant="outline"
                size="sm"
                aria-label="More"
                disabled={qty >= MAX_QTY}
                onClick={() => setQty((n) => Math.min(MAX_QTY, n + 1))}
                className="h-9 w-9 p-0"
              >
                <Icon name="add" size={14} />
              </Button>
            </div>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        {error && <p className="text-neg text-body mr-auto">{error}</p>}
        <Button disabled={!ready} loading={saving} onClick={() => void save()} size="lg" className="w-full">
          {qty > 1 ? `Add ${qty} accounts` : 'Add account'}
        </Button>
      </ModalFooter>
    </>
  );
}
