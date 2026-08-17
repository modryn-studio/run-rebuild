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
import { displayTime, displaySessionDate } from '@/lib/time/session';
import type { SessionGroup, TapeRow } from '@/lib/trades/read';
import { TradeDrawer } from './trade-drawer';

/** `+` on a gain, the minus `fmtMoney` already carries on a loss. A tape is a sequence of outcomes
 *  and an unsigned figure makes the reader do the comparison the sign is there to do for them. */
const signed = (cents: number): string => (cents > 0 ? `+${fmtMoney(cents)}` : fmtMoney(cents));

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

  /* `@container` so a column can be gated on the CARD's width rather than the viewport's: the rail
     opening changes this card by 304px and nothing about the window says so.
     `overflow-clip`, not `hidden` — it clips without creating a scroll container, which is what
     lets the header and the bands inside it stay sticky. */
  return (
    <Card className="@container overflow-clip">
      {/* STICKY, so the count and the tape's identity survive the scroll. The two masking spans are
          the craft detail that makes it work: a sticky header inside a rounded card lets rows show
          through the corner radius as they pass under it, so one span paints the page ground behind
          the corner and the other paints the card's own ground back over it with the radius. */}
      <div className="border-rule bg-surface sticky top-0 z-20 flex min-h-15 items-center gap-3 border-b px-5 py-2">
        <span aria-hidden className="bg-bg pointer-events-none absolute inset-x-0 top-0 h-3" />
        <span
          aria-hidden
          className="bg-surface pointer-events-none absolute inset-x-0 top-0 h-3 rounded-t-[var(--radius)]"
        />
        <span className="text-title text-text font-medium">Trades</span>
        {/* THE NOUN, not a bare number. "360" beside a title reads as an id as easily as a count. */}
        <span className="text-body text-muted ml-auto tabular-nums">
          {total.toLocaleString('en-US')} {total === 1 ? 'trade' : 'trades'}
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
              <span className="text-body text-muted font-medium">
                {displaySessionDate(s.sessionDate)}
              </span>
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
          either from pushing the figures off their shared right edge.
          AN EQUAL CLAIM ON THE SLACK, not a 2:1 one. Measured at 1440 with the rail and sidebar
          open, which leaves the tape 689px: a 2:1 split handed this column 230px to render a name
          needing 131, while the account beside it truncated to "FTDFYL..." inside 115. A column
          cannot hoard space it has no content for while its neighbour is cutting the digits that
          identify the row. `flex-1` on both distributes what is left evenly instead. */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <InstrumentMark symbol={contract} />
        <div className="min-w-0">
          <p className="text-body-lg text-text truncate">{name ?? contract}</p>
          {/* The phone's version of the two columns to its right: one line on a desktop, two here.
              Reads "2 short", the way a trader says a position, rather than "short 2". */}
          <p className="text-body text-muted truncate sm:hidden">
            {t.qty}
            {t.direction ? ` ${t.direction}` : ''} · {displayTime(t.entryAt, zone)}
          </p>
        </div>
      </div>

      {/* WHICH ACCOUNT, AND IT FLEXES — the one place this row departs from v2, deliberately.
          v2 pinned this at `w-72 shrink-0` so the money column never moved, and its own issue #98
          measures what that cost: at 1280px with the rail open the tape is 692px, the fixed columns
          take 632, and the instrument name collapses to 60px so every product on the page truncates.
          A cross-account tape may not squeeze out its own subject to keep a column still. */}
      <span className="text-body text-muted hidden min-w-0 flex-1 items-center gap-1.5 sm:flex">
        <AccountName name={t.accountName} logo={t.firmLogo} />
      </span>

      {/* WHEN IT WAS TAKEN, not when it closed, and it has to be the key the list is sorted by or
          the order reads as random. `w-20` because "12:28 PM" needs the room "08:54" did not. */}
      <span className="text-body text-muted hidden w-20 shrink-0 tabular-nums sm:block">
        {displayTime(t.entryAt, zone)}
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

/* WHICH ACCOUNT: the firm's mark, its name, and the four digits that identify the row.
 *
 * THE DIGITS NEVER TRUNCATE, THE FIRM DOES. A plain `truncate` eats from the RIGHT, which cuts
 * exactly the tail that says WHICH account — and for a copy-trader running one strategy across
 * twelve of them, that tail is the only part they are reading. Seen live at 1440px before the fix:
 * "FTDFYL10018370…", which is the same prefix on every account that firm ever issued. So the tail
 * is its own `shrink-0` span and the head takes the squeeze.
 *
 * NOT `accountLast4`, WHICH IS A DIFFERENT JOB and reaching for it here shipped a real defect for
 * one render: that helper COMPOSES a bracketed suffix for a firm name ("Tradeify 50K" + " (...4873)"),
 * so using it to SPLIT an id made the head `name.slice(0, len - 9)` and the row read
 * "FTDFYL100 (...4873)" — the middle digits dropped by arithmetic rather than by truncation, which
 * is a wrong string rather than a shortened one. Splitting the name itself cannot do that: every
 * character is still rendered, and the browser decides what fits.
 *
 * THE LOGO IS ON A PERMANENTLY LIGHT TILE, the same `--color-logo-tile` the Add-account modal uses:
 * a firm ships one asset that assumes a light ground, so theming the tile would put a light-only
 * mark on a dark chip. */
function AccountName({ name, logo }: { name: string; logo: string | null }) {
  const TAIL = 4;
  const long = name.length > 8;
  const head = long ? name.slice(0, -TAIL) : name;
  const tail = long ? name.slice(-TAIL) : '';
  return (
    <>
      {logo && (
        <span
          className="border-border flex size-[18px] shrink-0 items-center justify-center overflow-hidden rounded-full border"
          style={{ background: 'var(--color-logo-tile)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a static local mark, not content */}
          <img src={logo} alt="" aria-hidden className="h-full w-full object-contain" />
        </span>
      )}
      {/* HEAD AND TAIL IN THEIR OWN GAPLESS BOX. They are two halves of ONE token, and the row's
          `gap-1.5` (which exists to space the logo off the name) was landing between them too:
          "FTDFYL10018370 4873", which reads as two fields rather than one truncated id. The gap
          belongs between the mark and the name, nowhere else. */}
      <span className="flex min-w-0">
        <span className="truncate">{head}</span>
        {tail && <span className="shrink-0">{tail}</span>}
      </span>
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
      aria-hidden
      /* MIXED WITH `surface`, NOT `transparent`. The tint is a wash of the hue over the ground it
         sits on, and mixing into transparency makes it translucent instead — which lets the row's
         hover ground show through and changes the mark's colour when the pointer arrives. */
      className="text-caption grid size-7 shrink-0 place-items-center rounded-full font-medium tabular-nums tracking-[-0.01em]"
      style={{
        color: `var(--mark-${hue})`,
        background: `color-mix(in srgb, var(--mark-${hue}) var(--mark-tint), var(--color-surface))`,
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
