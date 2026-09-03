'use client';

/* THE ROSTER'S HERO: cumulative P&L, or a breakdown of what each period earned.
 *
 * GEOMETRY IS MEASURED, NOT CHOSEN. Every number below was read off `run-trading@v2`, which read
 * them off its own reference: 275px tall on a desktop and 242 on a phone, the plot running y 12 to
 * 234, six gridlines 44.4px apart, and a left gutter that goes to ZERO below `sm` because on a
 * 390px screen it is 18% of the width spent on six numbers the shape already tells you. (v2's gutter
 * is a hard 70px; here it is sized to the widest label it will actually print — see `AXIS_PAD`.)
 *
 * GRIDLINES ARE POSITIONED DIVS AND THE LINE IS SVG, and that split is the whole reason no chart
 * library is here. A `viewBox`ed SVG stretched to full width paints its strokes thicker
 * horizontally than vertically, so a hairline gridline is not a hairline. Divs stay exactly 1px at
 * any card width; the line uses `vectorEffect="non-scaling-stroke"` so it does not stretch either.
 * The breakdown's bars are divs for the same reason.
 *
 * X IS THE DATE, NOT THE INDEX. Spacing points evenly by index draws a weekend exactly as wide as a
 * weeknight, so a line that actually sat flat over three days rose at the same slope as one that
 * moved overnight — the chart reporting a rate that never happened.
 *
 * HOVER SNAPS TO A REAL POINT, never to a position along the line. An interpolated value between
 * two sessions is a number that never existed, and this product's whole claim is that it reports
 * what happened.
 *
 * TWO FIGURES, NOT ONE. The headline is the ALL-TIME total — where the trader stands, full stop —
 * and the line under it is the selected window's change, with its own period named. Making the
 * headline itself windowed prints the same number twice the moment a change indicator arrives.
 *
 * THE PHONE IS NOT A NARROW DESKTOP. Below `sm` the six gridlines, their labels and the two axis
 * dates all come off, leaving the line, one dashed rule at zero, and a crosshair that appears under
 * a finger. What is left is what a 390px screen can actually be read at arm's length; the ruler is
 * a desktop object and the tooltip carries the exact figure when it is wanted.
 *
 * ─── NOT PORTED YET, AND STATED RATHER THAN MISSING ───────────────────────────────────────────
 * The paging arrows over a long breakdown: this draws every bucket in the window and lets a wide
 * corpus compress. (The "1 day" range IS here now — `sessionWindow` in `src/lib/time/session.ts`
 * and `foldIntraday` in `src/lib/accounts/series.ts`.)
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Menu } from '@/components/ui/menu';
import { Icon } from '@/components/ui/icon';
import { SegmentedItem } from '@/components/ui/segmented';
import { TrendIndicator } from './trend-indicator';
import { useChartView } from './chart-view';
import { cn } from '@/lib/cn';
import { usePhone } from '@/lib/use-phone';
import { fmtMoney } from '@/lib/format';
import type { Grain } from '@/lib/time/session';
import {
  GRAINS,
  RANGES,
  RANGE_LABELS,
  isInstantKey,
  bucketize,
  windowChange,
  windowSlice,
  type Point,
  type Range,
} from '@/lib/accounts/series';

/* The plot's box, in the same units v2 measured. `--chart-h` and `--axis-gutter` are CSS variables
   rather than JS width checks because both have to be right on the FIRST paint and the server has
   no viewport — a media query resolves before anything renders. */
const PLOT_TOP = 12;
const PLOT_BOTTOM = 234;
const GRIDLINES = 6;
const AXIS_GAP = 17;

/* THE GUTTER FITS ITS LABELS RATHER THAN BEING A CONSTANT (2026-08-26, Luke: "why are we not
 * utilizing the full width of the /accounts page's chart... why do we have a gap there on the left
 * side?").
 *
 * IT WAS A HARD 70px, ported from v2 where it is correct: v2's corpus is 29 accounts and its axis
 * reads "-$26.4K", which very nearly fills 70. Measured on this build's roster the widest label is
 * "-$1.3K" at 33px, so 25px of every chart was dead air pinned to the card's left edge - a constant
 * measured against one corpus's digit count, applied to another's.
 *
 * `ch` ON A TABULAR FIGURE IS EXACT FOR THE DIGITS, which are the characters that vary: the labels
 * render `tabular-nums`, so every digit is one `ch` wide. The punctuation ($ - . K) is not, and is
 * mostly NARROWER, so this rounds up - which is the safe direction, since a gutter one pixel short
 * clips the label and a gutter one pixel long is invisible.
 *
 * THE FLOOR IS THE LABEL'S OWN PADDING. With no data there are no labels and the gutter collapses
 * to the 12px breathing room, which is what lets an empty chart use its whole card. */
const AXIS_PAD = 12;

/* ─── THE BREAKDOWN'S PAGE, AND THE ARROWS THAT MOVE IT (`S6d`, 2026-08-27) ──────────────────────
 *
 * Ported from `run-trading@v2`'s `total-pnl-card.tsx`, whose arithmetic is the point: a bar's width
 * is `plot width / slot count` and nothing else, so no chosen width survives a growing corpus. v2
 * answered that by DERIVING the grain from the range; this now answers it by PAGING, which is what
 * lets the grain be a control the trader owns.
 *
 * THE BAR WIDTH IS THE FIXED THING AND THE COUNT FALLS OUT OF IT (Luke, 2026-08-06: "try to fit as
 * many as you can on the chart without changing the width of the current bars. im happy with the
 * size of the bars as is"). A bar is 0.7 of its slot here, the same ratio the renderer below uses,
 * so a 44px bar wants a 63px slot. That is what turns "how many bars fit" into arithmetic rather
 * than a guess. */
const BAR_CAP = 44;
const SLOT_PX = Math.round(BAR_CAP / 0.7);

/* THE ROOM THE ARROWS TAKE, on each side, and ONLY when they are shown (Luke: "i dont want them
   sitting on top of content... when the chart does not need the arrows then no arrows display and
   the chart keeps its width"). A 32px button plus 8px of air.
   The pair is what puts the arrow FLUSH against the plot rather than near it: the inset is 40 and
   the button is 32, so its inner edge lands exactly on the plot's outer edge. Two constants that
   agree by arithmetic instead of two that agree today. */
const PAN_INSET = 40;
const PAN_SIZE = 32;

/** Buckets to draw before the plot has been measured. One paint at a sensible width beats a flash
 *  of everything followed by a re-slice; the ResizeObserver corrects it on the next frame. */
const PAGE_FALLBACK = 12;

/* THE PLOT'S OWN EDGES, which move only when the arrows are on screen. A CSS variable rather than a
   prop threaded through six style objects: every layer - the line, the bars, the zero rule, the
   hover guide, the label track - has to agree on where the box starts, and one variable is how they
   cannot drift. Zero when there is nothing to pan. */
const PAN_LEFT = 'calc(var(--axis-gutter) + var(--pan-inset, 0px))';
const PAN_RIGHT = 'var(--pan-inset, 0px)';

/* WHAT A BUCKET IS CALLED, and it is not always a date (v2, Luke 2026-08-04: "why do i feel like
   there is missing data?"). A MONTH's bar labelled "May 1" reads as one day's trading, so a bar
   holding thirty sessions looked like it was reporting one. Name the PERIOD instead. */
