'use client';

/* THE ROSTER'S HERO: cumulative P&L, or a breakdown of what each period earned.
 *
 * GEOMETRY IS MEASURED, NOT CHOSEN. Every number below was read off `run-trading@v2`, which read
 * them off its own reference: 275px tall on a desktop and 242 on a phone, the plot running y 12 to
 * 234, six gridlines 44.4px apart, and a 70px left gutter that goes to ZERO below `sm` because on a
 * 390px screen it is 18% of the width spent on six numbers the shape already tells you.
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
 * ─── NOT PORTED YET, AND STATED RATHER THAN MISSING ───────────────────────────────────────────
 * The "1 day" intraday range. It needs per-fill timestamps and a session window (open / close /
 * live), which v2 carries in `session-window.ts` and this build has no equivalent of. Every range
 * here reads `session_date`, which is a stored column. The paging arrows over a long breakdown are
 * the other gap: this draws every bucket in the window and lets a wide corpus compress.
 */

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Menu } from '@/components/ui/menu';
import { TrendIndicator } from './trend-indicator';
import { useChartView } from './chart-view';
import { cn } from '@/lib/cn';
import { fmtMoney } from '@/lib/format';
import {
  RANGES,
  RANGE_LABELS,
  bucketize,
  grainFor,
  windowChange,
  windowStart,
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
function axisDate(day: string, withYear: boolean): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' as const } : {}),
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Fractional days since epoch, so the x axis is real time rather than position in an array. */
const dayNum = (day: string) => new Date(`${day}T00:00:00Z`).getTime() / 86_400_000;

type Kind = 'cumulative' | 'breakdown';

/** The phone's chip labels. The long form stays on the desktop menu, which is the control a wide
 *  viewport meets first. */
const SHORT_LABELS: Record<Range, string> = {
  '1w': '1W',
  '1m': '1M',
  '3m': '3M',
  ytd: 'YTD',
  '1y': '1Y',
  all: 'ALL',
};

export function PnlChart({
  series,
  counted,
  baseDollars,
}: {
  series: Point[];
  counted: number;
  /** Total stated account size behind the figure, or null when any account in scope has none. */
  baseDollars: number | null;
}) {
  /* THE PERIOD IS THE PAGE'S, NOT THIS CARD'S. It governs the group headers and every row's
     sparkline too, so it lives in `ChartViewProvider` where all three read one value. */
  const { kind, range, setKind, setRange, periodLabel, periodShort } = useChartView();
  const [hover, setHover] = useState<number | null>(null);

  const view = useMemo(() => {
    if (series.length === 0) {
      return { points: [], bars: [], start: null as string | null, total: 0, change: 0 };
    }
    const endsOn = series[series.length - 1].day;
    const start = windowStart(range, endsOn);
    const span = dayNum(endsOn) - dayNum(series[0].day);

    /* THE WINDOW IS SLICED WITH ONE POINT OF LEAD-IN, so the first day inside it draws from the
       level it actually started at rather than from wherever the slice happened to open. */
    const from = start ? series.findIndex((p) => p.day >= start) : 0;
    const lead = from > 0 ? from - 1 : 0;
    const points = start ? series.slice(lead) : series;

    return {
      points,
      bars: bucketize(points, grainFor(range, span)),
      start,
      total: series[series.length - 1].cents,
      change: windowChange(series, start).change,
    };
  }, [series, range, kind]);

  const active = kind === 'cumulative' ? view.points : view.bars;
  /* CLAMPED DURING RENDER, not corrected in an effect. `hover` is an INDEX, and changing the range
     rebuilds the series shorter underneath it — v2 took the whole page down with
     "Cannot read properties of undefined" doing exactly this. An effect runs after the render that
     would already have thrown. */
  const at = hover !== null && hover < active.length ? hover : null;

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
          <span className="eyebrow text-muted whitespace-nowrap">Total P&amp;L</span>
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
          <Menu
            label="Period"
            value={range}
            onChange={(v) => setRange(v as Range)}
            options={RANGES.map((r) => ({ value: r, label: RANGE_LABELS[r] }))}
          />
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
          <span className="text-figure text-text font-medium tabular-nums">
            {fmtMoney(view.total)}
          </span>
          {/* TWO DIFFERENT EMPTIES, TWO SENTENCES. v2 shipped one: excluding every account empties
              `counted` too, and the card then told a trader looking at their own roster that they
              had no accounts. The second names the switch that caused it, so the way back is
              obvious. */}
          {counted === 0 ? (
            <span className="text-body-lg text-muted font-medium">
              {series.length === 0 ? 'No accounts yet' : 'Every account is left out of totals'}
            </span>
          ) : range === 'all' ? (
            // All time: the change IS the figure above, so coverage is the useful thing to say.
            <span className="text-body-lg text-muted font-medium">
              Across {counted} {counted === 1 ? 'account' : 'accounts'}
            </span>
          ) : (
            <TrendIndicator
              cents={view.change}
              periodLabel={periodLabel}
              periodShort={periodShort}
              baseDollars={baseDollars}
            />
          )}
        </div>

        <Plot kind={kind} points={view.points} bars={view.bars} at={at} onHover={setHover} />

        {/* PHONE ONLY: the period as a chip row UNDER the chart. One tap instead of two, and it
            never covers the thing it is about — which a menu opening over a 390px chart does.
            `text-body` RATHER THAN v2'S `text-small`, same reason as the eyebrow. `min-h-11` is the
            44px tap floor, which v2 shipped at 28px until a postcheck caught it. */}
        <div className="mt-3 flex justify-between gap-1 sm:hidden">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={cn(
                'text-body min-h-11 flex-1 rounded-[var(--radius-sm)] font-semibold transition-colors',
                range === r ? 'bg-surface-2 text-text select-pop' : 'text-muted'
              )}
            >
              {SHORT_LABELS[r]}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

function Plot({
  kind,
  points,
  bars,
  at,
  onHover,
}: {
  kind: Kind;
  points: Point[];
  bars: { day: string; cents: number }[];
  at: number | null;
  onHover: (i: number | null) => void;
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

  const spanStart = points.length > 0 ? dayNum(points[0].day) : 0;
  const spanDays = points.length > 0 ? dayNum(points[points.length - 1].day) - spanStart : 0;
  const xPct = (day: string) => (spanDays === 0 ? 0 : ((dayNum(day) - spanStart) / spanDays) * 100);

  const line = points.map((p) => `${xPct(p.day)},${yPct(p.cents)}`).join(' ');

  /* READ OFF WHAT IS DRAWN, not off the whole corpus. v2 read its full span here and stamped a
     year suffix on a chart sitting entirely inside one. */
  const ends = kind === 'cumulative' ? points : bars;
  const multiYear =
    ends.length > 0 && ends[0].day.slice(0, 4) !== ends[ends.length - 1].day.slice(0, 4);

  return (
    /* FULL BLEED ON A PHONE. `max-sm:-mx-4` cancels the page column's own 16px gutter so the plot
       runs edge to edge - at 390px the card has no chrome anyway, and 32px of the width is a lot to
       spend on air beside a line whose shape is the whole point. */
    <div className="relative mt-4 w-full [--axis-gutter:0px] [--chart-h:242px] max-sm:-mx-4 max-sm:w-auto sm:[--axis-gutter:70px] sm:[--chart-h:275px]">
      {/* THE PHONE'S ONLY AXIS. Six gridlines and their labels are desktop-only, so without this a
          390px chart draws a line floating in nothing with no baseline to read it against. Dashed
          rather than solid so it reads as a reference rather than as data. */}
      <span className="border-border absolute right-0 left-0 border-t border-dashed sm:hidden" />
      <div
        className="relative w-full"
        style={{ height: 'var(--chart-h)' }}
        onMouseLeave={() => onHover(null)}
        onMouseMove={(e) => {
          if (!hasData) return;
          const box = e.currentTarget.getBoundingClientRect();
          const gutter =
            parseFloat(getComputedStyle(e.currentTarget).getPropertyValue('--axis-gutter')) || 0;
          const w = box.width - gutter;
          const pos = ((e.clientX - box.left - gutter) / w) * 100;
          if (pos < 0 || pos > 100) return onHover(null);

          if (kind === 'breakdown') {
            const slot = 100 / bars.length;
            onHover(Math.min(bars.length - 1, Math.max(0, Math.floor(pos / slot))));
          } else {
            /* NEAREST REAL POINT. Never interpolated: a value between two sessions is a number that
               never existed. */
            let best = 0;
            let bestD = Infinity;
            points.forEach((p, i) => {
              const d = Math.abs(xPct(p.day) - pos);
              if (d < bestD) [best, bestD] = [i, d];
            });
            onHover(best);
          }
        }}
      >
        {/* SIX GRIDLINES AS DIVS. Their labels live in the left gutter and vanish with it below
            `sm`. WITH NO DATA the grid still draws and nothing sits on it — the honest picture of a
            corpus that has not been fed. A flat line across an empty grid would draw a trend nobody
            measured. */}
        {Array.from({ length: GRIDLINES }, (_, i) => {
          const top = PLOT_TOP + (i * (PLOT_BOTTOM - PLOT_TOP)) / (GRIDLINES - 1);
          const value = max - (i * (max - min)) / (GRIDLINES - 1);
          return (
            <div key={i} className="absolute right-0 left-0 flex items-center" style={{ top }}>
              <span
                className="text-caption text-muted hidden shrink-0 -translate-y-1/2 text-right tabular-nums sm:block"
                style={{ width: 'var(--axis-gutter)', paddingRight: 12 }}
              >
                {hasData ? compactMoney(Math.round(value)) : ''}
              </span>
              <span className="border-rule h-px flex-1 border-t" />
            </div>
          );
        })}

        {hasData && kind === 'cumulative' && (
          <svg
            className="absolute"
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
              left: 'var(--axis-gutter)',
              right: 0,
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
              const top = up ? yPct(b.cents) : yPct(0);
              const height = Math.abs(yPct(b.cents) - yPct(0));
              return (
                <div
                  key={b.day}
                  className={cn(
                    'absolute transition-opacity duration-100',
                    up ? 'bg-pos' : 'bg-neg',
                    at !== null && at !== i ? 'opacity-45' : 'opacity-100'
                  )}
                  style={{
                    left: `${i * slot + slot * 0.15}%`,
                    width: `${slot * 0.7}%`,
                    top: `${top}%`,
                    height: `${Math.max(height, 0.6)}%`,
                    borderRadius: up ? '2px 2px 0 0' : '0 0 2px 2px',
                  }}
                />
              );
            })}
          </div>
        )}

        {/* THE TOOLTIP IS THE LEGEND. Colour with no key is decoration, so rather than a permanent
            legend taking width beside the chart, the panel that appears on hover names the bucket
            and its figure. */}
        {at !== null && hasData && (
          <Tip
            kind={kind}
            label={kind === 'cumulative' ? points[at].day : bars[at].day}
            cents={kind === 'cumulative' ? points[at].cents : bars[at].cents}
            leftPct={
              kind === 'cumulative' ? xPct(points[at].day) : (at + 0.5) * (100 / bars.length)
            }
          />
        )}

        {/* THE WINDOW'S TWO ENDS, AT THE PLOT'S OWN BOTTOM EDGE — absolutely positioned INSIDE the
            box rather than flowed under it. Flowed, they land past the 41px of slack between the
            last gridline (234) and the box's height (275), plus their own gap: measured at 50px of
            dead air against v2's card, which is why this card stood taller than its reference.
            `AXIS_GAP` is 17, v2's measured breathing room after its labels sat on the line at 12.
            A label per bucket would need stride arithmetic against a measured width; two ends
            answer "what am I looking at" without it. */}
        {hasData && (
          <div
            className="text-caption text-muted absolute right-0 flex justify-between tabular-nums"
            style={{ left: 'var(--axis-gutter)', top: PLOT_BOTTOM + AXIS_GAP }}
          >
            <span>{axisDate(kind === 'cumulative' ? points[0].day : bars[0].day, multiYear)}</span>
            <span>
              {axisDate(
                kind === 'cumulative' ? points[points.length - 1].day : bars[bars.length - 1].day,
                multiYear
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function Tip({
  kind,
  label,
  cents,
  leftPct,
}: {
  kind: Kind;
  label: string;
  cents: number;
  leftPct: number;
}) {
  /* IT LEANS AWAY FROM THE EDGE IT IS NEAR, and it is offset from the column rather than centred on
     it — v2 centred the panel on the hovered x, which put it exactly over the bar it was
     describing. Fine at 2px bars, useless at 44. */
  const flip = leftPct > 50;
  return (
    <div
      className="border-border bg-surface pointer-events-none absolute z-10 w-max rounded-[var(--radius-sm)] border px-2.5 py-1.5 shadow-[var(--shadow-card)]"
      style={{
        left: `calc(var(--axis-gutter) + ${leftPct}% * (1 - var(--axis-gutter) / 100%))`,
        top: 0,
        marginLeft: flip ? -34 : 34,
        transform: flip ? 'translateX(-100%)' : undefined,
      }}
    >
      {/* THE TOOLTIP NAMES THE BUCKET IN FULL, which the axis cannot afford. It appears one at a
          time and has the room, so the year stays: a hovered point should not make the reader work
          out which year they are looking at from the two ends of the plot. */}
      <p className="text-caption text-muted">{axisDate(label, true)}</p>
      <p className="text-body text-text font-medium tabular-nums">{signed(cents)}</p>
    </div>
  );
}
