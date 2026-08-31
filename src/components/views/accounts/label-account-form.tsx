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
import { ModalBody, ModalFooter, ModalActions } from '@/components/ui/modal-shell';
import { AccountSheet } from './account-sheet';
import { FirmPicker } from './firm-picker';
import { CloseAccountModal } from './close-account-modal';
import { EndingModal } from './ending-modal';
import { DeleteAccountModal } from './delete-account-modal';
import { Field, TypeRows, SizeField } from './account-fields';
import { AccountLogo } from './account-logo';
import { cn } from '@/lib/cn';
import {
  ACCOUNT_ENDINGS,
  ACCOUNT_TYPE_LABELS,
  accountStatusFits,
  accountRowTitle,
  accountPrefix,
  isPersonalFirm,
  isPlaceholderAccountName,
  knownFirmForAccount,
  PERSONAL_FIRM,
  placeholderAccountTitle,
} from '@/lib/prop-firms';
import type { AccountStatus, AccountType } from '@/lib/db/schema';
import type { RosterAccount } from '@/lib/accounts/read';

/** The three things this modal can be showing. See the navigation note inside the component. */
type Screen = 'type' | 'firm' | 'edit';

export function LabelAccountForm({
  account,
  siblingCount,
  onClose,
  onSaved,
  onBusyChange,
  sheet,
}: {
  account: RosterAccount;
  /* HOW MANY OTHER ACCOUNTS SHARE THIS ONE'S PREFIX. Computed by the caller, which holds the whole
     roster; asking the server would be a round trip for a number already on screen. */
  siblingCount: number;
  onClose: () => void;
  onSaved: () => void;
  onBusyChange: (busy: boolean) => void;
  /* PRESENT MEANS "YOU ARE A SHEET" (2026-08-28). Below 768px this editor is not a card floating over
     the roster but a full-screen panel whose SCREENS STACK - and `stack` is already exactly that
     stack, one entry per screen, which is why this took a container rather than a rewrite. Each
     entry becomes a layer, and because all three screens rename the bar ("Edit account" / "Which
     kind of account?" / "Which firm?") every one of them slides, which is the rule
     `account-sheet.tsx` states.
     `open` is the owner's, because the panel has to travel before the owner unmounts it. */
  sheet?: { open: boolean } | null;
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
  /* STATUS AND ITS DATE ARE HELD HERE, not read off `account` on every render, because Close and
     Reopen COMMIT ON PRESS and the form stays open underneath them. Reading the prop would leave the
     Actions row saying "Close account" until the trader dismissed and reopened the whole modal —
     which is the one place a write is invisible to the screen that caused it. */
  const [status, setStatus] = useState(account.status);
  const [closedOn, setClosedOn] = useState(account.closedOn);
  const [reopening, setReopening] = useState(false);
  /* THE ENDING THE TRADER RESTATES when a type change leaves the stored one behind, and the modal
     that asks for it. Held separately from `status` rather than overwriting it, because nothing is
     written until Save: the Actions row above must keep saying what the account IS. */
  const [ending, setEnding] = useState<AccountStatus | null>(null);
  const [askingEnding, setAskingEnding] = useState(false);

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
    /* A NEW TYPE, SO THE ANSWER TO "how did it end" IS STALE. Evaluation -> Sim Funded -> Evaluation
       must not carry `closed` across, and clearing here is the only place that sees every change. */
    setEnding(null);
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

  /* ─── THE ENDING HAS TO MOVE WITH THE TYPE ─────────────────────────────────────────────────────
   *
   * `schema.ts`'s CHECK pairs them: an evaluation is passed or failed, a sim-funded account is
   * failed or closed, a personal one only closes. So a CLOSED sim-funded account relabelled as an
   * evaluation is a pair the database refuses - and it refused it in production (2026-08-28, Luke,
   * on his own corpus), as a 500 and "Could not save the account" with no way forward. The type row
   * offered the change, Save sent the type alone, and the second fact was never asked for.
   *
   * SO THE EDITOR ASKS, on Save, in a modal of its own (`ending-modal.tsx`). `needsEnding` is true
   * only while a stored ENDING cannot survive the type on screen, so it can never fire on an active
   * account - every type permits `active`. */
  /* CLOSE COMMITS ON PRESS AND CARRIES THE TYPE ON SCREEN, which is right when that type is the
     stored one and wrong the moment it is not (2026-08-28, postcheck). Staging Personal -> Evaluation
     and then pressing Close wrote `accountType: 'evaluation'` WITHOUT the firm and size that
     `save()` pairs with a type change - landing an evaluation whose firm is the `Personal` sentinel
     and whose size is null, which is exactly the incoherent row `save()` normalises to prevent. It
     also walked straight past `ready`, so it could commit a change Save itself was refusing.
     SO CLOSE WAITS FOR SAVE. It is one press either way, and the alternative - having Close quietly
     write the rest of the form - would make Cancel a lie about a change the trader had not saved. */
  const typeStaged = type !== account.accountType;

  const endings = type ? ACCOUNT_ENDINGS[type] : [];
  const needsEnding = type !== null && !accountStatusFits(type, status);
  /* ONE ENDING IS NOT A QUESTION: relabelling anything as Personal can only mean `closed`, so that
     answer is taken rather than asked for and no modal ever opens. */
  const forcedEnding = needsEnding && endings.length === 1 ? endings[0].value : null;

  /* SAVE IS PRESSABLE, and the modal is what collects the answer. Holding the button disabled until
     a question the trader has not been asked yet is answered is a dead end with no sign on it. */
  const ready = type !== null && (!isProp || (Boolean(firm) && size !== null));

  /* REOPEN WRITES ON PRESS AND NEEDS NO CONFIRMATION, because it IS the undo. A control that asks
     "are you sure you want to undo?" is the reason people stop trusting undo.
     IT IS ALSO THE ONLY THING THAT UNDOES A CLOSE. Cancel does not: by the time this row is on
     screen the close has already been written, and letting Cancel silently revert it would mean the
     trader confirmed something and then had it taken back.
     LEGAL FOR EVERY TYPE. The schema's CHECK permits `active` against all three types and against a
     null one, so a reopen can never be refused for an incoherent pair — unlike a close. */
  async function reopen() {
    if (reopening) return;
    setReopening(true);
    setError(null);
    try {
      const res = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: account.id, status: 'active', closedOn: null }),
      });
      if (!res.ok) throw new Error('patch failed');
      setStatus('active');
      setClosedOn(null);
      /* The roster behind this modal is now stale, and the trader may leave via Cancel, which does
         not refresh. Refreshing here keeps every immediate write self-contained. */
      router.refresh();
    } catch {
      setError('Could not reopen this account. Try again.');
    } finally {
      setReopening(false);
    }
  }

  /* `picked` ARRIVES FROM THE MODAL, because a `setState` two lines earlier is not readable here -
     the answer has to travel as an argument or the first save after it would still send nothing. */
  async function save(picked?: AccountStatus) {
    if (savingRef.current || !ready || type === null) return;

    /* THE ONE QUESTION THE FORM STILL OWES. Asked here rather than at the type row, so changing a
       type is one uninterrupted gesture and the interruption lands where the trader has already
       said they are finished. Cancel on the modal returns to the editor with nothing written. */
    const nextStatus = needsEnding ? (forcedEnding ?? picked ?? ending) : null;
    if (needsEnding && !nextStatus) {
      setAskingEnding(true);
      onBusyChange(true);
      return;
    }

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
          /* SENT ONLY WHEN THE TYPE CHANGE FORCED IT, never on an ordinary save. `closedOn` is
             deliberately left alone: the account ended on the day it ended, and only the WORD for
             that ending is what the new type disagrees with. */
          ...(nextStatus ? { status: nextStatus } : {}),
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

  /* `.value-fade` IS THE MODAL'S TRANSITION AND THE SHEET HAS ITS OWN. In a card the three screens
     replace each other in place, so the body fades and that is the whole change the eye gets. In a
     sheet each screen is its own layer arriving from the bottom, so a fade on top of the slide would
     be two answers to one question - and the layer would be transparent for the first 140ms of its
     travel, which reads as a rendering fault rather than as motion. */
  const fade = sheet ? '' : 'value-fade';

  const TITLES: Record<Screen, string> = {
    type: 'Which kind of account?',
    firm: 'Which firm?',
    edit: 'Edit account',
  };

  /* ONE SCREEN, BUILT BY NAME rather than by reading `screen` — because a sheet renders ALL of them
     at once, one per layer, and only the modal renders the current one. The header is identical in
     every layer and correct in every layer, since `SurfaceHeader` renders it only for the layer the
     sheet considers active, which is always the top of this stack. */
  const screenNode = (s: Screen) => (
    <>
      <ModalHeader
        title={TITLES[s]}
        onBack={stack.length > 1 ? back : undefined}
        onClose={saving ? undefined : onClose}
      />

      {s === 'type' && (
        /* `px-6` IS THE MODAL'S OWN GUTTER AND IT WAS MISSING (2026-08-28, Luke: "the modal screen
           (the edit screens) dont fit the modal properly"). `ModalBody` deliberately carries no
           horizontal padding — the upload step's progress panel needs to reach the card's edges —
           so every screen states its own, and these three stated none. Measured against v2: its
           fields sit in a 24px gutter, mine ran to the card edge.
           `key={screen}` + `value-fade` is the other half: the body fades when the screen changes,
           which is what makes a three-screen stack read as one object changing rather than three
           modals flickering. An animation only re-fires when its key does. */
        <ModalBody key={s} className={cn(fade, 'px-6 pt-1 pb-5')}>
          {realName && <NameFact account={account} />}
          <TypeRows onPick={pickType} current={type} />
        </ModalBody>
      )}

      {s === 'firm' && (
        <ModalBody key={s} className={cn(fade, 'px-6 pt-4 pb-5')}>
          <FirmPicker
            autoFocus
            onPick={(f) => {
              setFirm(f);
              answered('edit');
            }}
          />
        </ModalBody>
      )}

      {s === 'edit' && (
        <>
          {/* THE EDITOR: everything you can change about an account that already has a type. Type
              and Firm are ROWS you can change rather than screens you must pass through, and the
              sections below them render only when they apply - a personal account has no firm and
              no size, and shows neither.
              NO BROKER-NAME BLOCK HERE. It belongs to the `type` screen, which is where a trader is
              being asked to identify a row they have not seen before. In the editor they already
              know which account they opened; the breadcrumb behind the modal says so. */}
          <ModalBody key={s} className={cn(fade, 'px-6 pt-4')}>
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
                IS - and unlike everything above, these COMMIT ON PRESS. The rule that this modal
                never auto-saves is about a bare tap having consequences; Close and Delete each have
                a confirmation screen, which is the moment of intent that rule was asking for.
                CANCEL DOES NOT UNDO A CLOSE. Only Reopen does.
                CARDS, matching the Visibility switches exactly, with the control on the right where
                their switches sit - so "a thing you can do to this account" and "a thing you can set
                about this account" are the same object with a different control in the slot.

                ─── WHY CLOSE EXISTS AT ALL ────────────────────────────────────────────────────
                Nothing in this build detects a breach or a hit target: there is no drawdown tracking
                and no profit-target figure, so an account's ending cannot be inferred. Close IS the
                manual statement of it, and that is the whole job — the trader says the account ended
                and how, and the roster's chip and every "your evaluation total" figure follow from
                that one answer. If breach detection ever lands, it proposes this answer rather than
                replacing the control.

                AN UNLABELLED ACCOUNT CANNOT CLOSE, and the schema is why rather than a preference:
                a null `account_type` may only be `active` (`schema.ts`'s CHECK). There is no outcome
                to offer, because "how did it end" has no answer until the account is one of three
                kinds. Labelling it first is not a hoop - it is the question that makes the next one
                answerable. */}
            <Section title="Actions">
              {status === 'active' ? (
                <ActionRow
                  title="Close account"
                  note={
                    type === null
                      ? 'Pick a type above first, so the outcome can be one this kind of account has.'
                      : typeStaged
                        ? 'Save your type change first, so the outcome fits the kind of account this is.'
                        : 'Mark how it ended. Every trade stays.'
                  }
                  action={
                    <Button
                      variant="secondary"
                      size="md"
                      className="max-sm:min-h-11"
                      disabled={saving || type === null || typeStaged}
                      /* `busy` LOCKS THE SHELL UNDERNEATH, so Escape and a backdrop click land on
                         the confirmation rather than dismissing this form out from under it. */
                      onClick={() => {
                        setConfirmingClose(true);
                        onBusyChange(true);
                      }}
                    >
                      Close
                    </Button>
                  }
                />
              ) : (
                /* THE SAME ROW, ONE STATE LATER. It states the outcome and the date the trader gave,
                   because a year on "how did it end" is the single most useful fact about a closed
                   account - and it is the fact a chip alone cannot carry. */
                <ActionRow
                  title="Account is closed"
                  note={closedNote(status, closedOn)}
                  action={
                    <Button
                      variant="secondary"
                      size="md"
                      className="max-sm:min-h-11"
                      loading={reopening}
                      onClick={() => void reopen()}
                    >
                      Reopen
                    </Button>
                  }
                />
              )}

              {/* DELETE IS OFFERED WHENEVER THERE IS NOTHING TO LOSE, closed or not, and its absence
                  is deliberately NOT explained: a paragraph of policy where a button is missing is
                  policy nobody asked for. An account holding trades cannot be deleted - the route
                  refuses it with a 409 and the foreign keys refuse it underneath that - because the
                  whole claim of this product is that it keeps the tape. Hide sits directly above and
                  is the answer a trader who is done looking actually wants. */}
              {account.trades === 0 && (
                <div className="mt-2">
                  <ActionRow
                    title="Delete account"
                    note="Nothing has been imported yet, so there is nothing to lose."
                    action={
                      <Button
                        variant="secondary"
                        size="md"
                        disabled={saving}
                        /* `text-neg` RATHER THAN v2'S INLINE `style={{ color: ... }}`. Same result,
                           and it follows the theme without a second declaration. The FILL stays
                           `secondary`: the red belongs on the confirmation's commit button, not on
                           the thing that merely opens it. */
                        className="text-neg max-sm:min-h-11"
                        onClick={() => {
                          setConfirmingDelete(true);
                          onBusyChange(true);
                        }}
                      >
                        Delete
                      </Button>
                    }
                  />
                </div>
              )}
            </Section>
          </ModalBody>

          <ModalFooter>
            {/* THE ERROR SITS WITH THE BUTTON THAT CAUSED IT, not at the top of a body the trader
                has scrolled past. */}
            {error && <p className="text-neg text-body mr-auto">{error}</p>}
            <ModalActions>
              <Button variant="secondary" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => void save()} disabled={!ready || saving} loading={saving}>
                Save
              </Button>
            </ModalActions>
          </ModalFooter>
        </>
      )}

    </>
  );

  /* A CONFIRMATION IS NOT A SCREEN OF THIS FLOW, so it goes outside the container entirely: over the
     modal on a desktop, and after the sheet in the DOM on a phone, which is what puts it on top
     without a second z-index to keep in step. `ConfirmShell` picks its own shape.
     They are reached only from the editor today, and putting them inside that branch would tie a
     confirmation's lifetime to which question is showing underneath it. */
  const confirmations = (
    <>
      {confirmingClose && (
        <CloseAccountModal
          accountId={account.id}
          accountType={type}
          onCancel={() => {
            setConfirmingClose(false);
            onBusyChange(false);
          }}
          onClosed={(nextStatus, nextClosedOn) => {
            setConfirmingClose(false);
            onBusyChange(false);
            /* THE FORM STAYS OPEN and its Actions row flips to "Account is closed / Reopen". Closing
               the whole modal here would leave the trader unable to see what they just did, or to
               take it back, without reopening the editor - and Reopen is the only undo a close has.
               The write already happened, so the roster behind is refreshed rather than staged. */
            setStatus(nextStatus);
            setClosedOn(nextClosedOn);
            router.refresh();
          }}
        />
      )}

      {askingEnding && type && (
        <EndingModal
          type={type}
          onCancel={() => {
            setAskingEnding(false);
            onBusyChange(false);
          }}
          onPicked={(picked) => {
            setAskingEnding(false);
            setEnding(picked);
            /* STRAIGHT ON WITH THE SAVE the trader already pressed. `onBusyChange` stays true -
               the form is now writing, which is the same lock the question was holding. */
            void save(picked);
          }}
        />
      )}

      {confirmingDelete && (
        <DeleteAccountModal
          accountId={account.id}
          title={accountRowTitle(account)}
          onCancel={() => {
            setConfirmingDelete(false);
            onBusyChange(false);
          }}
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

  return (
    <>
      {sheet ? (
        <AccountSheet
          open={sheet.open}
          onClose={onClose}
          onBack={back}
          /* A CONFIRMATION ON TOP PUTS THIS ONE IN `busy`, so one Escape closes exactly one thing —
             the same lock `ModalShell` takes on the desktop path. `saving` is here for the other
             reason: a PATCH is in flight and the roster is about to change underneath. */
          busy={saving || confirmingClose || confirmingDelete || askingEnding}
          label="Edit account"
          /* THE STACK IS THE LAYER LIST, unchanged. It was built to answer "what does Back mean",
             which is the same question a sheet asks of its screens. */
          layers={stack.map(screenNode)}
        />
      ) : (
        screenNode(screen)
      )}
      {confirmations}
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

/* "Passed on July 31, 2026. Every trade is still here." - the outcome and the date the trader
 * stated, in one line, with the reassurance attached to it rather than left to be inferred.
 *
 * `passed` IS THE ONLY STATUS THAT GETS ITS OWN WORD. `failed` and `closed` both read as "Closed"
 * because the row above already carries the chip that distinguishes them, and because "Failed on
 * July 31" is a sentence a trader does not need read back to them twice.
 *
 * PARSED AS UTC, because it is a plain YYYY-MM-DD with no time in it - letting the browser read it
 * as local would shift the day back for anyone west of Greenwich. */
function closedNote(status: AccountStatus, closedOn: string | null): string {
  const word = status === 'passed' ? 'Passed' : 'Closed';
  if (!closedOn) return `${word}. Every trade is still here.`;
  const on = new Date(`${closedOn}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${word} on ${on}. Every trade is still here.`;
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
    /* `min-h-13` (52px), UP FROM 44: the row now holds a 36px button plus its 8px of vertical air,
       and at `min-h-11` the control was flush against both edges. The `Field` gap above it is
       unchanged, so the form's rhythm is the same and only the row breathes. */
    <div className="bg-hover flex min-h-13 items-center gap-3 rounded-[var(--radius)] px-4 py-2">
      {logo}
      <span className="text-body-lg text-text min-w-0 flex-1 truncate font-medium">{label}</span>
      {/* A REAL `Button`, NOT A TEXT LINK (2026-08-28, Luke: "i like buttons better than text links
          for the 'change' link"). v2 draws this as an underlined muted link, and the inconsistency
          it creates is the argument against it: the Actions rows directly below carry `Close` and
          `Delete` as `secondary` buttons, so the modal had two different control CLASSES doing the
          identical job - a thing on the right of a row that acts on that row.
          `secondary` and `md`, matching those, so all four rows read as one family. */}
      <Button variant="secondary" size="md" onClick={onChange} className="max-sm:min-h-11 shrink-0">
        Change
      </Button>
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