function bucketLabel(day: string, grain: Grain): string {
  if (isInstantKey(day)) return day;
  const d = new Date(`${day}T12:00:00Z`);
  const fmt = (o: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString('en-US', { ...o, timeZone: 'UTC' });
  // A year names itself; a quarter needs the word, because "Jul-Sep 2026" is a range where "Q3" is
  // a period the whole market already keeps.
  if (grain === 'year') return day.slice(0, 4);
  if (grain === 'quarter') return `Q${Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1} ${day.slice(0, 4)}`;
  if (grain === 'month') return fmt({ month: 'long', year: 'numeric' });
  const date = fmt({ month: 'short', day: 'numeric' });
  return grain === 'week' ? `Week of ${date}` : date;
}

const signed = (cents: number) => (cents > 0 ? `+${fmtMoney(cents)}` : fmtMoney(cents));

/* THE AXIS SPEAKS IN THOUSANDS. Six gridlines carrying `-$19,732.41` each is six long strings the
 * eye has to parse to learn a magnitude it only wanted approximately — and at a 70px gutter they
 * clip. `-$19.7K` is the same fact at a glance. The FIGURE above the chart stays exact; this is the
 * ruler, not the reading. (v2 calls this `compactUsd`.) */
function compactMoney(cents: number): string {
  const d = cents / 100;
  const sign = d < 0 ? '-' : '';
  const abs = Math.abs(d);
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${Math.round(abs)}`;
}

/* A DATE THE AXIS CAN AFFORD. `displayDayShort` gives "Jul 7, 2026", which is right in a rail of
 * stated facts and too long for two ends of a plot. The year comes back only when the window
 * actually crosses one — otherwise it is the same four digits printed twice, saying nothing. */
/* EXPORTED SINCE 2026-09-03 for `/today`'s `Net P&L` widget, whose phone readout names the hovered
   point's date in the card's own header rather than in a tooltip. One formatter, because the
   instant-versus-date branch below and the trader's-zone rule are exactly the things a second copy
   would get wrong. */
export function axisDate(day: string, withYear: boolean, zone: string): string {
  /* A 1-DAY POINT IS AN INSTANT, so its axis label is a CLOCK rather than a date - "Jul 21" printed
     at both ends of a session would be the same three characters saying nothing about a window
     whose whole content is the hours between them.
     IN THE TRADER'S OWN ZONE, which is what `display_timezone` is for and the only correct answer
     for a wall clock shown to a person. It must never reach the BUCKETING, which is why the session
     this chart is drawing was chosen by `session_date` upstream and not by anything here. */
  if (isInstantKey(day)) {
    /* THE WEEKDAY COMES WITH IT, and that is not decoration. A session runs 17:00 to 17:00, so both
       ends of the axis print "5:00 PM" - the same four characters twice, saying nothing about the
       window between them. Measured on the running page before the weekday was added. The day is
       what makes the two ends different, and it is also the honest shape of a futures session:
       it starts the evening BEFORE the date it carries. */
    return new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(day));
  }
  const [y, m, d] = day.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' as const } : {}),
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Fractional days since epoch, so the x axis is real time rather than position in an array.
 *  An instant key already parses on its own; only a bare calendar date needs the midnight suffix. */
const dayNum = (day: string) =>
  (isInstantKey(day) ? new Date(day) : new Date(`${day}T00:00:00Z`)).getTime() / 86_400_000;

type Kind = 'cumulative' | 'breakdown';

/** The phone's chip labels. The long form stays on the desktop menu, which is the control a wide
 *  viewport meets first. */
const SHORT_LABELS: Record<Range, string> = {
  '1d': '1D',
  '1w': '1W',
  '1m': '1M',
  '3m': '3M',
  ytd: 'YTD',
  '1y': '1Y',
  all: 'ALL',
};

export function PnlChart({
  zone,
  intradaySeries,
  series,
  counted,
  baseDollars,
  label = 'Total P&L',
  note,
  showCoverage = true,
}: {
  series: Point[];
  counted: number;
  /** Total stated account size behind the figure, or null when any account in scope has none. */
  baseDollars: number | null;
  /** `trader.display_timezone`. DISPLAY ONLY — it labels the 1-day axis and never buckets. */
  zone: string;
  /** The last session's cumulative curve, keyed by instant. Already windowed; never sliced here. */
  intradaySeries: Point[];
  /* ─── THE THREE THINGS A SUBJECT CHANGES (2026-08-27, `S6d`) ────────────────────────────────
     This card is now drawn by TWO pages: the roster, where the subject is every account, and
     `/accounts/details`, where it is one. `run-trading@v2` reached the same point and took the same
     shape - `SubjectPage` passes `chartLabel`, `chartNote` and `showCoverage` and the card is
     otherwise identical, because "a subject page whose chart card could be swapped out would not be
     one page any more". Three props rather than a fork. */
  /** The eyebrow. `Total P&L` on a roster; on one account it says whether fees are in the figure. */
  label?: string;
  /** The line under the figure. Say what the number is net OF, since that is what it raises. */
  note?: string;
  /* "Across N accounts". OFF for a single subject, and not because it is redundant - because it is
     the wrong KIND of sentence. Coverage describes a SET, and `Across 1 account` on a page that IS
     one account reads as though the page might have been about more. v2 defaults it off for the
     same reason. */
  showCoverage?: boolean;
}) {
  /* THE PERIOD IS THE PAGE'S, NOT THIS CARD'S. It governs the group headers and every row's
     sparkline too, so it lives in `ChartViewProvider` where all three read one value. */
  const { kind, range, setKind, setRange, grain, setGrain, anchor, setAnchor, periodLabel, periodShort } =
    useChartView();
  const [hover, setHover] = useState<number | null>(null);

  /* ─── ON A PHONE THE SCRUB READS IN THE HEADER, NOT IN A TOOLTIP (2026-09-03) ────────────────
   *
   * Luke: *"for consistency, i want the accounts page chart to be implemented the same in regards
   * to the hold to show p&l, up/down value changes, and date shown instead of having pop ups."*
   * `/today`'s widget got this first, ported from the reference's iOS app, and the argument is the
   * same on both: a tooltip on a 390px chart is drawn under the thumb that summoned it, and the
   * finger covers roughly the area the panel needs. The header has room, nothing is touching it,
   * and it costs nothing because it replaces copy that is already there.
   *
   * `usePhone()`, NOT `usePhoneState()`, and `CLAUDE.md` says which: render off the first, ACT off
   * the second. This picks between two renderings of one number - it navigates, writes and fetches
   * nothing - and `usePhone()` answers `false` before the query is read, which is what keeps the
   * server's HTML and the first client render in agreement. A scrub cannot happen before hydration.
   *
   * THE DESKTOP KEEPS ITS TOOLTIP. It has the room, it has a mouse, and the crosshair panel is a
   * measured interaction with no reason to be spent. */
  const phone = usePhone();

  /* THE DRAWING WIDTH, MEASURED BY THE PARENT because the PAGE depends on it: how many bars fit is a
     question about pixels, and the answer decides the slice the bars, the hit test and the labels
     all read.
     AND IT IS THE UN-INSET WIDTH, deliberately. Measuring the drawing box would feed the arrows
     their own effect - showing them narrows the box, a narrower box fits fewer bars, fewer bars can
     mean everything fits, which hides the arrows and widens the box again. Measuring a rail that
     never moves breaks that loop. */
  const [plotPx, setPlotPx] = useState(0);
  const plotBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = plotBox.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setPlotPx(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const view = useMemo(() => {
    /* 1d IS ITS OWN SERIES, NOT A SLICE OF THIS ONE, and that is the whole reason it needed a second
       read. Slicing the daily total by the session's open INSTANT is what this did before the branch
       existed, and it silently half-worked: "2026-07-21" string-compares as greater than
       "2026-07-20T22:00:00Z", so the slice landed on the last two DAILY points and drew a two-point
       line that looked like a chart. The fold has already windowed this one exactly. */
    if (range === '1d') {
      /* THE SESSION'S CURVE IS ZERO-BASED AND EVERY OTHER RANGE'S IS NOT (2026-09-03).
         `foldIntraday` anchors the day at its OPEN with `cents: 0`, so these points describe the
         day's MOVEMENT; every other range is a slice of the cumulative series, where a point IS
         the running level. That difference is invisible to a tooltip labelled with a date and
         wrong the moment the phone's header prints one as a balance - the first dot would read
         `$0.00`, telling a trader they are flat on the year because they are flat on the morning.
         `/today`'s widget hit exactly this and Luke caught it there first.
         THE BASE IS THE PREVIOUS SESSION'S CLOSE. `series` is cumulative and its last point is the
         session being drawn, so the level entering it is the point before. `cumulate` opens with a
         zero anchor dated the day before the first that moved, so index 0 is that anchor and this
         is safe at every length. */
      const base = series.length > 1 ? series[series.length - 2].cents : 0;
      return {
        points: intradaySeries,
        bars: [],
        start: null as string | null,
        total: series.length > 0 ? series[series.length - 1].cents : 0,
        change:
          intradaySeries.length > 0 ? intradaySeries[intradaySeries.length - 1].cents : 0,
        base,
        abs: (p: Point) => base + p.cents,
      };
    }
    if (series.length === 0) {
      return {
        points: [],
        bars: [],
        start: null as string | null,
        total: 0,
        change: 0,
        base: 0,
        abs: (p: Point) => p.cents,
      };
    }
    /* THE WINDOW, WITH ITS ONE POINT OF LEAD-IN, NOW LIVES IN `series.ts` (2026-09-03). It was
       nine lines here until `/today`'s `Net P&L` widget needed the same window off the same
       series; `windowSlice` carries the lead-in rule and the reasoning for it, so the two hosts
       cannot drift. (A dead `span` went with it - `grainFor` has not been called from this block
       since the Breakdown stopped being bounded by the Period menu.) */
    const { points, start } = windowSlice(series, range);

    return {
      points,
      /* THE BREAKDOWN IS NOT BOUNDED BY THE PERIOD MENU, and in v2 it was - found from a screenshot
         on 2026-08-06: three bars spread across an empty plot, on a stored range of 1 week.
         The two views carry different controls now, and the Period menu is not even RENDERED on
         this one - so cutting the bars by `range` underneath would be an invisible filter: pick
         Daily and the chart silently shows only the days inside a window the trader cannot see or
         change. It looks like the paging is broken.
         So the bars read the WHOLE series at the chosen grain, and the arrows are what move along
         it. `grainFor` still decides nothing here; it belongs to the cumulative view. */
      bars: bucketize(series, grain),
      start,
      total: series[series.length - 1].cents,
      change: windowChange(series, start).change,
      /* THE LEVEL THE WINDOW OPENED AT, which the phone's scrub readout subtracts to get a hovered
         point's change. Same definition the resting delta above uses, so the two cannot disagree.
         `abs` IS THE IDENTITY HERE, because these points already ARE the running level. Naming it
         anyway is what gives the readout one formula instead of a branch. */
      base: windowChange(series, start).base,
      abs: (p: Point) => p.cents,
    };
  }, [series, intradaySeries, range, kind, grain]);

  /* WHICH BUCKETS ARE ON SCREEN. Everything below reads `page.band`; `page.all` exists only so the
     arrows know whether there is anything either side of it. */
  const page = useMemo(() => {
    /* NOT BUILT ON THE INTRADAY AXIS. Those keys are INSTANTS, and every bucket function here parses
       a key as a plain `YYYY-MM-DD` - v2 crashed a closed account's 1-day view with
       `RangeError: Invalid time value` doing exactly this. Nothing is lost: 1 day forces the
       cumulative kind (see `ChartViewProvider`), so these bars can never be drawn from it. */
    if (range === '1d' || view.bars.length === 0) {
      return { band: view.bars, all: view.bars, startIdx: 0, endIdx: view.bars.length - 1 };
    }

    /* TRIMMED TO WHAT ACTUALLY TRADED, at the ENDS only (Luke, 2026-08-05: "you only need to show
       dates that have trading data. this chart isnt the same as the cumulative chart").
       An INTERIOR gap stays: a week you did not trade inside a month you did is a fact about the
       month, and the bars already leave it blank. `bucketize` only emits buckets that saw movement,
       so the trim is really about a zero-valued end bucket rather than an absent one. */
    let lo = 0;
    let hi = view.bars.length - 1;
    while (lo <= hi && view.bars[lo].cents === 0) lo++;
    while (hi >= lo && view.bars[hi].cents === 0) hi--;
    const all = view.bars.slice(lo, hi + 1);
    if (all.length === 0) return { band: all, all, startIdx: 0, endIdx: -1 };

    /* AS MANY BARS AS FIT, NOT A CONSTANT. Measured rather than assumed, for the same reason the
       axis gutter is: the plot changes width without the data changing at all - the sidebar
       collapses, the window resizes, the summary rail wraps under at `lg`.
       TWO PASSES, because the arrows take room only when they are shown and whether they are shown
       depends on how many fit. Ask at full width first; if everything fits there are no arrows and
       that answer stands. If it does not, the arrows appear, the usable width shrinks by their
       inset, and the second pass is the real page. It cannot oscillate: the second pass is never
       larger than the first. */
    const fitAt = (px: number) => Math.max(1, Math.floor(px / SLOT_PX));
    const full = plotPx > 0 ? fitAt(plotPx) : PAGE_FALLBACK;
    const paged = all.length > full;
    const size = paged && plotPx > 0 ? fitAt(plotPx - 2 * PAN_INSET) : full;

    /* THE PAGE ENDS AT THE ANCHOR - the newest bucket on screen, null meaning the newest there is.
       Indexes rather than date arithmetic, now that the list holds only real buckets: "one page
       earlier" is a slice, and a slice cannot land between two buckets or walk into an empty
       century the way stepping by the calendar could. */
    const at = anchor ? all.findIndex((b) => b.day === anchor) : -1;
    const endIdx = at >= 0 ? at : all.length - 1;
    const startIdx = Math.max(0, endIdx - size + 1);
    return { band: all.slice(startIdx, endIdx + 1), all, startIdx, endIdx };
  }, [view.bars, range, anchor, plotPx]);

  /* ONE PAGE AT A TIME, clamped so the last step lands ON the end rather than past it. */
  const panBy = (by: -1 | 1) => {
    if (page.all.length === 0) return;
    const size = Math.max(1, page.band.length);
    const next = Math.min(page.all.length - 1, Math.max(size - 1, page.endIdx + by * size));
    setAnchor(next >= page.all.length - 1 ? null : page.all[next].day);
  };
  const canPanBack = kind === 'breakdown' && page.startIdx > 0;
  const canPanForward = kind === 'breakdown' && page.endIdx < page.all.length - 1;
  const paging = canPanBack || canPanForward;

  /* THE DELTA DESCRIBES WHAT IS ON SCREEN. On Breakdown that is the PAGE, not the Period menu's
     window - v2 left this reading "1 week change" under a chart showing three weeks, which is the
     same two-numbers-one-screen fault the rail and the tape were fixed for, and worse here because
     it names a control this view does not render. */
  const pageChange = page.band.reduce((n, b) => n + b.cents, 0);
  const pageLabel =
    page.band.length === 0
      ? ''
      : page.band.length === 1
        ? bucketLabel(page.band[0].day, grain)
        : `${bucketLabel(page.band[0].day, grain)} to ${bucketLabel(page.band[page.band.length - 1].day, grain)}`;

  /* THE BREAKDOWN'S HIT TEST READS THE PAGE, not the whole corpus. `at` is an INDEX, so if these
     two lists ever differed the hover would light a bar that is not the one under the pointer. */
  const active = kind === 'cumulative' ? view.points : page.band;
  /* CLAMPED DURING RENDER, not corrected in an effect. `hover` is an INDEX, and changing the range
     rebuilds the series shorter underneath it — v2 took the whole page down with
     "Cannot read properties of undefined" doing exactly this. An effect runs after the render that
     would already have thrown. */
  const at = hover !== null && hover < active.length ? hover : null;

  /* ONLY THE CUMULATIVE VIEW, because Breakdown has no phone control to reach it - `ChartViewProvider`
     forces the cumulative kind below `sm` - so a scrub there is unreachable rather than unhandled. */
  const scrub = phone && at !== null && kind === 'cumulative' ? view.points[at] ?? null : null;

  return (
    <Card className="p-5 max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none">
      {/* Title cluster left, controls right, both TOP-aligned — on a wide screen. Below `sm` the two
          stack, because at 390px the controls take enough of the row to wrap the eyebrow onto a
          second line, and the group below bleeds UP into this row by 16px on the assumption that it
          is one line tall. Wrapped, that bleed pulled the figure straight through the eyebrow: a
          measured 12px of text overlapping text on Luke's phone. `flex-wrap` alone does not fix it —
          the collision is vertical, and it is the BLEED that has to know the header got taller. */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        {/* THE EYEBROW IS DESKTOP-ONLY. On a phone the figure is the first thing under the page
            title, and a page titled "Accounts" showing one large money figure does not need a label
            saying which money.
            `.eyebrow` RATHER THAN v2'S THREE HAND-SET CLASSES. v2 spells it
            `text-small font-semibold tracking-[0.1em] uppercase`, and its own comment admits the
            tracking breaks the type-scale rule, ending "if a second card wants this eyebrow, it
            becomes a token rather than a second copy of these three classes". This build already
            made it one, and `/trades` uses it on the filter sheet's section bands — so the TOKEN is
            the faithful port. Copying v2's literal classes would reintroduce `text-small`, which
            `design-system.md` §2a says appears nowhere on `/trades` and a ported page must not bring
            back. 11px/0.14em against 12px/0.1em: invisible, and consistent with the page beside it. */}
        <div className="hidden items-center gap-1.5 sm:flex">
          <span className="eyebrow text-muted whitespace-nowrap">{label}</span>
        </div>

        {/* BOTH MENUS ARE DESKTOP-ONLY. The phone takes the period as a chip row under the chart —
            one tap instead of two, and it never covers the thing it is about. */}
        <div className="hidden shrink-0 gap-2 sm:flex">
          <Menu
            label="What to chart"
            value={kind}
            onChange={(v) => setKind(v as Kind)}
            options={[
              { value: 'cumulative', label: 'Cumulative' },
              { value: 'breakdown', label: 'Breakdown' },
            ]}
          />
          {/* THE SECOND CONTROL BELONGS TO THE VIEW (Luke, 2026-08-06: "the two views carry
              different controls"). Cumulative asks HOW FAR BACK; Breakdown asks HOW WIDE A BAR IS
              and moves along the corpus with the arrows. One menu slot, two questions - which does
              mean the control changes identity when you toggle, and v2 records Luke's call on that:
              "do nothing, it resolves itself once the trader has toggled twice." */}
          {kind === 'breakdown' ? (
            <Menu
              label="Bar size"
              value={grain}
              onChange={(v) => setGrain(v as Grain)}
              options={GRAINS.map((g) => ({ value: g.value, label: g.label }))}
            />
          ) : (
            <Menu
              label="Period"
              value={range}
              onChange={(v) => setRange(v as Range)}
              options={RANGES.map((r) => ({ value: r, label: RANGE_LABELS[r] }))}
            />
          )}
        </div>
      </div>

      {/* THE BLEED IS `sm:` ONLY. It closes the gap the taller CONTROLS open beside a short title,
          and below `sm` the controls are no longer beside the title — they are above the whole
          group, so there is no dead band to rise into and pulling up would only collide. */}
      <div className="sm:-mt-4">
        {/* THE FIGURE AND ITS TRAILING CONTEXT ON ONE BASELINE ROW, wrapping to a second line only
            when the card is too narrow for both. Beside it on a wide screen, under it on a narrow
            one — the same flip the roster's group headers make, at the same 640px, so the two cards
            never disagree about which shape the page is in.
            `text-figure` (26px), and the restraint is the point: the card is calm because the number
            does not shout. INK, NOT pos/neg — colour is reserved for the delta beside it. */}
        <div className="flex flex-col gap-y-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3">
          {/* `text-figure` (26px) FROM `sm`, `text-h3` (20px) BELOW IT (2026-08-27). Was `text-h2`
              they are the two that set the volume of the page: this figure is the first thing under
              the title on a phone and everything below it is read relative to it. Both are roles
              from the ramp and both are 500 weight, so this is a step down the scale rather than a
              size picked for one screen. The line-heights are identical (30px), so nothing below it
              moves. */}
          {/* UNDER A SCRUBBING FINGER THE FIGURE IS THE HOVERED POINT'S RUNNING LEVEL, and the
              eyebrow above it is already desktop-only, so nothing else in this row has to move. */}
          <span className="text-figure max-sm:text-h3 text-text font-medium tabular-nums">
            {fmtMoney(scrub ? view.abs(scrub) : view.total)}
          </span>
          {/* TWO DIFFERENT EMPTIES, TWO SENTENCES. v2 shipped one: excluding every account empties
              `counted` too, and the card then told a trader looking at their own roster that they
              had no accounts. The second names the switch that caused it, so the way back is
              obvious. */}
          {scrub ? (
            /* THE HOVERED POINT'S DELTA, WITH ITS DATE TO THE RIGHT - the reference's own
               arrangement, landing in the slot the resting delta already occupies so the row does
               not change height under the finger.
               `TrendIndicator` IS REUSED rather than hand-rolled: it owns the arrow, the pos/neg
               ink, the absent-percentage rule and the flat-is-colourless rule, and a second
               readout deciding any of those for itself would drift from the one beside it.
               `periodLabel` ALONE, with no `periodShort`: that component renders the label
               unbreakpointed when the short form is absent, which is what a date wants. `axisDate`
               handles the `1d` case, where a point is an INSTANT and its label is a clock in the
               trader's own zone - printing "Sep 2" at both ends of one session would say nothing. */
            <TrendIndicator
              cents={view.abs(scrub) - view.base}
              periodLabel={axisDate(scrub.day, false, zone)}
              baseDollars={baseDollars}
            />
          ) : counted === 0 ? (
            <span className="text-body-lg max-sm:text-small text-muted font-medium">
              {series.length === 0 ? 'No accounts yet' : 'Every account is left out of totals'}
            </span>
          ) : kind === 'breakdown' ? (
            /* THE PAGE'S OWN NET, LABELLED WITH ITS OWN SPAN. Summed from the bars actually drawn,
               so the figure and the columns under it cannot disagree - and it moves when the arrows
               do, which is what tells the trader the arrows did something.
               `periodShort` takes the SAME string here rather than an abbreviation: the phone never
               reaches this branch (Breakdown has no phone control), so a second shorter form would
               be a string nothing renders. */
            <TrendIndicator
              cents={pageChange}
              periodLabel={pageLabel}
              periodShort={pageLabel}
              baseDollars={baseDollars}
            />
          ) : range === 'all' ? (
            /* All time: the change IS the figure above, so coverage is the useful thing to say.
               `max-sm:text-body` for the same reason the figure above it stepped down - these three
               branches are one line in three moods and they have to move together, or the page
               changes size when the range changes.
               NOTHING AT ALL when coverage is off, which is the single-subject case: the change is
               the figure and the coverage is the page, so there is no second fact left to state. */
            showCoverage ? (
              <span className="text-body-lg max-sm:text-small text-muted font-medium">
                Across {counted} {counted === 1 ? 'account' : 'accounts'}
              </span>
            ) : null
          ) : (
            <TrendIndicator
              cents={view.change}
              periodLabel={periodLabel}
              periodShort={periodShort}
              /* THE COVERAGE RIDES ALONG ON A PHONE. At `all` the branch above prints it alone,
                 because there the change IS the figure overhead and a delta line would be the same
                 money twice; at every other range both facts are true and both are wanted.
                 `undefined` when coverage is off, so the phone does not append "1 account" to a
                 delta on a page that is one account - the same sentence the branch above suppresses. */
              note={showCoverage ? `${counted} ${counted === 1 ? 'account' : 'accounts'}` : undefined}
              baseDollars={baseDollars}
            />
          )}
        </div>

        {/* WHAT THE FIGURE IS NET OF, and it only appears when a caller has something to say. The
            roster has nothing honest to put here - its accounts' fee coverage can differ one from
            the next, which is exactly why `accounts-rail.tsx` defers the claim to this page. */}
        {note && <p className="text-body max-sm:text-small text-muted mt-1">{note}</p>}

        <Plot
          /* THE PANEL IS THE PHONE'S ONLY LOSS, and the header took its job. The crosshair, the
             highlighted point and the whole pointer model are untouched. */
          showTip={!phone}
          kind={kind}
          points={view.points}
          bars={page.band}
          grain={grain}
          at={at}
          onHover={setHover}
          zone={zone}
          boxRef={plotBox}
          paging={paging}
          canPanBack={canPanBack}
          canPanForward={canPanForward}
          onPan={panBy}
        />

        {/* PHONE ONLY: the period as a chip row UNDER the chart. One tap instead of two, and it
            never covers the thing it is about — which a menu opening over a 390px chart does.
            `text-body` RATHER THAN v2'S `text-small`, same reason as the eyebrow. `min-h-11` is the
            44px tap floor, which v2 shipped at 28px until a postcheck caught it. */}
        <div className="mt-3 flex justify-between gap-1 sm:hidden">
          {RANGES.map((r) => (
            /* `SegmentedItem`, THE SAME OBJECT THE SCOPE CHIPS ABOVE THE CHART USE. These two rows
               were hand-typed variants of one control and had already drifted a weight apart -
               `font-semibold` here against `font-medium` there, on the same screen, 300px apart.
               `flex-1` is this row's own layout: it divides the width rather than scrolling. */
            <SegmentedItem
              key={r}
              selected={range === r}
              onClick={() => setRange(r)}
              className="flex-1 px-0"
            >
              {SHORT_LABELS[r]}
            </SegmentedItem>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* EXPORTED FOR THE RACK (2026-08-27), and it is the house rule rather than a convenience: "a
 * component isn't done until it appears in `/kitchen-sink` in every state, in the same commit."
 * `PnlChart` itself cannot be racked - it reads `useChartView`, which is the PAGE's state - but the
 * plot is pure props, and the plot is where every visual decision and the whole pointer model live.
 * Racking it is also what makes the touch path TESTABLE: the rack is outside the auth gate, so a
 * browser with real touch emulation can reach it. */
export function Plot({
  kind,
  points,
  bars,
  grain = 'day',
  at,
  onHover,
  zone,
  boxRef,
  paging = false,
  canPanBack = false,
  canPanForward = false,
  onPan,
  className,
  showTip = true,
}: {
  zone: string;
  kind: Kind;
  points: Point[];
  bars: { day: string; cents: number }[];
  /** The grain the bars were bucketed at, so the tooltip can name a PERIOD rather than a date. */
  grain?: Grain;
  at: number | null;
  onHover: (i: number | null) => void;
  /* THE UN-INSET RAIL THE PARENT MEASURES. Handed down rather than measured here, because the thing
     that depends on it - how many buckets are on screen - is the parent's to decide. Optional, so
     the rack can render a plot with no paging at all. */
  boxRef?: React.Ref<HTMLDivElement>;
  /** Whether the arrows are on screen, which is the only thing that insets the drawing box. */
  paging?: boolean;
  canPanBack?: boolean;
  canPanForward?: boolean;
  onPan?: (by: -1 | 1) => void;
  /* THE CALL SITE OWNS THE POSITION (2026-09-03, added for `/today`'s `Net P&L` widget). The two
     utilities below - `mt-4` and the phone's `-mx-4` full bleed - are this plot's position INSIDE
     the roster card, not properties of the plot: the margin closes the gap under that card's
     figure row, and the bleed cancels `PAGE_COLUMN`'s own 16px gutter. Neither is true inside a
     dashboard widget, whose body brings its own padding and whose gutter is the card's.
     Same split `design-system.md` already draws for motion - the class owns the TIMING, the call
     site owns the DISPLACING - and the reason it is a prop rather than a wrapper div is that
     `--axis-gutter` and `--chart-h` are declared on this element and every layer inside reads
     them. A wrapper cannot cancel a margin without also breaking that. */
  className?: string;
  /* WHETHER THE HOVER PANEL IS DRAWN (2026-09-03). `/today`'s widget answers the same gesture in
     its HEADER on a phone, which is what the reference's app does - the title swaps for the hovered
     point's figure, its delta and its date - so a tooltip there would be the same reading twice,
     one of them under the trader's own thumb. The hit test, the crosshair and the highlighted dot
     are untouched: what is suppressed is the panel, not the interaction. */
  showTip?: boolean;
}) {
  const values = kind === 'cumulative' ? points.map((p) => p.cents) : bars.map((b) => b.cents);
  const hasData = values.length > 0;

  /* BY REDUCE, NOT SPREAD. `Math.min(...values)` puts one argument on the stack per point, which is
     ~1,250 of them at five years of daily sessions. Floored at zero on both sides so the axis
     always contains the baseline — a chart of pure losses still shows what zero was. */
  const rawMax = values.reduce((m, v) => (v > m ? v : m), 0);
  const rawMin = values.reduce((m, v) => (v < m ? v : m), 0);
  const pad = Math.max((rawMax - rawMin) * 0.1, 1);
  const max = rawMax + pad;
  const min = rawMin - pad;

  const yPct = (c: number) => ((max - c) / (max - min)) * 100;

  /* THE WIDEST LABEL THE AXIS WILL ACTUALLY PRINT, computed from the same expression that renders
     them below - so the gutter and its contents cannot disagree. Not the longest of `max`/`min`:
     the widest string is often an INTERIOR gridline ("-$1.3K" beats "$612"), and taking the ends
     would clip it. */
  const axisChars = hasData
    ? Array.from({ length: GRIDLINES }, (_, i) =>
        compactMoney(Math.round(max - (i * (max - min)) / (GRIDLINES - 1))).length
      ).reduce((w, n) => (n > w ? n : w), 0)
    : 0;

  const spanStart = points.length > 0 ? dayNum(points[0].day) : 0;
  const spanDays = points.length > 0 ? dayNum(points[points.length - 1].day) - spanStart : 0;
  const xPct = (day: string) => (spanDays === 0 ? 0 : ((dayNum(day) - spanStart) / spanDays) * 100);

  const line = points.map((p) => `${xPct(p.day)},${yPct(p.cents)}`).join(' ');

  /* READ OFF WHAT IS DRAWN, not off the whole corpus. v2 read its full span here and stamped a
     year suffix on a chart sitting entirely inside one. */
  const ends = kind === 'cumulative' ? points : bars;
  const multiYear =
    ends.length > 0 && ends[0].day.slice(0, 4) !== ends[ends.length - 1].day.slice(0, 4);

  /* WHICH POINTER IS CURRENTLY HOLDING THE PLOT, or null. A ref rather than state: it changes on
     every press and release and nothing renders from it, so putting it in state would re-render the
     chart twice per gesture to store a fact only an event handler reads. */
  const held = useRef<number | null>(null);

  /* ONE READER FOR EVERY POINTER. It was inline on `onMouseMove`, which is the handler a touch
     screen never fires - so the chart was a desktop-only object on the one viewport where it is the
     first thing under the page title.
     THE GUTTER IS READ FROM COMPUTED STYLE rather than assumed, because it is set by a media query
     (`--axis-gutter`) and JS has no other way to know which side of `sm` the layout resolved on. */
  const scrub = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hasData) return;
    const box = e.currentTarget.getBoundingClientRect();
    const cs = getComputedStyle(e.currentTarget);
    const gutter = parseFloat(cs.getPropertyValue('--axis-gutter')) || 0;
    /* THE HIT TEST HAS TO READ THE SAME BOX THE BARS ARE DRAWN IN. When the arrows are up the
       columns are inset by `--pan-inset` on both sides, and a test that still measured the full
       width would map the pointer onto the wrong column - by a whole bar at the edges, which is
       exactly where a trader reaches for the arrow. Read from the same variable the layer uses
       rather than from `paging`, so the two cannot disagree. */
    const inset = parseFloat(cs.getPropertyValue('--pan-inset')) || 0;
    const left = gutter + inset;
    const raw = ((e.clientX - box.left - left) / (box.width - left - inset)) * 100;

    /* OFF THE PLOT MEANS TWO DIFFERENT THINGS. A mouse that leaves has stopped asking, so the
       readout clears. A finger that slides past the last session is still HOLDING - it has simply
       run out of chart - so it clamps to the end and keeps reading. Clearing there would blank the
       tooltip at exactly the edge a thumb is most likely to reach. */
    if (raw < 0 || raw > 100) {
      if (e.pointerType === 'mouse') return onHover(null);
    }
    const pos = Math.min(100, Math.max(0, raw));

    if (kind === 'breakdown') {
      const slot = 100 / bars.length;
      return onHover(Math.min(bars.length - 1, Math.max(0, Math.floor(pos / slot))));
    }
    /* NEAREST REAL POINT. Never interpolated: a value between two sessions is a number that never
       existed. */
    let best = 0;
    let bestD = Infinity;
    points.forEach((pt, i) => {
      const d = Math.abs(xPct(pt.day) - pos);
      if (d < bestD) [best, bestD] = [i, d];
    });
    onHover(best);
  };

  return (
    /* FULL BLEED ON A PHONE. `max-sm:-mx-4` cancels the page column's own 16px gutter so the plot
       runs edge to edge - at 390px the card has no chrome anyway, and 32px of the width is a lot to
       spend on air beside a line whose shape is the whole point. */
    /* `--axis-w` IS SET INLINE, `--axis-gutter` PICKS IT UP AT `sm`. An inline style cannot carry a
       media query, and the gutter has to be 0 on a phone (no labels) and content-sized above it -
       so the measured value goes in its own variable and the responsive class does the switching.
       Both still resolve on the FIRST paint, which is why this is CSS rather than a width check. */
    <div
      className={cn(
        'relative mt-4 w-full [--axis-gutter:0px] [--chart-h:242px] max-sm:-mx-4 max-sm:w-auto sm:[--axis-gutter:var(--axis-w)] sm:[--chart-h:275px]',
        className
      )}
      style={
        {
          '--axis-w': `calc(${axisChars}ch + ${AXIS_PAD}px)`,
          /* THE ONLY THING THAT MOVES THE DRAWING BOX, and it is zero unless the arrows are on
             screen (Luke: "when the chart does not need the arrows then no arrows display and the
             chart keeps its width"). Every layer reads `PAN_LEFT`/`PAN_RIGHT`, so they cannot
             drift apart. Below `sm` it stays zero: the arrows are desktop-only, because Breakdown
             has no phone control to reach it. */
          '--pan-inset': paging ? `${PAN_INSET}px` : '0px',
        } as React.CSSProperties
      }
    >
      {/* THE MEASURING RAIL, AND IT IS THE UN-INSET ONE ON PURPOSE. Zero-height, no paint, spanning
          exactly the drawing area minus the axis gutter - which is the number "how many bars fit"
          needs. Measuring the INSET box instead would feed the arrows their own effect: showing them
          narrows the box, a narrower box fits fewer bars, fewer bars can mean everything fits, which
          hides the arrows and widens the box again. This rail never moves, so the two passes in
          `page` are both answerable from one stable number. */}
      <div
        ref={boxRef}
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 h-0"
        style={{ left: 'var(--axis-gutter)' }}
      />
      <div
        /* `touch-pan-y` IS WHAT LETS BOTH GESTURES LIVE HERE (2026-08-27, Luke: "allow user to tap
           and hold on the chart and provide interaction with a vertical line and dot"). It hands
           VERTICAL drags to the browser, so the page still scrolls under a thumb that started on the
           chart, and keeps HORIZONTAL ones for us to scrub with. Without it the choice is a chart
           you cannot scrub or a 242px band of the page you cannot scroll past.
           A vertical pan that begins here arrives as `pointercancel`, which clears the readout - so
           scrolling never leaves a stale tooltip pinned to the plot. */
        className="relative w-full touch-pan-y"
        style={{ height: 'var(--chart-h)' }}
        // MOUSE ONLY. A touch pointer leaves the element the instant the finger lifts, and
        // `onPointerUp` has already answered that.
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') onHover(null);
        }}
        /* CAPTURE ON PRESS, so the readout follows a finger that slides off the plot's own box
           rather than dying at its edge. A mouse needs none of this: it is already tracked by
           hover, and capturing it would swallow presses meant for anything underneath.
           IN A `try`, because `setPointerCapture` THROWS on a pointer id the browser does not
           consider active - and one throw here takes the press with it, since the scrub below never
           runs. Capture is an improvement on the gesture, not a precondition for it. */
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') return;
          held.current = e.pointerId;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Not capturable. Touch pointers are implicitly captured anyway.
          }
          scrub(e);
        }}
        /* THE GUARD IS OUR OWN REF, NOT `hasPointerCapture` (2026-08-27). Asking the browser whether
           it holds capture makes the drag depend on a capture call having succeeded, which is a
           second thing that can fail silently - and it made the gesture untestable: a dispatched
           `pointerdown` cannot take capture, so a scrub test passed on the press and then quietly
           did nothing on every move. Same class of false pass the row drag hit with synthetic
           events. What this actually needs to know is "is a finger still down", which is ours to
           remember. */
        onPointerMove={(e) => {
          if (e.pointerType === 'mouse' || held.current === e.pointerId) scrub(e);
        }}
        onPointerUp={(e) => {
          if (e.pointerType === 'mouse') return;
          held.current = null;
          onHover(null);
        }}
        onPointerCancel={(e) => {
          if (e.pointerType === 'mouse') return;
          held.current = null;
          onHover(null);
        }}
      >
        {/* SIX GRIDLINES AS DIVS, AND THEY ARE DESKTOP-ONLY (2026-08-27, Luke: "remove the grid
            lines from the mobile /accounts chart"). Their LABELS were already gone below `sm` with
            the gutter, which left the phone carrying six unlabelled rules - a ruler with no numbers
            on it, measuring nothing and costing the one viewport that has no room to spare. What
            replaces them is the single dashed line at ZERO below, which is the only one of the six
            that says something without a label beside it.
            WITH NO DATA the grid still draws and nothing sits on it — the honest picture of a corpus
            that has not been fed. A flat line across an empty grid would draw a trend nobody
            measured. */}
        {Array.from({ length: GRIDLINES }, (_, i) => {
          const top = PLOT_TOP + (i * (PLOT_BOTTOM - PLOT_TOP)) / (GRIDLINES - 1);
          const value = max - (i * (max - min)) / (GRIDLINES - 1);
          return (
            <div
              key={i}
              className="absolute right-0 left-0 flex items-center max-sm:hidden"
              style={{ top }}
            >
              <span
                className="text-caption text-muted hidden shrink-0 -translate-y-1/2 text-right tabular-nums sm:block"
                style={{ width: 'var(--axis-gutter)', paddingRight: AXIS_PAD }}
              >
                {hasData ? compactMoney(Math.round(value)) : ''}
              </span>
              <span className="border-rule h-px flex-1 border-t" />
            </div>
          );
        })}

        {/* THE PHONE'S ONLY RULE, AND IT IS ZERO. This used to be a dashed line pinned to the TOP of
            the box, which marked the ceiling of the plot - a reference the reader has no use for,
            since the top is wherever the biggest number happened to land. At the baseline it says
            the one thing a P&L chart is read against: which side of flat the line is on, and where
            it crossed. Dashed rather than solid so it reads as a reference rather than as data.
            It sits INSIDE the plot box now, so it moves with the scale instead of with the card. */}
        <span
          aria-hidden
          className="border-border absolute right-0 border-t border-dashed sm:hidden"
          style={{
            left: 'var(--axis-gutter)',
            top: PLOT_TOP + (yPct(0) / 100) * (PLOT_BOTTOM - PLOT_TOP),
          }}
        />

        {hasData && kind === 'cumulative' && (
          /* THE LINE DRAWS ITSELF IN, left to right (2026-08-26). `.draw-in` was declared in
             `globals.css` and its reduced-motion guard was written, but nothing had ever applied
             it - so the chart's whole entrance was a hard cut.
             KEYED ON THE GEOMETRY, NOT ON THE PERIOD. An animation re-fires when its key changes,
             and the honest trigger is "the shape is different": picking a period that happens to
             draw the same curve is not a change worth 700ms of the trader's attention. The key is
             the polyline itself, trimmed - the full string is up to ~1,250 points and using it
             whole would allocate a long key on every render to answer a yes/no question. */
          <svg
            key={`c:${line.length}:${line.slice(0, 24)}:${line.slice(-24)}`}
            className="draw-in absolute"
            style={{
              left: 'var(--axis-gutter)',
              right: 0,
              top: PLOT_TOP,
              height: PLOT_BOTTOM - PLOT_TOP,
              width: 'calc(100% - var(--axis-gutter))',
            }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="pnl-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={`0,100 ${line} 100,100`} fill="url(#pnl-fill)" />
            <polyline
              points={line}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        {hasData && kind === 'breakdown' && (
          <div
            className="absolute"
            style={{
              /* INSET WHEN THE ARROWS ARE UP, so they sit flush OUTSIDE the columns rather than on
                 top of them. `PAN_LEFT`/`PAN_RIGHT` resolve to the plain gutter and 0 when nothing
                 is paged, so the un-paged chart keeps its full width. */
              left: PAN_LEFT,
              right: PAN_RIGHT,
              top: PLOT_TOP,
              height: PLOT_BOTTOM - PLOT_TOP,
            }}
          >
            <div
              className="border-rule absolute right-0 left-0 border-t"
              style={{ top: `${yPct(0)}%` }}
            />
            {bars.map((b, i) => {
              const slot = 100 / bars.length;
              const up = b.cents >= 0;
              /* THE BAR IS CAPPED IN px, WHICH IS THE ONLY REASON IT SURVIVES BROWSER ZOOM
                 (2026-08-27, Luke: "why don't the bars on the breakdown chart scale with the rest
                 of the page when i use the zoom on the chrome browser?").

                 Measured at 1440: at 100% a bar drew 75.4 physical px and body text 16; at 150% the
                 text went to 24 and the bar to 71.1. Everything on the page grew by half and the
                 columns did not move. A percentage of a box is the cause - zoom shrinks the plot's
                 CSS width by exactly the zoom factor, so a fraction of it holds its PHYSICAL size
                 while `--chart-h`, which is real px, grows. Bars got taller and no wider.

                 `min()` in CSS rather than arithmetic here, because the two operands are in
                 different spaces: `slot * 0.7` is a share of a box only the browser has measured,
                 and `BAR_CAP` is device-independent px. The cap is what zoom multiplies.

                 WHAT IT COSTS, AND IT IS A REAL TRADE: a corpus narrower than one page no longer
                 stretches to fill the plot - twelve buckets on a wide monitor now sit at 44px with
                 air between them rather than at 75px shoulder to shoulder. v2 draws it this way and
                 its `BAR_CAP` is this number; the paging arithmetic above already assumes it, since
                 `SLOT_PX` IS `BAR_CAP / 0.7`. Stretching and zooming are contradictory, and of the
                 two only one of them is a bug. */
              const width = `min(${slot * 0.7}%, ${BAR_CAP}px)`;
              const top = up ? yPct(b.cents) : yPct(0);
              const height = Math.abs(yPct(b.cents) - yPct(0));
              return (
                <div
                  key={b.day}
                  className={cn(
                    'bar-rise absolute transition-opacity duration-100',
                    up ? 'bg-pos' : 'bg-neg',
                    at !== null && at !== i ? 'opacity-45' : 'opacity-100'
                  )}
                  style={{
                    /* CENTRED IN ITS SLOT rather than offset by a fixed 15%, because the bar is no
                       longer a known share of it: once the cap bites, `left: 15%` would push every
                       column off its own tick.
                       AND CENTRED BY `calc`, NOT BY `translateX(-50%)`, which is the version this
                       first shipped as and would have been wrong on every bar. `.bar-rise` animates
                       `transform: scaleY()` with `both` fill, so an inline transform here is
                       overwritten by the animation and never comes back - every column would have
                       sat half its own width right of its tick, silently, with the axis labels
                       still pointing at where it should have been. Subtracting half the width from
                       `left` leaves `transform` to the animation alone. */
                    left: `calc(${(i + 0.5) * slot}% - ${width} / 2)`,
                    width,
                    top: `${top}%`,
                    height: `${Math.max(height, 0.6)}%`,
                    borderRadius: up ? '2px 2px 0 0' : '0 0 2px 2px',
                    /* GROWS FROM THE BASELINE IT MEASURES FROM, so a loss extends DOWN from zero
                       rather than rising up into place. A single origin would make every negative
                       bar animate the wrong way against its own axis. */
                    transformOrigin: up ? 'bottom' : 'top',
                    /* LEFT TO RIGHT ACROSS THE WHOLE ROW, in the same 320ms the line takes to reach
                       the right edge - so switching Cumulative to Breakdown replaces one gesture
                       with the same gesture, rather than with a different one. Normalised by bar
                       COUNT, not a fixed per-bar step: a fixed step would take 12 bars a quarter
                       second and 250 bars eight. */
                    animationDelay: `${Math.round((i / Math.max(1, bars.length - 1)) * 320)}ms`,
                  }}
                />
              );
            })}
          </div>
        )}

        {/* THE CROSSHAIR: WHERE ON THE LINE THE FIGURE CAME FROM.
            The tooltip named the bucket and its value and nothing pointed AT it, which is readable
            on a desktop where the cursor is its own marker and unreadable on a phone, where the
            finger is over the plot and there is no cursor at all. So the mark is drawn rather than
            borrowed from the input device.
            CUMULATIVE ONLY. The breakdown already marks its own bucket by dimming the others, and a
            second marker over a 44px bar would be two answers to one question.
            IT IS INSIDE A BOX ALREADY INSET BY THE GUTTER, so both children position in plain
            percentages of the PLOT rather than of the card — the same wrapper the line and the bars
            use, and the reason neither of them needs gutter arithmetic in its own coordinates. */}
        {at !== null && hasData && kind === 'cumulative' && (
          <div
            aria-hidden
            className="pointer-events-none absolute right-0"
            style={{
              left: 'var(--axis-gutter)',
              top: PLOT_TOP,
              height: PLOT_BOTTOM - PLOT_TOP,
            }}
          >
            {/* FROM THE POINT DOWNWARD, not the full height of the plot. Above the point the line
                would cross the area fill, which is the shape being read; below it there is nothing
                but ground, so a rule there costs no information and still ties the value to its
                place on the x axis. */}
            <span
              className="bg-border absolute bottom-0 w-px -translate-x-1/2"
              style={{ left: `${xPct(points[at].day)}%`, top: `${yPct(points[at].cents)}%` }}
            />
            {/* THE GROUND'S OWN RING, not a white one: the card is `surface` from `sm` and
                transparent below it, where the page's `bg` shows through. Two token utilities rather
                than one hard-coded halo, because the dark mode values are different literals and an
                inverted guess is exactly what `design-system.md` forbids. */}
            <span
              className="bg-accent ring-bg sm:ring-surface absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-[3px]"
              style={{ left: `${xPct(points[at].day)}%`, top: `${yPct(points[at].cents)}%` }}
            />
          </div>
        )}

        {/* THE TOOLTIP IS THE LEGEND. Colour with no key is decoration, so rather than a permanent
            legend taking width beside the chart, the panel that appears on hover names the bucket
            and its figure. */}
        {at !== null && hasData && showTip && (
          <Tip
            zone={zone}
            kind={kind}
            /* THE BAR NAMES ITS PERIOD, not its first day (v2, Luke 2026-08-04: "why do i feel
               like there is missing data?"). A month's bar labelled "May 1" reads as one session,
               so a column holding thirty of them looked like it was reporting one. `bucketLabel`
               says "May 2026" and "Week of Aug 3" out loud. The cumulative side keeps a raw key,
               because there the point genuinely IS that day. */
            label={kind === 'cumulative' ? points[at].day : bucketLabel(bars[at].day, grain)}
            preformatted={kind === 'breakdown'}
            cents={kind === 'cumulative' ? points[at].cents : bars[at].cents}
            leftPct={
              kind === 'cumulative' ? xPct(points[at].day) : (at + 0.5) * (100 / bars.length)
            }
          />
        )}

        {/* THE WINDOW'S TWO ENDS, AT THE PLOT'S OWN BOTTOM EDGE — absolutely positioned INSIDE the
            box rather than flowed under it. DESKTOP ONLY (2026-08-27, Luke: "remove the start and
            end date on the chart"): below `sm` the range chips directly beneath the plot already
            name the window, so the two dates restated it in a second, longer form — and the tooltip
            gives the exact date of any point that is actually asked about. Flowed, they land past the 41px of slack between the
            last gridline (234) and the box's height (275), plus their own gap: measured at 50px of
            dead air against v2's card, which is why this card stood taller than its reference.
            `AXIS_GAP` is 17, v2's measured breathing room after its labels sat on the line at 12.
            A label per bucket would need stride arithmetic against a measured width; two ends
            answer "what am I looking at" without it. */}
        {hasData && (
          <div
            className="text-caption text-muted absolute flex justify-between tabular-nums max-sm:hidden"
            style={{ left: PAN_LEFT, right: PAN_RIGHT, top: PLOT_BOTTOM + AXIS_GAP }}
          >
            <span>
              {axisDate(kind === 'cumulative' ? points[0].day : bars[0].day, multiYear, zone)}
            </span>
            <span>
              {axisDate(
                kind === 'cumulative' ? points[points.length - 1].day : bars[bars.length - 1].day,
                multiYear,
                zone
              )}
            </span>
          </div>
        )}
        {/* A CONTROL THAT CANNOT DO ANYTHING SHOULD NOT BE ON SCREEN ASKING TO BE PRESSED. Forward
            disappears at the newest page and Back at the oldest, rather than sitting there
            disabled. */}
        {canPanBack && onPan && <PanButton dir={-1} onClick={() => onPan(-1)} />}
        {canPanForward && onPan && <PanButton dir={1} onClick={() => onPan(1)} />}
      </div>
    </div>
  );
}

/* THE PAN ARROW, FLUSH AGAINST THE PLOT AND OUTSIDE IT - v2 measured this off the reference rather
 * than eyeballing it (Luke, 2026-08-06: "what i want you to copy is the arrows and how they do
 * that"). Theirs: a 32px button at 84->116 with the chart starting at exactly 116. Touching, never
 * overlapping, and vertically centred on the plot to the pixel.
 * The inner edge is pinned by SUBTRACTING the button from the inset, so the two stay flush if
 * either number ever changes - rather than two constants that happen to agree today.
 *
 * DESKTOP ONLY (`hidden sm:flex`), because Breakdown is: the phone's control row carries the range
 * chips and no chart-type control, so these bars cannot be reached below `sm`.
 *
 * NO BORDER, JUST THE SHADOW, and this is `Stepper`'s answer rather than a new one (corrected
 * 2026-08-27 after Luke pushed back on the first version, which carried both). v2's own arrow wears
 * a hairline AND a shadow; this build had already settled the same shape in `trade-drawer-body.tsx`
 * without one, and its comment states why: a control floating over the page "with nothing behind it
 * to bound against" is the CARD case, not the button case, and a card is a fill plus a shadow. The
 * house rule needed no exception - the existing one already covered this. */
function PanButton({ dir, onClick }: { dir: -1 | 1; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === -1 ? 'Earlier' : 'Later'}
      className="bg-surface hover:bg-hover absolute z-10 hidden -translate-y-1/2 items-center justify-center rounded-full shadow-[var(--shadow-card)] transition active:shadow-[var(--shadow-press)] sm:flex"
      style={{
        width: PAN_SIZE,
        height: PAN_SIZE,
        top: (PLOT_TOP + PLOT_BOTTOM) / 2,
        ...(dir === -1
          ? { left: `calc(${PAN_LEFT} - ${PAN_SIZE}px)` }
          : { right: `calc(${PAN_RIGHT} - ${PAN_SIZE}px)` }),
      }}
    >
      <Icon name="chevron" className={dir === -1 ? 'rotate-90' : '-rotate-90'} />
    </button>
  );
}

function Tip({
  zone,
  kind,
  label,
  cents,
  leftPct,
  preformatted = false,
}: {
  kind: Kind;
  label: string;
  cents: number;
  leftPct: number;
  zone: string;
  /* THE BREAKDOWN HANDS A FINISHED STRING. Its buckets are periods rather than days, and only the
     caller knows the grain that produced them - "May 2026" cannot be recovered from "2026-05-01"
     without it. Passing the grain down here instead would put a second copy of the naming rule in
     the tooltip. */
  preformatted?: boolean;
}) {
  /* IT LEANS AWAY FROM THE EDGE IT IS NEAR, and it is offset from the column rather than centred on
     it — v2 centred the panel on the hovered x, which put it exactly over the bar it was
     describing. Fine at 2px bars, useless at 44. */
  const flip = leftPct > 50;
  return (
    <div
      className="border-border bg-surface pointer-events-none absolute z-10 w-max rounded-[var(--radius-sm)] border px-2.5 py-1.5 shadow-[var(--shadow-card)]"
      style={{
        /* POSITIONED INSIDE THE SAME BOX THE COLUMNS ARE. `PAN_LEFT` is the gutter plus the
           arrows' inset, so a tooltip over the first bar lands on that bar rather than 40px left
           of it once paging is on. */
        left: `calc(${PAN_LEFT} + ${leftPct}% * (1 - (${PAN_LEFT} + ${PAN_RIGHT}) / 100%))`,
        top: 0,
        marginLeft: flip ? -34 : 34,
        transform: flip ? 'translateX(-100%)' : undefined,
      }}
    >
      {/* THE TOOLTIP NAMES THE BUCKET IN FULL, which the axis cannot afford. It appears one at a
          time and has the room, so the year stays: a hovered point should not make the reader work
          out which year they are looking at from the two ends of the plot. */}
      <p className="text-caption text-muted">
        {preformatted ? label : axisDate(label, true, zone)}
      </p>
      <p className="text-body text-text font-medium tabular-nums">{signed(cents)}</p>
    </div>
  );
}

