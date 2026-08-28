/* THE SHAPE EVERY "HERE IS ONE THING, AND EVERY TRADE UNDER IT" PAGE HAS.
 *
 * Ported from `run-trading@v2` (`subject-page.tsx`, `docs/plans/subject-page-template.md`), which
 * argues it better than a summary can: the account details page was never really an account page.
 * It is
 *
 *     a CHART of something over time, the TAPE of the trades that make it up, and a RAIL of facts
 *     about it.
 *
 * Nothing in that sentence requires the something to be an account. It always was one only because
 * that is the only page anybody had needed, and the layout got written inline in the route that
 * needed it - the right call for one page and the wrong one for the second. v2 measured the
 * reference on 2026-08-02 and found its account page, its merchant page and its category page are
 * the SAME page: same header row, same full-width chart, same filtered tape left, same summary rail
 * right, one extra card between them. They built one page and pointed it at three things.
 *
 * So the subject is a parameter, and "can we have a page for X" stops being a project.
 *
 * ─── WHAT IS SHARED AND WHAT IS A SLOT ────────────────────────────────────────────────────────
 *
 * Shared, and not negotiable per subject, because these are what make two pages feel like one app:
 * the page column and its bottom gutter, the chart card, the two-column geometry with its fixed
 * 304px rail, and the rail dropping BELOW the tape on a phone.
 *
 * Slots, because they are the only parts that genuinely differ: the header (an account has an Edit
 * action; a product has nothing to edit), the tape, and the rail's contents.
 *
 * THE CHART IS A MIDDLE CASE, and it is deliberately NOT a slot. It is identical everywhere except
 * the strings naming it, so it lives here and takes those as props - "a subject page whose chart
 * card could be swapped out would not be one page any more". The one place this port differs from
 * v2 is mechanical rather than structural: v2's `TotalPnlCard` reads its series off context, so its
 * `SubjectPage` passes three strings. This build's `PnlChart` takes its series as props, so they
 * pass through here. Same card, same constraint, one more argument.
 *
 * ─── WHAT IT DELIBERATELY DOES NOT OWN ────────────────────────────────────────────────────────
 *
 * THE PROVIDERS. `ChartViewProvider` scopes the chart and the modal provider carries the roster,
 * and both are context the CALLER establishes. A page about a product hands the chart provider a
 * different set than a page about an account does, and a component that tried to guess which would
 * have to know what its subject is - the one thing this is built not to know.
 *
 * THE DATA LAYER, equally. Each route runs its own query. There is no `getTradesFor(subject)` taking
 * a discriminated union, and there should not be until a third caller proves what they have in
 * common. Two concrete functions that happen to share a fold are easier to read than one that is
 * right about a case nobody has written.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { PAGE_COLUMN } from '@/lib/shell';
import { StickyRail } from '@/components/shell/sticky-rail';
import { DesktopOnly } from '@/components/views/desktop-only';
import { PnlChart } from '@/components/views/accounts/pnl-chart';
import type { Point } from '@/lib/accounts/series';

export function SubjectPage({
  header,
  tape,
  recent,
  rail,
  chartLabel,
  chartNote,
  showCoverage = false,
  counted = 1,
  series,
  intradaySeries,
  baseDollars,
  zone,
}: {
  /** The breadcrumb, title and any actions. An account's carries Edit; a product's will not. */
  header: ReactNode;
  /** Normally the tape. A slot rather than props, so the route keeps its own query's shape. */
  tape: ReactNode;
  /* WHAT REPLACES THE TAPE ON A PHONE: four rows and a way to the rest (2026-08-28). A phone has one
     column, so the chart, the whole tape and the rail become a SCROLL - and a full tape in the
     middle of it puts the facts about the subject a thousand rows down. Absent means the tape is
     shown at every width, which is what a subject with a short tape would want. */
  recent?: ReactNode;
  /** The right column. Facts about the subject, whatever the subject is. */
  rail: ReactNode;
  /** The chart's eyebrow, e.g. `Net P&L`. */
  chartLabel: string;
  /** The line under the figure. Say what it is net OF, since that is the question it raises. */
  chartNote?: string;
  /* "Across N accounts". OFF by default, because the first subject is one account and that sentence
     is about a SET. See `PnlChart`'s own note. */
  showCoverage?: boolean;
  counted?: number;
  series: Point[];
  intradaySeries: Point[];
  baseDollars: number | null;
  zone: string;
}) {
  return (
    <div className={cn(PAGE_COLUMN, 'pb-8 max-md:px-0 max-md:pb-0')}>
      {header}

      <PnlChart
        label={chartLabel}
        note={chartNote}
        showCoverage={showCoverage}
        counted={counted}
        series={series}
        intradaySeries={intradaySeries}
        baseDollars={baseDollars}
        zone={zone}
      />

      {/* THE PHONE'S STACK, IN THE ORDER LUKE SPECIFIED: the chart, then Recent Trades, then a
              gap, then Summary, then a gap, then Data. `recent` is `md:hidden` here and the grid
              below is `max-md:hidden`, so exactly one of the two is ever in the document - the same
              rule `/trades/[id]` follows about not rendering its screen twice. */}
      {recent && <div className="md:hidden">{recent}</div>}

      {/* 304px IS FIXED AND THE TAPE TAKES WHAT IS LEFT — the same geometry `/accounts` uses, and
          that is the point rather than a coincidence. v2: "a rail that changed width between two
          pages of one section would read as a different app." Fixed rather than a fraction because
          a rail holds label/value pairs whose ideal width does not change with the viewport;
          letting it flex only stretches the gap between a word and its number.
          BELOW `lg` THE RAIL ORDERS LAST. The tape is what you came for; the summary is what you
          check afterwards. Same call `/accounts` makes about its own rail on a phone. */}
      <div
        className={cn(
          'mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_304px]',
          /* THE TAPE GOES, THE RAIL STAYS. When a `recent` slot is supplied the phone shows four
                 rows instead of the tape - but the rail's two tables are the FACTS about the
                 subject and belong on the page that is about it. So the grid keeps rendering below
                 `md`; only its first cell is dropped. */
          recent && 'max-md:mt-6'
        )}
      >
        {/* NOT `max-md:hidden`. That leaves the tape's 300 rows in the document on a phone so
                that CSS can hide them, under a four-row table drawn from the same array. Measured at
                390px on one real account: 30 rows built, 4 visible. `DesktopOnly` is a client gate,
                which is the only thing that can actually not render them. */}
        {recent ? (
          <DesktopOnly>
            <div className="min-w-0">{tape}</div>
          </DesktopOnly>
        ) : (
          <div className="min-w-0">{tape}</div>
        )}
        {/* STICKY ONLY WHEN IT FITS, and `StickyRail` MEASURES that rather than guessing from the
            viewport. A rail taller than the screen cannot pin at top-0 without hiding its own
            bottom - which is also why there is no `max-h` + `overflow-y-auto` here: that is the
            second scrollbar Luke ruled out (2026-08-03, "i didn't want two scroll bars"). */}
        <StickyRail>{rail}</StickyRail>
      </div>
    </div>
  );
}
