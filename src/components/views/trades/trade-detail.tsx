'use client';

/* THE FACTS OF ONE TRADE, and nothing about where they are shown.

 * SPLIT OUT OF `trade-drawer.tsx` (`S5d`, 2026-08-20) because a phone gets a ROUTE and a desktop
 * keeps the drawer, and those are two containers around one body. The alternative was a second copy
 * for `/trades/[id]`, which is how two surfaces start disagreeing about what a trade is — and this
 * body is the one place in the product where gross, fees and net are shown together, so a fork here
 * is a fork in the thing the reconcile claim rests on.
 *
 * IT OWNS NO CHROME. No panel, no scroll container, no close control, no width — every one of those
 * belongs to the container, and the two containers want different answers. It renders the header
 * block, the fact sections, and stops.
 *
 * `titleId` IS A PROP because the two containers label themselves differently: the drawer is a
 * `role="dialog"` pointing `aria-labelledby` at this heading, and the route is a page whose heading
 * is simply its heading. One hardcoded id would put a duplicate in the document the moment both
 * ever rendered at once.
 */

import { ACCOUNT_TYPE_LABELS } from '@/lib/prop-firms';
import { Icon } from '@/components/ui/icon';
import { fmtMoney, fmtPriceDecimal, fmtDuration } from '@/lib/format';
import { productName } from '@/lib/instruments';
import { displayClock } from '@/lib/time/session';
import type { TapeRow } from '@/lib/trades/read';
import { InstrumentMark } from './instrument-mark';
import { Section, Row } from './trade-drawer-body';

const signed = (cents: number): string => (cents > 0 ? `+${fmtMoney(cents)}` : fmtMoney(cents));

export function TradeDetail({
  trade: t,
  zone,
  titleId,
  showTitle = true,
}: {
  trade: TapeRow;
  zone: string;
  titleId: string;
  /** False where the CONTAINER already names the trade. `/trades/[id]` puts the product in its own
   *  top bar, the way the reference's mobile detail screen does, and rendering the heading again
   *  underneath would say it twice. The drawer has no title bar, so it keeps the heading. */
  showTitle?: boolean;
}) {
  const contract = t.contract ?? t.symbolRoot;
  const held = t.exitAt.getTime() - t.entryAt.getTime();

  return (
    <>
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
                {/* THE SAME CUT THE TAPE MAKES. Truncating the whole composed name here ate the
                    size and the digits - the only half that says WHICH account. */}
                <span className="text-body flex min-w-0 gap-1">
                  <span className="truncate">{t.accountHead}</span>
                  {t.accountTail && <span className="shrink-0">{t.accountTail}</span>}
                </span>
              </span>
              {/* WHAT KIND OF ACCOUNT, under the name (2026-08-28, Luke, from v2's screen). It is
                  the fact that decides what the figure above it MEANS - the same +$12.60 is play
                  money on an evaluation and a payout on a funded account - and this is the only
                  surface with room to say it.
                  `text-body` MUTED, NOT `text-caption` (corrected 2026-08-28, postcheck). It
                  shipped at 11px on the argument that size should separate it from the name above.
                  `design-system.md` §2a settles it the other way: this surface's secondary tier IS
                  `text-body` muted, and `text-caption` is reserved for DISCLOSURE - the rail's
                  provenance line and the inline quarantine reason - which are read by a different
                  kind of attention. It also made three type steps in one right-aligned column, at
                  the smallest size in the product, for what the comment above correctly calls the
                  fact that decides what the figure means. The name and the type are one identity
                  block, so reading as one block is right. Omitted entirely while the account is
                  unlabelled, rather than printed as "Unlabelled": that word belongs to the roster,
                  where it is a call to action. */}
              {t.accountType && (
                <span className="text-body text-muted mt-1 block text-right">
                  {ACCOUNT_TYPE_LABELS[t.accountType]}
                </span>
              )}
            </div>
          </div>

          {showTitle && (
            <h2 id={titleId} className="text-h2 text-text mt-4 font-medium">
              {productName(contract) ?? contract}
            </h2>
          )}
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
    </>
  );
}
