'use client';

/* ONE TRADE, opened from the tape. A right-side drawer over the page.
 *
 * REBUILT AGAINST `run-trading@v2`'s DRAWER (2026-08-20, Luke: "that panel needs to match the
 * run-trading@v2's panel exactly"). What was here was a narrower panel with a flat label/value list;
 * this is v2's structure and its measured geometry - 560 wide, a 64px mark, the figure top-right,
 * uppercase section eyebrows, and two circular steppers hanging off the left edge.
 *
 * WHY A DRAWER AND NOT A MODAL. A modal is a detour: it takes the screen, you finish, you come back.
 * This is READING - you open a trade, then the one before it, then the one before that - and a
 * drawer keeps the list on screen the whole time, so the thing you are stepping through never
 * disappears. That is also why it gets steppers and a modal never would.
 *
 * READ-ONLY, AND THE OPTION IS NOT OFFERED. `CLAUDE.md`: "Trades are not editable - the option is
 * not offered. The claim is 'our numbers are the broker's numbers.'" There is no edit affordance
 * here to disable, because a disabled one still says the idea was entertained. v2's drawer refuses
 * the same things for the same reason, and refuses more besides: every editable field, Delete, tags,
 * attachments, review state.
 *
 * WHAT v2 HAS THAT THIS DELIBERATELY DOES NOT:
 *   "View N trades"  the per-product page does not exist in this build (issue #15). A link to a
 *                    route that 404s is worse than no link, so it returns with that page.
 *   the account LINK `/accounts/details/<id>` does not exist either, so the account renders as a
 *                    plain string with its firm mark. It becomes a link when the page does.
 *   the NOTE         notes are NOT IN V1 (#10).
 *   the CLASSIFICATION  v1 cuts auto-tagging (#11).
 * Each is an absent surface rather than a design disagreement, and each comes back with its page.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { IconButton } from '@/components/ui/icon-button';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { fmtMoney, fmtPriceDecimal, fmtDuration } from '@/lib/format';
import { productName } from '@/lib/instruments';
import { displayClock } from '@/lib/time/session';
import type { TapeRow } from '@/lib/trades/read';
import { InstrumentMark } from './instrument-mark';
import { Section, Row, Stepper } from './trade-drawer-body';

const signed = (cents: number): string => (cents > 0 ? `+${fmtMoney(cents)}` : fmtMoney(cents));

/* MATCHES `.drawer-transition`'s 0.3s (globals.css), and it has to: the panel slides on that
   declaration, and this is how long the parent waits before unmounting it. Two numbers describing
   one motion is how an exit ends up cut off halfway. */
const PANEL_MS = 300;

