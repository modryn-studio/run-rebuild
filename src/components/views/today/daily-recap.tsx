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
import { InstrumentMark } from '@/components/views/trades/instrument-mark';
import { ConfirmShell } from '@/components/views/accounts/confirm-shell';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { CONFIRM_TITLE_ID } from '@/components/ui/modal-shell';
import { Widget } from './widget';
import { recapPeriod, type Recap, type RecapTrade } from '@/lib/desk/recap';
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
    return <p className="text-body-lg text-text leading-relaxed">{recap.lede}</p>;
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
    <ConfirmShell onCancel={onClose} label="Your daily recap" role="dialog" width="max-w-xl">
      {(dismiss) => (
        <>
          {/* THE CLAIM IS THE TITLE, and that is the whole answer to the wall (2026-08-31, Luke:
              *"we need low low low cognitive load"*, having proposed a three-step walkthrough).
              It used to be the first PARAGRAPH, which meant tapping a card that says X opened a
              modal that said X again and then piled four more paragraphs under it. The repetition
              was the wall, not the length - and a three-step version would have made that repeat
              step one of three.
              A SENTENCE AS A TITLE takes `text-h3` rather than `text-title`: it wraps to two lines
              and it is a claim rather than a label, so it needs the room. */}
          <div className="flex items-start justify-between gap-3 px-6 pt-5">
            <div className="min-w-0">
              {/* THE SAME TREATMENT AS THE CARD, and the reference applies it the same way: the
                  ACCENT LINE IS THE LABEL and the ink is the content. Its modal runs a coloured
                  `✦ Overview │ August 23rd-29th` eyebrow over an ink headline; ours runs a coloured
                  mark and session date over the claim. Measured on the live page: eyebrow
                  `rgba(0,0,0,0)` with the gradient clipped to it, headline `rgb(34,32,29)`.
                  IT STAYS `.eyebrow` AT 11px rather than borrowing their 18. Theirs is the same
                  size as their card title because their headline is 30px and has the room; ours is
                  a 20px claim, and a second 18px line above it would be arguing with it.
                  NO MARK HERE, unlike the card. On the dashboard the mark says "this one is not a
                  figure card" - it is doing work against the widgets beside it. Inside the modal
                  there is nothing to be distinguished from, so the colour carries the signal alone
                  and the alternative was inventing a 13px icon step to sit beside 11px caps. #29
                  already has 13 and 22 on its list of sizes that are off every scale. */}
              <p className="eyebrow text-accent">{recapPeriod(recap.sessionDate)}</p>
              <h2 id={CONFIRM_TITLE_ID} className="text-h3 text-text mt-1 font-medium">
                {recap.lede}
              </h2>
            </div>
            <IconButton onClick={dismiss} aria-label="Close">
              <Icon name="close" size={14} />
            </IconButton>
          </div>

          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-6">
            {/* EVIDENCE BEFORE THE WORKING, which is the second half of the same fix. "Which
                trades" is the question a trader has the moment they read the claim; "how did it
                happen" is the one they may never ask. Three rows answer the first in one glance,
                and they sit above the prose so the prose is something you descend into rather than
                something you have to get past. */}
            {recap.trades && recap.trades.length > 0 && (
              <div className="mb-8">
                {recap.trades.map((t) => (
                  <CitedTrade key={t.id} trade={t} />
                ))}
              </div>
            )}

            {/* THE WORKING. `architecture.md` calls it that, and it is the only prose left on the
                screen now that the claim has moved into the header. */}
            <div className="text-body-lg text-text flex flex-col gap-4 leading-relaxed">
              {(recap.body ?? '').split(PARA).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            {/* THE TRUST NOTE, ALWAYS, NOT ONLY WHEN SOMETHING LOOKS WRONG. `spec.md` §4.2 requires
                it, and the reference repeats it on EVERY step of its own recap rather than once at
                the end. It states what the read depends on and how to correct it, which is the only
                honest way to publish a generated claim about somebody's money. */}
            {recap.provenance && (
              <p className="text-body text-muted mt-8 leading-relaxed">
                Read from {recap.provenance.roundTrips} round{' '}
                {recap.provenance.roundTrips === 1 ? 'trip' : 'trips'} across{' '}
                {recap.provenance.accounts}{' '}
                {recap.provenance.accounts === 1 ? 'account' : 'accounts'}, reconciled to your broker
                to the cent{recap.provenance.fees ? ', fees included' : ''}. If a trade here is
                wrong, re-sync the account and the next read uses the correction.
              </p>
            )}
          </div>
        </>
      )}
    </ConfirmShell>
  );
}

/* A CITED TRADE IS NOT A TAPE ROW, and the difference is deliberate rather than a shortcut.
 *
 * The tape's row answers "what happened, in order, at a glance" and carries the columns that
 * question needs. A citation answers "which one is he talking about" - so it carries the mark, the
 * product, the clock and the net, and nothing else. Importing `TapeRow` here would mean building a
 * full tape row for every sentence the read wants to point at.
 *
 * NOT A LINK YET. `/trades/[id]` exists and this SHOULD open it, which is a wiring job for the
 * slice that connects the real read - a fixture has no real trade ids to point at, and a link to a
 * fabricated one is worse than a row that is honestly inert. */
function CitedTrade({ trade }: { trade: RecapTrade }) {
  return (
    <div className="border-rule flex min-h-13 items-center gap-3 border-b last:border-b-0">
      <InstrumentMark symbol={trade.symbolRoot} />
      <span className="text-body-lg text-text min-w-0 flex-1 truncate">{trade.product}</span>
      <span className="text-body text-muted shrink-0 tabular-nums">{trade.at}</span>
      <span
        className={cn(
          'text-body-lg shrink-0 font-medium tabular-nums',
          trade.netCents >= 0 ? 'text-pos' : 'text-neg'
        )}
      >
        {signed(trade.netCents)}
      </span>
    </div>
  );
}
