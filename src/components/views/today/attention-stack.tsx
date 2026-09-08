'use client';

/* THE STACK BEHIND THE LANE - one account at a time, and nothing else on screen.
 *
 * `monarch-dashboard-teardown.md` §A15. The reference's mobile review flow is a stack of cards with
 * a decrementing count, swipe to answer, and the full transaction editor on every card. This takes
 * the SHAPE and almost none of the contents, because the two flows are answering different things:
 * theirs corrects a machine's guess about data it already holds, this one collects a fact that
 * exists in no file Run will ever read.
 *
 * WHAT CAME ACROSS: one subject at a time, a position in the set, and a flow that ends by ceasing
 * to exist rather than by being dismissed.
 *
 * WHAT DID NOT, AND WHY EACH ONE IS A DELETION RATHER THAN AN OMISSION:
 *
 * - `Skip for now`. Theirs needs it because an item must eventually LEAVE the queue. Nothing here
 *   is queued: `attention.ts` recomputes the lane from the account rows every render, so an
 *   unanswered account is simply still unanswered and the strip is still right. Closing IS skipping.
 * - The swipes. Two consequential answers, one of which writes a status the CHECK constrains, is a
 *   pair of buttons rather than a gesture. With no skip and no accidental commit there is also
 *   nothing for an undo arrow to undo.
 * - The filter. You filter a hundred transactions. You do not filter three accounts.
 * - The editor. Nothing here touches a trade, and `spec.md`'s NOT IN V1 names their controls by
 *   name: "Notes, notebook, journaling-by-typing, tags, folders."
 *
 * ─── THE FIELDS ARE THE EXISTING ONES, NOT A SECOND SET ───────────────────────────────────
 *
 * `TypeRows`, `SizeField`, `Chip`, `FirmPicker` and `EndingChoice` are the same components
 * `label-account-form.tsx` uses, and the PATCH body below is that form's body field for field. Two
 * screens collecting one fact two ways is how a product comes to disagree with itself about what an
 * account is - and the `ready` gate in particular is not a rule this file gets its own opinion on:
 * type, firm and size commit together or not at all, because a prop account holding two of the three
 * is a row every percentage downstream is computed against wrongly.
 *
 * WHAT THIS SCREEN DELIBERATELY DOES NOT ASK, and the editor does: `hidden`, `excludedFromTotals`,
 * and the closing DATE. The first two are tidying decisions with no deadline and no prompt; the
 * third is a question in a flow whose whole argument is speed, and `closed_on` is nullable with
 * `closedNote` already written for the null case ("Passed. Every trade is still here."). A trader
 * who wants the date opens the account and sets it there.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ModalBody, ModalFooter, ModalShell, useModalClose } from '@/components/ui/modal-shell';
import { usePhone } from '@/lib/use-phone';
import { cn } from '@/lib/cn';
import { AccountSheet, useSheet } from '@/components/views/accounts/account-sheet';
import { ModalHeader, EndingChoice } from '@/components/views/accounts/shared';
import { Chip, Field, SizeField, TypeRows } from '@/components/views/accounts/account-fields';
import { FirmPicker } from '@/components/views/accounts/firm-picker';
import { AccountLogo } from '@/components/views/accounts/account-logo';
import {
  ACCOUNT_ENDINGS,
  PERSONAL_FIRM,
  accountPrefix,
  accountRowTitle,
  isPlaceholderAccountName,
  placeholderAccountTitle,
} from '@/lib/prop-firms';
import type { AccountStatus, AccountType } from '@/lib/db/schema';
import type { AttentionItem } from '@/lib/accounts/attention';

/** Everything one card is collecting, before it is sent. */
interface Draft {
  type: AccountType | null;
  firm: string;
  size: number | null;
  name: string;
  spread: boolean;
  ending: AccountStatus | null;
}

