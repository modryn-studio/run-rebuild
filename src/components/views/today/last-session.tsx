'use client';

/* LAST SESSION - the front door's second card, and the proof under the first one's figure.
 *
 * ─── WHY THIS CARD EXISTS, WHICH IS NOT MONARCH'S REASON ───────────────────────────────────────
 *
 * It maps to the reference's `Transactions` widget and inherits none of its purpose.
 * `monarch-dashboard-teardown.md` §3.9 carries the argument in full; the short form is that THEIR
 * card is an action queue - the dashboard is where categorising happens without navigating - and
 * Run deleted the chore that queue exists to serve. Porting the placement and keeping the reason
 * would be porting a placement with no purpose.
 *
 * Run's three reasons, because they decide almost every line below:
 *
 *   1. IT IS THE PROOF UNDER THE HEADLINE. `Net P&L` is a figure and a curve, which is an
 *      abstraction, and this product's one claim is "our numbers are the broker's numbers". A curve
 *      cannot demonstrate that; rows can. This is the only place on the front door where the trader
 *      sees the actual trades they would recognise from their broker's own screen.
 *   2. A TRADER'S UNIT IS THE DAY. Which is why the scope is a SESSION and not "the most recent N".
 *   3. IT IS THE RE-ENTRY CARD. `CLAUDE.md`: no state may represent absence. It shows the last real
 *      day as though nothing happened - no gap, no catch-up, no counting.
 *
 * AND THE ONE CHORE IT DOES KEEP IS VERIFICATION, not data entry. The trader is the only person who
 * knows what their Friday actually looked like; a missing round trip or a quarantined row is
 * something they catch in five rows and nowhere else on this page. That is why §A11 settled that
 * quarantined rows SHOW here, marked, and why the rows are tappable.
 *
 * ─── WHAT IS DELIBERATELY NOT PORTED FROM THE REFERENCE ────────────────────────────────────────
 *
 * **THE EDITABLE ROWS.** Their four rows carry live merchant and category comboboxes. Trades are the
 * broker's or they are nothing (`CLAUDE.md`), so nothing here writes - the tap opens `TradeSheet`,
 * which reads.
 *
 * **THE CARD'S OWN ACCOUNT PICKER.** §3.9 originally said to port their `All transactions` select as
 * an account scope. `§A8` killed it before this card was built: the scope on `/today` is PAGE-level
 * and lives in the header band, so a picker here would be a second control answering "which
 * accounts" - the disagreement that page exists to prevent. `Widget`'s `scope` slot stays empty.
 *
 * **A CALL TO ACTION.** No "see all trades" pill, and `widget.tsx` already holds the argument: a CTA
 * inside a card that is itself a target is "a second thing to aim at inside a card that is already
 * aimed at". The header IS the link, filtered to this session. `RecentTrades` has a pill because it
 * is a plain `Card` with a caption; this is a `Widget` with a linked header.
 *
 * ─── THE HEADLINE IS IN THE BODY, WHICH IS THE OPPOSITE OF `Net P&L` ───────────────────────────
 *
 * That card puts its figure in the TITLE, because the reference's `net_worth` widget does and
 * because deleting the figure row was what made it compact enough to match. This one does not, and
 * the reference splits the same way: its `Transactions` widget's title is the word, not a number.
 * The date has to be in the header - a session card without its date is unreadable - and a figure,
 * a date and a noun do not share a 375px row.
 *
 * `displaySessionDate` RATHER THAN A NEW FORMATTER. It prints "Friday, August 7, 2026", which is
 * longer than a widget header wants, and it is still right: `lib/time/session.ts` owns every date
 * string in this product precisely so a second surface cannot disagree about which day it is, and
 * `/trades` prints this exact string on its session bands. A trader meeting one day under two
 * spellings is worse than a header that wraps - and `widget.tsx`'s head cluster is `flex-wrap`
 * specifically so it can.
 *
 * ─── THE WORD IS `Total P&L`, AND THERE IS NO FEE COPY AT ALL ──────────────────────────────────
 *
 * 2026-09-04, Luke: *"no trader cares how much a trade made before fees. traders only care about the
 * net value. we will use the copy 'Total P&L' throughout the app where we could be using 'Net'. but
 * we chose 'Total' so stick with it. don't add any copy talking about net or net vs gross."*
 *
 * SO THIS CARD DOES NOT BRANCH ON `hasFees`, and that reverses what §A10 filed. `getDigest` carries
 * fee coverage, so this card COULD have said `Net P&L` / `Gross P&L` per scope - and will not. The
 * standing rule was "any surface showing a NET figure states whether fees were imported", which is a
 * rule about the word `net`: a claim about fee coverage. `Total` is a claim about arithmetic, so the
 * rule's trigger never fires. `preflight.ts` makes `fees_empty` and `fees_partial` BLOCKING findings
 * besides, so the disclosure has nothing left to disclose. The arithmetic is unchanged - `NET` is
 * still gross plus fees. This is a decision about the WORD. `§A11`.
 *
 * ─── THREE BLANKS, AND THEY ARE `Net P&L`'S OWN THREE ──────────────────────────────────────────
 *
 * Same three signals, same three sentences, because the two cards are describing one set of accounts
 * and a page that gives two different explanations for one condition is worse than either. See that
 * file for why `series.length === 0` cannot carry this on its own.
 */

