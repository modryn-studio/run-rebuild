'use client';

/* THE TAPE: every trade the filter selected, banded by the session it was realised in.
 *
 * Ported from `run-trading@v2`'s `trades-card.tsx` (2026-08-17, S5c), with its row structure and
 * both of its measured retreats intact — and one deliberate departure, noted on the account column.
 *
 * ONE LINE PER EVENT, WHICH IS THE RETREAT THAT MATTERS. v2 shipped a two-line 69px row carrying the
 * entry and exit prices, then moved them into the drawer and went to one line: "those prices are
 * VERIFICATION detail. Verification has a home now: the drawer. A tape is for scanning, and a scan
 * wants one line per event." What survived that cut, and why each: the PRODUCT (what), the CLOCK
 * (when — sequence is the subject of every read this corpus has produced), and the RESULT.
 * `wireframes.md` §3 was amended in the same change rather than left disagreeing.
 *
 * SORTED BY THE ENTRY, BANDED BY THE EXIT, and the two keys are deliberately different. Money is
 * realised at the close, so the SESSION comes from the exit; the DECISION is the entry, so the order
 * within a session comes from that. Ordering rows by the exit instead was visibly wrong on v2's own
 * tape: a position scaled out in three pieces closes on one stamp, so three consecutive rows printed
 * the identical time and the sequence between them was carried by nothing the eye could see.
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { fmtMoney } from '@/lib/format';
import { productName, productRoot, markHue } from '@/lib/instruments';
import { displayClock } from '@/lib/time/session';
import type { SessionGroup, TapeRow } from '@/lib/trades/read';
import { TradeDrawer } from './trade-drawer';

/** `+` on a gain, the minus `fmtMoney` already carries on a loss. A tape is a sequence of outcomes
 *  and an unsigned figure makes the reader do the comparison the sign is there to do for them. */
const signed = (cents: number): string => (cents > 0 ? `+${fmtMoney(cents)}` : fmtMoney(cents));

/** "Aug 8, 2026". The session date is a plain calendar string, so it is formatted as one rather
 *  than parsed into an instant — turning it into a `Date` would re-introduce a zone this value
 *  deliberately does not have. */
