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
import { Button, buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { SheetHeader, SHEET_CONTROL_ICON } from '@/components/ui/sheet-header';
import { InstrumentMark } from '@/components/views/trades/instrument-mark';
import { Widget } from './widget';
import { recapPeriod, type Recap, type RecapTrade } from '@/lib/desk/recap';
import { useOverlayBack } from '@/lib/overlay-back';
import { usePhone } from '@/lib/use-phone';
import { fmtMoney } from '@/lib/format';
import { cn } from '@/lib/cn';

/** `+` on a winner, the money minus on a loser. The same one-liner `trade-detail.tsx` declares, and
 *  it stays local for the same reason: it is one expression, and a shared helper would be a third
 *  place to look for a plus sign. */
const signed = (cents: number): string => (cents > 0 ? `+${fmtMoney(cents)}` : fmtMoney(cents));

export function DailyRecap({ recap }: { recap: Recap }) {
  const [open, setOpen] = useState(false);
  const ready = recap.state === 'ready';

  return (
    <>
      <Widget
        title="Your Daily Recap"
        period={recap.state === 'empty' ? undefined : recapPeriod(recap.sessionDate)}
        onOpen={ready ? () => setOpen(true) : undefined}
      >
        <CardBody recap={recap} onOpen={() => setOpen(true)} />
      </Widget>

      {ready && open && <ReadOverlay recap={recap} onClose={() => setOpen(false)} />}
    </>
  );
}

/* FOUR STATES, AND EACH SAYS THE SPECIFIC THING (`wireframes.md` §5, P9): "never a generic 'no
   data' plate". Every one of these ends on what would change it, and the two that a trader can act
   on carry the button that acts. */
function CardBody({ recap, onOpen }: { recap: Recap; onOpen: () => void }) {
  if (recap.state === 'ready') {
    return (
      <>
        {/* `text-body-lg`, NOT `text-body`. This sentence is the most consequential prose in the
            product and it is competing with three widgets of figures. §2a's "a lead paragraph" is
            exactly this role. */}
        <p className="text-body-lg text-text leading-relaxed">{recap.lede}</p>
        <div className="mt-4">
          <Button variant="secondary" size="md" onClick={onOpen} className="max-sm:min-h-11">
            Read it
          </Button>
        </div>
      </>
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

/* THE READ ITSELF, OPENED IN PLACE. There is no `/read` page to navigate to - `spec.md` §4 took the
 * row out on 2026-08-31 - so this is the whole of the read's surface.
 *
 * A SHEET ON A PHONE, A CENTRED CARD ON A DESKTOP, which is the rule every dismissible surface in
 * this product follows (`design-system.md` §6a). It answers the device Back button through
 * `useOverlayBack`, one entry, pushed by the tap that opened it.
 */
function ReadOverlay({ recap, onClose }: { recap: Recap; onClose: () => void }) {
  const phone = usePhone();
  useOverlayBack(true, () => {
    onClose();
    return false;
  });

  const title = recapPeriod(recap.sessionDate);

  const body = (
    <>
      {/* CLAIM, THEN EVIDENCE, THEN THE WORKING - the shape every step of Monarch's recap uses, and
          the shape `architecture.md` already names as `read.body` + `read.working`. */}
      <div className="text-body-lg text-text flex flex-col gap-4 leading-relaxed">
        {(recap.body ?? '').split('\n\n').map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      {recap.trades && recap.trades.length > 0 && (
        <div className="mt-8">
          <p className="eyebrow text-muted">The trades this is about</p>
          <div className="mt-2">
            {recap.trades.map((t) => (
              <CitedTrade key={t.id} trade={t} />
            ))}
          </div>
        </div>
      )}

      {/* THE TRUST NOTE, ALWAYS, NOT ONLY WHEN SOMETHING LOOKS WRONG. `spec.md` §4.2 requires it and
          the reference repeats it on EVERY step of its own recap rather than once at the end. It
          states what the read depends on and how to correct it, which is the only honest way to
          publish a generated claim about somebody's money. */}
      {recap.provenance && (
        <p className="text-body text-muted mt-8 leading-relaxed">
          Read from {recap.provenance.roundTrips} round{' '}
          {recap.provenance.roundTrips === 1 ? 'trip' : 'trips'} across{' '}
          {recap.provenance.accounts}{' '}
          {recap.provenance.accounts === 1 ? 'account' : 'accounts'}, reconciled to your broker to
          the cent{recap.provenance.fees ? ', fees included' : ''}. If a trade here is wrong,
          re-sync the account and the next read uses the correction.
        </p>
      )}
    </>
  );

  if (phone) {
    return (
      <div className="fixed inset-0 z-[70]">
        <div className="absolute inset-0" style={{ background: 'var(--scrim-nav)' }} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Your daily recap"
          className="bg-bg absolute inset-0 flex flex-col"
        >
          <SheetHeader
            title={title}
            lead={null}
            trail={
              <IconButton onClick={onClose} aria-label="Close">
                <Icon name="close" size={SHEET_CONTROL_ICON} />
              </IconButton>
            }
          />
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-10">{body}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default"
        style={{ background: 'var(--scrim)' }}
        onClick={onClose}
      />
      <Card
        role="dialog"
        aria-modal="true"
        aria-label="Your daily recap"
        className="pop-in-center relative z-10 flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-5">
          <h2 className="text-title text-text font-medium">{title}</h2>
          <IconButton onClick={onClose} aria-label="Close">
            <Icon name="close" size={14} />
          </IconButton>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-6">{body}</div>
      </Card>
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
