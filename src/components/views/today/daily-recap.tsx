'use client';

/* "YOUR DAILY RECAP" — the card, and the read it opens.
 *
 * Ported from Monarch's `Your Weekly Recap`, walked end to end on 2026-08-31 and read out of the
 * markup rather than off the pixels. Its card is four parts: title, period, one line, a CTA. Ours
 * is the same four, with one deliberate difference and one deliberate omission.
 *
 * ─── THE DIFFERENCE: THE LINE IS THE READ'S OWN ────────────────────────────────────────────────
 *
 * Monarch's line is generic and identical every week - *"See how your net worth and spending changed
 * last week, and see what's coming up this week"*. It has to be: a recap covering four subjects has
 * no single first sentence.
 *
 * A read about ONE thing does. So the card carries the read's own opening line, and says something
 * true about the trader's own trading before they tap. That is the one place this beats the
 * reference rather than copying it, and it is only available because `spec.md` §4.2 already settled
 * that the read names ONE subject rather than several.
 *
 * ─── THE OMISSION: NO PAGINATION, AND NO SCOPE PICKER YET ──────────────────────────────────────
 *
 * 2026-08-31, Luke: *"what if we had left and right arrows to view yesterday's recap... or is this
 * becoming more of a page than a widget now?"* - and that instinct is the answer. There are ZERO
 * previous/next controls on Monarch's entire dashboard, and the pattern literature states why: a
 * dashboard's claim is *at a glance*, and pagination turns a glance into a task. Browsing back
 * through reads is navigation, and navigation is a page's job.
 *
 * A `Daily / Weekly` scope picker is allowed by the widget contract - Monarch's net-worth widget has
 * one - but there is no weekly read to switch to, and a picker with one real option is a control
 * that cannot be answered. Both ideas are written up in `build-plan.md` §S8 as what would earn the
 * deferred `/read` page back.
 *
 * ─── WHAT AN EMPTY DAY DOES, WHICH IS NOT NOTHING ──────────────────────────────────────────────
 *
 * The card does not disappear on a day the trader did not trade. It shows the MOST RECENT read that
 * exists, named by its session. No arrows, no counting, no "3 days ago" - just *Wednesday, Aug 28*.
 * That is `CLAUDE.md`'s re-entry rule working as designed: every surface reopens where it was left,
 * and the trader who has been away is the one this is worth most to.
 *
 * The card is only truly empty on day one, and that state has its own copy and its own button.
 */

import { useState } from 'react';
import Link from 'next/link';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InstrumentMark } from '@/components/views/trades/instrument-mark';
import { ConfirmShell } from '@/components/views/accounts/confirm-shell';
import { ModalHeader } from '@/components/views/accounts/shared';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { ModalBody, ModalFooter, MODAL_TITLE_ID } from '@/components/ui/modal-shell';
import { Widget } from './widget';
import {
  recapPeriod,
  type Recap,
  type RecapEvidence,
  type RecapTrade,
} from '@/lib/desk/recap';
import { fmtMoney } from '@/lib/format';
import { cn } from '@/lib/cn';

/** `+` on a winner, the money minus on a loser. The same one-liner `trade-detail.tsx` declares, and
 *  it stays local for the same reason: it is one expression, and a shared helper would be a third
 *  place to look for a plus sign. */
const signed = (cents: number): string => (cents > 0 ? `+${fmtMoney(cents)}` : fmtMoney(cents));

/** The paragraph break the engine writes. A named constant because a blank line is invisible in a
 *  `.split()` call and the next reader cannot tell one newline from two. */
const PARA = '\n\n';

export function DailyRecap({ recap }: { recap: Recap }) {
  const [open, setOpen] = useState(false);
  const ready = recap.state === 'ready';

  return (
    <>
      <Widget
        title="Your Daily Recap"
        period={recap.state === 'empty' ? undefined : recapPeriod(recap.sessionDate)}
        /* THE MARK IS THE NAV'S OWN `read` ICON, which is the row this card replaced. It does the
           job the reference's sparkle does - separating a generated card from a figure card - out
           of the icon set that already exists, rather than inlining an SVG for one surface. */
        mark="read"
        onOpen={ready ? () => setOpen(true) : undefined}
      >
        <CardBody recap={recap} />
      </Widget>

      {ready && open && <ReadOverlay recap={recap} onClose={() => setOpen(false)} />}
    </>
  );
}

