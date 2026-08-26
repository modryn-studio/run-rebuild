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
import { cn } from '@/lib/cn';
import { fmtMoney } from '@/lib/format';
import { displayDayShort } from '@/lib/time/session';
import {
  CHANGE_LABELS,
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

/** Fractional days since epoch, so the x axis is real time rather than position in an array. */
const dayNum = (day: string) => new Date(`${day}T00:00:00Z`).getTime() / 86_400_000;

type Kind = 'cumulative' | 'breakdown';

export function PnlChart({ series, counted }: { series: Point[]; counted: number }) {
  const [kind, setKind] = useState<Kind>('cumulative');
  const [range, setRange] = useState<Range>('all');
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
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-body-lg text-text font-medium tabular-nums">{signed(view.total)}</p>
          {/* THE WINDOW'S CHANGE, NAMED — AND ABSENT AT ALL TIME, because there it is the headline
              again. The headline is the all-time total by design, so at that range the two lines are
              the same number by definition, and a card that prints one figure twice looks broken
              rather than thorough. v2's own note names this trap from the other direction: an early
              draft made the HEADLINE windowed, "which was defensible right up until the trend
              indicator arrived: it would have printed the identical number twice". Same collision,
              opposite end. Every other range answers a genuinely different question.
              `Across N accounts` takes the slot instead, which is the fact the headline cannot
              carry: what the figure is ABOUT. */}
          {range === 'all' ? (
            <p className="text-body text-muted">
              Across {counted} {counted === 1 ? 'account' : 'accounts'}
            </p>
          ) : (
            <p className="text-body text-muted">
              {signed(view.change)} <span>{CHANGE_LABELS[range]}</span>
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
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

      <Plot kind={kind} points={view.points} bars={view.bars} at={at} onHover={setHover} />
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

  return (
    <div className="relative mt-4 w-full [--axis-gutter:0px] [--chart-h:242px] sm:[--axis-gutter:70px] sm:[--chart-h:275px]">
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
                {hasData ? fmtMoney(Math.round(value)) : ''}
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
      </div>

      {/* THE WINDOW'S TWO ENDS, under the plot. A label per bucket needs stride arithmetic against a
          measured width; two ends answer "what am I looking at" without it. */}
      {hasData && (
        <div
          className="text-caption text-muted flex justify-between tabular-nums"
          style={{
            marginLeft: 'var(--axis-gutter)',
            marginTop: AXIS_GAP - (PLOT_BOTTOM - PLOT_TOP) + 222,
          }}
        >
          <span>{displayDayShort(kind === 'cumulative' ? points[0].day : bars[0].day)}</span>
          <span>
            {displayDayShort(
              kind === 'cumulative' ? points[points.length - 1].day : bars[bars.length - 1].day
            )}
          </span>
        </div>
      )}
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
      <p className="text-caption text-muted">
        {kind === 'cumulative' ? displayDayShort(label) : displayDayShort(label)}
      </p>
      <p className="text-body text-text font-medium tabular-nums">{signed(cents)}</p>
    </div>
  );
}
