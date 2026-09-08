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

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { PHONE_QUERY } from '@/lib/shell';
import { signed } from '@/lib/format';
import { productName } from '@/lib/instruments';
import { InstrumentMark } from './instrument-mark';
import { ColumnsMenu, useTapeColumns, type TapeColumn } from './columns-menu';
import { displayTime, displaySessionDate } from '@/lib/time/session';
import type { FacetAccount, SessionGroup, TapeRow } from '@/lib/trades/read';
import Link from 'next/link';
import { AccountSelect } from './account-select';
import { TradeDrawer } from './trade-drawer';
import { TradeSheet } from './trade-sheet';

/** How many rows are IN THE DOM. 361 rows became ~5,000 nodes on v2 and cost ~2 of its 4.5s to
 *  interactive, so the window governs the DOM while the fetch below governs the wire. */
const PAGE = 60;
/** How many rows cross the wire per trip. */
const BATCH = 300;

/** `+` on a gain, the minus `fmtMoney` already carries on a loss. A tape is a sequence of outcomes
 *  and an unsigned figure makes the reader do the comparison the sign is there to do for them. */

/** The account's name as one string, for the cell's tooltip and its accessible name. `AccountName`
 *  puts the head and the tail in separate spans so only the head truncates, which means the space
 *  between them is a flex gap rather than a character — so it has to be put back here. */