/* FOUR STATES, AND EACH SAYS THE SPECIFIC THING (`wireframes.md` §5, P9): "never a generic 'no
   data' plate". Every one of these ends on what would change it, and the two that a trader can act
   on carry the button that acts. */
function CardBody({ recap }: { recap: Recap }) {
  if (recap.state === 'ready') {
    /* NO BUTTON, because the BODY is the button - `Widget` wraps this in one when `onOpen` is
       passed, with the chevron at its far end. That is the reference's own shape and the first
       pass missed it: its recap card has no call to action, because a second thing to aim at
       inside a card that is already aimed at is a second decision for no extra reach.
       `text-body-lg` at 16px matches the reference's body exactly, and it is the right role
       regardless: this sentence is the most consequential prose in the product. */
    /* ONE STEP DOWN ON A PHONE. See `CitedTrade` below for the measurement and the argument;
       this is the same call, and it is what makes the card itself smaller. */
    return (
      <p className="text-body-lg max-sm:text-body text-text leading-relaxed">{recap.lede}</p>
    );
  }

  if (recap.state === 'thin') {
    return (
      <p className="text-body text-muted leading-relaxed">
        Too little trading to read. A fuller session gives it something to work with.
      </p>
    );
  }

  if (recap.state === 'pending') {
    return (
      <p className="text-body text-muted leading-relaxed">
        Your first read arrives after the session closes.
      </p>
    );
  }

  /* DAY ONE, and it is the only state with nothing behind it at all. The copy is `wireframes.md`'s
     own, kept word for word because it names the file and the outcome in one line. */
  return (
    <>
      <p className="text-body text-muted leading-relaxed">
        Add your Tradovate export and Run will read it.
      </p>
      <div className="mt-4">
        <Link href="/accounts" className={buttonClasses('secondary', 'md', 'max-sm:min-h-11')}>
          Add account
        </Link>
      </div>
    </>
  );
}

/* THE READ ITSELF, AND IT OPENS THROUGH THE SAME SHELL AS EVERY OTHER OVERLAY.
 *
 * 2026-08-31, Luke: *"i need consistency! ... the scrim animation is not the same as the /account
 * page."* He was right, and the cause was bigger than the scrim: this file had hand-rolled a fourth
 * overlay. No `.backdrop-fade` on the way in, no exit at all, no Escape handler, no body-scroll
 * lock, and on a phone no slide - it simply appeared and disappeared, three feet from an
 * `Add account` modal that faded both ways.
 *
 * It is `ConfirmShell` now, which is what `Close this account?`, `Delete` and the ending question
 * already use - so a phone gets the same full-screen sheet with the same 200ms travel and the same
 * Back-button handling, and a desktop gets the same fade in and out. Two props were added to that
 * shell rather than a fifth copy made here: `role` (this is content, not an alert, and a screen
 * reader should not be told otherwise) and `width`.
 *
 * WIDER THAN A CONFIRMATION, and that is the one measured difference. A confirmation is a question
 * and fits `max-w-md`; this is four paragraphs of prose, and `design-system.md` §2 puts a comfortable
 * measure at 60-75 characters - `max-w-xl` lands there at this size where `md` runs short and `2xl`
 * runs long.
 */
