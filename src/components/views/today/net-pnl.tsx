'use client';

/* NET P&L - the front door's one number, and the reference's `net_worth` widget is its source.
 *
 * ─── WHY THIS IS NOT A SECOND CHART ────────────────────────────────────────────────────────────
 *
 * 2026-09-03, Luke: *"monarch's net worth card looks like their table on the accounts page. it has
 * similar features. why couldn't we do the same?"* He is right, and the markup settles it. Read on
 * the running app that day, styled-components leak the React component name into the class, so this
 * is not inference:
 *
 *   the dashboard widget   NetWorthPerformanceChart__LineChartContainer   svg 633x275
 *   the /accounts page     NetWorthPerformanceChart__LineChartContainer   svg 1146x275
 *
 * ONE chart component, in both hosts, at the SAME height, with the same six y-gridlines - only the
 * width differs, and the x ticks thin themselves with it (8 labels in the widget against 16 on the
 * page). `TimeframeTrendIndicator__Root` is shared too, and `DashboardWidgetAmountHeader__*` -
 * named after the widget - renders on the PAGE. The sharing runs both directions.
 *
 * WHAT DIFFERS IS THE WRAPPER AND THE CONTROL, which is all this file is:
 *
 *   widget   AccountsDashboardWidget__{Body, ChartWrapper, StyledSelect}   ONE `Select`, local state
 *   page     AccountNetWorthCharts__* + NetWorthChartControls__*           a BUTTON ROW, in the URL
 *
 * So the widget compresses by collapsing a button row into a dropdown and rounding the figure - not
 * by simplifying the chart. THE CARD KEEPS THE FULL 275px PLOT, gridlines and axis labels included.
 * An earlier plan here called for a 96px sparkline with the axes off; that was wrong, and it was
 * wrong because it was reasoned from the widget's size rather than read out of it.
 *
 * `Plot` WAS ALREADY THE SHARED PIECE. It has been exported from `pnl-chart.tsx` since 2026-08-27
 * for the rack, and its own note says why: *"`PnlChart` itself cannot be racked - it reads
 * `useChartView`, which is the PAGE's state - but the plot is pure props."* Pure props, no `Card`,
 * no header, no context. That is exactly the reference's split, arrived at independently, so there
 * was nothing to extract: this file is the second wrapper.
 *
 * ─── THE TWO PLACES THIS DELIBERATELY DIVERGES ─────────────────────────────────────────────────
 *
 * **THE HEADLINE IS ALL-TIME AND THE DELTA IS WINDOWED.** Monarch windows neither - net worth is a
 * BALANCE, so their figure is "where you stand now" and the delta beside it is the period's move.
 * P&L is a FLOW: windowed net P&L IS the delta, so printing both would print one number twice.
 * `pnl-chart.tsx` already settled this - *"the headline is the ALL-TIME total, full stop, and the
 * line under it is the selected window's change"* - and a card beside it may not disagree.
 *
 * ─── A WIDGET IS NOT A SMALL PAGE, AND THE FIRST BUILD OF THIS FILE GOT THAT WRONG ────────────
 *
 * 2026-09-03, Luke: *"im just looking at monarch's Net worth card and noticing that the text size
 * is smaller than it is on their /accounts page. im looking at our widget and noticing that it
 * might be too large... the widget card shouldn't be a direct mirror. it's a card. a widget. it's
 * supposed to be smaller and more compact."* He was right, and the measurement is unambiguous.
 * Every value below was read with `getComputedStyle` on both running apps, not inferred:
 *
 *                    THEIR widget      THEIR page        change
 *   figure           18px / 500        24px / 500        ONE STEP DOWN
 *   delta            16px / 600        16px / 600        none
 *   axis labels      12px / 500        12px / 500        none
 *   plot svg         275px             275px             none
 *   eyebrow          absent            12px / 600        dropped
 *   card             665 x 375         1186 x 390        15px SHORTER
 *
 *                    OUR widget        OUR page          change
 *   figure           26px / 500        26px / 500        NONE  <- the defect
 *   card             611 x 418         1238 x 382        36px TALLER
 *
 * So exactly ONE thing shrinks between their two hosts - the figure - and the chart, the delta and
 * the ruler are untouched. Ours shrank nothing, and the card came out taller than the page card it
 * was meant to be a compact version of.
 *
 * AND THE COMPACTNESS COMES FROM WHERE THE FIGURE LIVES, not from a smaller font. Their widget has
 * no figure row: `CardTitle` IS the figure - one 18px/500 ink span reading `-$334,452 net worth` -
 * and the delta sits in the `Description` slot beside it at 16px/600 green, both inside the same
 * `<a>`. The body holds nothing but the chart. That deletes an entire 30px row plus its 16px gap,
 * which is very close to the 36px this card was over by.
 *
 * SO THE TITLE IS THE FIGURE HERE TOO, and `Widget` needed no new prop: `title` takes
 * `-$2,092.29 net P&L` and `period` takes the `TrendIndicator`. It also SATISFIES
 * `design-system.md` §2a rather than bending it - the header row is now ONE type size (18px), and
 * hierarchy comes from ink and weight alone: ink figure, muted qualifier, coloured delta. The
 * first build put a 26px figure under an 18px title, which was two sizes in one card.
 *
 * WHAT DOES *NOT* SHRINK, because the reference does not shrink it: the plot stays 275px, the axis
 * stays 11px, the delta stays 16px. A widget is more compact by carrying LESS CHROME, not by
 * printing the same chrome smaller.
 *
 * THE PHONE IS NOT ANSWERED HERE. `Widget`'s title steps to `text-body` (14px) below `sm`, so the
 * figure steps with it - which is wrong for a hero number and deliberately left alone: the teardown
 * §A1 took the phone out of scope entirely, because `/today`'s mobile layout is its own read of
 * Monarch's iOS app and designing it twice is worse than designing it late.
 *
 * ─── ALL SEVEN RANGES, INCLUDING `1 day` (2026-09-03) ──────────────────────────────────────────
 *
 * This shipped with six. Luke: *"why would we not have the same cumulative drop down time frames as
 * the accounts page? 1 day, 1 week, etc.?"* - and the argument for leaving `1d` out was weaker than
 * it looked. It was "the day belongs to the `Last session` card", which is true about the RECORD and
 * false about the CURVE: `Last session` will list the day's round trips, and a 1-day range on this
 * card draws the day's SHAPE, which is a different question and the one the reference's own accounts
 * page keeps a separate read for. Two controls offering different subsets of one scale is also the
 * thing a trader has to learn rather than read.
 *
 * IT COSTS A SECOND QUERY AND THAT IS UNAVOIDABLE. `1d` is keyed by INSTANTS, not calendar dates,
 * so it cannot be sliced out of the daily series - `pnl-chart.tsx` records what happens when you
 * try: `"2026-07-21"` string-compares as greater than `"2026-07-20T22:00:00Z"`, so the slice lands
 * on the last two DAILY points and draws a two-point line that looks like a chart. `/today`'s page
 * takes the same second read `/accounts` does, folded server-side, and `windowSlice` is never asked
 * for this range.
 *
 * ONE THING STILL DOES NOT COME ACROSS: the phone's chip row. `/accounts` puts the ranges under the
 * chart as `SegmentedItem`s below `sm` because a menu opening over a 390px chart covers the thing it
 * is about. That is a mobile decision, and §A1 took the phone out of this card's scope.
 *
 * ─── LOCAL STATE, NOT THE URL (Luke, 2026-09-03: "keep it local") ──────────────────────────────
 *
 * The reference splits exactly here: its accounts page stores the chart in the query string
 * (`?chartType=performance&dateRange=1M&timeframe=month`) and its widget keeps the period in the
 * component. Both are right. A page's subject IS the chart, so it belongs in the address and should
 * survive a share; a widget's period is a glance, and putting it in the URL would make `/today`'s
 * address carry the state of whichever card was last poked.
 *
 * AND NOTHING REFETCHES. The server hands down the whole all-time series once and every range is a
 * slice of it on the client - `CLAUDE.md`: *"never fetch what the client is already holding."* One
 * row per (account, session) is ~750 for three accounts over a year.
 */

