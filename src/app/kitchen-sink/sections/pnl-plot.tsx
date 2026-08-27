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
  grain,
  paging,
}: {
  kind: 'cumulative' | 'breakdown';
  points: Point[];
  bars: { day: string; cents: number }[];
  grain?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  /* THE PAGED STATE, FAKED AT THE PROPS RATHER THAN BY A REAL PAGE. `Plot` takes `canPan*` as
     props precisely so it can be racked: the SLICING is `PnlChart`'s job and needs the page's
     state, but the arrows, their flush position and the inset they open are this component's, and
     those are what a rack has to be able to show. */
  paging?: boolean;
}) {
  const [at, setAt] = useState<number | null>(null);
  return (
    <Plot
      kind={kind}
      points={points}
      bars={bars}
      grain={grain}
      at={at}
      onHover={setAt}
      zone={ZONE}
      paging={paging}
      canPanBack={paging}
      canPanForward={paging}
      onPan={() => {}}
    />
  );
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

      {/* THE PAGED BREAKDOWN (`S6d`). The bar width is the fixed thing and the COUNT falls out of
          it, so a corpus wider than the plot pages rather than thinning - which is what lets the
          grain be a control the trader owns instead of one derived from the range. */}
      <Row label="Breakdown, paged" note="the arrows sit flush OUTSIDE the columns, never over them">
        <Live kind="breakdown" points={POINTS} bars={BARS} paging />
        <Note>
          The arrows only exist when there is somewhere to go: Back disappears at the oldest bucket
          and Later at the newest, rather than sitting there disabled. They also inset the drawing
          box by exactly their own width, so they touch the plot without covering a column, and the
          un-paged chart keeps its full width.
        </Note>
        <Note>
          A fill and a shadow, no border: the same answer <code>Stepper</code> gives in the
          trade drawer, and for its reason: a disc floating over the page has nothing behind it to
          bound against, which is the Card case rather than the button case. It ported from v2
          wearing a hairline as well, which would have made it claim to be both.
        </Note>
      </Row>

      {/* A BAR IS A PERIOD, so its label names one. "May 1" on a month bucket reads as one session,
          which is how a column holding thirty of them looked like it was reporting one. */}
      <Row label="Breakdown, monthly" note="the tooltip names the period, not the bucket's first day">
        <Live kind="breakdown" points={POINTS} bars={BARS} grain="month" />
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