function longDate(sessionDate: string): string {
  const [y, m, d] = sessionDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function TradesTape({
  sessions,
  total,
  displayTimezone,
  narrowed,
}: {
  sessions: SessionGroup[];
  /** Every trade the filter selected, which is not the number of rows drawn. */
  total: number;
  displayTimezone: string;
  /** Whether anything is narrowing, which decides which empty state is honest. */
  narrowed: boolean;
}) {
  const [open, setOpen] = useState<TapeRow | null>(null);
  const drawn = sessions.reduce((n, s) => n + s.trades.length, 0);

  return (
    <Card className="overflow-hidden">
      <div className="border-rule flex min-h-15 items-center justify-between gap-3 border-b px-5">
        <span className="text-title text-text font-medium">Trades</span>
        <span className="text-body text-muted tabular-nums">
          {total.toLocaleString('en-US')}
        </span>
      </div>

      {sessions.length === 0 ? (
        <Empty narrowed={narrowed} />
      ) : (
        sessions.map((s) => (
          <div key={s.sessionDate}>
            {/* THE SESSION BAND. Ground `band`, no rules, and BOTH the date and the total muted.
                The muted total is the interesting half: a band is a LABEL for the rows under it and
                its figure is a subtotal of numbers already on screen, so in full ink it competes
                with the results it is only summarising. Muted puts it back in the background, which
                is also why no rule is needed — a ground change is enough to separate a label from a
                list. `design-system.md` carries the rule.
                `top-15` matches the header's own `min-h-15`, so the band comes to rest exactly
                beneath it rather than overlapping. */}
            <div className="bg-band sticky top-15 z-10 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 py-2">
              <span className="text-body text-muted font-medium">{longDate(s.sessionDate)}</span>
              <span className="text-body text-muted flex items-center gap-3 font-medium tabular-nums">
                <span>{signed(s.netCents)}</span>
                <span>
                  {s.tradeCount.toLocaleString('en-US')} {s.tradeCount === 1 ? 'trade' : 'trades'}
                </span>
                {/* A rate off nothing decided is a divide, not a fact — so it is absent rather
                    than printed as 0%. */}
                {s.winRatePct !== null && <span>{s.winRatePct}% win</span>}
              </span>
            </div>
            <div className="divide-rule divide-y">
              {s.trades.map((t) => (
                <Row key={t.id} trade={t} zone={displayTimezone} onOpen={() => setOpen(t)} />
              ))}
            </div>
          </div>
        ))
      )}

      {/* SAYS SO WHEN IT IS SHOWING PART OF THE SET. A tape that silently stops at its cap looks
          exactly like a tape that ended, and "187 trades" in the header over 500 drawn rows is the
          kind of quiet disagreement this codebase forbids everywhere else. */}
      {drawn < total && (
        <p className="border-rule text-small text-muted border-t px-5 py-3 text-center">
          Showing the first {drawn.toLocaleString('en-US')} of {total.toLocaleString('en-US')}.
          Narrow the range or the filters to see the rest.
        </p>
      )}

      {open && <TradeDrawer trade={open} zone={displayTimezone} onClose={() => setOpen(null)} />}
    </Card>
  );
}

function Row({
  trade: t,
  zone,
  onOpen,
}: {
  trade: TapeRow;
  zone: string;
  onOpen: () => void;
}) {
  const contract = t.contract ?? t.symbolRoot;
  const name = productName(contract);
  const excluded = t.state !== 'ok';

  return (
    <button
      type="button"
      onClick={onOpen}
      // A durable probe target. Verifying a tape by guessing markup selectors is how a session
      // spends an hour proving a page rendered nothing when it rendered fine.
      data-trade={t.id}
      className="group hover:bg-hover flex min-h-13 w-full items-center gap-4 px-5 py-2 text-left transition-colors"
    >
      {/* THE INSTRUMENT, and the first of the two flexible columns. `min-w-0` on both is what stops
          either from pushing the figures off their shared right edge. */}
      <div className="flex min-w-0 flex-[2] items-center gap-3">
        <InstrumentMark symbol={contract} />
        <div className="min-w-0">
          <p className="text-body-lg text-text truncate">{name ?? contract}</p>
          {/* The phone's version of the two columns to its right: one line on a desktop, two here. */}
          <p className="text-body text-muted truncate sm:hidden">
            {t.direction ? `${t.direction} ${t.qty}` : `${t.qty}`} · {displayClock(t.entryAt, zone).slice(0, 5)}
          </p>
        </div>
      </div>

      {/* WHICH ACCOUNT, AND IT FLEXES — the one place this row departs from v2, deliberately.
          v2 pinned this at `w-72 shrink-0` so the money column never moved, and its own issue #98
          measures what that cost: at 1280px with the rail open the tape is 692px, the fixed columns
          take 632, and the instrument name collapses to 60px so every product on the page truncates.
          A cross-account tape may not squeeze out its own subject to keep a column still. */}
      <span className="text-body text-muted hidden min-w-0 flex-1 items-baseline sm:flex">
        <AccountName name={t.accountName} />
      </span>

      {/* WHEN IT WAS TAKEN, not when it closed, and it has to be the key the list is sorted by or
          the order reads as random. */}
      <span className="text-body text-muted hidden w-14 shrink-0 tabular-nums sm:block">
        {displayClock(t.entryAt, zone).slice(0, 5)}
      </span>

      {/* THE RESULT, WITH ITS RIGHT EDGE PINNED. `min-w`, not `w`: it holds every figure a retail
          futures account produces and grows rather than colliding if one exceeds it. A column of
          numbers that does not share a right edge cannot be compared by eye, which is the only
          thing a tape is for.
          pos/neg here, unlike a roster's ink: this is a RESULT, and a tape is a sequence of
          outcomes where a roster at rest is a state. */}
      <div className="flex min-w-24 shrink-0 items-center justify-end gap-2 sm:min-w-32">
        {/* AN EXCLUDED OR QUARANTINED TRADE IS MARKED, NOT HIDDEN, and its figure goes muted rather
            than coloured: it is real and it is not counted, so it may not wear the colour that
            means "this is in your result". */}
        {excluded && (
          <span className="text-muted shrink-0" title={t.quarantineReason ?? t.exclusionReason ?? undefined}>
            <Icon name="warn" size={14} />
          </span>
        )}
        <span
          className={cn('text-body-lg font-medium tabular-nums', excluded && 'text-muted')}
          style={excluded ? undefined : { color: t.netCents >= 0 ? 'var(--color-pos)' : 'var(--color-neg)' }}
        >
          {signed(t.netCents)}
        </span>
      </div>

      {/* IT LIGHTS WITH THE ROW. The whole row is the button, so a bare chevron sitting inside it
          reads as a control that is switched off. */}
      <span
        aria-hidden
        className="text-muted group-hover:border-border group-hover:bg-surface group-hover:shadow-[var(--shadow-card)] group-active:shadow-[var(--shadow-press)] flex size-8 shrink-0 items-center justify-center rounded-full border border-transparent transition"
      >
        <Icon name="chevron" size={16} className="-rotate-90" />
      </span>
    </button>
  );
}

/* THE DIGITS NEVER TRUNCATE, THE REST DOES.
 *
 * A plain `truncate` eats a string from the RIGHT, which on `FTDFYL100183704873` cuts exactly the
 * tail that says WHICH account — and for a copy-trader running one strategy across twelve of them,
 * that tail is the only part of the name they are reading. Rendered live at 1440px it read
 * "FTDFYL10018370…", which is the same prefix on every account the firm ever issued.
 *
 * So the tail is its own `shrink-0` span and the head takes the squeeze. `run-trading@v2` learned
 * this on a firm name plus a bracketed tail; the shape here is one long token, and the rule is the
 * same one. A short name has no tail worth protecting and truncates whole. */
function AccountName({ name }: { name: string }) {
  const TAIL = 4;
  if (name.length <= 8) return <span className="truncate">{name}</span>;
  return (
    <>
      <span className="truncate">{name.slice(0, -TAIL)}</span>
      <span className="shrink-0">{name.slice(-TAIL)}</span>
    </>
  );
}

/* THE PRODUCT'S MARK. A hue per root, so a scan down the tape can tell one instrument from another
 * without reading — and a micro never shares a hue with its full-size sibling, which is the one
 * assignment here that is about risk rather than looks. */
function InstrumentMark({ symbol }: { symbol: string }) {
  const root = productRoot(symbol);
  const hue = markHue(root);
  return (
    <span
      className="text-caption grid size-8 shrink-0 place-items-center rounded-full font-medium"
      style={{
        color: `var(--mark-${hue})`,
        background: `color-mix(in srgb, var(--mark-${hue}) var(--mark-tint), transparent)`,
      }}
    >
      {root.slice(0, 3)}
    </span>
  );
}

/* THE EMPTY STATE SAYS WHICH EMPTY IT IS. "No trades in this range" and "no trades yet" send the
 * trader to two different places, and telling somebody with two years of tape that they have never
 * traded is the version that costs trust. */
function Empty({ narrowed }: { narrowed: boolean }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-body-lg text-text">
        {narrowed ? 'No trades in this range.' : 'No trades yet.'}
      </p>
      <p className="text-body text-muted mx-auto mt-2 max-w-sm">
        {narrowed
          ? 'Widen the dates, or clear the filters.'
          : 'Import your Tradovate exports and they will appear here.'}
      </p>
    </div>
  );
}
