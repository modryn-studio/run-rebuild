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
 * ─── CLOSE AND DELETE ARRIVED IN `S6e`, held back from C3 on purpose ───────────────────────────
 * They carry most of v2's shipped bug list for this screen, so they got their own pass rather than
 * riding in on the end of a large one. Both open a SECOND MODAL rather than a second screen - see
 * `close-account-modal.tsx` for why that distinction is load-bearing.
 * No "Set the line": `daily_line_cents` is cut (`s6-plan.md` D2).
 * No free-text rename: the title is derived from firm + size + last 4, and a typed name competing
 * with it on every roster row is new design rather than a port.
 */

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { slotSurface } from '@/components/ui/card';
import { ModalHeader } from './shared';
import { ModalBody, ModalFooter, ModalActions } from './modal-shell';
import { FirmPicker } from './firm-picker';
import { CloseAccountModal } from './close-account-modal';
import { DeleteAccountModal } from './delete-account-modal';
import { Field, TypeRows, SizeField } from './account-fields';
import { AccountLogo } from './account-logo';
import { cn } from '@/lib/cn';
import {
  ACCOUNT_TYPE_LABELS,
  accountRowTitle,
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
  const [displayName, setDisplayName] = useState(account.displayName ?? '');
  const [hidden, setHidden] = useState(account.hidden);
  const [excluded, setExcluded] = useState(account.excludedFromTotals);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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

  /* WHAT THE ROW WOULD BE CALLED WITH NO DISPLAY NAME, shown as the field's placeholder - so an
     empty box STATES the fallback rather than leaving the trader to guess it. Computed off the
     PENDING answers rather than the saved ones, so changing the size updates the placeholder and the
     trader can see what they are opting out of. */
  const derivedTitle = accountRowTitle({
    ...account,
    displayName: null,
    propFirm: isProp ? firm || account.propFirm : PERSONAL_FIRM,
    sizeDollars: isProp ? size : null,
  });

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
          /* SENT ON EVERY SAVE, INCLUDING EMPTY. "" is the trader clearing the name back to the
             derived form, which is an answer rather than an absence - the route normalises it to
             null. Omitting it when empty would make "clear this name" impossible. */
          displayName,
          hidden,
          excludedFromTotals: excluded,
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
        /* `px-6` IS THE MODAL'S OWN GUTTER AND IT WAS MISSING (2026-08-28, Luke: "the modal screen
           (the edit screens) dont fit the modal properly"). `ModalBody` deliberately carries no
           horizontal padding — the upload step's progress panel needs to reach the card's edges —
           so every screen states its own, and these three stated none. Measured against v2: its
           fields sit in a 24px gutter, mine ran to the card edge.
           `key={screen}` + `value-fade` is the other half: the body fades when the screen changes,
           which is what makes a three-screen stack read as one object changing rather than three
           modals flickering. An animation only re-fires when its key does. */
        <ModalBody key={screen} className="value-fade px-6 pt-1 pb-5">
          {realName && <NameFact account={account} />}
          <TypeRows onPick={pickType} current={type} />
        </ModalBody>
      )}

      {screen === 'firm' && (
        <ModalBody key={screen} className="value-fade px-6 pt-4 pb-5">
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
          {/* THE EDITOR: everything you can change about an account that already has a type. Type
              and Firm are ROWS you can change rather than screens you must pass through, and the
              sections below them render only when they apply - a personal account has no firm and
              no size, and shows neither.
              NO BROKER-NAME BLOCK HERE. It belongs to the `type` screen, which is where a trader is
              being asked to identify a row they have not seen before. In the editor they already
              know which account they opened; the breadcrumb behind the modal says so. */}
          <ModalBody key={screen} className="value-fade px-6 pt-4">
            {/* THE TRADER'S OWN NAME, and the reason it is the FIRST field is the copy-trader: five
                50Ks under one login otherwise read as five identical rows differing in four digits.
                Empty means "use the derived name", which is what almost every account will do - the
                placeholder shows what that name currently is, so an empty box is not a mystery. */}
            <Field label="Name" hint="optional">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={derivedTitle}
                maxLength={60}
                aria-label="Account name"
              />
            </Field>

            <Field label="Type">
              <ChangeableRow
                label={ACCOUNT_TYPE_LABELS[type ?? 'personal']}
                onChange={() => open('type')}
              />
            </Field>

            {isProp && (
              <Field label="Firm">
                <ChangeableRow
                  label={firm || 'Not named yet'}
                  logo={firm ? <AccountLogo propFirm={firm} size={32} /> : undefined}
                  onChange={() => open('firm')}
                />
              </Field>
            )}

            {isProp && <SizeField value={size} onChange={setSize} />}

            {/* OFFERED ONLY WHEN THERE IS SOMETHING TO SPREAD IT TO, and default ON: a trader with
                siblings almost always wants this, and the alternative is answering the same question
                eleven times.
                NO NOTE UNDER IT (v2, Luke 2026-08-05: "the copy is confusing... do we even need this
                copy?"). It read "One login per firm, so they are all the same firm", which argued a
                premise back at the person who set the login up. The TITLE already carries the
                evidence: it names the PREFIX, and the prefix is the whole reason these accounts are
                known to be one firm. A switch that has to explain itself in a second sentence is
                usually a title that has not done its job, and this title had. */}
            {isProp && realName && prefix && siblingCount > 0 && (
              <div className="mt-4">
                <Switch
                  on={applyToSiblings}
                  onToggle={() => setApplyToSiblings((v) => !v)}
                  title={`Apply this firm to my other ${siblingCount} ${prefix} account${siblingCount === 1 ? '' : 's'}`}
                />
              </div>
            )}

            {/* TWO KINDS OF "DO NOT SHOW ME THIS", and they are genuinely different questions.
                Hiding is about the LIST; excluding is about the ARITHMETIC. Neither touches an
                event, which is what lets a trader use them without fear.
                HIDE IS NOT A ONE-WAY DOOR HERE, which is the bug v2 shipped: it filtered hidden
                rows out in SQL, and the roster row was the only route back to this modal. This
                build's `getRoster` deliberately does not filter them and `roster-card.tsx` puts
                them in a disclosure flap instead, so a hidden account is one tap from being
                un-hidden. */}
            <Section title="Visibility">
              <Switch
                on={hidden}
                onToggle={() => setHidden((v) => !v)}
                title="Hide account"
                note="Hides it from your Accounts page."
              />
              <div className="mt-2">
                <Switch
                  on={excluded}
                  onToggle={() => setExcluded((v) => !v)}
                  title="Exclude account P&L"
                  note="Keeps its P&L out of your Accounts chart and totals. The row stays."
                />
              </div>
            </Section>

            {/* ACTIONS: everything above changes a LABEL, everything here changes what the account
                IS - and unlike everything above, these COMMIT ON PRESS through their own
                confirmation. The rule that this modal never auto-saves is about a bare tap having
                consequences; each of these has a confirmation screen, which is the moment of intent
                that rule was asking for. Cancel does not undo a close.
                CARDS, matching the Visibility switches exactly, with the control on the right where
                their switches sit - so "a thing you can do to this account" and "a thing you can set
                about this account" are the same object with a different control in the slot.
                WHICH ONES APPEAR: Close only on an `active` account, because `active` is the only
                status you can close FROM and a null type may only be active. Delete only at zero
                trades, because the route refuses anything else with a 409 - and a button that is
                going to be refused should not be how a trader learns the rule.
                A CLOSED ACCOUNT SHOWS NEITHER, which is the honest gap rather than an oversight:
                Reopen is real work with its own question, and a Close button a closed account
                cannot use would be worse than nothing. */}
            {(account.status === 'active' || account.trades === 0) && (
              <Section title="Actions">
                {account.status === 'active' && type !== null && (
                  <ActionRow
                    title="Close account"
                    note="Mark how it ended. Every trade stays."
                    action={
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setConfirmingClose(true)}
                        disabled={saving}
                      >
                        Close
                      </Button>
                    }
                  />
                )}
                {account.trades === 0 && (
                  <div className={account.status === 'active' ? 'mt-2' : ''}>
                    <ActionRow
                      title="Delete account"
                      note="Nothing has been imported into it, so no trades are lost."
                      action={
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setConfirmingDelete(true)}
                          disabled={saving}
                        >
                          Delete
                        </Button>
                      }
                    />
                  </div>
                )}
              </Section>
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

      {/* THE CONFIRMATIONS SIT OUTSIDE THE SCREEN SWITCH, so they can appear over ANY of them. They
          are reached only from the editor today, and putting them inside that branch would tie a
          modal's lifetime to which question is showing underneath it. */}
      {confirmingClose && (
        <CloseAccountModal
          accountId={account.id}
          accountType={type}
          onCancel={() => setConfirmingClose(false)}
          onClosed={() => {
            setConfirmingClose(false);
            /* THE SAME EXIT A SAVE TAKES. The write already happened, so `router.refresh()` and a
               close is what makes the change appear to happen IN the page. Staging it would mean
               Cancel could silently undo a decision the trader believes they made. */
            router.refresh();
            onSaved();
          }}
        />
      )}

      {confirmingDelete && (
        <DeleteAccountModal
          accountId={account.id}
          title={accountRowTitle(account)}
          onCancel={() => setConfirmingDelete(false)}
          onDeleted={() => {
            setConfirmingDelete(false);
            /* THE SECOND HALF OF v2'S DELETE BUG. The row is gone, and on `/accounts/details` the
               page IS that row - refreshing in place would re-render a 404 underneath a closing
               modal. So this LEAVES, to the one place that is still true.
               `replace`, not `push`: the deleted account's URL must not be one step of Back away. */
            router.replace('/accounts');
          }}
        />
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

/* A STATED ANSWER WITH ONE WAY TO CHANGE IT. The row is not a field: the value is settled, and the
 * only affordance is the word that unsettles it. A filled-in search box reads as still-searching,
 * which is the mistake this shape exists to avoid.
 *
 * FILLED, NOT BORDERED, and UNDERLINED rather than accent (2026-08-28, correcting the first port).
 * It shipped as a bordered box with an accent "Change", which made a settled answer look like an
 * input and made the link compete with Save for the one accent on the screen. v2 draws it on
 * `bg-hover` with a muted underlined link - the underline is what marks it as a link where the
 * colour no longer does. */
function ChangeableRow({
  label,
  logo,
  onChange,
}: {
  label: string;
  logo?: React.ReactNode;
  onChange: () => void;
}) {
  return (
    <div className="bg-hover flex min-h-11 items-center gap-3 rounded-[var(--radius)] px-4 py-2">
      {logo}
      <span className="text-body-lg text-text min-w-0 flex-1 truncate font-medium">{label}</span>
      <button
        type="button"
        onClick={onChange}
        // `-my-2 py-2` grows the tap box without moving the row's height.
        className="text-body text-muted hover:text-text -my-2 shrink-0 py-2 underline underline-offset-2 transition-colors"
      >
        Change
      </button>
    </div>
  );
}

/** A titled group of settings. `mt-8` rather than a rule: the gap IS the separation. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <p className="text-body-lg text-text mb-4 font-medium">{title}</p>
      {children}
    </div>
  );
}

/* A THING YOU CAN DO TO THIS ACCOUNT, drawn as the same card the Visibility switches are, with the
 * control in the slot their switch sits in. That is the whole reason it is a card rather than a
 * button in a row: "a thing you can set" and "a thing you can do" read as one family, and the only
 * difference is what is on the right. */
function ActionRow({
  title,
  note,
  action,
}: {
  title: string;
  note: string;
  action: React.ReactNode;
}) {
  return (
    <div className="bg-hover flex items-center gap-4 rounded-[var(--radius)] p-4">
      <div className="min-w-0 flex-1">
        <p className="text-body-lg text-text">{title}</p>
        <p className="text-body text-muted mt-0.5">{note}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
