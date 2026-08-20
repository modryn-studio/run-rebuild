'use client';

/* THE TAPE: every trade the filter selected, banded by the session it was realised in.
 *
 * Ported from `run-trading@v2`'s `trades-card.tsx` (2026-08-17, S5c), including both of its paging
 * mechanics — the earlier version of this file had neither, which is why it looked like v2 and did
 * not behave like it.
 *
 * ONE LINE PER EVENT. v2 shipped a two-line 69px row carrying entry and exit prices, then moved
 * them into the drawer: "those prices are VERIFICATION detail. A tape is for scanning, and a scan
 * wants one line per event." What survived: the PRODUCT (what), the CLOCK (when), the RESULT.
 *
 * SORTED BY THE ENTRY, BANDED BY THE EXIT. Money is realised at the close, so the SESSION comes from
 * the exit; the DECISION is the entry, so the order within a session comes from that. Ordering rows
 * by the exit was visibly wrong on v2's own tape: a position scaled out in three pieces closes on
 * one stamp, so three consecutive rows printed the same time and the sequence was carried by
 * nothing the eye could see.
 */

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { fmtMoney } from '@/lib/format';
import { productName } from '@/lib/instruments';
import { InstrumentMark } from './instrument-mark';
import { ColumnsMenu, useTapeColumns, type TapeColumn } from './columns-menu';
import { displayTime, displaySessionDate } from '@/lib/time/session';
import type { SessionGroup, TapeRow } from '@/lib/trades/read';
import { TradeDrawer } from './trade-drawer';

/** How many rows are IN THE DOM. 361 rows became ~5,000 nodes on v2 and cost ~2 of its 4.5s to
 *  interactive, so the window governs the DOM while the fetch below governs the wire. */
const PAGE = 60;
/** How many rows cross the wire per trip. */
const BATCH = 300;

/** `+` on a gain, the minus `fmtMoney` already carries on a loss. A tape is a sequence of outcomes
 *  and an unsigned figure makes the reader do the comparison the sign is there to do for them. */
const signed = (cents: number): string => (cents > 0 ? `+${fmtMoney(cents)}` : fmtMoney(cents));

/** What the paging route needs to answer for the rest of the tape. */
export type TapeRest = { ids: string[] };

/* JSON HAS NO DATES. Rows fetched from the route arrive with `entryAt`/`exitAt` as ISO strings,
 * while the first page's came from the server component as real `Date`s. Reviving here means every
 * consumer below sees one type — without it the clock silently renders "Invalid Date" on row 301
 * and nowhere else, which is the worst kind of bug to find. */
function reviveTrade(t: TapeRow): TapeRow {
  return { ...t, entryAt: new Date(t.entryAt), exitAt: new Date(t.exitAt) };
}

