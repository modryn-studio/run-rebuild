'use client';

/* "WHICH ACCOUNT IS THIS?" — the confirm step for a row that arrived inside a CSV (`S6d` C3).
 *
 * An import creates an account row from the only identity the export carries: a name like
 * `FTDFYL100183704873`. The firm, the size and the type are absent from every one of the six
 * Tradovate export types and from the API too, so the row lands real, holding real fills, and
 * unnamed. This is the screen that names it.
 *
 * IT IS A CONFIRM, NOT AN INTERROGATION, and that ordering is the whole design. Run's promise is
 * that it pays attention, so after a file lands it should STATE what it found and let the trader
 * correct it, never open with a form. Hence: the account name is shown as fact, a known prefix
 * pre-fills the firm as a suggestion the trader can overrule, and only what is genuinely unknowable
 * gets asked.
 *
 * ONE QUESTION PER SCREEN (Jobs and Rams, independently, 2026-07-30). v2's first version was a
 * single screen stacking a fact block, type chips, a firm picker, a siblings switch and a size row -
 * which offers to answer a question the trader has not been asked yet.
 *
 * THE SUGGESTION SKIPS A SCREEN, and that is the point of having one. A confirmed prefix fills the
 * firm before the trader is asked, so answering "Evaluation" lands them straight on the editor with
 * the firm already stated. Back and Change both lead to the picker.
 *
 * ASKED ONCE PER LOGIN, NOT ONCE PER ACCOUNT. Each prop firm issues its own Tradovate username, and
 * every account under that login shares the account-name prefix. So when siblings exist the firm
 * answer offers to cover all of them: a copy-trader with eleven accounts across two firms answers
 * twice. Type and size stay per-account, because a trader farming five evaluations can have exactly
 * one promoted, and spreading that would be Run inventing a fact.
 *
 * ─── WHAT THIS DOES NOT DO, BY DECISION (Luke, 2026-08-27) ─────────────────────────────────────
 * No Close and no Delete. v2's editor ends with both, each opening a stacked confirmation, and they
 * carry most of its shipped bug list - delete fired on first click and then 404'd the page it stood
 * on. They are their own slice with their own attention.
 * No "Set the line": `daily_line_cents` is cut (`s6-plan.md` D2).
 * No free-text rename: the title is derived from firm + size + last 4, and a typed name competing
 * with it on every roster row is new design rather than a port.
 */

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { slotSurface } from '@/components/ui/card';
import { ModalHeader } from './shared';
import { ModalBody, ModalFooter, ModalActions } from './modal-shell';
import { FirmPicker } from './firm-picker';
import { Field, TypeRows, SizeField } from './account-fields';
import { AccountLogo } from './account-logo';
import { cn } from '@/lib/cn';
import {
  ACCOUNT_TYPE_LABELS,
  accountPrefix,
  isPersonalFirm,
  isPlaceholderAccountName,
  knownFirmForAccount,
  PERSONAL_FIRM,
  placeholderAccountTitle,
} from '@/lib/prop-firms';
import type { AccountType } from '@/lib/db/schema';
import type { RosterAccount } from '@/lib/accounts/read';

/** The three things this modal can be showing. See the navigation note inside the component. */
type Screen = 'type' | 'firm' | 'edit';