function ReadOverlay({ recap, onClose }: { recap: Recap; onClose: () => void }) {
  return (
    <ConfirmShell
      onCancel={onClose}
      label="Your Daily Recap"
      role="dialog"
      width="max-w-2xl"
      labelledBy={MODAL_TITLE_ID}
      /* PAPER, NOT `surface`, and it is the only modal in the product that is (2026-09-01, Luke:
         *"the bg of the modal is the bg paper color. then the trades sit on the lighter white
         color just like the trades table on the /trades page"*). Measured on the reference's
         `ModalCard__Root`: `rgb(246,245,243)`, which is `--color-bg` here to the byte. The class
         also sets `--modal-ground` so `.modal-fade` ends on the right colour. */
      ground="modal-paper"
    >
      {(dismiss, markReplacing) => (
        <>
          {/* `ModalHeader`, UNCHANGED AND UNPARAMETERISED - the same component, the same
              geometry and the same gutter as Add account, Edit account and Import refused
              (2026-09-01, Luke: *"i need consistency. update the recap modal to be exactly the same
              format, padding, etc. as the other modals. how is this difficult? shouldn't we have a
              standard?"*).

              THIS FILE HAS NOW BEEN WRONG ABOUT THIS TWICE, and the second time is the instructive
              one. First it hand-rolled a header outright, which cost it the phone bar entirely:
              below 768px it drew a bare 14px X floating in the content where every other sheet has
              an h-16 bar with a 22px control. The fix for that added a `showTitle` prop so the
              desktop row could stay title-less like the reference's - and that still read as a
              different modal, because it WAS one: an X alone at `px-6 pt-5` with no row to sit in,
              against every other modal's centred title in an h-14 bar with the control at `px-3`.

              THE STANDARD IS THE STANDARD. `text-title`, centred, `grid h-14 grid-cols-[36px_1fr_36px]
              px-3`, close at 16px, and on a phone the same `SheetHeader` bar. Nothing here varies.
              WHICH IS WHY THE CLAIM IS NOT THE TITLE. It is a sentence and a bar centres one
              truncated line, so the bar names the SURFACE ("Your Daily Recap", the card's own
              words) and the claim opens the body underneath at `text-h2`, where it has the room.
              That is also the reference's split: a chrome row, then eyebrow, then headline. */}
          <ModalHeader title="Your Daily Recap" onClose={dismiss} />

          {/* `px-6 pt-4` IS THE MODAL'S OWN GUTTER, the same one `label-account-form.tsx` states on
              all three of its screens and for the same reason recorded there: `ModalBody` carries
              no horizontal padding of its own, so every screen declares it and a screen that
              forgets runs its content to the card's edge. */}
          <ModalBody className="px-6 pt-4">
            {/* THE CLAIM IS THE SCREEN'S HEADLINE, and that is the whole answer to the wall
                (2026-08-31, Luke: *"we need low low low cognitive load"*, having proposed a
                three-step walkthrough). It used to be the first PARAGRAPH, which meant tapping a
                card that says X opened a modal that said X again and then piled four more
                paragraphs under it. The repetition was the wall, not the length.
                NO ID ON IT. The header above names the dialog through `MODAL_TITLE_ID`, which is
                the more correct name anyway: a dialog's accessible name should be what it IS, not
                the sentence it happens to open with. Exactly one element per screen may carry an
                id `aria-labelledby` points at - two live copies is how Delete came to be announced
                as "Edit account" (2026-08-28).
                A SENTENCE TAKES `text-h2` rather than `text-title`: it wraps to two lines and it is
                a claim rather than a label, so it needs the room. */}
            <div className="mb-6">
              {/* THE ACCENT LINE IS THE LABEL AND THE INK IS THE CONTENT, which is how the
                  reference splits its own: a coloured `✦ Overview │ August 23rd-29th` eyebrow over
                  an ink headline. Ours runs the mark and the session date over the claim. Measured
                  on the live page: their eyebrow `rgba(0,0,0,0)` with the gradient clipped to it,
                  their headline `rgb(34,32,29)`.
                  THE MARK IS HERE AND NOT IN THE BAR. On a phone the bar says where you are and
                  this says what it covers; on a desktop the bar is chrome and this is the first
                  thing drawn, which is where the reference puts its own sparkle too. */}
              <p className="text-title text-accent flex items-center gap-1.5 font-medium">
                <Icon name="read" size={16} className="shrink-0" />
                {recapPeriod(recap.sessionDate)}
              </p>
              <h2 className="text-h2 text-text mt-2 font-medium">
                {recap.lede}
              </h2>
            </div>

            {/* EVIDENCE BEFORE THE WORKING, which is the second half of the same fix. "Which
                trades" is the question a trader has the moment they read the claim; "how did it
                happen" is the one they may never ask. Three rows answer the first in one glance,
                and they sit above the prose so the prose is something you descend into rather than
                something you have to get past. */}
            <Evidence recap={recap} />

            {/* THE WORKING. `architecture.md` calls it that, and it is the only prose left on the
                screen now that the claim has moved into the header. */}
            <div className="text-body-lg max-sm:text-body text-text flex flex-col gap-4 leading-relaxed">
              {(recap.body ?? '').split(PARA).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            {/* THE TRUST NOTE, AND WHY IT IS COMPUTED RATHER THAN HARDCODED (2026-09-01, Luke:
                *"i would assume we would need some sort of hard coded note there right? or what is
                the purpose of this note?"*).

                `spec.md` P8 is LOCKED and answers both halves, having been amended for exactly this
                on 2026-08-11: *"The product states what its own output depends on, every time. For
                Run this is PROVENANCE, NOT ADJUSTABILITY - which file, which account, which range,
                last read when. Monarch's note ends 'you can review and adjust'; Run has nothing to
                adjust, so Run's note names the source instead. Stronger, because 'this came from
                your Tradovate export of Aug 5' is checkable, while 'you can adjust it' is an
                invitation to doubt."*

                So a hardcoded note would be the wrong artefact, not a cheaper one. Theirs has to be
                generic because their numbers depend on choices the trader makes (categorisation,
                recurring items) and can only be described in the abstract. Ours depends on a
                COUNT, and a count is checkable against `/trades` in ten seconds.

                WHAT WAS CUT: a second sentence, *"If a trade here is wrong, re-sync the account and
                the next read uses the correction."* That is the adjustability half P8 rules out,
                and it was doing the exact damage P8 names - inviting doubt about a figure the first
                sentence had just certified. Re-sync lives on `/trades`, next to the trade.

                14px, WHICH IS WHAT THE REFERENCE MEASURES AT. Its `RecapFlow__NoteText` is
                `14px / 400 / lh 21`, `rgb(119,117,115)` - one step under its 16px body. `text-body`
                is 14/20 here against its own 16px `text-body-lg` prose, so the relationship ports
                exactly. `leading-relaxed` is gone: it was pushing this to ~23 and the token's own
                20 is the closer match. */}
            {recap.provenance && (
              <p className="text-body text-muted mt-8">
                Read from {recap.provenance.roundTrips} round{' '}
                {recap.provenance.roundTrips === 1 ? 'trip' : 'trips'} across{' '}
                {recap.provenance.accounts}{' '}
                {recap.provenance.accounts === 1 ? 'account' : 'accounts'}, reconciled to your broker
                to the cent{recap.provenance.fees ? ', fees included' : ''}.
              </p>
            )}

            <Feedback />
          </ModalBody>

          {/* ONE ACTION, SO IT TAKES THE FOOTER'S FULL WIDTH - `ModalActions`' own rule, and the
              reference does the same thing: its recap's last step is a single edge-to-edge CTA.
              `secondary` RATHER THAN `primary`, and that is the one place this reads the reference
              and declines it. Theirs is a red-to-orange gradient, which `design-system.md` bans
              outright; more to the point, an accent fill is the loudest object on a screen, and the
              loudest object on a screen about a trader's own mistake should not be the invitation
              to keep talking. The read is the point. This is the door out of it.
              IT POINTS AT `/read`, WHICH 404s TODAY, and that is a deliberate standing state rather
              than an oversight (2026-08-31, Luke: *"dont delete /read from the left sidebar. just
              keep it as a 404 for now"*). The sidebar row already goes there; this is the second
              door to the same accepted destination, and it starts working the day that page ships
              without a change here. `build-plan.md` §S8 carries it as the slice's open wiring. */}
          {/* ONE ACTION, AND ONLY THE ACTION. The thumbs were briefly out here, because the
              scroll hint was drawing on top of them at the foot of the scroller. That is fixed at
              the cause instead: the hint and its fade now share one `more` state and are gone the
              moment the content ends, so the last row in the scroller is never under them at rest.
              The thumbs are back where the reference puts them (2026-09-01, Luke: *"include the
              thumbs up/down icons just under that note. not in the footer"*). */}
          <ModalFooter>
            <Link
              href="/read"
              /* THE HISTORY ENTRY THIS SHEET OWNS IS DECLARED SPENT BEFORE THE NAVIGATION, or the
                 overlay's cleanup calls `history.back()` on the way out and reverts the route we
                 just asked for - `CLAUDE.md`'s rule, and `Delete` in `/accounts` is the other
                 caller. A no-op on the desktop path, which pushes no entry. */
              onClick={markReplacing}
              className={buttonClasses('secondary', 'lg', 'w-full')}
            >
              Ask a follow-up
            </Link>
          </ModalFooter>
        </>
      )}
    </ConfirmShell>
  );
}

/* THE EVIDENCE TIER, AND IT IS A SWITCH OVER A CLOSED VOCABULARY (2026-09-01).
 *
 * `RecapEvidence` in `lib/desk/recap.ts` carries the whole argument for why the engine SELECTS a
 * shape rather than generating one. What lives here is the other half of it: the `default` arm.
 * A `kind` this build has never heard of - a newer job writing into an older client - falls back
 * to the citations every read has, rather than to an empty box. That is the graceful-degrade rule,
 * and it is why this is a switch with a default rather than a lookup table.
 *
 * THE CITATIONS ARE NOT PART OF THE SWITCH. They render under every kind, because a read that
 * draws a comparison is still pointing at the trades it drew it from. Only the shape ABOVE them
 * varies with the kind. */
function Evidence({ recap }: { recap: Recap }) {
  const cited = recap.trades ?? [];
  return (
    <>
      <EvidenceShape evidence={recap.evidence} />
      {/* THE CITATIONS SIT ON WHITE, ON THE CARD'S PAPER GROUND - the same figure-on-ground the
          tape already uses, moved inside a modal. `Card` rather than the reference's own block,
          because theirs is white WITH a border AND a shadow and `design-system.md` §3 allows one
          or the other: `Card` is this system's answer to "a white object on the page's ground",
          and it is the object `/trades` builds its tape out of.
          `px-4` RATHER THAN THE REFERENCE'S 24px PADDING. Theirs wraps a chart, which needs room on
          every side; this wraps rows that already carry `min-h-13` and their own rules, so vertical
          padding would add a second, larger gap above the first row than between any two after it. */}
      {cited.length > 0 && (
        <Card className="mb-8 px-4">
          {cited.map((t) => (
            <CitedTrade key={t.id} trade={t} />
          ))}
        </Card>
      )}
    </>
  );
}

function EvidenceShape({ evidence }: { evidence?: RecapEvidence }) {
  switch (evidence?.kind) {
    case 'comparison':
      return <Comparison evidence={evidence} />;
    // `'trades'`, absent, and anything a future job writes: the citations alone. See above.
    default:
      return null;
  }
}

/* TWO FIGURES, AND THE WIDTH OF THE WINDOW BETWEEN THEM.
 *
 * NO CHART, and that is a measured choice rather than a stage on the way to one. This compares
 * exactly two values, and two values are a sentence with a rule down the middle - a bar pair would
 * spend a third of the modal drawing what `47 seconds` beside `4m 10s` already says. The chart that
 * IS earned is the intraday one, for a claim about shape over time, and it is a different `kind`.
 *
 * ONE TYPE SIZE ON BOTH FIGURES, AND THE RANK IS CARRIED BY INK: this session is `text-text`, the
 * baseline is `text-muted`. `design-system.md`: muted is METADATA, ink is PROSE, two tiers and
 * never three - and a baseline IS a property of the figure beside it, which is what the metadata
 * tier is for. Sizing the baseline down instead would say it matters less, and it does not: it is
 * the only reason the first number means anything at all.
 *
 * THE WINDOW IS PRINTED, IN TRADES. A baseline whose width is not stated is a number taken on
 * faith, and `recap.ts` carries why the unit is trades rather than days. */
function Comparison({ evidence }: { evidence: Extract<RecapEvidence, { kind: 'comparison' }> }) {
  return (
    <Card className="mb-8 p-4">
      <p className="text-body text-muted">{evidence.label}</p>
      <div className="mt-3 flex items-baseline gap-3">
        <span className="text-h3 text-text font-medium tabular-nums">{evidence.session}</span>
        <span className="text-body text-muted">this session</span>
      </div>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="text-h3 text-muted font-medium tabular-nums">{evidence.baseline}</span>
        <span className="text-body text-muted">over your last {evidence.over} trades</span>
      </div>
    </Card>
  );
}

/* WAS THIS READ USEFUL - two thumbs, and the reference puts them in exactly this place.
 *
 * WHY IT IS WORTH A CONTROL AT ALL. The read is a generated claim about somebody's money, and
 * nothing else in the product can tell whether one landed. `spin.md`'s argument is that the corpus
 * of what the engine got RIGHT and WRONG is the asset rather than the model reading it, and a thumb
 * is the cheapest row that corpus can be built out of.
 *
 * IT IS EPHEMERAL TODAY, AND THAT IS STATED RATHER THAN HIDDEN. There is no read id to key a vote
 * to and no route to post it to, so the choice lives in this component and dies with the overlay.
 * `build-plan.md` §S8 holds the wiring. What ships now is the shape, because the shape is the half
 * most likely to be wrong on the first try.
 *
 * NO COPY CHANGE WHEN IT IS PRESSED. The pressed thumb takes the accent and `aria-pressed`, and
 * that is the entire acknowledgement. A "Thanks!" would be a reward beat on a surface that has just
 * finished telling a trader what a habit cost them, and it would be rewarding the ACT OF READING -
 * which is the shape `CLAUDE.md`'s re-entry doctrine bans everywhere else on this page.
 *
 * PRESSING THE SAME THUMB TWICE CLEARS IT, because there is no other way back from a mis-tap on a
 * pair of controls with no Cancel. */
function Feedback() {
  const [vote, setVote] = useState<'up' | 'down' | null>(null);

  /* NO PROMPT LINE, AND THAT IS THE REFERENCE'S OWN SHAPE (2026-09-01, read out of its markup).
     Its `FeedbackActions__Root` is two bare 36px pill buttons and nothing else - no *"Was this
     useful?"*, which this had. Two thumbs under a note are self-explanatory, and a question above
     them makes the product ask for something instead of offering somewhere to put an opinion.
     20px UNDER THE NOTE, measured: their wrapper is `flex-direction: column` with `row-gap: 20px`,
     note bottom 524 to thumbs top 544. `mt-5` is exactly that. */
  return (
    <div className="mt-5 flex items-center">
      {(['up', 'down'] as const).map((v) => (
        <IconButton
          key={v}
          aria-label={v === 'up' ? 'Give positive feedback' : 'Give negative feedback'}
          aria-pressed={vote === v}
          onClick={() => setVote((prev) => (prev === v ? null : v))}
        >
          {/* THE ACCENT GOES ON THE MARK, NOT ON THE BUTTON, and that is measured rather than
              stylistic. `text-accent` passed to `IconButton` merges cleanly, renders in the class
              list, and changes nothing: `.icon-btn` and its phone block in globals.css are
              hand-written and UNLAYERED, and unlayered CSS beats a layered Tailwind utility
              whatever its specificity. Measured on the running page: `aria-pressed="true"`, class
              list containing `text-accent`, computed colour still `rgb(34,32,29)` at 1280px and at
              533px alike. That is the same silent failure `eslint.config.mjs` exists to catch,
              arriving from a third direction: the class is real, the token is real, and the rule
              still loses.
              THE MARK HAS NO SUCH RULE OVER IT. `Drawn` sets `stroke="currentColor"`, so a colour
              on the svg itself is what the stroke resolves to - measured `rgb(31,107,87)`, the
              accent exactly, in both the desktop and the phone case. */}
          {/* MUTED AT REST, ACCENT WHEN CHOSEN. The reference's pair sit at
              `rgb(119,117,115)` - its `content.secondary`, which is Run's `--color-muted` - rather
              than at full ink, because an unanswered opinion control is metadata beside the note it
              follows, not a call to action. `IconButton` is full ink by default (Luke, 2026-08-20),
              which is right for a control that DOES something and wrong for this one.
              THE COLOUR GOES ON THE MARK, NOT THE BUTTON, and that is measured rather than
              stylistic: `.icon-btn` and its phone block in globals.css are hand-written and
              UNLAYERED, so they beat a layered Tailwind text utility whatever its specificity.
              Measured with `text-accent` on the button: class present, computed colour unchanged at
              1280px and at 375px alike. `Drawn` sets `stroke="currentColor"`, so a colour on the
              svg itself is what the stroke resolves to. */}
          <Icon
            name={v === 'up' ? 'thumbs-up' : 'thumbs-down'}
            size={16}
            className={vote === v ? 'text-accent' : 'text-muted'}
          />
        </IconButton>
      ))}
    </div>
  );
}

/* A CITED TRADE IS NOT A TAPE ROW, and the difference is deliberate rather than a shortcut.
 *
 * The tape's row answers "what happened, in order, at a glance" and carries the columns that
 * question needs. A citation answers "which one is he talking about" - so it carries the mark, the
 * product, the clock and the net, and nothing else. Importing `TapeRow` here would mean building a
 * full tape row for every sentence the read wants to point at.
 *
 *
 *       ONE STEP DOWN ON A PHONE, and the reason is a RELATIONSHIP rather than a number (2026-09-01,
 * Luke: *"why do i have the feeling that the font size is not consistent with the accounts and
 * trades pages... im thinking we need to go smaller to match monarch and match our accounts and
 * trades pages"*). He is right, and the port is what got it wrong: the reference's recap body is
 * 16px, so this was built at 16px - but THEIR base is 16 and their transaction rows are 16 too,
 * so over there the recap body is exactly a row. Run's base is 14, and `trades-tape.tsx` and
 * `roster-card.tsx` both write `text-body-lg max-sm:text-body`. Copying their absolute number
 * reproduced the size and broke the relation it came from: measured at 412px, a tape row is 14
 * and this was 16, one step above every row in the product.
 * A ROW IS ONE TYPE SIZE (`design-system.md` §2a) and the reference's own recap keeps its rows and
 * its prose on one step too, so all four of this file's `text-body-lg` call sites move together.
 * `text-h2` DOES NOT MOVE: `trade-detail.tsx` keeps 24 on a phone, so the claim does too.
 *
 * NOT A LINK YET. `/trades/[id]` exists and this SHOULD open it, which is a wiring job for the
 * slice that connects the real read - a fixture has no real trade ids to point at, and a link to a
 * fabricated one is worse than a row that is honestly inert. */
function CitedTrade({ trade }: { trade: RecapTrade }) {
  return (
    <div className="border-rule flex min-h-13 items-center gap-3 border-b last:border-b-0">
      <InstrumentMark symbol={trade.symbolRoot} />
      <span className="text-body-lg max-sm:text-body text-text min-w-0 flex-1 truncate">
        {trade.product}
      </span>
      <span className="text-body text-muted shrink-0 tabular-nums">{trade.at}</span>
      <span
        className={cn(
          'text-body-lg max-sm:text-body shrink-0 font-medium tabular-nums',
          trade.netCents >= 0 ? 'text-pos' : 'text-neg'
        )}
      >
        {signed(trade.netCents)}
      </span>
    </div>
  );
}
