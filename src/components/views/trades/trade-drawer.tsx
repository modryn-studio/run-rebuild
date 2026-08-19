'use client';

/* ONE TRADE, CHECKED. This is where the prices went when the row went to one line, so it is not a
 * detail panel in the ordinary sense — it is the surface a trader holds up against their broker
 * screen, and `spec.md` §S3's provenance requirement (P8) lands here.
 *
 * READ-ONLY, AND THE OPTION IS NOT OFFERED. `CLAUDE.md`: "Trades are not editable — the option is
 * not offered. The claim is 'our numbers are the broker's numbers.'" There is no edit affordance
 * here to disable, because a disabled one still says the idea was entertained.
 *
 * THE IDS ARE THE POINT OF THE BOTTOM HALF. Tradovate issues them and shows them in its own exports,
 * so a trader disputing a fill or reconciling a statement needs the exact string rather than Run's
 * paraphrase of it. That is the difference between a figure you are asked to trust and one you can
 * go and check.
 */

import { useCallback, useEffect, useRef } from 'react';
import { IconButton } from '@/components/ui/icon-button';
import { Icon } from '@/components/ui/icon';
import { fmtMoney, fmtPriceDecimal, fmtDuration } from '@/lib/format';
import { productName } from '@/lib/instruments';
import { displayClock } from '@/lib/time/session';
import type { TapeRow } from '@/lib/trades/read';