import { useMemo, useState } from 'react';
import { Widget } from './widget';
import { Plot, axisDate } from '@/components/views/accounts/pnl-chart';
import { TrendIndicator } from '@/components/views/accounts/trend-indicator';
import { Menu } from '@/components/ui/menu';
import { SegmentedItem } from '@/components/ui/segmented';
import { usePhone } from '@/lib/use-phone';
import { fmtMoney } from '@/lib/format';
import {
  RANGES,
  RANGE_LABELS,
  windowChange,
  windowSlice,
  type Point,
  type Range,
} from '@/lib/accounts/series';

/* THE PHONE'S CHIP LABELS, and they are `pnl-chart.tsx`'s own `SHORT_LABELS` rather than a second
   set: the two rows are the same seven windows and a trader meeting `1M` on one screen and
   `1 mo` on the other would be meeting two vocabularies. Not imported, because that module does
   not export them and widening its surface for a label map is a worse trade than five lines. */
const SHORT: Record<Range, string> = {
  '1d': '1D',
  '1w': '1W',
  '1m': '1M',
  '3m': '3M',
  ytd: 'YTD',
  '1y': '1Y',
  all: 'ALL',
};

/** Monarch's default, and Run's `windowStart` already defines what it means: one calendar month
 *  back from the subject's LAST TRADING DAY, not from today. `/accounts` draws the same window
 *  under the same word, which is the whole reason not to invent "the last 30 sessions" here. */