const accountTitle = (t: TapeRow): string =>
  t.accountTail ? `${t.accountHead} ${t.accountTail}` : t.accountHead;

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
  accounts,
  selectedAccounts,
  narrowed,
  rest,
  title,
  fixedColumns,
  action,
  emptyAction,
}: {
  sessions: SessionGroup[];
  /** Every trade the filter selected, which is not the number of rows sent. */
  total: number;
  displayTimezone: string;
  /** Every account the trader owns, for the header's selector. From `getFacets`. */
  accounts: FacetAccount[];
  /** The ids in the `accounts` param right now. Empty means every account. */
  selectedAccounts: string[];
  /** Whether anything is narrowing, which decides which empty state is honest. */
  narrowed: boolean;
  /** The ids of every trade the filter selects, so the client can ask for the rest by id. */
  rest?: TapeRest;
  /* THE CARD'S OWN NAME, AND ONLY A SUBJECT PAGE PASSES ONE (`S6d`, 2026-08-27).
     `/trades` deliberately has none: the shell's band already prints "Trades" from the route, so a
     card header repeating it said one word twice, 64px apart. On `/accounts/details` the band
     prints the ACCOUNT, so nothing on screen has named this list yet - which is why v2's own
     `TradesCard` carries the title there and this one does not carry it everywhere. Same component,
     and the difference is a prop rather than a fork. */
  title?: string;
  /* WHETHER FEES ARE IN THESE FIGURES. Stated ONCE at the top rather than on every row: without a
     Cash History import every number below is gross, and a trader holding this page up against
     their firm's dashboard needs to know which of the two they are reading. `undefined` means the
     caller is not making the claim - `/trades` answers it in the summary rail's own label instead,
     and two places saying it would be the same fact twice. */
  /* THE COLUMN SET, WHEN THE PAGE DECIDES IT RATHER THAN THE TRADER (`S6d`, ported from v2's
     `TradesCard`). Passing it hides exactly these columns AND removes the Columns control, because
     on such a page there is nothing left to choose.
     `/accounts/details` passes `['account']`: when the subject IS an account, every row belongs to
     it and saying so is noise (v2: "the reference's merchant-page rows carry 'Visa Credit Card
     (...3686)' where its account-page rows do not"). That leaves Time as the only remaining toggle,
     and Luke's call on 2026-08-27 is that a menu of one is not worth a control - the trade times
     are always wanted on this page.
     IT REPLACED A `showAccount` BOOLEAN, WHICH CARRIED A TRAP. That version filtered the MENU but
     still read `useTapeColumns` for what to render, so a trader who had hidden Time on `/trades`
     arrived here with it hidden and no control to bring it back. Naming the whole set closes that:
     the stored preference is not consulted at all, so nothing can be hidden without a way back.
     AND IT IS NOT WRITTEN BACK. `useTapeColumns` is `localStorage` and shared; a page's layout must
     never re-decide another page's. `/trades` keeps whatever the trader chose there. */
  fixedColumns?: TapeColumn[];
  /* THE ONE CONTROL IN THIS HEADER THAT ADDS ROWS RATHER THAN NARROWING THEM (2026-09-02).
     Everything else the tape offers - Search, Date, Filters, Columns - hides trades. Until this
     prop there was no way to put the control that FILLS the tape on the surface the tape is, so
     the trader who had just finished trading was sent to the roster to press a button named after
     something they were not doing. `spec.md` `S1`, amended 2026-09-02.
     A NODE RATHER THAN A BOOLEAN, because the two pages that pass one pass different things: the
     account page's import is scoped to that account and may adopt a placeholder row, `/trades`'
     cannot be and must not. That difference is a correctness property (`lib/intake/accounts.ts`),
     so it is decided by the caller and never inferred here.
     MEASURED ON MONARCH (2026-09-02, live): its transactions table header carries its `Add` in
     exactly this position. What it opens there is a form for typing one transaction in by hand,
     which is the half Run refuses - a hand-typed trade is unreconcilable by construction. The
     placement is worth taking; the payload is not.
     IT SITS AFTER `ColumnsMenu` AND PUSHES OFF `ml-auto`, so the header reads left to right as
     what this list IS, then what narrows it, then the one thing that grows it. */
  action?: ReactNode;
  /* THE WAY OUT OF THE "no trades yet" STATE, and only that one - a NARROWED empty tape already
     has its way out in the band it was narrowed from (2026-09-02).
     SEPARATE FROM `action` BECAUSE THE TWO PAGES DIVERGE, and the divergence is Monarch's own,
     measured live: it carries its list page's control in the PAGE BAND and its detail page's in the
     TABLE HEADER. `/trades` follows that - its import is in the shell's band beside Search, Date
     and Filters, so the tape takes no `action` there and only needs to fix its dead end. The
     account page takes the reverse pair. */
  emptyAction?: ReactNode;
}) {
  /* WHICH ROW IS OPEN, as an INDEX into the flattened list rather than an id, because the steppers
     walk the list: "the next trade" is a position, and resolving an id back to one on every arrow
     press would be the same lookup done later and worse. -1 is closed. */
  const [open, setOpen] = useState(-1);

  /* THE PHONE'S SHEET HOLDS A ROW, NOT AN INDEX, and the difference is the point: it has no
     steppers, so it never needs to ask "what is next" - it needs the trade itself, which the tape
     is already holding. `null` is closed. */
  const [sheetRow, setSheetRow] = useState<TapeRow | null>(null);

  /* ONE ROW, TWO DESTINATIONS, DECIDED AT THE MOMENT OF THE TAP (`S5d`, 2026-08-20).
   *
   * A phone opens the sheet; a desktop opens the drawer in place. Both render the same
   * `TradeDetail`, so this chooses a CONTAINER rather than a screen — the facts are identical
   * either way.
   *
   * MEASURED AT THE TAP, not at render, and that is deliberate. Reading the viewport during render
   * means the server and the first client pass disagree (the server has no viewport at all), which
   * is a hydration mismatch and a visible flash. A click handler runs only in the browser and only
   * when it is needed, so the question is asked at the one moment the answer is knowable.
   *
   * `md`, THE SAME 768px BOUNDARY the shell already draws for the sidebar and the bottom bar. A
   * third breakpoint for "is this a phone" is a third answer to one question - which is why this
   * reads `PHONE_QUERY` rather than spelling the width out. The literal was here and in
   * `last-session.tsx` until 2026-09-04, two copies of a string `lib/shell.ts` already exports and
   * `usePhone` already reads; a third copy is how the three answers start. */
  const openTrade = (row: TapeRow, index: number) => {
    if (window.matchMedia(PHONE_QUERY).matches) {
      /* NO `router.push` HERE ANY MORE (2026-08-25). It used to navigate, which unmounted this
         entire tape and made the trader wait on a server round trip for a row already sitting in
         `flat` - see `trade-sheet.tsx` for the measurements. The sheet takes the row directly and
         changes the URL itself, so the tape stays mounted and Back costs nothing. */
      setSheetRow(row);
      return;
    }
    setOpen(index);
  };

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
  /* THE HOOK RUNS EITHER WAY, because hooks must. Its value is simply not read when the page has
     declared its own set - which is also what keeps the trader's `/trades` preference intact. */
  const { hidden: stored, toggle: toggleColumn } = useTapeColumns();
  const hiddenColumns = fixedColumns ?? stored;
  const totalsFor = new Map(sessions.map((s) => [s.sessionDate, s]));

  /* `@container` so a column can be gated on the CARD's width rather than the viewport's.
     `overflow-clip`, not `hidden` — it clips without creating a scroll container, which is what
     lets the header and the bands inside it stay sticky. */
  /* FULL-BLEED BELOW `md`, A CARD ABOVE IT (`S5d`, 2026-08-20, Luke: "full-bleed, no card below
     md"). The reference's mobile list runs wall to wall — no radius, no shadow, no side gutter, and
     its date bands bleed too. A 375px screen cannot afford 32px of gutter plus 40px of card padding
     to make a list of five-word rows look like an object; at that width the list IS the screen.
     `max-md:` unsets the three things `cardSurface` gives: the radius, the shadow and the ground
     step. The ground stays `surface` because the rows still need to sit on white against the grey
     bands between them — what goes is the OBJECT, not the paper.
     The negative margin cancels `PAGE_COLUMN`'s `px-4` from the inside, which is what lets the rows
     reach the screen edges without the page column having to know a phone is looking at it. */
  return (
    <Card className="@container overflow-clip max-md:-mx-4 max-md:rounded-none max-md:shadow-none">
      {/* STICKY, so the count and the tape's identity survive the scroll. The two masking spans are
          the craft detail that makes it work: a sticky header inside a rounded card lets rows show
          through the corner radius as they pass under it, so one span paints the page ground behind
          the corner and the other paints the card's own ground back over it with the radius. */}
      {/* THE WHOLE HEADER ROW GOES ON A PHONE (`S5d`, 2026-08-20, Luke: "drop the whole header row
          on mobile"). The reference has no equivalent — its screen title lives in the top bar, and
          Run's does too now, so a second "Trades" directly under it says it twice.
          `ColumnsMenu` goes with it rather than being kept, and that is the honest call rather than
          a space-saving one: it toggles ACCOUNT and TIME, and both are already off the row at this
          width. A control whose two options are both already applied has no job here. */}
      <div className="border-rule bg-surface sticky top-0 z-20 flex min-h-15 items-center gap-3 border-b px-5 py-2 max-md:hidden">
        <span aria-hidden className="bg-bg pointer-events-none absolute inset-x-0 top-0 h-3" />
        <span
          aria-hidden
          className="bg-surface pointer-events-none absolute inset-x-0 top-0 h-3 rounded-t-[var(--radius)]"
        />
        {/* THE SELECTOR STANDS WHERE THE TITLE DID (Luke, 2026-08-20). The shell's band already
            prints "Trades" from the route, so a card header repeating it said one word twice, 64px
            apart. It renders NOTHING below two accounts — see `account-select.tsx` for why that is
            correctness rather than tidiness — which leaves this header carrying only `ColumnsMenu`
            on the current one-account corpus. That is the honest state of it, not an oversight. */}
        {title && <h2 className="text-title text-text font-medium">{title}</h2>}
        {/* THE FEE LINE IS GONE (2026-09-04). It read *"Gross, no fees imported"* beside the word
            `Trades`, and `hasFees === false` is now only true for an account with no trades - so the
            one place it rendered was a header above an empty table, qualifying figures that were not
            there. The argument is on `label` in `pnl-chart.tsx`. */}
        <AccountSelect accounts={accounts} selected={selectedAccounts} />
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
        {/* ABSENT, NOT EMPTY, when the page owns its columns. A menu whose every entry is decided
            elsewhere is a control that cannot change anything, which this file already refuses for
            `AccountSelect` below two accounts. */}
        {!fixedColumns && <ColumnsMenu hidden={hiddenColumns} onToggle={toggleColumn} />}
        {/* `ml-auto` RATHER THAN `justify-between` ON THE ROW, because this header's left-hand side
            is a variable number of things - a title, a gross-fees note, a selector, a menu - and
            several of them render nothing on any given page. Splitting the row would push the
            leftmost survivor to one edge and this to the other on a header carrying two items;
            pushing only this one keeps the rest as a left-aligned cluster whatever survives. */}
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </div>

      {all.length === 0 ? (
        <Empty narrowed={narrowed} action={emptyAction} />
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
              {/* `top-15` matches the tape's own column header (`min-h-15`, sticky at 0 inside this
                  same scroller) so the band rests exactly beneath it. That header is `max-md:hidden`.
                  `top-0` BELOW `md`, CHANGED 2026-08-24 WITH THE SEARCH ROW. It was `top-14`, 56px,
                  the search row's exact height - because that row was `sticky top-0` in this
                  scroller and the band had to clear it. The row now portals into the shell's header
                  band, OUTSIDE `<main>`, so the scrollport already begins below it and 56px of
                  offset would park the band 56px down from its own ceiling with a strip of tape
                  showing through the gap. Nothing to clear, so nothing to offset. */}
              <div className="bg-band sticky top-15 z-10 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 py-2 max-md:top-0 max-md:px-4">
                {/* THE BAND TAKES THE SAME STEP AS THE ROWS IT LABELS. Chrome is never smaller than
                    the content it controls, and at 12 against a 14px row it still is not. */}
                <span className="text-body max-sm:text-small text-muted font-medium">
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
                  <span className="text-body max-sm:text-small text-muted font-medium tabular-nums">
                    {signed(t.netCents)}
                  </span>
                )}
              </div>
              <div className="divide-rule divide-y">
                {d.trades.map((row) => (
                  <TradeRow
                    hidden={hiddenColumns}
                    key={row.id}
                    trade={row}
                    zone={displayTimezone}
                    onOpen={() => openTrade(row, flat.indexOf(row))}
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
            {(total - limit).toLocaleString('en-US')} more{' '}
            {total - limit === 1 ? 'trade' : 'trades'}
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
          /* `rest.ids.length`, NOT `flat.length` (2026-08-25, postcheck). `flat` is the RENDERED
             WINDOW, so a 360-trade tape said "1 of 60" beside a rail saying `Trades 360` and a
             footer saying "300 more trades" - and the denominator GREW as the trader scrolled, so
             the same trade read "1 of 60" and then "1 of 120". Under "never show a number you
             cannot reconcile" that was the one unreconcilable figure on the page.
             `rest.ids` is the ordered id list for the whole filtered selection, which is the set
             the stepper actually walks. */
          position={{ index: open, of: rest?.ids.length ?? flat.length }}
        />
      )}

      {/* THE PHONE'S CONTAINER, AND IT IS MOUNTED WHETHER OR NOT A TRADE IS OPEN. That is what
          lets it travel in both directions, and it is why tapping a row moves something on the
          same frame instead of after a navigation. The breakpoint gate lives HERE, with the surface
          that knows this is the phone's container - see the prop's note in `trade-sheet.tsx`. */}
      <TradeSheet
        className="md:hidden"
        row={sheetRow}
        zone={displayTimezone}
        onClose={() => setSheetRow(null)}
      />
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

/* A LINK THAT SOMETIMES REFUSES TO NAVIGATE, which is the honest shape of this control
 * (2026-08-24). The row DOES go somewhere on a phone - `/trades/[id]` - so it owes the things only
 * a real anchor gives: middle-click, cmd-click, "open in new tab", and a status bar that shows the
 * destination. It was a `<button>` calling `router.push`, which had none of them.
 *
 * ABOVE `md` IT OPENS THE DRAWER IN PLACE and navigates nowhere, so there the click is prevented.
 * The `href` stays regardless: it is a true statement about where this row's trade lives, and it is
 * what makes cmd-click work on a desktop even though a plain click does not.
 *
 * THE LINK EARNS ITS PLACE ON THE AFFORDANCES ALONE. It was converted partly to enable a
 * `useLinkStatus` spinner in the row, and that spinner has since been removed as the wrong mark for
 * the event - the wait belongs at the destination, in the shape of what is arriving. The anchor
 * stays regardless: middle-click and cmd-click are reason enough for a control that navigates.
 *
 * ─── THE ROW STOPPED BEING THAT LINK (2026-09-04), AND KEPT BEING THAT TARGET ────────────────────
 *
 * The account cell is now a second destination, and two links cannot nest. The row is a `<div>`;
 * the anchor wrapping the instrument name throws an `::after` back out to the row's edges. Same hit
 * area, one fewer invalid nesting, a better accessible name. Details at the anchor itself.
 *
 * WHY THE ROW KEPT THE HIT AREA RATHER THAN COPYING THE REFERENCE, which was the live question.
 * Monarch's transaction row is inert - `cursor: auto`, no hover rule anywhere on it - and its
 * detail opens ONLY from a 32px chevron. Three things decided against copying that:
 *
 *   ITS ROW HAS FOUR PEER TARGETS (merchant, category, account, detail) and no primary, so no one
 *   of them can own the row. This row has one primary and one secondary. A single dominant action
 *   is the case the block link exists for.
 *
 *   OPENING THE TRADE IS THE LOOP HERE. Monarch can afford a 32x32 target because its common act
 *   is re-categorising inline, which is why its merchant and category are comboboxes rather than
 *   links. Run's tape is read by opening rows. Trading ~1000x49 for 32x32 is a Fitts's Law cost
 *   paid on every single open.
 *
 *   AND ON A PHONE THE REFERENCE ITSELF TAPS THE ROW. Both facts are `S5d`, from the NATIVE APP via
 *   Luke - never from the browser, which cannot reach it and whose narrowed web view is a squeezed
 *   desktop table rather than a designed screen (CLAUDE.md, Tooling). `build-plan.md`: the app's
 *   transaction row is one line - category emoji, merchant, amount - and "Tap a row -> full screen,
 *   animated up from the bottom". The chevron note below says the same: no chevron there, the whole
 *   row is the target. So chevron-only would not have been copying the reference on a phone, it
 *   would have been contradicting it - and this row's chevron is already `max-md:hidden`, which
 *   would have left the phone with no target at all.
 *
 *   THE SAME SOURCE SETTLES THE ACCOUNT CELL: the app's row carries no account, which is why the
 *   link below is `hidden ... sm:flex` and why nothing was added to the phone row here. */
/* EXPORTED SINCE 2026-08-28, for `RecentTrades` on the phone's account page. A second table
 * rendering its own lookalike row is how two lists of the same object stop agreeing about what a
 * row is - and this one already carries a dozen measured decisions (the 45px mark inset, the 14px
 * phone step it shares with the roster row, which columns drop below `sm`, where the net figure's
 * right edge sits). The other table differs in its HEADER and its LENGTH, which is all it should
 * differ in. */
export function TradeRow({
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
    <div
      // A durable probe target. Verifying a tape by guessing markup selectors is how a session
      // spends an hour proving a page rendered nothing when it rendered fine.
      data-trade={t.id}
      /* `relative` IS LOAD-BEARING NOW, not decoration: it is the containing block that clamps the
         trade link's overlay to this row. Without it the overlay resolves against the nearest
         positioned ancestor - the card, or the viewport - and one row's link swallows the whole
         tape. See the anchor below. */
      /* `px-4` AND A TIGHTER MARK GAP ON A PHONE (2026-08-21). Measured against the reference's own
         mobile screen, taken as ratios of screen width so the device scale cannot skew it: its row
         label starts at 11.7% of the width, Run's started at 15.4% — 45px against 60px at 390. The
         heights were already right (row 52 against 51, band 36 against 37); the whole difference was
         horizontal.
         `px-4` also gives the screen ONE left edge: the search field above sits at 16 because the
         page column does, and the band and row content now start there too. Three surfaces that
         each began at a different x (16, 20, 20) is what made the column read as slightly loose
         rather than as a list. The `px-5` card gutter stays above `md`, where it is measured off
         the reference's desktop card and where a 20px inset has room to be one. */
      className="group hover:bg-hover relative flex min-h-13 w-full items-center gap-4 px-5 py-2 text-left transition-colors max-md:gap-3 max-md:px-4"
    >
      {/* THE INSTRUMENT, and the first of the two flexible columns. `min-w-0` on both is what stops
          either from pushing the figures off their shared right edge.
          AN EQUAL CLAIM ON THE SLACK, not a 2:1 one. Measured at 1440 with the rail and sidebar
          open, which leaves the tape 689px: a 2:1 split handed this column 230px to render a name
          needing 131, while the account beside it truncated to "FTDFYL..." inside 115. */}
      <div className="flex min-w-0 flex-1 items-center gap-3 max-md:gap-2">
        <InstrumentMark symbol={contract} />
        <div className="min-w-0">
          {/* 14px ON A PHONE (2026-08-27), AND IT MOVES WITH THE ROSTER ROW. A tape row and a
              roster row are the same object - a list row naming a thing with a money figure pinned
              right - so they take the phone's step together or the two pages disagree about what a
              row is. `/accounts` needed it to stop truncating account names; this page does not have
              that problem and takes the step anyway, because consistency is the reason.
              THE SEARCH FIELD ABOVE DOES NOT MOVE and must not: `text-body-lg` is the iOS no-zoom
              floor for a focused input, which is a browser behaviour rather than a type decision. */}
          {/* THE ROW'S TARGET IS THE WHOLE ROW; THE ANCHOR IS ONLY THIS WORD (2026-09-04). The
              element used to BE the row, which stopped being legal markup the moment the account
              cell became a second link - `<a>` inside `<a>` is not a nesting the parser allows, it
              is one it silently rewrites. So the anchor shrank to the instrument name and grew an
              `::after` back out to the row's edges, clamped by the `relative` above.
              THE HIT AREA IS UNCHANGED. This is the block-link / "breakout" pattern (Adrian
              Roselli, Andy Bell): one real anchor, one real second link raised above its overlay,
              nothing nested. What it BUYS over the old shape is the accessible name - the row's
              text used to be concatenated into one link label reading "MNQ 09:31 Apex Trader
              Funding 50K (...4021) +$412.50, link". Now the label is composed, ordered, and stops.
              `truncate` IS ON THE SPAN, NOT THE ANCHOR, and that is not tidiness. `truncate` sets
              `overflow: hidden`, which clips a pseudo-element to its own box - so an anchor wearing
              it would clip the overlay back down to the width of the word and take the row's hit
              area with it. The anchor must not have an overflow. */}
          <Link
            href={`/trades/${t.id}`}
            aria-label={`${name ?? contract}, ${displayTime(t.entryAt, zone)}, ${signed(t.netCents)}`}
            /* `onOpen` DECIDES, AND IT ALREADY KNEW HOW. It measures the viewport at the tap and
               either pushes the route or opens the drawer - see its own note upstream. The only new
               part is that when it opens the drawer, the anchor's default navigation has to be
               cancelled, or the desktop would open the drawer AND leave for the route.
               Modified clicks are left alone: cmd/ctrl/shift/middle must reach the browser, or the
               affordances this element is an anchor for are the ones it swallows.
               AND A DRAG THAT SELECTED TEXT IS NOT A CLICK. This is the one cost the block-link
               pattern is known for: an overlay covering the row means highlighting a figure to copy
               it ends in a navigation instead. The row has had that bug since it became a link in
               August; the overlay only makes it worth fixing. A selection inside this row means the
               pointer was reading, not aiming. */
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              /* SCOPED TO THIS ROW, and that is the difference between a guard and a bug. A bare
                 "is anything selected" would let a selection left behind anywhere on the page - in
                 the drawer that was just closed, in the header - swallow the next click on any row,
                 and the trader would experience it as the tape ignoring them once. */
              const selection = window.getSelection();
              const dragged =
                selection !== null &&
                !selection.isCollapsed &&
                selection.toString().trim() !== '' &&
                e.currentTarget.closest('[data-trade]')?.contains(selection.anchorNode) === true;
              e.preventDefault();
              if (dragged) return;
              onOpen();
            }}
            className="after:absolute after:inset-0 after:content-['']"
          >
            <span className="text-body-lg max-sm:text-body text-text block truncate">
              {name ?? contract}
            </span>
          </Link>
          {/* THE PHONE'S SECOND LINE IS GONE (`S5d`, 2026-08-20). This read
              `{qty} {direction} · {time}` below `sm`, standing in for the two columns to its right.
              The reference's mobile row is strictly ONE line — its category mark, the merchant, the
              amount — and Luke's call is to copy that screen.
              WHAT IT COSTS, STATED: direction and time come off the row on a phone. That is
              defensible only because the DETAIL SCREEN carries both, which is the same split the
              reference makes — the list is for scanning, the detail is for checking. It is also the
              position the `Columns` control already takes on desktop, where account and time are
              exactly the two fields a trader is allowed to drop.
              Nothing replaces it: a row that is one line is one line. */}
        </div>
      </div>

      {/* FULL INK, NOT MUTED (2026-08-24), and the reference decided it. Read live off Monarch's own
          transactions table rather than inferred: its account cell renders at `rgb(255,255,255)` on
          a `rgb(25,25,24)` ground — the BRIGHTEST thing in the row, above even the merchant name at
          `rgb(238,238,236)`. Its whole row is full ink; the only muted things on that screen are the
          date group bands and two icon glyphs.
          That does not break "muted is METADATA, ink is PROSE", because an account is not metadata
          about the trade — it is one of the facts the trade IS, and on a funded account it is the
          fact that decides whether a loss matters. The hierarchy this column used to carry in COLOUR
          it now carries in SIZE, which is what the reference does too: `text-body` here against
          `text-body-lg` on the instrument. */}
      {/* AND IT IS A LINK NOW (2026-09-04), to the account's own page. Read live off Monarch's
          transactions table, which is where the whole mechanic comes from and where every number
          below was measured rather than guessed.
          `relative` PLUS A STACKING ORDER, which is what keeps this reachable: it sits above the
          trade link's overlay instead of under it. It comes after that anchor in the DOM, so source
          order alone would do it - `z-10` is here to say so out loud, because a later reorder of
          this row would otherwise silently make the account uncliqueable and nothing would fail.
          THE BORDER AND THE ARROW ARRIVE TOGETHER, on hover and on focus. Monarch: a 1px border in
          `--border-primary-hover` at 8px radius, and an `arrow-right` fading 0 -> 1. Both at 0.1s
          `ease-out`, which is the curve this system already names for a thing entering or leaving.
          THE ARROW'S SPACE IS ALWAYS RESERVED - `opacity`, never `width`. Monarch's account cell
          measures 234px at rest and 234px on hover; the merchant cell beside it animates its own
          chevron's WIDTH and visibly shoves the name left. In a column of rows, one row reflowing
          under the pointer is the tape moving while you read it.
          NOT `IconButton`, and not a nested control: this is one link whose mark is part of it. */}
      {!hidden.includes('account') && (
        <Link
          href={`/accounts/details/${t.accountId}`}
          /* THE FULL NAME ON HOVER, because this is the cell that truncates. `AccountName` gives
             the firm away before the digits, so a squeezed column shows "Apex Trader Fun… (...4021)"
             and the tooltip is the only place the whole string exists. Monarch does the same, with
             the composed title on a plain `title`. */
          title={accountTitle(t)}
          /* AND THE SAME STRING AS THE ACCESSIBLE NAME, which is not belt-and-braces - without it
             the name is wrong. `AccountName` renders the head and the tail as two spans separated
             by a flex `gap-1`, and a gap is not a character: the eye reads "Tradeify 50K (...0007)"
             and `textContent` says "Tradeify50K (...0007)". That was invisible while the row was
             one link and this was a fragment inside its label; it is the whole name now. */
          aria-label={accountTitle(t)}
          /* `rounded-sm` IS 8px HERE, which is both Monarch's measured radius and this system's
             CONTROL step (`--radius-sm`) - a button, an input, a chip. The cell is a control, so it
             takes the control's radius rather than the 12px slot radius the row itself would use.
             `group/account` SO THE ARROW ANSWERS THIS CELL AND NOT THE ROW. The row is already a
             `group`, and a bare `group-hover` on the mark below would light the arrow whenever the
             pointer was anywhere in the row - which is the one thing the mark must not say, since
             the rest of the row goes somewhere else entirely.
             THE FOCUS RING IS NOT SUPPRESSED. Monarch clears its outline and leans on the border
             alone; this system draws a 2px accent ring on `:focus-visible` globally, and a keyboard
             user losing it here to match a competitor would be copying the wrong half. The border
             and the arrow arrive on focus too, so the cell reads the same either way in. */
          className="group/account border-transparent hover:border-border focus-visible:border-border text-body-lg text-text relative z-10 hidden min-w-0 flex-1 items-center gap-1.5 rounded-sm border px-2 py-1 transition-colors sm:flex"
        >
          <AccountName head={t.accountHead} tail={t.accountTail} logo={t.firmLogo} />
          {/* THE ARROW, NOT A CHEVRON, and the distinction is the destination. A chevron in this
              system means "there is more of this here" - it is what the row's own mark says. An
              arrow means "you are leaving for somewhere else", which is what this cell does: it
              exits the tape. `back` rotated 180deg because the set holds one arrow and rotating it
              is how this file already draws the row's chevron. */}
          <Icon
            name="back"
            size={16}
            aria-hidden
            className="text-muted ml-auto shrink-0 rotate-180 opacity-0 transition-opacity group-hover/account:opacity-100 group-focus-visible/account:opacity-100"
          />
        </Link>
      )}

      {/* WHEN IT WAS TAKEN, not when it closed, and it has to be the key the list is sorted by or
          the order reads as random. `w-20` because "12:28 PM" needs the room "08:54" did not. */}
      {/* ONE SIZE ACROSS THE ROW (2026-08-24, Luke: "flatten to 16 everywhere in the row").
          The reference's row is 16px in every cell - merchant, category, account - and carries its
          hierarchy in WEIGHT and INK instead of in size. This row split 16/14, which made account
          and time read as annotations on the instrument rather than as fields of equal standing.
          They are not annotations: an account decides whether a loss matters, and the entry time is
          the key the tape is ordered by.
          What still separates the net figure is what separates it in the reference too - it is the
          only cell that is coloured, and the only one at weight 500. */}
      {!hidden.includes('time') && (
        <span className="text-body-lg text-text hidden w-20 shrink-0 tabular-nums sm:block">
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
          className={cn(
            'text-body-lg max-sm:text-body font-medium tabular-nums',
            excluded && 'text-muted'
          )}
          style={
            excluded
              ? undefined
              : { color: t.netCents >= 0 ? 'var(--color-pos)' : 'var(--color-neg)' }
          }
        >
          {signed(t.netCents)}
        </span>
      </div>

      {/* IT LIGHTS WITH THE ROW. The row is still the target - the trade link's overlay covers it -
          so a bare chevron sitting there at rest would read as a control that is switched off.
          STILL A SPAN, AND STILL `aria-hidden`, though the reason moved (2026-09-04). It used to be
          that this sat inside the row's own <a> and a nested control is invalid markup. The row is
          a plain <div> now, so it COULD be a real control - and must not be, because it would be a
          second element pointing at the same trade the overlay already opens. Two tab stops, one
          destination. Monarch's chevron is a real button precisely because ITS row is inert; ours
          is not, so ours stays a mark.
          BORDER ON HOVER, NOT A DROP SHADOW (2026-08-20). It hand-rolled the mechanic IconButton
          carried before the house rule landed, `shadow-card` included - so it kept claiming "I float
          above the page" after every other control in the product had stopped. Now it is the same
          three states `.lift-press` declares: nothing at rest, the border a secondary button shows
          at rest plus the raised ground on hover, and the pressed ground plus the INSET on press.
          `border-transparent` at rest so only the COLOUR moves and the disc never resizes. */}
      {/* GONE ON A PHONE (`S5d`, 2026-08-20). The reference's mobile row has no chevron: the whole
          row is the target and a tap is the affordance. It earns its place on a DESKTOP, where a
          pointer needs somewhere to aim and a hover state to answer it — neither of which exists on
          a touch screen, where it is 32px of chrome that never lights up. */}
      {/* AND NO PENDING SPINNER HERE (2026-08-25, reversing 2026-08-24). A `useLinkStatus` spinner
          sat in this slot for a day. The mark was wrong for the event: a spinner means A REQUEST IN
          FLIGHT, and tapping a row opens a whole SCREEN. That screen now states its own waiting
          shape in `[id]/loading.tsx`, which is where the wait belongs - at the destination, in the
          shape of what is arriving, rather than as a bead on the thing you just left. */}
      {/* FULL INK AT REST (2026-08-24). Monarch's own chevron measures `rgb(255,255,255)` — it does
          not sit quiet and light up, it is simply part of the row. The hover mechanic below is
          unchanged and still does the work it was added for: the GROUND and the BORDER arrive on
          hover, which is what makes it read as a control. Only the resting ink moved. */}
      {/* `pointer-events-none`, AND IT IS A BUG FIX, NOT TIDINESS (2026-09-04, Luke: "the chevron
          button on the same row does not do anything"). The mark is `aria-hidden` decoration and was
          nonetheless the one place in the row where a click died - it swallowed the event and had
          nothing to do with it.
          WHY ONLY HERE, when the time and the net figure sit further right and pass their clicks
          through fine: the glyph inside is `-rotate-90`, and a non-`none` `rotate` promotes an
          element into the POSITIONED paint step. That put it in the same step as the trade link's
          `::after` at `z-index: auto`, where document order decides - and the chevron is the row's
          last child. Nothing else in the row is transformed, so nothing else was affected, which is
          exactly why this looked like "the chevron is broken" rather than "the overlay is short".
          A z-index would also have worked and would have been the wrong fix: it would leave a
          decorative mark hit-testable and make the row's targets depend on arithmetic between three
          elements. Decoration should not be a target at all. */}
      <span
        aria-hidden
        className="text-text group-hover:bg-surface group-hover:border-border group-active:bg-bg pointer-events-none flex size-8 shrink-0 items-center justify-center rounded-full border border-transparent transition group-active:shadow-[var(--shadow-press)] max-md:hidden"
      >
        <Icon name="chevron" size={16} className="-rotate-90" />
      </span>
    </div>
  );
}

/* WHICH ACCOUNT: the firm's mark, its name, and the four digits that identify the row.
 *
 * THE SIZE AND THE DIGITS NEVER TRUNCATE, THE FIRM DOES. A plain `truncate` eats from the RIGHT,
 * which cuts exactly the tail that says WHICH account — and for a copy-trader running one strategy
 * across twelve of them, that tail is the only part they are reading. So the tail is its own
 * `shrink-0` span and the head takes the squeeze. It is the same cut the filter panel's `Chip`
 * makes, from the same `accountTitleParts`, so a chip and the rows it selects shorten identically.
 *
 * THE SPLIT COMES FROM THE SERVER, WHERE THE TITLE WAS COMPOSED (2026-08-26, Luke: "keep the size
 * and account number untouched. truncate the name only"). This shipped as `name.slice(0, -4)` /
 * `name.slice(-4)` — a blind FOUR-CHARACTER count that cut "Apex Trader Funding 50K (...4021)" into
 * head "…50K (...4" and tail "021)". So a squeezed row lost the size and half the digits, while the
 * comment sitting right here claimed the digits could not truncate. Any arithmetic split has this
 * failure mode; the composition boundary is the only cut that does not.
 *
 * THE LOGO IS ON A PERMANENTLY LIGHT TILE, the same `--color-logo-tile` the Add-account modal uses:
 * a firm ships one asset that assumes a light ground, so theming the tile would put a light-only
 * mark on a dark chip. */
function AccountName({ head, tail, logo }: { head: string; tail: string; logo: string | null }) {
  return (
    <>
      {logo && (
        <span
          /* `size-5` (20px), NOT `size-[18px]`. 18 is on no scale in this system - the nearest
             steps are 16 and 20 - and the modal’s version of this same tile is `h-8 w-8`. 20 over
             16 because the tile is bordered: at 16px the ring eats 2px and the mark inside it stops
             being a logo and starts being a smudge. */
          className="border-border flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full border"
          style={{ background: 'var(--color-logo-tile)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a static local mark, not content */}
          <img src={logo} alt="" aria-hidden className="h-full w-full object-contain" />
        </span>
      )}
      {/* HEAD AND TAIL IN ONE BOX WITH A SINGLE SPACE. The row's `gap-1.5` exists to space the logo
          off the name and was landing between these two as well, which read as two fields rather
          than as one name. `gap-1` is the space the string itself would have carried — flex trims
          whitespace at an item's edge, so it has to be put back by the layout. */}
      <span className="flex min-w-0 gap-1">
        <span className="truncate">{head}</span>
        {tail && <span className="shrink-0">{tail}</span>}
      </span>
    </>
  );
}

/* THE EMPTY STATE SAYS WHICH EMPTY IT IS. "No trades in this range" and "no trades yet" send the
 * trader to two different places, and telling somebody with two years of tape that they have never
 * traded is the version that costs trust. */
function Empty({ narrowed, action }: { narrowed: boolean; action?: ReactNode }) {
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
      {/* NEVER UNDER THE NARROWED SENTENCE. "Widen the dates, or clear the filters" names two
          controls that are already on screen; an Import button under it would answer a question
          nobody asked, and would invite a trader to re-upload a file they already have in order to
          fix a filter. The sentence above is an INSTRUCTION only in the `!narrowed` case, and that
          is the only case that was a dead end. */}
      {!narrowed && action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