import { useState } from 'react';
import { Widget } from './widget';
import { TradeRow } from '@/components/views/trades/trades-tape';
import { TradeSheet } from '@/components/views/trades/trade-sheet';
import { TradeDrawer } from '@/components/views/trades/trade-drawer';
import { displaySessionDate } from '@/lib/time/session';
import { PHONE_QUERY } from '@/lib/shell';
import { signed } from '@/lib/format';
import type { SessionGroup, TapeRow } from '@/lib/trades/read';

/** Five (Luke, 2026-09-04). `RecentTrades` shows four, but that table sits beside a chart on a
 *  phone; this card owns its column. */
const SHOWN = 5;

export function LastSession({
  session,
  href,
  imported,
  zone,
}: {
  /* THE NEWEST SESSION THAT HAS TRADES IN IT, folded on the server. Null when there is none, which
     is one of the three blanks below rather than an empty table.
     NEVER "TODAY", and that is the re-entry rule rather than a convenience (§7 Q2, confirmed by
     Luke 2026-09-04). A card scoped to the current date shows an empty box every Monday morning and
     every day the trader did not trade, which is a state representing absence - the one thing
     `CLAUDE.md` forbids outright on every surface. */
  session: SessionGroup | null;
  /** `/trades` narrowed to this session, composed by the page. Plain `/trades` when there is none. */
  href: string;
  /** Whether Run holds any countable trade at all, ignoring exclusion and ignoring scope. */
  imported: boolean;
  /** `trader.display_timezone`. DISPLAY ONLY - the row clocks a fill with it and never buckets. */
  zone: string;
}) {
  /* ─── TWO SURFACES FOR ONE TAP, AND THE VIEWPORT PICKS AT THE MOMENT OF THE TAP ──────────────
   *
   * THE FIRST BUILD MOUNTED ONLY `TradeSheet` AND THAT WAS WRONG ON A DESKTOP. A full-screen sheet
   * is the PHONE's answer (`design-system.md` §6a: below `PHONE_QUERY` every dismissible surface is
   * one), and `/trades` opens a DRAWER above it. Shipping the sheet at every width would have made
   * one row open two different things on two screens - and covered a 1440px desktop with a
   * full-bleed panel to show four fields.
   *
   * SO THIS IS `trades-tape.tsx`'S OWN `openTrade`, to the line, including the media query rather
   * than `usePhone()`: `CLAUDE.md` says render off `usePhone()` and ACT off the real answer, and
   * deciding WHICH surface opens is an act. `usePhone()` answers `false` before the query is read,
   * which on a cold desktop-sized phone load would open the wrong one.
   *
   * BOTH ARE FED FROM ROWS ALREADY IN HAND. `recent-trades.tsx` set that precedent and `CLAUDE.md`
   * states the rule: the phone once round-tripped the server for the `TapeRow` the tapped row was
   * already rendering - 305ms before anything moved, plus a skeleton for data in memory. */
  const [sheetRow, setSheetRow] = useState<TapeRow | null>(null);
  const [drawerAt, setDrawerAt] = useState(-1);

  const shown = session ? session.trades.slice(0, SHOWN) : [];

  const openTrade = (row: TapeRow, index: number) => {
    if (window.matchMedia(PHONE_QUERY).matches) {
      setSheetRow(row);
      return;
    }
    setDrawerAt(index);
  };

  /* ONE BLANK, NOT THREE (#55, 2026-09-08). `allExcluded` and `nothingInScope` were facts about the
     PAGE'S scope, and the page now says them once above the grid instead of every card saying them
     in its own words. What is left is the one state that is about THIS card's subject. */
  const nothingImported = !imported;

  return (
    <>
      <Widget
        title="Last session"
        /* THE DATE, AND NOTHING WHEN THERE IS NO SESSION. An empty card may not print a day: the
           only honest date would be one Run holds no trades for, which is a figure asserting
           something. */
        period={session ? displaySessionDate(session.sessionDate) : undefined}
        href={href}
      >
        {nothingImported ? (
          /* DAY ONE, AND IT NAMES WHAT THE CARD WILL HOLD RATHER THAN WHAT IS MISSING. No count, no
             "no sessions yet", no date - `CLAUDE.md`'s re-entry rule. No button either: the header
             is already the door, and `widget.tsx` says why a second target inside one card is
             wrong. */
          <p className="text-body text-muted">
            Your most recent trading day lands here, trade by trade, straight from your broker&rsquo;s
            export.
          </p>
        ) : (
          session && (
            <>
              {/* ─── THE SESSION'S OWN LINE ───────────────────────────────────────────────────
                *
                * THE FIGURE IS COLOURED AND THE REST IS NOT, which is the tape row's own rule one
                * level up: a net is a RESULT, and a result is the only cell in this product that
                * earns pos/neg ink. The count and the rate are facts about the day, so they are
                * muted metadata beside it.
                * `text-body-lg` AND NOT A FIGURE SIZE. `design-system.md` §2a: hierarchy comes from
                * ink and weight, never from another size step - and this card's header already
                * spends the one step it has. A 26px figure here would be the exact defect `Net P&L`
                * was corrected for on 2026-09-03.
                * THE RATE IS ABSENT WHEN NOTHING WAS DECIDED, rather than printed as 0%. A rate off
                * zero decided trades is a divide, not a fact - `getTape` returns null for it and
                * this renders nothing rather than inventing a floor. */}
              <p className="text-body-lg max-sm:text-body flex flex-wrap items-baseline gap-x-2">
                <span
                  className={
                    session.netCents > 0
                      ? 'text-pos font-medium'
                      : session.netCents < 0
                        ? 'text-neg font-medium'
                        : 'text-text font-medium'
                  }
                >
                  {signed(session.netCents)}
                </span>
                <span className="text-muted">
                  {session.tradeCount} {session.tradeCount === 1 ? 'trade' : 'trades'}
                  {session.winRatePct !== null && ` · ${session.winRatePct}% won`}
                </span>
              </p>

              {/* ─── THE ROWS, FULL BLEED ─────────────────────────────────────────────────────
                *
                * THE CALL SITE OWNS THE POSITION, which is the rule `Plot` is already placed by in
                * `net-pnl.tsx`. `Widget`'s body carries `px-5 max-md:px-4` and `TradeRow` carries
                * the identical gutter of its own, so a row dropped in here would be inset twice and
                * would stop sharing a left edge with every other list in the product. The negative
                * margin cancels the body's half; the row keeps its own.
                * `mt-4`, matching the gap `Net P&L` leaves between its header line and its plot.
                *
                * `divide-y` RATHER THAN A BORDER PER ROW, and `divide-rule` rather than
                * `divide-border`: this is a list separator inside a card, which is the lighter of
                * the two tokens. `recent-trades.tsx` draws the same list the same way.
                *
                * IT IS THE TAPE'S OWN ROW, imported rather than rebuilt. A lookalike would drift
                * within a week, and that component carries a dozen measured decisions - the 45px
                * phone inset taken off the reference as a ratio of screen width, which columns drop
                * below `sm`, where the net figure pins its right edge, how an excluded trade is
                * marked. It also means the trader meets ONE row shape on three screens. */}
              <div className="divide-rule -mx-5 mt-4 divide-y max-md:-mx-4">
                {shown.map((t, i) => (
                  <TradeRow
                    key={t.id}
                    trade={t}
                    zone={zone}
                    onOpen={() => openTrade(t, i)}
                    /* ─── TWO COLUMNS, NOT FOUR, AND THE MEASUREMENT DECIDED IT ────────────────
                     *
                     * THE FIRST BUILD PASSED `[]` and the rack caught it inside a minute. `TradeRow`
                     * is a FOUR-column row - instrument, account, time, result - sized for a
                     * full-width tape, and its `sm:` breakpoints are VIEWPORT queries while a
                     * dashboard card is a CONTAINER. So at a wide viewport in a narrow card every
                     * column renders and the two elastic ones collapse. Measured on the rack, with
                     * the card forced to each width:
                     *
                     *   card 360   instrument 0px    account 17px   <- the name does not render
                     *   card 416   instrument 27     account 45     <- mark only, text at zero
                     *   card 480   instrument 59     account 77     <- "MNQ D…" at 19px
                     *   card 611   instrument 125    account 142    <- fine
                     *
                     * AND 611 IS THE BEST CASE, NOT THE TYPICAL ONE. `/today` is
                     * `lg:grid-cols-2` from 1024px, and the card there is `(viewport - 224 sidebar
                     * - 32 gutter - 16 gap) / 2` - which is 376px at 1024 and does not clear 560
                     * until the viewport is about 1400. So the four-column row does not fit a
                     * half-width card at any realistic desktop width, and hiding one column does
                     * not save it.
                     *
                     * THE REFERENCE ALREADY ANSWERED THIS. Monarch's own `Transactions` widget row
                     * is the merchant and the amount - it carries neither the account nor the time,
                     * which live on its full `/transactions` page. Their dashboard row is two
                     * fields for the same reason ours has to be.
                     *
                     * SO THE CARD DRAWS THE ROW'S OWN PHONE FORM AT EVERY WIDTH, which is the shape
                     * `trades-tape.tsx` already designed for a narrow column and already defends:
                     * "the list is for scanning, the detail is for checking". Nothing new was
                     * invented here.
                     *
                     * WHAT IT COSTS, STATED. §3.9's argument for this card includes that the
                     * account is a fact the trade IS - on a funded account it decides whether a loss
                     * matters - and that fact is now one tap away rather than on the row. Two things
                     * make that survivable and neither is a rationalisation: the page's scope band
                     * already names which accounts are in view (`§A8`), and `TradeSheet` carries the
                     * account on the row the trader tapped. What the card still shows without a tap
                     * is what it exists to show - that the session is there, how many trades are in
                     * it, and which ones are marked. */
                    hidden={['account', 'time']}
                  />
                ))}
              </div>
            </>
          )
        )}
      </Widget>

      {/* ─── THE DESKTOP'S PANEL ──────────────────────────────────────────────────────────────
        *
        * NO `position` PROP, AND THAT IS THE ONE THING THIS DIVERGES FROM THE TAPE ON. The drawer
        * can print "3 of 360", and the tape's own scar tissue is about getting that denominator
        * right - it once said "1 of 60" beside a rail saying 360, "the one unreconcilable figure on
        * the page". This card draws FIVE rows of a session that may hold more, so any denominator it
        * could offer would be a number the trader cannot reconcile against the "12 trades" line
        * eight pixels above it. The steppers still walk the five rows in hand; they just do not
        * claim to be walking the session. */}
      {drawerAt >= 0 && shown[drawerAt] && (
        <TradeDrawer
          trade={shown[drawerAt]}
          zone={zone}
          onClose={() => setDrawerAt(-1)}
          onPrev={drawerAt > 0 ? () => setDrawerAt(drawerAt - 1) : undefined}
          onNext={drawerAt < shown.length - 1 ? () => setDrawerAt(drawerAt + 1) : undefined}
        />
      )}

      {/* THE PHONE'S CONTAINER, MOUNTED WHETHER OR NOT A TRADE IS OPEN - which is what lets it
          travel in both directions, and is why a tap moves something on the same frame. A SIBLING of
          the card rather than a child of the list: it is `fixed inset-0`, so nesting it inside the
          card's `overflow-hidden` would clip it.
          `md:hidden` IS THE CALLER'S CALL AND THE TAPE MAKES THE SAME ONE. `trade-sheet.tsx` leaves
          the gate here on purpose - baking it in made `filter-sheet.tsx` impossible to rack, since
          the rack runs at desktop width and the component erased itself there. */}
      <TradeSheet
        className="md:hidden"
        row={sheetRow}
        zone={zone}
        onClose={() => setSheetRow(null)}
      />
    </>
  );
}