const signed = (cents: number): string => (cents > 0 ? `+${fmtMoney(cents)}` : fmtMoney(cents));

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
  /* THE STEPPERS. Undefined at either end rather than disabled-and-present, so the control is
     absent when there is nowhere to go instead of being a button that does nothing. Checking a
     trade usually means checking several in a row, which is the whole reason these exist. */
  onPrev?: () => void;
  onNext?: () => void;
  /** Where this trade sits in the tape as shown, so the panel can say so. */
  position?: { index: number; of: number };
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

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
        onClose();
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
    [onClose, onPrev, onNext]
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
        onClick={onClose}
        // `--scrim`, not `--color-scrim`: the token is a bare custom property rather than a colour
        // role, and a utility naming one that does not exist emits NOTHING — no error, no warning,
        // just an undimmed page you have to notice by eye.
        className="absolute inset-0 bg-[var(--scrim)]"
      />
      <div
        ref={panel}
        tabIndex={-1}
        className="bg-surface border-border relative flex h-full w-full max-w-sm flex-col overflow-y-auto border-l outline-none"
      >
        <div className="border-rule flex min-h-15 shrink-0 items-center gap-2 border-b px-5">
          <span id="trade-drawer-title" className="text-title text-text min-w-0 flex-1 truncate font-medium">
            {productName(contract) ?? contract}
          </span>

          {/* WHERE YOU ARE IN THE TAPE. Without it the arrows are two controls with no sense of
              distance — and on a long tape "3 of 360" is the difference between stepping and
              wandering. Counts from 1, because the trader is not reading an array index. */}
          {position && (
            <span className="text-caption text-muted shrink-0 tabular-nums">
              {(position.index + 1).toLocaleString('en-US')} of {position.of.toLocaleString('en-US')}
            </span>
          )}
          {/* ABSENT AT EITHER END, not disabled. A disabled control still says the idea was
              entertained; nothing there says there is nothing there. */}
          <IconButton onClick={onPrev} aria-label="Previous trade" disabled={!onPrev}>
            <Icon name="chevron" size={14} className="rotate-180" />
          </IconButton>
          <IconButton onClick={onNext} aria-label="Next trade" disabled={!onNext}>
            <Icon name="chevron" size={14} />
          </IconButton>
          <IconButton onClick={onClose} aria-label="Close">
            <Icon name="close" size={14} />
          </IconButton>
        </div>

        {/* THE RESULT FIRST, because it is what the trader came to check against. Net, then the two
            halves that make it, so the arithmetic is visible rather than asserted. */}
        <div className="px-5 py-4">
          <p
            className="text-figure font-medium tabular-nums"
            style={{ color: t.netCents >= 0 ? 'var(--color-pos)' : 'var(--color-neg)' }}
          >
            {signed(t.netCents)}
          </p>
          <p className="text-body text-muted mt-1">
            {signed(t.grossCents)} gross, {fmtMoney(t.feeCents)} fees
          </p>
        </div>

        <dl className="border-rule border-t pb-2">
          <Line label="Direction">
            {/* NULL IS AN HONEST ANSWER. Direction is "which side opened", and with two fills that
                cannot be ordered there is no answer — a guess here is the entry/exit swap wearing a
                different hat. */}
            {t.direction ? (
              <span className="text-text capitalize">{t.direction}</span>
            ) : (
              <span className="text-muted">Unknown</span>
            )}
          </Line>
          <Line label="Quantity">
            <span className="text-text tabular-nums">{t.qty.toLocaleString('en-US')}</span>
          </Line>
          <Line label="Contract">
            <span className="text-text">{contract}</span>
          </Line>

          <Group />

          {/* THE PRICES, WHICH ARE THE REASON THIS PANEL EXISTS. Entry is the side that OPENED, not
              the buy: a short opens on the sell, and mapping by side rendered every winning short as
              a loser that made money on the previous build. Resolved once in the projector, so these
              two labels mean what they say. */}
          <Line label="Entry">
            <span className="text-text tabular-nums">{fmtPriceDecimal(t.entryPrice)}</span>
          </Line>
          <Line label="Exit">
            <span className="text-text tabular-nums">{fmtPriceDecimal(t.exitPrice)}</span>
          </Line>

          <Group />

          <Line label="Opened">
            <span className="text-text tabular-nums">{displayClock(t.entryAt, zone)}</span>
          </Line>
          <Line label="Closed">
            <span className="text-text tabular-nums">{displayClock(t.exitAt, zone)}</span>
          </Line>
          <Line label="Held">
            <span className="text-text tabular-nums">{fmtDuration(held)}</span>
          </Line>
          {/* THE SESSION IT COUNTS IN, which is derived from the CLOSE and is not always the day the
              clock above suggests — an evening trade belongs to the next trade date. Stating it is
              what stops that looking like a bug. */}
          <Line label="Session">
            <span className="text-text tabular-nums">{t.sessionDate}</span>
          </Line>

          <Group />

          <Line label="Account">
            <span className="text-text">{t.accountName}</span>
          </Line>
          {t.state !== 'ok' && (
            <Line label={t.state === 'quarantined' ? 'Quarantined' : 'Excluded'}>
              <span className="text-neg text-right">
                {t.quarantineReason ?? t.exclusionReason ?? 'Not counted.'}
              </span>
            </Line>
          )}
        </dl>

        {/* PROVENANCE, at the foot and in mono. TRADOVATE'S IDS, NOT RUN'S — these are the strings
            Tradovate issues and prints in its own exports, so they are what a trader disputing a
            fill or reconciling a statement actually needs. Run's own row id appears in no export
            and would be worse than blank here, because it looks like provenance without being any.
            Reproduced exactly rather than prettified, and `break-all` so a long id wraps instead of
            forcing the panel to scroll sideways. */}
        <div className="border-rule mt-auto border-t px-5 py-4">
          <p className="text-caption text-muted">From your Tradovate export.</p>
          {t.pairId || t.buyFillId || t.sellFillId ? (
            <dl className="mt-2 flex flex-col gap-1">
              {t.pairId && <Provenance label="Pair" value={t.pairId} />}
              {t.buyFillId && <Provenance label="Buy fill" value={t.buyFillId} />}
              {t.sellFillId && <Provenance label="Sell fill" value={t.sellFillId} />}
            </dl>
          ) : (
            /* SAYS SO rather than showing Run's id instead. "We do not have it" is a fact; a uuid
               that matches nothing is a claim that does not survive being checked. */
            <p className="text-caption text-muted mt-1">
              This trade arrived without Tradovate&rsquo;s own ids.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Provenance({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-caption text-muted shrink-0">{label}</dt>
      <dd className="text-caption text-text min-w-0 font-mono break-all">{value}</dd>
    </div>
  );
}

function Group() {
  return <div className="border-rule my-2 border-t" />;
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-1.5">
      <dt className="text-body text-muted shrink-0">{label}</dt>
      <dd className="text-body min-w-0 text-right">{children}</dd>
    </div>
  );
}