export function TradesTape({
  sessions,
  total,
  displayTimezone,
  narrowed,
  rest,
}: {
  sessions: SessionGroup[];
  /** Every trade the filter selected, which is not the number of rows sent. */
  total: number;
  displayTimezone: string;
  /** Whether anything is narrowing, which decides which empty state is honest. */
  narrowed: boolean;
  /** The ids of every trade the filter selects, so the client can ask for the rest by id. */
  rest?: TapeRest;
}) {
  /* WHICH ROW IS OPEN, as an INDEX into the flattened list rather than an id, because the steppers
     walk the list: "the next trade" is a position, and resolving an id back to one on every arrow
     press would be the same lookup done later and worse. -1 is closed. */
  const [open, setOpen] = useState(-1);

  /* ENDLESS SCROLL, WINDOWED ON THE CLIENT. Two mechanics and they are not redundant: `limit`
     governs how many rows are in the DOM, `extra` governs how many have crossed the wire. */
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  /* THE ROWS FETCHED SINCE THIS LIST LOADED, kept beside the server's rather than merged into them:
     props are the server's and this is ours, and keeping the two apart is what makes the reset below
     a single obvious line rather than a reconciliation. */
  const [extra, setExtra] = useState<TapeRow[]>([]);
  /* THE REASON, NOT JUST THE FACT. This was a bare boolean and the line it drew said only "Could
     not load more trades" — which is the silent-failure this codebase forbids everywhere else: a
     401, a 500 and an empty batch are three different problems with three different fixes, and the
     trader (or whoever is debugging it) could not tell them apart. Null means no failure. */
  const [failure, setFailure] = useState<string | null>(null);
  const failed = failure !== null;
  /* A REF, NOT STATE. This guards against a second fetch starting while one is in flight, and a
     state flag would only take effect on the next render — one render too late when the observer
     can fire twice in a frame. Nothing reads it during render. */
  const busy = useRef(false);

  // The server's rows, flattened back out of their session groups, plus anything fetched since.
  const fromServer = sessions.flatMap((s) => s.trades);
  const all = extra.length > 0 ? [...fromServer, ...extra] : fromServer;
  const visible = all.slice(0, limit);
  const more = all.length > limit;
  /** Rows the filter selects that have not crossed the wire yet. */
  const unfetched = rest ? rest.ids.length - all.length : 0;

  /* THE FETCH, DRIVEN BY THE BUFFER RATHER THAN BY THE SENTINEL. Reaching the last row and only THEN
     asking the server is how a list stutters: the trader waits at a spinner for a round trip that
     could have happened while they were still scrolling. Half a batch of runway. */
  useEffect(() => {
    if (!rest || failed || busy.current) return;
    if (unfetched <= 0) return;
    if (all.length - limit > BATCH / 2) return;

    busy.current = true;
    const from = rest.ids.length - unfetched;
    void (async () => {
      try {
        const res = await fetch('/api/trades/page', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ids: rest.ids.slice(from, from + BATCH) }),
        });
        if (!res.ok) {
          // The status IS the diagnosis: 401 is a dead session, 500 is the route, 404 is the path.
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ? `${res.status}: ${body.error}` : `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { trades?: TapeRow[] };
        const rows = (data.trades ?? []).map(reviveTrade);
        /* AN EMPTY BATCH WOULD LOOP FOREVER — `from` is derived from what we hold, so nothing new
           means the next render asks for the same window again. Treated as a failure, which is what
           it is: the ids came from this same filter and should have resolved. */
        if (rows.length === 0) setFailure('the server returned no rows for ids it should know');
        else setExtra((x) => [...x, ...rows]);
      } catch (e) {
        setFailure(e instanceof Error ? e.message : 'the request did not complete');
      } finally {
        busy.current = false;
      }
    })();
  }, [rest, failed, unfetched, all.length, limit]);

  useEffect(() => {
    // Nothing left to reveal and nothing left to fetch: no observer, and none left running from the
    // previous render.
    if (!more && unfetched === 0) return;
    const el = sentinel.current;
    if (!el) return;
    /* `rootMargin`, so the next page is already rendering by the time the trader reaches the bottom
       rather than after they hit it and wait. */
    const io = new IntersectionObserver(
      (entries) => {
        // Clamped to what is loaded. Letting the limit run past the end while a fetch is in flight
        // would land 300 rows in the DOM at once when it returned, which is the whole thing the
        // window exists to prevent.
        if (entries.some((e) => e.isIntersecting)) setLimit((n) => Math.min(n + PAGE, all.length));
      },
      { rootMargin: '600px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
    /* `all.length` IS A DEPENDENCY and it is load-bearing, not tidiness. An observer does not
       re-fire for an element that was already intersecting, so when a batch arrives under a sentinel
       still on screen nothing would wake the list up. Re-creating it re-delivers the entry. */
  }, [more, limit, unfetched, all.length]);

  /* THE DRAWER'S STEPPER PULLS THE WINDOW ALONG. The sentinel is not the only way to reach the
     bottom: opening a trade and pressing Next walks to row 60 and stops there, on a tape of
     thousands, with the arrow greyed out as though that were the end. The drawer walks the RENDERED
     array on purpose, so the honest fix is to render more rather than hand it a second, longer list.
     Two rows of lead so the step after this one is already there. */
  useEffect(() => {
    if (open < 0 || !more) return;
    if (open >= visible.length - 2) setLimit((n) => Math.min(n + PAGE, all.length));
  }, [open, more, visible.length, all.length]);

  /* A NEW FILTER IS A NEW LIST, so the window starts over rather than staying deep in a tape the
     trader is no longer looking at, and so does everything fetched against the old one. The drawer
     closes with it, because index 400 of the old list is not a trade in the new one.
     KEYED ON THE LIST'S IDENTITY, NOT ITS REFERENCE: `router.refresh()` hands down a new array
     holding the same trades in the same order, and against a reference dependency that reads as a
     new list — which would slam the drawer shut every time the page revalidated. First id, last id
     and length are enough: a filter change moves at least one, a refresh of the same slice moves
     none. */
  const listKey = `${fromServer.length}:${fromServer[0]?.id ?? ''}:${fromServer[fromServer.length - 1]?.id ?? ''}`;
  useEffect(() => {
    setLimit(PAGE);
    setExtra([]);
    setFailure(null);
    setOpen(-1);
  }, [listKey]);

  /* REGROUPED FROM THE WINDOW, not from the server's own groups, because rows fetched since arrive
     flat and belong under their own session bands. The flat order the drawer steps through is then
     rebuilt from these groups rather than assumed to equal `visible` — so what the stepper walks is
     exactly what is on screen. */
  const days = groupBySession(visible);
  const flat = days.flatMap((d) => d.trades);
  // Session totals come from the server and cover the WHOLE session, not the rows drawn.
  const { hidden: hiddenColumns, toggle: toggleColumn } = useTapeColumns();
  const totalsFor = new Map(sessions.map((s) => [s.sessionDate, s]));

  /* `@container` so a column can be gated on the CARD's width rather than the viewport's.
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
        {/* THE COUNT CAME OUT (2026-08-20). It read "360 trades" here, and the summary rail beside
            it already says `Trades 360` off the same filtered set - `getDigest` and the tape count
            one set by construction, so the two can never disagree and the second was pure redundancy
            sitting where the reference puts CONTROLS. Measured on Monarch: its table header carries
            Edit multiple / Sort / Columns and NO count, despite the same rail-plus-table shape.
            SORT IS DELIBERATELY NOT HERE. This tape's order is a finding rather than a preference:
            rows descend by ENTRY because a position scaled out in three pieces closes on one exit
            stamp, so ordering by exit prints one time on three rows and the sequence reads as
            random. A generic column sorter invites exactly that arrangement. If sort ships it needs
            a deliberate short list that excludes the broken one. */}
        <ColumnsMenu hidden={hiddenColumns} onToggle={toggleColumn} />
      </div>

      {all.length === 0 ? (
        <Empty narrowed={narrowed} />
      ) : (
        days.map((d) => {
          const t = totalsFor.get(d.sessionDate);
          return (
            <div key={d.sessionDate}>
              {/* THE SESSION BAND. Ground `band`, no rules, and BOTH the date and the total muted.
                  The muted total is the interesting half: a band is a LABEL for the rows under it
                  and its figure is a subtotal of numbers already on screen, so in full ink it
                  competes with the results it is only summarising. A ground change is enough to
                  separate a label from a list, which is why no rule is needed.
                  `top-15` matches the header's own `min-h-15`, so the band rests exactly beneath. */}
              <div className="bg-band sticky top-15 z-10 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 py-2">
                <span className="text-body text-muted font-medium">
                  {displaySessionDate(d.sessionDate)}
                </span>
                {/* THE DAY'S NET, AND NOTHING ELSE (2026-08-19, Luke: "keep it simple").
                    This carried the count and the win rate too, which `spec.md` §5 asked for and
                    which `psychology.md` §6 then argues against on the page it governs: the four
                    properties are "specificity in place of evaluation" and "ending on a position,
                    not a grade". `0% win` on a seven-trade day is a grade — it is the only figure
                    on this page that scores a stretch of trading rather than reporting it, and it
                    lands hardest on exactly the day a trader least needs scoring.
                    The count and the rate are not lost: both are in the summary rail, over the
                    filtered set, where they are a description rather than a verdict on one day.
                    `run-trading@v2` groups by day with `{ day, netCents, trades }` and prints only
                    the net, so this is also what the reference does. spec.md and build-plan.md were
                    amended in the same commit; see the note there. */}
                {t && (
                  <span className="text-body text-muted font-medium tabular-nums">
                    {signed(t.netCents)}
                  </span>
                )}
              </div>
              <div className="divide-rule divide-y">
                {d.trades.map((row) => (
                  <Row
                    hidden={hiddenColumns}
                    key={row.id}
                    trade={row}
                    zone={displayTimezone}
                    onOpen={() => setOpen(flat.indexOf(row))}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* THE SENTINEL, and it is the only thing on screen that knows a window exists. It carries a
          row's height so the observer has something real to intersect, and a quiet line rather than
          a spinner: the next page renders in a frame or two, and a spinner that flashes for 30ms
          reads as a stutter rather than as progress. `aria-hidden` because the rows arriving
          beneath it are the announcement.
          THE COUNT IS AGAINST THE WHOLE TAPE, not against what has been loaded (Luke, 2026-08-05:
          "why did we create a footer saying 'Showing the first 300 of 2,277'... that is super
          confusing"). Whether a row is in the DOM, in memory or still on the server is the tape's
          business, not the trader's — so the line says the one thing they asked, which is how much
          is left. */}
      {(more || unfetched > 0) && !failed && (
        <div ref={sentinel} aria-hidden className="flex h-13 items-center justify-center">
          <span className="text-body text-muted">
            {(total - limit).toLocaleString('en-US')} more {total - limit === 1 ? 'trade' : 'trades'}
          </span>
        </div>
      )}

      {/* A FETCH CAN FAIL, and a scroll that silently stops is indistinguishable from the end of the
          tape. Says what happened and offers the retry, rather than leaving the trader to guess. */}
      {failed && (
        <div className="border-rule flex min-h-13 flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t px-5 py-3 text-center">
          <span className="text-body text-muted">
            Could not load the remaining {(total - all.length).toLocaleString('en-US')} trades.
          </span>
          {/* THE REASON, said out loud. A scroll that silently stops is indistinguishable from the
              end of the tape, and "could not load" with no cause is indistinguishable from a bug in
              any of four layers. */}
          <span className="text-caption text-muted">({failure})</span>
          <button
            type="button"
            onClick={() => setFailure(null)}
            className="text-body text-link font-medium"
          >
            Try again
          </button>
        </div>
      )}

      {open >= 0 && flat[open] && (
        <TradeDrawer
          trade={flat[open]}
          zone={displayTimezone}
          onClose={() => setOpen(-1)}
          onPrev={open > 0 ? () => setOpen(open - 1) : undefined}
          onNext={open < flat.length - 1 ? () => setOpen(open + 1) : undefined}
          position={{ index: open, of: flat.length }}
        />
      )}
    </Card>
  );
}

/** Rows back into session bands. The server groups the first page; anything fetched after arrives
 *  flat, so the window is regrouped here rather than appended to stale groups. */
function groupBySession(rows: TapeRow[]): { sessionDate: string; trades: TapeRow[] }[] {
  const out: { sessionDate: string; trades: TapeRow[] }[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.sessionDate === r.sessionDate) last.trades.push(r);
    else out.push({ sessionDate: r.sessionDate, trades: [r] });
  }
  return out;
}

function Row({
  trade: t,
  zone,
  onOpen,
  hidden,
}: {
  trade: TapeRow;
  zone: string;
  onOpen: () => void;
  /** Which optional columns the trader has turned off. See `columns-menu.tsx`. */
  hidden: TapeColumn[];
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
          needing 131, while the account beside it truncated to "FTDFYL..." inside 115. */}
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

      {!hidden.includes('account') && (
        <span className="text-body text-muted hidden min-w-0 flex-1 items-center gap-1.5 sm:flex">
          <AccountName name={t.accountName} logo={t.firmLogo} />
        </span>
      )}

      {/* WHEN IT WAS TAKEN, not when it closed, and it has to be the key the list is sorted by or
          the order reads as random. `w-20` because "12:28 PM" needs the room "08:54" did not. */}
      {!hidden.includes('time') && (
        <span className="text-body text-muted hidden w-20 shrink-0 tabular-nums sm:block">
          {displayTime(t.entryAt, zone)}
        </span>
      )}

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
          <span
            className="text-muted shrink-0"
            title={t.quarantineReason ?? t.exclusionReason ?? undefined}
          >
            <Icon name="warn" size={14} />
          </span>
        )}
        <span
          className={cn('text-body-lg font-medium tabular-nums', excluded && 'text-muted')}
          style={
            excluded ? undefined : { color: t.netCents >= 0 ? 'var(--color-pos)' : 'var(--color-neg)' }
          }
        >
          {signed(t.netCents)}
        </span>
      </div>

      {/* IT LIGHTS WITH THE ROW. The whole row is the button, so a bare chevron sitting inside it
          reads as a control that is switched off.
          A SPAN THAT WEARS `IconButton`'S MECHANIC, not the component: this sits INSIDE a <button>,
          and a nested button is invalid HTML - which is also why it is `aria-hidden`. The row is the
          control; this is the mark that says so.
          BORDER ON HOVER, NOT A DROP SHADOW (2026-08-20). It hand-rolled the mechanic IconButton
          carried before the house rule landed, `shadow-card` included - so it kept claiming "I float
          above the page" after every other control in the product had stopped. Now it is the same
          three states `.lift-press` declares: nothing at rest, the border a secondary button shows
          at rest plus the raised ground on hover, and the pressed ground plus the INSET on press.
          `border-transparent` at rest so only the COLOUR moves and the disc never resizes. */}
      <span
        aria-hidden
        className="text-muted group-hover:text-text group-hover:bg-surface group-hover:border-border group-active:bg-bg group-active:shadow-[var(--shadow-press)] flex size-8 shrink-0 items-center justify-center rounded-full border border-transparent transition"
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
 * twelve of them, that tail is the only part they are reading. So the tail is its own `shrink-0`
 * span and the head takes the squeeze.
 *
 * NOT `accountLast4`, WHICH IS A DIFFERENT JOB and reaching for it here shipped a real defect for
 * one render: that helper COMPOSES a bracketed suffix for a firm name, so using it to SPLIT a
 * string made the head `name.slice(0, len - 9)` and the row read "FTDFYL100 (...4873)" — the middle
 * digits dropped by arithmetic rather than by truncation, which is a wrong string rather than a
 * shortened one. Splitting the name itself cannot do that: every character is still rendered, and
 * the browser decides what fits.
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
          "FTDFYL10018370 4873", which reads as two fields rather than one truncated id. */}
      <span className="flex min-w-0">
        <span className="truncate">{head}</span>
        {tail && <span className="shrink-0">{tail}</span>}
      </span>
    </>
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