const DEFAULT_RANGE: Range = '1m';

export function NetPnl({
  series,
  intradaySeries,
  counted,
  scopeName,
  imported,
  baseDollars,
  zone,
}: {
  /** The cumulative all-time line across every account that counts toward totals. */
  series: Point[];
  /* THE LAST SESSION'S CURVE, KEYED BY INSTANT - what the `1d` range draws. Already windowed and
     already scoped to the counted accounts by the page; never sliced here. Empty when Run holds
     nothing, which draws the plot's own no-data grid exactly as `/accounts` does. */
  intradaySeries: Point[];
  /** How many accounts are in the figure, for the coverage sentence. */
  counted: number;
  /* THE SCOPED ACCOUNT'S NAME, or null when the scope is every account. It replaces the count in
     the phone's trailing clause: `10 accounts` answers "how much of my record is this", which
     stops being a question the moment the answer is one. Composed by the page through
     `toFacetAccount`, so it is the same string the picker and the tape print. */
  scopeName: string | null;
  /* WHETHER RUN HOLDS ANY COUNTABLE TRADE AT ALL, ignoring exclusion - and it is a SEPARATE fact
     from `series.length`, which is the whole reason it is a prop.
     THIS CARD SHIPPED THE V2 BUG FOR ONE HOUR AND THE RACK CAUGHT IT. Switching every account out
     of totals empties the fold, so `series.length === 0` was true for a trader holding a year of
     tape - and the card told them to import a file. `pnl-chart.tsx` records the same fault:
     *"v2 shipped one [empty]: excluding every account empties `counted` too, and the card then told
     a trader looking at their own roster that they had no accounts."* Two states, two sentences,
     and the second names the switch that caused it so the way back is obvious. */
  imported: boolean;
  /** Total stated account size behind the figure, or null when any counted account has none. */
  baseDollars: number | null;
  /** `trader.display_timezone`. DISPLAY ONLY - `Plot` labels an axis with it and never buckets. */
  zone: string;
}) {
  const [range, setRange] = useState<Range>(DEFAULT_RANGE);
  const [hover, setHover] = useState<number | null>(null);

  const view = useMemo(() => {
    const total = series.length > 0 ? series[series.length - 1].cents : 0;
    /* `1d` IS ITS OWN SERIES, NOT A SLICE OF THIS ONE, and the branch is here rather than inside
       `windowSlice` because that helper's whole contract is calendar keys. The change is the
       session's own last cumulative value, since the curve already opens at the session's zero. */
    if (range === '1d') {
      /* ─── `1d`'S CURVE IS ZERO-BASED AND EVERY OTHER RANGE'S IS NOT ────────────────────────
       *
       * `foldIntraday` anchors the session at its OPEN with `cents: 0`, so `intradaySeries` is a
       * curve of the day's own movement rather than of the trader's running level. Every other
       * range is a slice of the cumulative series, where a point IS the running level.
       *
       * THAT DIFFERENCE SHIPPED AS A BUG AND LUKE CAUGHT IT (2026-09-03): *"with the scrub, when
       * the chart is held, shouldn't the header's net P&L start out at the balance it was at
       * prior? ... for the 1D on the all account setting, when the first dot is held, the balance
       * would say what it was at the beginning of the day. then the up/down would say $0.00."*
       * He is right, and the readout was printing `$0.00` for that first dot - a figure that says
       * the trader is flat on the year because they are flat on the morning.
       *
       * SO THE BASE IS THE PREVIOUS SESSION'S CLOSE, and `abs()` below adds it back. `series` is
       * cumulative and its last point is the session being drawn, so the level ENTERING that
       * session is the point before it. `cumulate` opens with a zero anchor dated the day before
       * the first that moved, so index 0 is that anchor and this is safe at every length. */
      const base = series.length > 1 ? series[series.length - 2].cents : 0;
      return {
        points: intradaySeries,
        total,
        change:
          intradaySeries.length > 0 ? intradaySeries[intradaySeries.length - 1].cents : 0,
        base,
        /* THE RUNNING LEVEL AT A POINT. Zero-based curve plus the level it started from. */
        abs: (p: Point) => base + p.cents,
      };
    }
    const { points, start } = windowSlice(series, range);
    const { change, base } = windowChange(series, start);
    /* THE BASE IS THE LAST LEVEL BEFORE THE WINDOW, and the phone readout needs it: a hovered
       point's delta is that point minus this, which is the same arithmetic the resting delta uses
       against the last point. Two readouts, one definition of "change".
       `abs` IS THE IDENTITY HERE, because these points already ARE the running level. Naming it
       anyway is what lets the readout below have one formula instead of a branch. */
    return { points, total, change, base, abs: (p: Point) => p.cents };
  }, [series, intradaySeries, range]);

  /* CLAMPED DURING RENDER, not corrected in an effect - the same fault `pnl-chart.tsx` records:
     `hover` is an INDEX, and picking a shorter range rebuilds the series underneath it. An effect
     runs after the render that would already have thrown. */
  const at = hover !== null && hover < view.points.length ? hover : null;

  /* TWO DIFFERENT BLANKS. `nothingImported` is day one; `allExcluded` is a switch the trader
     threw on `/accounts` and may not remember throwing. Neither draws a plot - there is no line -
     and neither offers the picker, because a period control belongs only where more than one
     period is answerable. */
  const nothingImported = !imported;
  /* THREE BLANKS, NOT TWO (postcheck, 2026-09-03). `allExcluded` was `series.length === 0`, which
     is true for TWO different reasons and told one story for both: every account in scope is
     switched out of totals, OR the scope names an account Run holds no countable trades for. The
     second printed *"Every account is left out of totals. Turn one back on from Accounts"* over an
     account that is not excluded and cannot be turned back on, which is a wrong sentence - the one
     thing this product does not get to ship.
     `counted` IS THE TELL and it was already a prop: it is the scoped, non-excluded set, so zero
     means exclusion emptied it and non-zero with an empty series means those accounts have nothing
     to draw.
     REACHABLE ONLY BY A HAND-EDITED URL TODAY - neither picker offers a no-trade account, and
     `/trades`' facets are inner-joined on the trade table so its shared `accounts` param cannot
     carry one either. Fixed anyway: a sentence that is only correct because of who happens to be
     able to reach it is a trap for the next surface that reads the same param. */
  const allExcluded = imported && counted === 0;
  const nothingInScope = imported && counted > 0 && series.length === 0;
  const blank = nothingImported || allExcluded || nothingInScope;

  /* ─── THE PHONE'S SCRUB READOUT LIVES IN THE HEADER, NOT IN A TOOLTIP (2026-09-03) ───────────
   *
   * Luke, from the reference's iOS app: *"monarch does not show a pop up on the chart when user
   * presses and slides to see each point on the chart. instead of a pop up, the header changes
   * state. so the copy 'net P&L' would disappear when user tap and holds the chart on mobile. then
   * the price would change depending on which dot on the chart the user is on. then the money
   * up/down would also change with where the user is positioned on the chart. and the date would
   * show to the right of the up/down amount."*
   *
   * AND IT IS THE RIGHT ANSWER FOR A PHONE RATHER THAN A STYLE CHOICE. A tooltip on a 390px chart
   * is drawn under the thumb that summoned it, and the finger covers roughly the area the panel
   * needs. Moving the readout to the header puts it where nothing is touching, and it costs no
   * extra room because it replaces copy that was already there.
   *
   * `usePhone()`, NOT `usePhoneState()`, and `CLAUDE.md` says which: *"render off `usePhone()`, ACT
   * off `usePhoneState()`."* Nothing here navigates, writes or fetches - it picks between two
   * strings - and `usePhone()` answers `false` before the query is read, which is what makes the
   * server's HTML and the first client render agree. A scrub cannot happen before hydration anyway.
   *
   * DESKTOP KEEPS ITS TOOLTIP (Luke's call, asked and answered): it has the room, it has a mouse,
   * and the crosshair panel is a measured interaction this card has no reason to spend. */
  const phone = usePhone();
  const scrub = phone && at !== null && !blank ? view.points[at] : null;

  /* ─── THE WORD IS `total P&L`, NOT `net P&L`, AND THAT IS A RECONCILE RULE (2026-09-03) ───────
   *
   * THIS CARD SHIPPED SAYING `net P&L` AND `/accounts` REFUSES TO. `accounts-rail.tsx` labels the
   * IDENTICAL arithmetic - every counted account's net, summed - `Total P&L`, and says why in as
   * many words: *"This rail is a roster rollup across accounts whose fee coverage can differ per
   * account, so one label cannot make that claim honestly for all of them - the per-account answer
   * belongs on `/accounts/details`, where there IS one account to answer for."* The standing rule it
   * names is `any surface showing a net figure states whether fees were imported`, and this card
   * stated nothing: there is no `hasFees` in this file, and `getDailySeries` does not carry one.
   *
   * SO ONE NUMBER HAD TWO NAMES, and the front door had the more confident one. That is the defect
   * class this page's own comments cite twice (a rail reading +$954.99 under a chart reading
   * -$26,995.06), reached through the vocabulary rather than through the arithmetic.
   *
   * WHY NOT JUST KEEP `net`, WHICH IS PROBABLY TRUE NOW? Because "probably" is the whole problem.
   * `preflight.ts` made `fees_empty` and `fees_partial` BLOCKING findings, so a fee-less import
   * cannot land any more and every row written since is genuinely net - but rows written before that
   * guard are not, and this card sums across accounts without asking. `Total` is true either way,
   * costs no query, and makes `/today` and `/accounts` say one word for one figure.
   *
   * WHAT WOULD EARN `net` BACK: fee coverage carried into the fold, so the card can say `Net P&L`
   * when every counted account has it, `Gross P&L` when none do, and `Total P&L` when they differ -
   * which is what `/accounts/details` already does for the one account it answers for. Filed in
   * `monarch-dashboard-teardown.md` §A10; not beta, because the beta's front door does not need to
   * make a claim it cannot check.
   *
   * THE CARD IS STILL CALLED `Net P&L` in the plan, the rack and this file's name, exactly as the
   * rail is still `accounts-rail`. What a thing is called in the build and what it asserts on screen
   * are different promises.
   *
   * THE TITLE IS THE FIGURE, and it falls back to the plain name when there is no figure to show -
     an empty card cannot lead with a number, and "$0.00 total P&L" over "import a file" would be a
     figure asserting something. The qualifier is lower case after the number, which is the
     reference's own shape (`-$334,452 net worth`): the line is a value, not a heading.
     UNDER A SCRUBBING FINGER THE QUALIFIER GOES and the figure becomes the hovered point's, which
     is exactly what the reference does: the words are what the readout replaces, because two
     numbers and a noun do not fit a 375px row. */
  const title = blank
    ? 'Net P&L'
    : scrub
      ? fmtMoney(view.abs(scrub))
      : fmtMoney(view.total) + ' net P&L';

  return (
    <Widget
      title={title}
      /* `/accounts`, NOT `/trades` (2026-09-03, Luke: *"why would clicking the header bring the
         user to /trades page? wouldn't we want to link user to /accounts page?"*). He is right and
         so is the reference: the teardown's §1 read its `Net worth` widget's title straight to
         `/accounts`, and `/trades` is where its `Transactions` widget points - which is the card
         that becomes Run's `Last session`. The rule underneath it is that a widget's title links to
         the page that OWNS its subject, and this figure's subject is the accounts it is summed
         across. `/trades` owns the round trips, and sending a trader from a curve to a list of
         fills makes them find their way back to the same chart they just left. */
      href="/accounts"
      /* THE DELTA GOES IN THE PERIOD SLOT, which is where the reference puts it - measured, its
         `DashboardWidget__Description` carries `$2,969.64 (0.9%)` at 16/600 green, on the title's
         line and inside the same anchor. `TrendIndicator` renders a `<div>`, which is valid inside
         an `<a>` (a link's content model is transparent) and is exactly how their markup nests it.
         AT `all` THE CHANGE *IS* THE FIGURE IN THE TITLE, so a delta would be the same money
         twice; coverage is the useful second fact there instead. `counted === 0` has no branch:
         it cannot reach here, because the fold that produced `series` skipped those accounts and
         `allExcluded` answered above. */
      period={
        blank ? undefined : scrub ? (
          /* THE HOVERED POINT'S DELTA, AND ITS DATE TO THE RIGHT OF IT - the reference's own
             arrangement, and it lands in the slot the resting delta already occupies so the row
             does not change height under the finger.
             `TrendIndicator` IS REUSED rather than hand-rolled: it owns the arrow, the pos/neg
             ink, the absent-percentage rule and the flat-is-colourless rule, and a second readout
             that decided any of those for itself would drift from the one beside it.
             `periodLabel` IS THE DATE HERE, which is what that slot is for: it prints muted, to
             the right of the figure, at the same size. `axisDate` handles the `1d` case, where a
             point is an INSTANT and its label is a clock in the trader's own zone rather than a
             date - printing "Sep 2" at both ends of one session would say nothing. */
          <TrendIndicator
            /* ONE FORMULA FOR BOTH RANGES: the running level at this point, less the level the
               window opened at. On `1d` that resolves to the session's own movement, so the first
               dot reads $0.00 against a figure that is the morning's balance - which is the shape
               Luke described and the reference's own. */
            cents={view.abs(scrub) - view.base}
            periodLabel={axisDate(scrub.day, false, zone)}
            baseDollars={baseDollars}
          />
        ) : range === 'all' ? (
          /* ─── AT `all` THERE IS NO DELTA, SO THE SLOT HOLDS THE COVERAGE - ON A PHONE ONLY ────
           *
           * WHY THE SLOT EXISTS AT ALL: at `all` the change IS the figure in the title, so a delta
           * there would be the same money twice. `/accounts`' chart reaches the identical branch
           * for the identical reason. The coverage is a FALLBACK FOR AN EMPTY SLOT, which is also
           * the whole explanation of why it appears at this one range and nowhere else - it is not
           * a coverage decision, it is a slot that has nothing else to hold.
           *
           * WHY THE DESKTOP DOES NOT GET IT (2026-09-03, Luke): *"on /today desktop the 'Across 9
           * accounts' is unnecessary because the account picker is right there in the header...
           * and all the other cards (future widget cards) will have the same effect and i dont
           * want to have to label all the other cards this way as well."*
           *
           * The second half is the stronger argument and it is the one to keep: the scope on this
           * page is PAGE-LEVEL. One control in the band governs every card, so a card that labels
           * its own coverage is labelling something the band already said - and six cards doing it
           * would say it six times. `/accounts` is genuinely different: its chart has no scope
           * control of its own, and its summary rail prints `Accounts 11` beside a total covering
           * 9, so there the sentence is the only thing reconciling them.
           *
           * THE PHONE KEEPS IT, and not for symmetry. Below `md` the picker is a bare `filter`
           * mark that names nothing, so the desktop's redundancy argument does not transfer - and
           * this line is the ONLY place a scoped account is ever named on a phone. The count is
           * simply what the same slot says when nothing is picked.
           *
           * `md:hidden` IS THE PICKER'S OWN BOUNDARY, since the picker is the reason. It leaves a
           * seam at 640-767px, where `TrendIndicator`'s phone form (`sm:hidden`) has already
           * stopped but this has not - a known mismatch between that component's `sm` and the
           * shell's `md` that predates this card and belongs to a breakpoint pass, not here. */
          <span className="text-body-lg max-sm:text-small text-muted font-medium md:hidden">
            {scopeName ?? `Across ${counted} ${counted === 1 ? 'account' : 'accounts'}`}
          </span>
        ) : (
          /* THE PHONE GETS THE PERIOD AND THE SCOPE BACK; THE DESKTOP STILL DOES NOT (2026-09-03,
             Luke: *"i like how the account page has the range listed next to the up/down amount
             and the 10 accounts. i take that back. i want that on the /today page's card. undo
             that removal."*).
             THE TWO REMOVALS WERE NOT THE SAME DECISION, which is why one stands and one is
             undone. `periodLabel` is still absent because on a DESKTOP it sat ~20px from a menu
             already reading `1 week` - the trader's own selection spelled back at them. On a phone
             there is no menu in that row: the ranges are chips under the chart and the account is
             behind an icon, so the same two facts have nowhere else to be. That is exactly why
             `/accounts` prints them on a phone and not on a desktop, and this card now matches it.
             THE SCOPE NAMES THE ACCOUNT WHEN THERE IS ONE (Luke: *"the accounts label only shows
             when the filter is set to 'all'. and then the account name will show in place of that
             when one is selected"*). It is the better half of the idea: `10 accounts` answers
             "how much of my record is this" and is useless once the answer is one, where the
             question becomes "WHICH one" - and on a phone the picker is a bare icon, so this line
             is the only place that name appears at all. */
          <TrendIndicator
            cents={view.change}
            periodShort={RANGE_LABELS[range]}
            note={scopeName ?? `${counted} ${counted === 1 ? 'account' : 'accounts'}`}
            baseDollars={baseDollars}
          />
        )
      }
      /* THE PICKER IS THE HEADER'S RIGHT EDGE, a sibling of the link rather than inside it - the
         reference's `HeaderRight`, and the reason is mechanical as much as visual: a `<button>`
         inside an `<a>` is invalid HTML and clicking the menu would navigate.
         ABSENT WHEN THERE IS NOTHING TO SCOPE, which is `ColumnsMenu`'s rule in this codebase
         already and the reference's own: its Goals and Recurring widgets print `this month` as a
         LABEL, because a period control belongs only where more than one period is answerable. */
      scope={
        blank ? undefined : (
          /* THE MENU IS DESKTOP-ONLY, and the phone takes the same seven windows as a chip row
             under the plot instead - one tap instead of two, and it never covers the thing it is
             about, which a popover over a 390px chart does. `/accounts` reached the same answer
             for the same card and this is that decision, not a new one.
             `max-sm:hidden`, WHICH IS `/accounts`' OWN PAIR (corrected 2026-09-03). This was
             `max-md:hidden` on the argument that one boundary per file beats matching a sibling -
             true in general, and wrong here twice over: it left 640-767px with neither the chips
             nor the menu on screen, and it put the card's period control at a different width from
             the identical control on `/accounts`. */
          <span className="max-sm:hidden">
            <Menu
              label="Period"
              value={range}
              onChange={(v) => setRange(v as Range)}
              options={RANGES.map((r) => ({ value: r, label: RANGE_LABELS[r] }))}
            />
          </span>
        )
      }
    >
      {nothingInScope ? (
        /* THE SCOPE IS REAL AND HOLDS NOTHING. No figure above it, for the same reason the branch
           below has none: the net across an account with no countable trades is not $0.00, it is
           unanswerable, and printing a zero would be a number a trader could act on. */
        <p className="text-body text-muted">
          Run holds no trades for this account yet. Widen the scope, or import its export.
        </p>
      ) : allExcluded ? (
        /* THE SWITCH, NAMED. No figure above it: the net across zero counted accounts is not
           $0.00, it is unanswerable, and printing a zero would be a number the trader could act
           on. `/accounts` is where the switch lives, so the sentence says so. */
        <p className="text-body text-muted">
          Every account is left out of totals. Turn one back on from Accounts and this fills in.
        </p>
      ) : nothingImported ? (
        /* A SPECIFIC EMPTY STATE, AND NO PLOT. The reference does the same on its Investments
           widget - *"Sync your brokerage for a live view of your portfolio"* replaces the content
           rather than drawing an empty version of it - and 275px of unlabelled grid is a worse
           answer than a sentence on the one screen a new trader opens first.
           NO BUTTON. The header is already the door to `/trades`, and `widget.tsx`'s own note is
           the argument: a call to action inside a card that is already one target is *"a second
           thing to aim at inside a card that is already aimed at."*
           AND IT DOES NOT COUNT. No "no imports yet", no days, no "0 sessions" - `CLAUDE.md`'s
           re-entry rule. It names what the card will hold, not what is missing. */
        <p className="text-body text-muted">
          Import a Tradovate export and your net P&amp;L lands here, reconciled to the cent.
        </p>
      ) : (
        /* THE BODY IS THE CHART, FULL STOP - the reference's `AccountsDashboardWidget__Body` holds
           exactly one child and that child is the plot. Deleting the figure row from here is what
           makes this a widget rather than a narrow copy of the page.
           THE CALL SITE OWNS THE POSITION. `Plot`'s `max-sm:-mx-4` cancels `PAGE_COLUMN`'s 16px
           gutter, which is right inside the roster card and wrong here: the gutter is the CARD's,
           and bleeding through it would run the plot under the card's own rounded corners. `mt-4`
           goes with the figure row it was the gap beneath - the body's own `py-5` is the 20px the
           reference leaves there (measured: 17px). */
        <>
          <Plot
            kind="cumulative"
            points={view.points}
            bars={[]}
            at={at}
            onHover={setHover}
            zone={zone}
            /* THE PANEL IS THE PHONE'S ONLY LOSS, and the header took its job. The crosshair, the
               highlighted point and the whole pointer model are untouched. */
            showTip={!phone}
            className="mt-0 max-sm:mx-0 max-sm:w-full"
          />

          {/* THE PHONE'S PERIOD ROW, UNDER THE CHART - and every class here is `pnl-chart.tsx`'s
              own, to the character (2026-09-03, Luke: *"are the range chips exactly the same as
              the range chips on the /accounts page? i dont think they look the same. they should
              be for consistency."*).
              THEY WERE NOT, AND HE COULD SEE IT: this row shipped with `min-h-11` added, which is
              BOTH redundant and wrong. `SegmentedItem` is `h-8` (32px) and already carries
              `hit-44`, an INVISIBLE 44px target - so the tap floor was met and the extra class only
              made the visible chip 12px taller than the identical row on `/accounts`. A tap floor
              expressed twice, once visibly, is how two copies of one control drift apart.
              `sm:hidden` RATHER THAN `md:hidden`, for the same reason: that is the breakpoint the
              row on `/accounts` uses, and it is also where `TrendIndicator` swaps its own phone
              form. The Menu below takes `max-sm:hidden` to match, so there is no width where
              neither control is on screen. (The SCRUB readout is still gated on `usePhone()` at
              767px, and that is deliberate rather than an oversight: control placement is a
              question about ROOM, and whether a tooltip is drawn under the thumb that summoned it
              is a question about TOUCH.) */}
          <div className="mt-3 flex justify-between gap-1 sm:hidden">
            {RANGES.map((r) => (
              <SegmentedItem
                key={r}
                selected={range === r}
                onClick={() => setRange(r)}
                className="flex-1 px-0"
              >
                {SHORT[r]}
              </SegmentedItem>
            ))}
          </div>
        </>
      )}
    </Widget>
  );
}