export function TradeDrawer({
  trade: t,
  zone,
  onClose,
  onPrev,
  onNext,
  position,
}: {
  trade: TapeRow;
  zone: string;
  onClose: () => void;
  /** Undefined at either end of the tape. The steppers stay PRESENT and go disabled - see Stepper. */
  onPrev?: () => void;
  onNext?: () => void;
  /** Where this trade sits in the tape as shown, so the panel can say so. */
  position?: { index: number; of: number };
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  /* THE SAME DURATION THE SIDEBAR USES, NOT THE SAME CURVE (2026-08-20, correcting the original
     request to match it exactly). Luke's reasoning — "two panels framing the work that arrive at
     different speeds read as two different products" — is an argument about DURATION, and it still
     holds: 0.3s, unchanged. But the drawer ENTERS AND LEAVES the screen, where the sidebar and rail
     RESIZE IN PLACE, and the role table gives those two different curves (`ease-out` versus
     `ease-in-out`). One curve had been asked to do both jobs. It slides on `.drawer-transition`
     (globals.css) rather than on a duration typed here.
     IT STARTS OFF-SCREEN AND IS SWITCHED ON AFTER THE FIRST PAINT. Mounting already-open would give
     the browser nothing to animate FROM, so the panel would appear rather than arrive. */
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  /* CLOSING IS TWO STEPS, because the PARENT owns mounting: slide out first, then tell it to
     unmount once the motion has finished. Every way out goes through here - the X, the scrim and
     Escape - or one of them would cut the exit off. Stepping to another trade deliberately does
     NOT: the panel stays put and its contents swap, which is what makes walking the tape read as
     one surface rather than a panel that leaves and comes back. */
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  const requestClose = useCallback(() => {
    if (closeTimer.current) return;
    setShown(false);
    closeTimer.current = setTimeout(onClose, PANEL_MS);
  }, [onClose]);

  /* FOCUS MOVES IN, AND GOES BACK WHERE IT CAME FROM. `run-trading@v2` shipped both this and its
     filter panels without either (its #68 and #95): a dialog that never moves focus leaves a
     keyboard user still on the row behind it, tabbing through a page they cannot see. */
  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => restoreTo.current?.focus?.();
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        requestClose();
        return;
      }
      /* ARROWS WALK THE TAPE. Checking one trade against a broker screen usually means checking
         several, and reaching for the mouse between each one is the friction this removes. Guarded
         on the target so the keys still belong to a field if one ever lands in here. */
      const el = e.target as HTMLElement | null;
      const typing = el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      if (!typing && (e.key === 'ArrowUp' || e.key === 'ArrowLeft') && onPrev) {
        e.preventDefault();
        onPrev();
        return;
      }
      if (!typing && (e.key === 'ArrowDown' || e.key === 'ArrowRight') && onNext) {
        e.preventDefault();
        onNext();
        return;
      }
      if (e.key !== 'Tab') return;
      // The trap. Without it, Tab walks straight out of an open dialog into the tape behind it.
      const focusable = panel.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [requestClose, onPrev, onNext]
  );

  const contract = t.contract ?? t.symbolRoot;
  const held = t.exitAt.getTime() - t.entryAt.getTime();

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trade-drawer-title"
      onKeyDown={onKeyDown}
    >
      {/* The scrim closes it, which is the affordance every modal in this app already has. */}
      <button
        type="button"
        aria-label="Close"
        onClick={requestClose}
        // `--scrim`, not `--color-scrim`: the token is a bare custom property rather than a colour
        // role, and a utility naming one that does not exist emits NOTHING — no error, no warning,
        // just an undimmed page you have to notice by eye.
        /* `ease-out` NAMED (2026-08-20). This carried a duration and no curve, so it inherited the
           `ease` default - and the default's job is a state change IN PLACE, where a scrim arriving
           over the page and leaving again is the textbook enter/leave. The modal's scrim already
           spells `ease-out` for the same move, so the two dim layers in this product now agree. */
        className={cn(
          'absolute inset-0 bg-[var(--scrim)] transition-opacity duration-300 ease-out',
          shown ? 'opacity-100' : 'opacity-0'
        )}
      />

      {/* THE STEPPERS, OVER THE LIST RATHER THAN INSIDE THE PANEL. They are controls for the tape
          BEHIND the drawer, so putting them over it says so. 48px, 16 apart, measured off v2.
          Hidden below `sm`, where 96px of furniture floating over a 390px screen would be covering
          the thing it navigates. */}
      <div
        /* `drawer-transition` CARRIES OPACITY TOO, unlike the panel below (2026-08-20). This
           combined `panel-transition` with Tailwind's `transition-opacity` utility, on the
           assumption that both would apply. They do not: `panel-transition` is an UNLAYERED rule
           (deliberately, so it always beats a hover utility at a call site — see its own note),
           and an unlayered `transition-property` always wins over anything in Tailwind's layer, in
           full, not merged. Measured live: `transitionProperty` on this element read `"width,
           translate"` with no `opacity` in it, so the steppers' fade was never animating — it
           snapped instantly while the slide beside it took 300ms. `.drawer-transition` states both
           properties itself, which is the only way one unlayered rule can own both. */
        className={cn(
          'drawer-transition absolute right-[min(560px,100%)] bottom-8 hidden flex-col gap-4 pr-4 sm:flex',
          shown ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        )}
      >
        <Stepper label="Previous trade" disabled={!onPrev} onClick={() => onPrev?.()}>
          <Icon name="chevron" size={18} className={cn('rotate-180', !onPrev && 'text-muted')} />
        </Stepper>
        <Stepper label="Next trade" disabled={!onNext} onClick={() => onNext?.()}>
          <Icon name="chevron" size={18} className={cn(!onNext && 'text-muted')} />
        </Stepper>
      </div>

      {/* 560 MEASURED off v2, capped at the viewport so a phone gets a full-width sheet rather than
          a panel with a useless sliver of page beside it. This was `max-w-sm` (384), narrow enough
          that the fact rows had to wrap.
          NO LEFT HAIRLINE. The panel is `surface` with a shadow, and the value step against the
          dimmed page is the whole separation. It carried a border AND a shadow, which is two answers
          to one question - and the exact pair `design-rules.md` forbids. The shadow stays, because
          it is what makes the panel read as sliding OVER the page; the hairline was the redundant
          one, and v2 removed it for the same reason. */}
      <div
        ref={panel}
        tabIndex={-1}
        className={cn(
          'drawer-transition bg-surface relative flex h-full w-full max-w-[560px] flex-col shadow-[var(--shadow-card)] outline-none',
          shown ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Pinned control row. v2's carries four buttons; Run has exactly one real action here, so
            it carries one. It stays because the panel scrolls and the way out must not. */}
        <div className="border-rule flex h-15 shrink-0 items-center justify-end gap-2 border-b px-4">
          {/* WHERE YOU ARE IN THE TAPE. Without it the steppers are two controls with no sense of
              distance — on a long tape "3 of 360" is the difference between stepping and wandering.
              Counts from 1, because the trader is not reading an array index. */}
          {position && (
            <span className="text-caption text-muted mr-auto shrink-0 tabular-nums">
              {(position.index + 1).toLocaleString('en-US')} of {position.of.toLocaleString('en-US')}
            </span>
          )}
          <IconButton onClick={requestClose} aria-label="Close">
            <Icon name="close" size={20} />
          </IconButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* THE HEADER BLOCK: the mark at 64, the figure top-right, the identity under it. */}
          <div className="px-6 pt-6">
            <div className="flex items-start justify-between gap-4">
              <InstrumentMark symbol={contract} className="text-body-lg size-16" />
              <div className="min-w-0 text-right">
                {/* pos/neg, unlike an ink figure elsewhere — a trade is a RESULT, and this is the
                    single number the drawer exists to explain. */}
                <p
                  className="text-h2 font-medium tabular-nums"
                  style={{ color: t.netCents >= 0 ? 'var(--color-pos)' : 'var(--color-neg)' }}
                >
                  {signed(t.netCents)}
                </p>
                {/* THE ACCOUNT, under the figure. The drawer opens from a tape that can span many
                    accounts, which is the moment the name stops being a label and starts answering
                    "which account was that".
                    NOT A LINK YET: `/accounts/details/<id>` does not exist in this build, and a link
                    to a 404 is worse than a plain string. It becomes one when that page lands.
                    mt-2, not mt-1 (v2's measurement): the reference clears its account line by 12px
                    and an earlier pass cleared it by 7, which read as the two being one block. */}
                <span className="text-muted mt-2 flex items-center justify-end gap-1.5">
                  {t.firmLogo && (
                    // A local asset; next/image would need each firm host whitelisted for nothing.
                    // ONE LINE, and that is not style: this was written as a two-line comment, so
                    // the directive applied to its own second line and suppressed nothing. Lint
                    // reported it as an unused directive rather than as an unsuppressed `<img>`,
                    // which is the quieter of the two failures and the easier one to scroll past.
                    // eslint-disable-next-line @next/next/no-img-element -- see above
                    <img src={t.firmLogo} alt="" className="size-5 shrink-0 rounded-full" />
                  )}
                  <span className="text-body truncate">{t.accountName}</span>
                </span>
              </div>
            </div>

            <h2 id="trade-drawer-title" className="text-h2 text-text mt-4 font-medium">
              {productName(contract) ?? contract}
            </h2>
          </div>

          <div className="px-6 py-6">
            {/* THE THREE NUMBERS THE TAPE ROW COMPRESSES INTO ONE. Gross and fees are what make the
                net believable, and this is the only surface with room to show the working. */}
            <Section label="Result">
              <Row label="Gross">{signed(t.grossCents)}</Row>
              <Row label="Fees">{t.feeCents === 0 ? 'Not imported' : fmtMoney(t.feeCents)}</Row>
              <Row label="Net" strong>
                {signed(t.netCents)}
              </Row>
            </Section>

            <Section label="The trade">
              {/* The contract as a FACT rather than a label: it is the string a trader checks
                  against their platform, so it reads in the same column as every other checkable
                  value here. */}
              <Row label="Contract">{contract}</Row>
              {/* NULL IS AN HONEST ANSWER. Direction is "which side opened", and with two fills that
                  cannot be ordered there is no answer — a guess here is the entry/exit swap wearing
                  a different hat. */}
              <Row label="Direction">
                {t.direction ? t.direction[0].toUpperCase() + t.direction.slice(1) : 'Unknown'}
              </Row>
              <Row label="Size">
                {t.qty.toLocaleString('en-US')} {t.qty === 1 ? 'contract' : 'contracts'}
              </Row>
              {/* THE PRICES, WHICH ARE THE REASON THIS PANEL EXISTS. Entry is the side that OPENED,
                  not the buy: a short opens on the sell, and mapping by side rendered every winning
                  short as a loser that made money on the previous build. Resolved once in the
                  projector, so these two labels mean what they say. */}
              <Row label="Entry">{fmtPriceDecimal(t.entryPrice)}</Row>
              <Row label="Exit">{fmtPriceDecimal(t.exitPrice)}</Row>
              <Row label="Opened">{displayClock(t.entryAt, zone)}</Row>
              <Row label="Closed">{displayClock(t.exitAt, zone)}</Row>
              {/* HOW LONG IT WAS ON is the one derived number here, and the one that most often
                  explains the row: a 28-second trade and a two-hour trade that lost the same money
                  were not the same decision. */}
              <Row label="Held">{fmtDuration(held)}</Row>
              {/* THE SESSION IT COUNTS IN, derived from the CLOSE and not always the day the clock
                  above suggests — an evening trade belongs to the next trade date. Stating it is
                  what stops that looking like a bug. */}
              <Row label="Session">{t.sessionDate}</Row>
            </Section>

            {t.state !== 'ok' && (
              <Section label={t.state === 'quarantined' ? 'Quarantined' : 'Excluded'}>
                <Row label="Reason">
                  <span className="text-neg">
                    {t.quarantineReason ?? t.exclusionReason ?? 'Not counted.'}
                  </span>
                </Row>
              </Section>
            )}

            {/* v2's "AT THE BROKER", and the idea it shares with the reference's "Original
                statement" is "here is the thing your provider would recognise, verbatim". For a
                futures trade that is the pair and the two fill ids — the strings Tradovate itself
                shows and the only ones a support ticket can be opened against. Hence copyable.
                Run's own row id appears in no export and would be worse than blank here, because it
                looks like provenance without being any. */}
            {t.pairId || t.buyFillId || t.sellFillId ? (
              <Section label="At the broker">
                {t.pairId && (
                  <Row label="Pair" copy={t.pairId}>
                    {t.pairId}
                  </Row>
                )}
                {t.buyFillId && (
                  <Row label="Buy fill" copy={t.buyFillId}>
                    {t.buyFillId}
                  </Row>
                )}
                {t.sellFillId && (
                  <Row label="Sell fill" copy={t.sellFillId}>
                    {t.sellFillId}
                  </Row>
                )}
              </Section>
            ) : (
              <Section label="At the broker">
                {/* SAYS SO rather than showing Run's id instead. "We do not have it" is a fact; a
                    uuid that matches nothing is a claim that does not survive being checked. */}
                <p className="text-body text-muted">
                  This trade arrived without Tradovate&rsquo;s own ids.
                </p>
              </Section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