export function LabelAccountForm({
  account,
  siblingCount,
  onClose,
  onSaved,
  onBusyChange,
}: {
  account: RosterAccount;
  /* HOW MANY OTHER ACCOUNTS SHARE THIS ONE'S PREFIX. Computed by the caller, which holds the whole
     roster; asking the server would be a round trip for a number already on screen. */
  siblingCount: number;
  onClose: () => void;
  onSaved: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const router = useRouter();

  // A real Tradovate name, or one of Run's own placeholder keys. Placeholders have nothing to state
  // as fact and no siblings to spread a firm to.
  const realName = !isPlaceholderAccountName(account.externalAccountId);
  const prefix = accountPrefix(account.externalAccountId);

  /* ALREADY-STATED WINS, then a confirmed prefix as a SUGGESTION, then nothing. A suggestion is only
     ever a prefix another trader confirmed on their own account, never read off the letters.
     `isPersonalFirm` GUARDS THE SEED, and it is the fix for a real v2 bug (Luke, 2026-07-31): a
     personal account stores the literal "Personal" in `propFirm`, so this line used to seed the firm
     field with it - and switching that account to Evaluation then rendered a firm row for a prop
     firm called Personal, complete with a "P" avatar. A sentinel is not a suggestion. */
  const suggested =
    (isPersonalFirm(account.propFirm) ? null : account.propFirm) ??
    (prefix ? knownFirmForAccount(account.externalAccountId) : null);

  const [firm, setFirm] = useState(suggested ?? '');
  const [type, setType] = useState<AccountType | null>(account.accountType);
  const [size, setSize] = useState<number | null>(account.sizeDollars);
  const [applyToSiblings, setApplyToSiblings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

  const isProp = type !== null && type !== 'personal';

  /* ─── NAVIGATION, HELD RATHER THAN DERIVED ─────────────────────────────────────────────────────
   *
   * v2 computed the current screen FROM THE ANSWERS - `type === null ? 'type' : isProp && !firm ?
   * 'firm' : 'edit'` - which was elegant while this was a one-way wizard: every answer advanced you,
   * so the answers really were the position.
   *
   * It broke the moment the same component became an editor, because the only way to navigate
   * BACKWARDS was then to erase an answer. All three bugs Luke found (2026-07-31) are that one
   * cause: Change on Type ran `setType(null)`, so the type screen had nothing to tick but the SAVED
   * value; with `type` erased there was no previous screen to compute, so there was NO BACK ARROW;
   * and Back from the firm screen also erased the type, landing you on the type list instead of the
   * editor you came from.
   *
   * So POSITION IS ITS OWN STATE and `type` only ever holds an answer. A one-entry stack means this
   * is the first screen and the header shows no arrow at all. */
  const [stack, setStack] = useState<Screen[]>(() => [
    account.accountType === null
      ? 'type'
      : account.accountType !== 'personal' && !suggested
        ? 'firm'
        : 'edit',
  ]);
  const screen = stack[stack.length - 1];

  /** Open a screen the trader asked for (a Change link). Back returns here. */
  const open = (to: Screen) => setStack((s) => [...s, to]);
  const back = () =>
    setStack((s) => {
      if (s.length > 1) return s.slice(0, -1);
      onClose();
      return s;
    });

  /* AN ANSWER WAS GIVEN: go where the flow goes next, EXCEPT that if the next screen is one we came
     THROUGH, unwind to it rather than stacking a second copy.
     That one rule is what makes this component serve both flows. In the wizard nothing is behind
     you, so every answer pushes and Back walks the questions in order. In the editor the editor
     itself is at the bottom of the stack, so answering a question opened from a Change link RETURNS
     you to it rather than burying it - which is what "changing one thing" means. */
  const answered = (next: Screen) =>
    setStack((s) => (s.includes(next) ? s.slice(0, s.indexOf(next) + 1) : [...s, next]));

  /* TYPE NEVER CLEARS THE FIRM (Luke, 2026-07-30, found by using it). Switching to Personal used to
     wipe `firm` and `size`, so going Evaluation -> Personal -> Evaluation dropped the trader on the
     full firm list with the suggestion gone. Nothing needs clearing: `save()` already sends the
     `Personal` sentinel and a null size for a personal account, so the held values are invisible
     rather than wrong, and keeping them means every answer survives a change of mind. */
  const pickType = (t: AccountType) => {
    setType(t);
    answered(t !== 'personal' && !firm ? 'firm' : 'edit');
  };

  const ready = type !== null && (!isProp || (Boolean(firm) && size !== null));

  async function save() {
    if (savingRef.current || !ready || type === null) return;
    savingRef.current = true;
    setSaving(true);
    onBusyChange(true);
    setError(null);
    try {
      const res = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: account.id,
          /* THE SENTINEL IS WRITTEN DELIBERATELY. A personal account has no prop firm, and storing
             `null` would be indistinguishable from "not answered yet" - which is the state the
             roster draws as `Unlabelled`. `PERSONAL_FIRM` says the trader answered and the answer
             was "none". `isPersonalFirm` is what every reader tests. */
          propFirm: isProp ? firm : PERSONAL_FIRM,
          accountType: type,
          /* AN EXPLICIT NULL IS A REAL ANSWER, not a missing field: re-labelling a 50K evaluation as
             a personal account has to CLEAR the size, or the row keeps a firm-set size it no longer
             has and every percentage downstream is computed against a number that means nothing. */
          sizeDollars: isProp ? size : null,
          /* ONLY WHEN THERE IS SOMETHING TO SPREAD TO, and only for a real broker name: a
             placeholder key has no prefix, and the route refuses anything that is not 2-16 letters
             anyway. Belt and braces, because this one writes to rows the trader is not looking at. */
          ...(isProp && applyToSiblings && realName && prefix && siblingCount > 0
            ? { applyFirmToPrefix: prefix }
            : {}),
        }),
      });
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        const message =
          typeof body === 'object' && body !== null && 'error' in body
            ? String((body as { error: unknown }).error)
            : 'Could not save the account';
        throw new Error(message);
      }
      /* `router.refresh()` IS THE WHOLE UPDATE. Every surface that shows this account - the roster,
         the rail, the breadcrumb, the chart's own scoping - is a Server Component reading the
         corpus, so re-reading is the one source of truth. Patching local state as well would make a
         second one, and the two would disagree the first time a field was added. */
      router.refresh();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the account');
      savingRef.current = false;
      setSaving(false);
      onBusyChange(false);
    }
  }

  const title =
    screen === 'type' ? 'Which kind of account?' : screen === 'firm' ? 'Which firm?' : 'Edit account';

  return (
    <>
      <ModalHeader
        title={title}
        onBack={stack.length > 1 ? back : undefined}
        onClose={saving ? undefined : onClose}
      />

      {screen === 'type' && (
        <ModalBody>
          {realName && <NameFact account={account} />}
          <TypeRows onPick={pickType} current={type} />
        </ModalBody>
      )}

      {screen === 'firm' && (
        <ModalBody>
          <FirmPicker
            autoFocus
            onPick={(f) => {
              setFirm(f);
              answered('edit');
            }}
          />
        </ModalBody>
      )}

      {screen === 'edit' && (
        <>
          <ModalBody>
            {realName && <NameFact account={account} />}

            {/* EACH ANSWER AS A ROW WITH A CHANGE LINK, which is what makes this an editor rather
                than a second pass through the wizard. */}
            <Field label="Type">
              <Answer value={ACCOUNT_TYPE_LABELS[type ?? 'personal']} onChange={() => open('type')} />
            </Field>

            {isProp && (
              <>
                <Field label="Firm">
                  <Answer
                    value={firm || 'Not named yet'}
                    muted={!firm}
                    mark={firm || null}
                    onChange={() => open('firm')}
                  />
                </Field>

                {/* THE SIBLINGS OFFER, and it appears only when there ARE siblings - a switch that
                    would affect nothing is a control that does nothing. It says the count, because
                    "also apply to 10 accounts" is a different decision from "also apply to 1". */}
                {realName && prefix && siblingCount > 0 && (
                  <div className="mt-4">
                    {/* `Switch` OWNS ITS OWN TITLE AND NOTE, so this is the primitive rather than a
                        hand-rolled row around a toggle - the same object `/trades`' filter sheet
                        uses. The note says the COUNT, because "also apply to 10 accounts" is a
                        different decision from "also apply to 1", and it says what does NOT spread,
                        because that is the part a trader would otherwise have to trust. */}
                    <Switch
                      on={applyToSiblings}
                      onToggle={() => setApplyToSiblings((v) => !v)}
                      title={`Apply to your other ${prefix} accounts`}
                      note={`${siblingCount} ${siblingCount === 1 ? 'account shares' : 'accounts share'} this login. Only the firm is copied.`}
                    />
                  </div>
                )}

                <SizeField
                  value={size}
                  onChange={setSize}
                  hint={account.sizeDollars !== null ? '(read from your import)' : undefined}
                />
              </>
            )}
          </ModalBody>

          <ModalFooter>
            {/* THE ERROR SITS WITH THE BUTTON THAT CAUSED IT, not at the top of a body the trader
                has scrolled past. */}
            {error && <p className="text-neg text-body mr-auto">{error}</p>}
            <ModalActions>
              <Button variant="secondary" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={save} disabled={!ready || saving} loading={saving}>
                Save
              </Button>
            </ModalActions>
          </ModalFooter>
        </>
      )}
    </>
  );
}

