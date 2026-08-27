'use client';

/* THE ROSTER'S PLOT, AND THE STATE THAT MATTERS MOST IS THE ONE UNDER A THUMB.
 *
 * `PnlChart` cannot be racked — it reads `useChartView`, which is the accounts page's own state —
 * but `Plot` is pure props, and the plot is where every visual decision lives: the gridlines, the
 * gutter, the line, the bars, the crosshair and the entire pointer model. This is the debt from S6c
 * being paid, and it is not ceremony: the rack is OUTSIDE the auth gate, which makes it the only
 * place a browser with real touch emulation can reach this component at all.
 *
 * `at` IS HELD HERE, not inside the plot, exactly as the real card holds it. A specimen that owns
 * state the component does not is a specimen of something else.
 *
 * THE PHONE STATES ARE THE POINT. Below `sm` the plot drops its six gridlines, their labels and the
 * two axis dates, and keeps one dashed rule at zero — so the desktop and phone specimens here are
 * genuinely different objects, not the same one at two widths. Narrow the window past 640px.
 */

import { useState } from 'react';
import { Plot } from '@/components/views/accounts/pnl-chart';
import { cumulate, type Point } from '@/lib/accounts/series';
import { Note, Row, Section } from '../_components/section';

/* A SESSION'S WORTH OF DAYS, IN CENTS, and it crosses zero twice on purpose: a curve that stays on
   one side of the baseline never shows whether the dashed rule is in the right place. */
const DAILY = [
  41_250, -18_400, -63_900, 12_050, 88_700, -24_300, -51_100, 9_400, 76_800, -13_200, 44_600,
  -92_500, 31_900, 58_300,
].map((cents, i) => ({ day: `2026-07-${String(i + 6).padStart(2, '0')}`, cents }));

const POINTS: Point[] = cumulate(DAILY);
const BARS = DAILY;

/* ONE SESSION, KEYED BY INSTANT — what the 1-day range hands the plot, and the running total is
   summed here rather than by `cumulate`. That helper fills the GAPS between calendar days, so it
   reads `dayBefore` on every key and throws on an ISO instant. The product never asks it to: the
   intraday curve comes from `foldIntraday`, which is a different fold for a different key space.
   (Caught by this section 500ing the first time it rendered, which is the rack doing its job.) */
const INTRADAY: Point[] = [12_400, -31_800, 8_900, -4_200, 27_600, -15_300].reduce<Point[]>(
  (acc, cents, i) => [
    ...acc,
    {
      day: new Date(Date.UTC(2026, 6, 20, 22 + i, 15)).toISOString(),
      cents: (acc[acc.length - 1]?.cents ?? 0) + cents,
    },
  ],
  []
);

const ZONE = 'America/Chicago';

function Live({
  kind,
  points,
  bars,
}: {
  kind: 'cumulative' | 'breakdown';
  points: Point[];
  bars: { day: string; cents: number }[];
}) {
  const [at, setAt] = useState<number | null>(null);
  return <Plot kind={kind} points={points} bars={bars} at={at} onHover={setAt} zone={ZONE} />;
}

export function PnlPlotSection() {
  return (
    <Section
      id="pnl-plot"
      title="P&L plot"
      intro="The accounts page's hero, without the card around it. Hover it with a mouse or press and drag with a finger: both run the same reader, and both snap to a real session rather than interpolating a value that never happened."
    >
      <Row
        label="Cumulative"
        note="hover for the crosshair and the tooltip; the dot rings in the ground behind it"
      >
        <Live kind="cumulative" points={POINTS} bars={BARS} />
      </Row>

      <Row label="Breakdown" note="one bar per session, and the others dim rather than a crosshair">
        <Live kind="breakdown" points={POINTS} bars={BARS} />
      </Row>

      <Row label="One session, by instant" note="what the 1D range draws: a clock axis, not a date">
        <Live kind="cumulative" points={INTRADAY} bars={[]} />
      </Row>

      <Row label="No data" note="the grid draws and nothing sits on it">
        <Live kind="cumulative" points={[]} bars={[]} />
      </Row>

      <Note>
        The axis gutter is sized to the widest label it will actually print, so these specimens have
        a narrower one than a six-figure roster would. Below <code>sm</code> it collapses to zero
        along with the gridlines and the two axis dates, and the dashed rule at zero is all that is
        left to read the line against.
      </Note>
    </Section>
  );
}