function seed(item: AttentionItem | undefined): Draft {
  return {
    type: item?.account.accountType ?? null,
    /* PRE-FILLED FROM `firm_source: 'detected'` WHEN THERE IS ONE, which is the one place Run does
       hold a guess awaiting a human - `prop-firms.ts`: recalled from a prefix confirmed on somebody
       else's account, "weaker, and the trader's own answer always overwrites it". The card says so
       out loud rather than presenting it as known. */
    firm: item?.account.propFirm ?? '',
    size: item?.account.sizeDollars ?? null,
    name: item?.account.displayName ?? '',
    /* DEFAULT ON, matching the editor. A copy-trader whose import brought in eleven accounts under
       one login answers "which firm" once instead of eleven times, and the switch names the prefix
       so the evidence for the claim is on screen. */
    spread: true,
    ending: null,
  };
}

const isProp = (t: AccountType | null) => t === 'evaluation' || t === 'sim_funded';

export function AttentionStack({
  items,
  onClose,
}: {
  /* A SNAPSHOT, TAKEN WHEN THE LANE WAS OPENED. The strip holds it, not this component, because
     every save calls `router.refresh()` and the server then recomputes a SHORTER list - a stack
     reading the live prop would renumber and reorder itself under the trader's thumb between one
     card and the next. */
  items: AttentionItem[];
  onClose: () => void;
}) {
  const router = useRouter();
  const phone = usePhone();
  const { closing, requestClose } = useModalClose(onClose);
  const sheet = useSheet(onClose);
  /* TWO CONTAINERS, TWO CLOCKS - a modal fades in 160ms, a sheet travels in 200. Both hooks run
     unconditionally because hooks must; only one is ever driven. `label-account-modal.tsx`. */
  const close = phone ? sheet.requestClose : requestClose;

  const [i, setI] = useState(0);
  const [screen, setScreen] = useState<'card' | 'firm' | 'ending' | 'done'>('card');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => seed(items[0]));
  const [seededFor, setSeededFor] = useState<string | null>(items[0]?.account.id ?? null);

  const item = items[i];

  /* STATE ADJUSTED DURING RENDER, which is the React-idiomatic reset and what `account-sheet.tsx`
     already does for its held layers. An effect would run after paint, so the next card would
     render for one frame carrying the previous account's answers. */
  if (item && seededFor !== item.account.id) {
    setSeededFor(item.account.id);
    setDraft(seed(item));
    setScreen('card');
    setError(null);
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  /* THE EDITOR'S GATE, NOT A SECOND OPINION ON IT. `label-account-form.tsx:258` and
     `manual-account-form.tsx:107` spell exactly this, and a third spelling that drifted would let
     this screen commit a prop account with a firm and no size. */
  const ready = draft.type !== null && (!isProp(draft.type) || (Boolean(draft.firm) && draft.size !== null));

  const realName = item ? !isPlaceholderAccountName(item.account.externalAccountId) : false;
  const prefix = item ? accountPrefix(item.account.externalAccountId) : null;
  const canSpread = Boolean(isProp(draft.type) && realName && prefix && item && item.siblingCount > 0);

  /** Advance, or land on the closing screen when this was the last card. */
  const next = () => {
    setError(null);
    if (i + 1 < items.length) setI(i + 1);
    else setScreen('done');
  };

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const parsed: unknown = await res.json().catch(() => null);
        const message =
          parsed && typeof parsed === 'object' && 'error' in parsed
            ? String((parsed as { error: unknown }).error)
            : 'That did not save. Try again.';
        setError(message);
        return false;
      }
      /* THE PAGE BEHIND IS RE-READ ON EVERY SAVE, so the strip's count and the roster are already
         correct by the time the stack closes. The stack itself reads the snapshot, so a refresh
         mid-flow cannot move the ground under it. */
      router.refresh();
      return true;
    } catch {
      setError('That did not save. Check your connection and try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveLabel() {
    if (!item || !ready) return;
    const prop = isProp(draft.type);
    const ok = await patch({
      id: item.account.id,
      /* THE SENTINEL, WRITTEN DELIBERATELY, and the reason is `label-account-form.tsx`'s: `null`
         is indistinguishable from "not answered yet", which is the state the roster draws as
         `Unlabelled`. `PERSONAL_FIRM` says the trader answered and the answer was "none". */
      propFirm: prop ? draft.firm : PERSONAL_FIRM,
      accountType: draft.type,
      sizeDollars: prop ? draft.size : null,
      displayName: draft.name,
      ...(canSpread && draft.spread && prefix ? { applyFirmToPrefix: prefix } : {}),
    });
    if (ok) next();
  }

  async function saveEnding(status: AccountStatus) {
    if (!item) return;
    const ok = await patch({
      id: item.account.id,
      /* STATUS AND TYPE TRAVEL TOGETHER because the CHECK pairs them, and the route's own comment
         says so: writing `passed` against a row the database still calls personal is exactly the
         incoherent pair the constraint rejects. The type here is the one already on the row - this
         screen never changes it. */
      accountType: item.account.accountType,
      status,
    });
    if (ok) next();
  }

  const title = item ? accountRowTitle(item.account) : 'Accounts';

  /* ─── THE SCREENS ─────────────────────────────────────────────────────────────────────── */

  /* THE COUNT IS THE HEADER'S TITLE, which is where the reference puts it: back arrow left,
     `2 remaining` centred, filter right. Run has no filter (you filter a hundred transactions, not
     three accounts), so the right cell holds the close.
     `1 of 3`, NOT `2 remaining`. The geometry is theirs and the sentence is not: a position states
     where you are in a set you chose to open, where a countdown states what is left undone, which is
     a backlog by another spelling and is the thing §A15 struck. */
  const header = (
    <ModalHeader
      title={
        screen === 'done'
          ? 'Accounts'
          : screen === 'card'
            ? `${i + 1} of ${items.length}`
            : title
      }
      onBack={screen === 'firm' || screen === 'ending' ? () => setScreen('card') : undefined}
      onClose={busy ? undefined : close}
    />
  );

  const card = item && (
    <>
      <ModalBody className="px-6 pt-4">
        {item.kind === 'label' ? (
          <>
            {/* THE BROKER'S OWN NAME, IN MONO, because it is a string the trader is being asked to
                RECOGNISE - they will have seen it in Tradovate and nowhere else. The derived title
                would be circular here: it is composed from the very facts this card is collecting. */}
            <p className="text-h3 mt-1 font-mono break-all">
              {realName
                ? item.account.externalAccountId
                : placeholderAccountTitle(item.account.externalAccountId)}
            </p>
            {/* WHAT IS TRUE OF IT, NOT WHEN IT ARRIVED. This said "New to Run, with N trades
                already in it", which is wrong for the row that most needs this card: Luke's own
                `FTDFYL...` holds 720 trades imported three weeks ago and has simply never been
                labelled. An unlabelled account is a NORMAL, LONG-LIVED state (`schema.ts`), not a
                recent arrival, and this component cannot see the import date anyway. */}
            <p className="text-body text-muted mt-1">
              {item.account.trades > 0
                ? `${item.account.trades.toLocaleString('en-US')} ${item.account.trades === 1 ? 'trade' : 'trades'}${item.account.lastSessionDate ? `, last one ${dayLabel(item.account.lastSessionDate)}` : ''}. Run does not know what kind of account this is.`
                : 'Run does not know what kind of account this is.'}
            </p>

            <div className="mt-5">
              <TypeRows onPick={(t) => set('type', t)} current={draft.type} />
            </div>

            {isProp(draft.type) && (
              <Field label="Firm">
                <div className="flex flex-wrap items-center gap-2">
                  {draft.firm && (
                    <Chip on onClick={() => setScreen('firm')}>
                      <AccountLogo propFirm={draft.firm} size={18} />
                      <span className="ml-2">{draft.firm}</span>
                    </Chip>
                  )}
                  <Chip on={!draft.firm} onClick={() => setScreen('firm')}>
                    {draft.firm ? 'Something else' : 'Pick a firm'}
                  </Chip>
                </div>
                {/* SAYS THE GUESS IS A GUESS. `firm_source` is the only place this product holds a
                    machine's answer where a human's would be better, and showing it silently
                    pre-filled would be Run stating a fact it recalled from somebody else's row. */}
                {item.account.firmSource === 'detected' && (
                  <p className="text-body text-muted mt-2">
                    Filled in from a name we have seen before. Your answer replaces it.
                  </p>
                )}
              </Field>
            )}

            {isProp(draft.type) && (
              <SizeField value={draft.size} onChange={(n) => set('size', n)} />
            )}

            {canSpread && prefix && item.siblingCount > 0 && (
              <div className="mt-4">
                <Switch
                  on={draft.spread}
                  onToggle={() => set('spread', !draft.spread)}
                  title={`Apply this firm to my other ${item.siblingCount} ${prefix} account${item.siblingCount === 1 ? '' : 's'}`}
                />
              </div>
            )}

            <Field label="Name" hint="optional">
              <Input
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder={accountRowTitle({ ...item.account, displayName: null })}
                maxLength={60}
                aria-label="Account name"
              />
            </Field>
          </>
        ) : (
          <>
            <p className="text-h3 mt-1">{title}</p>
            <p className="text-body text-muted mt-1">
              {item.account.trades.toLocaleString('en-US')}{' '}
              {item.account.trades === 1 ? 'trade' : 'trades'}
              {item.account.lastSessionDate ? ` · last one ${dayLabel(item.account.lastSessionDate)}` : ''}
            </p>

            {/* A FACT ABOUT THE FILE, NEVER ABOUT THE TRADER. "Your last import did not name this
                account" is something Run observed; "you have not traded this in nine days" is a
                progress report on a person, and it is the sentence the re-entry rule forbids. */}
            <div className="bg-hover mt-5 rounded-[var(--radius)] px-4 py-3">
              <p className="text-body text-text">
                Your last import covered your other accounts. This one was not in it.
              </p>
            </div>
          </>
        )}

        {error && <p className="text-body text-neg mt-4">{error}</p>}
      </ModalBody>

      {/* NO PEEKING CARD UNDER THIS ONE, AND THAT IS THE DECISION THIS FILE MOST HAD TO GET RIGHT.
       *
       * One was built on 2026-09-08 and removed the same day, on Luke's observation: *"the peeking
       * card is because monarch is using the swipe left/right for user to choose their answers."*
       * He is right, and it is the whole point of the affordance. In a Tinder-lineage stack the card
       * behind is not decoration - it is what the drag REVEALS. Monarch's own copy pairs them in one
       * sentence: *"swipe left or tap Skip for now"*, and the pattern's write-ups are explicit that
       * the buttons exist as the accessible twin of the gesture, never instead of it.
       *
       * SO A PEEK WITH NO DRAG IS A PROMISE THE SCREEN CANNOT KEEP. It says "throw me" to a card
       * that can only be tapped.
       *
       * AND THE GESTURE CANNOT COME HERE, WHICH IS THE REAL FINDING. Swipe works on a card carrying
       * ONE BINARY VERDICT - the pattern's own precondition is a quick decision, and Monarch's
       * `Mark as reviewed` is a single commit. Run's dominant card is a FORM: type, then firm, then
       * size, gated so the three commit together. There is no direction to throw a form in. Half of
       * the other card is not binary either, since `It ended` opens a second screen to ask how.
       *
       * A gesture that worked on some cards and not others would be worse than none: an affordance
       * that is sometimes there is one a trader stops trusting. So the stack keeps the reference's
       * GEOMETRY - one subject, the position in the header, a quiet left and a committing right -
       * and drops the one part of it that was load-bearing for a gesture this content cannot have. */}
      <ModalFooter>
        {/* TWO BUTTONS ON EVERY CARD, which is the reference's footer exactly: a quiet left and a
            committing right. Theirs is `Skip for now` / `Mark as reviewed`. */}
        <div className="flex w-full gap-3">
          {item.kind === 'label' ? (
            <>
              {/* `Not now` ADVANCES, IT DOES NOT DISMISS, and that distinction is why it can exist
                  beside §A15's deletion of `Skip for now`. Nothing is written and nothing is
                  remembered: the account stays unlabelled, the lane still counts it, and it is back
                  tomorrow. What it buys is not having to close the whole flow to get past one
                  account you do not want to answer - which on a five-item lane is the difference
                  between a stack and a wall. */}
              <Button variant="secondary" className="flex-1" onClick={next} disabled={busy}>
                Not now
              </Button>
              <Button
                className="flex-1"
                onClick={() => void saveLabel()}
                disabled={!ready || busy}
                loading={busy}
              >
                Save
              </Button>
            </>
          ) : (
            <>
              {/* STILL GOING WRITES NOTHING, and it should not: the account is active, which is what
                  the row already says. It moves to the next card, and if the next import also does
                  not name this account the lane asks again - which is the whole of the answer, since
                  Run has no way to learn otherwise. */}
              <Button variant="secondary" className="flex-1" onClick={next} disabled={busy}>
                Still going
              </Button>
              <Button className="flex-1" onClick={() => setScreen('ending')} disabled={busy}>
                It ended
              </Button>
            </>
          )}
        </div>
      </ModalFooter>
    </>
  );

  const firm = (
    <ModalBody className="px-6 pt-4 pb-5">
      <FirmPicker
        autoFocus
        onPick={(f) => {
          set('firm', f);
          setScreen('card');
        }}
      />
    </ModalBody>
  );

  const ending = item && (
    <ModalBody className="px-6 pt-4 pb-5">
      <p className="text-body text-muted">How did it end? Every trade stays either way.</p>
      <div className="mt-4 space-y-2">
        {(item.account.accountType ? ACCOUNT_ENDINGS[item.account.accountType] : []).map((e) => (
          <EndingChoice
            key={e.value}
            label={e.label}
            on={draft.ending === e.value}
            onPick={() => {
              set('ending', e.value);
              void saveEnding(e.value);
            }}
          />
        ))}
      </div>
      {error && <p className="text-body text-neg mt-4">{error}</p>}
    </ModalBody>
  );

  /* THE CLOSING SCREEN, AND IT IS A RECEIPT RATHER THAN A TROPHY. Rams: the lane simply not being
     there on the next paint conceals the state change - the trader cannot tell whether their answer
     landed or the strip was never there. So the flow says the lane is empty before it returns.
     NO COUNT, NO RING, NO CONGRATULATION. `psychology.md` §7 bans anything that rewards opening the
     app, and "You did it! 3/3" is that mechanic in the one place a chore ends. It states a fact
     about the data and offers the door. */
  const done = (
    <>
      <ModalBody className="px-6 pt-4">
        <p className="text-h3">Nothing else to answer</p>
        <p className="text-body text-muted mt-2">
          Your accounts are up to date. This comes back when an import brings in something new.
        </p>
      </ModalBody>
      <ModalFooter>
        <Button onClick={close}>Done</Button>
      </ModalFooter>
    </>
  );

  const body =
    screen === 'done' ? done : screen === 'firm' ? firm : screen === 'ending' ? ending : card;

  if (phone) {
    return (
      <AccountSheet
        open={sheet.open}
        onClose={close}
        onBack={() => setScreen('card')}
        busy={busy}
        label="Accounts that need you"
        layers={[
          <div key="base">
            {header}
            {screen === 'done' ? done : card}
          </div>,
          screen === 'firm' || screen === 'ending' ? (
            <div key="layer">
              {header}
              {screen === 'firm' ? firm : ending}
            </div>
          ) : null,
        ]}
      />
    );
  }

  return (
    <ModalShell onDismiss={() => !busy && requestClose()} busy={busy} closing={closing}>
      <div className={cn('flex min-h-0 flex-col')}>
        {header}
        {body}
      </div>
    </ModalShell>
  );
}

/* THE SESSION'S DAY, SHORT. `session_date` is a plain calendar date with no time and no zone -
 * parsed at UTC midnight so the string cannot shift a day under a browser west of Greenwich, which
 * is the same reason `closedNote` in `label-account-form.tsx` does it this way. */
function dayLabel(sessionDate: string): string {
  return new Date(`${sessionDate}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