/* WHAT THE BROKER CALLED IT, STATED AS FACT. This is the "confirm, do not interrogate" half made
 * literal: before any question, the screen says what Run found. Never the raw key - `pending:` and
 * `default-` are Run's own bookkeeping and may never reach a person. */
function NameFact({ account }: { account: RosterAccount }) {
  return (
    <div className={cn(slotSurface, 'flex items-center gap-3 px-4 py-3')}>
      <AccountLogo propFirm={account.propFirm} size={32} />
      <span className="min-w-0">
        <span className="text-body text-muted block">Your broker calls this</span>
        <span className="text-body-lg text-text block truncate font-medium tabular-nums">
          {placeholderAccountTitle(account.externalAccountId)}
        </span>
      </span>
    </div>
  );
}

/** One settled answer, with the way to change it. */
function Answer({
  value,
  onChange,
  muted,
  mark,
}: {
  value: string;
  onChange: () => void;
  muted?: boolean;
  mark?: string | null;
}) {
  return (
    <div className="border-border flex min-h-12 items-center gap-3 rounded-[var(--radius-sm)] border px-4">
      {mark && <AccountLogo propFirm={mark} size={24} />}
      <span className={cn('text-body min-w-0 flex-1 truncate', muted ? 'text-muted' : 'text-text')}>
        {value}
      </span>
      {/* A BUTTON, NOT A LINK: it goes nowhere, it changes which screen of this dialog is showing.
          `text-link` because that is what it reads as beside a stated value. */}
      <button type="button" onClick={onChange} className="text-link hit-44 shrink-0">
        Change
      </button>
    </div>
  );
}
