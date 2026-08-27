'use client';

/* WHAT THE PAGE IS CURRENTLY SHOWING, held in one place so three surfaces cannot disagree about it.
 *
 * The period control lives on the chart, but it governs more than the chart: every group header's
 * change is over the same window, and every row's sparkline draws the same span. `run-trading@v2`
 * learned this the hard way in the other direction — filtering narrowed its tape while the line
 * above it still drew everything, so "the page stated two different answers to one question".
 *
 * IT HOLDS THE VIEW, NOT THE TRADER'S PREFERENCES. What is on screen right now resets on reload,
 * which is correct for a view control and wrong for a preference. (v2 persists `kind` and `range`
 * to localStorage; that is deliberately not carried across yet — the roster's card ORDER is the
 * thing worth persisting, and it arrives with the drag slice.)
 *
 * THE SERIES ARE PASSED IN, ALREADY FOLDED. This provider does no arithmetic beyond slicing a
 * window: the page reads the corpus once, `accounts-view.tsx` folds it per account, and everything
 * here is a lookup. A second fold would be the same rows a render later, with a real chance of the
 * two disagreeing after an import lands between them.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Grain } from '@/lib/time/session';
import {
  CHANGE_LABELS,
  RANGE_LABELS,
  sumSeries,
  windowChange,
  windowStart,
  type Point,
  type Range,
} from '@/lib/accounts/series';

type Kind = 'cumulative' | 'breakdown';

type ChartView = {
  kind: Kind;
  range: Range;
  setKind: (k: Kind) => void;
  setRange: (r: Range) => void;
  /* ─── THE BREAKDOWN'S OWN TWO CONTROLS (`S6d`, 2026-08-27) ──────────────────────────────────
     Luke, 2026-08-06: "the two views carry different controls". Cumulative asks HOW FAR BACK
     (`range`); Breakdown asks HOW WIDE A BAR IS (`grain`) and moves along the corpus with the pan
     arrows (`anchor`). One menu slot, two questions - the control changes identity when the kind
     toggles, and v2 records Luke's call on that: "do nothing, it resolves itself once the trader
     has toggled twice." */
  /** The Breakdown's bar width. Never derived from `range` — see `GRAINS` in `series.ts`. */
  grain: Grain;
  setGrain: (g: Grain) => void;
  /* THE NEWEST BUCKET ON SCREEN, or null for "the newest there is". Null rather than an index, so a
     grain change does not carry a stale position: eight weeks back is not eight months back, and an
     index would silently mean the second after the menu moved. */
  anchor: string | null;
  setAnchor: (a: string | null) => void;
  /** The cumulative line for a set of accounts, merged. */
  seriesFor: (ids: string[]) => Point[];
  /** What that set changed by inside the current window. */
  changeFor: (ids: string[]) => number;
  /** One account's line, sliced to the window, for its row's sparkline. */
  shapeFor: (id: string) => Point[];
  periodLabel: string;
  periodShort: string;
};

const Ctx = createContext<ChartView | null>(null);

export function useChartView(): ChartView {
  const v = useContext(Ctx);
  /* A THROW, NOT A DEFAULT. A silent fallback here would render a chart of nothing and look like a
     data problem rather than a missing provider. */
  if (!v) throw new Error('useChartView must be used inside ChartViewProvider');
  return v;
}

export function ChartViewProvider({
  children,
  byAccount,
  intraday,
  endsOn,
}: {
  children: React.ReactNode;
  /** Each counted account's cumulative line, keyed by account id. */
  byAccount: Map<string, Point[]>;
  /* THE SAME SHAPE OVER THE LAST SESSION, keyed by INSTANT rather than by day. A second map rather
     than a second provider: every consumer below - the chart, the group headers' change, the row
     sparklines - has to switch source together or the page would show a 1-day chart over week-old
     sparklines. One `pick` decides it once, here. */
  intraday: Map<string, Point[]>;
  /** The last day anything traded — the anchor every range is measured back from. Null when the
   *  corpus is empty, where no window is meaningful. */
  endsOn: string | null;
}) {
  const [pickedKind, setKind] = useState<Kind>('cumulative');
  const [range, setRange] = useState<Range>('all');
  const [grain, setGrainState] = useState<Grain>('day');
  const [anchor, setAnchor] = useState<string | null>(null);

  /* CHANGING THE BAR WIDTH RETURNS TO THE NEWEST PAGE, and it has to. The anchor is a bucket START,
     so "2026-06-15" is a real day bucket and no week or month bucket at all - keeping it across a
     grain change would look up a bucket that cannot be found, and the page would silently fall back
     to the end anyway. Resetting says so out loud, and it is also what a trader means: picking
     Monthly is a request to see months, not to see the month containing wherever they had panned
     to. */
  const setGrain = useCallback((g: Grain) => {
    setGrainState(g);
    setAnchor(null);
  }, []);

  /* A 1-DAY BREAKDOWN IS ONE BAR, which is the useless control `grainFor` exists to prevent - the
     breakdown buckets by DAY and a single session holds exactly one of those.
     FORCED RATHER THAN DISABLED, and the trader's own choice is REMEMBERED: picking 1d while on
     Breakdown draws the cumulative curve, and leaving 1d puts Breakdown back. Disabling the menu
     entry would strand someone on a control they did not turn off; silently rewriting `kind` in
     state would lose what they had picked. */
  const kind: Kind = range === '1d' ? 'cumulative' : pickedKind;

  const start = useMemo(
    () => (endsOn === null ? null : windowStart(range, endsOn)),
    [range, endsOn]
  );

  /* WHICH CORPUS THIS RANGE IS ASKING ABOUT. 1d is the only range whose points are not days, so it
     is the only one that reads the other map. */
  const source = range === '1d' ? intraday : byAccount;

  const seriesFor = useCallback(
    (ids: string[]) => sumSeries(ids.map((id) => source.get(id) ?? [])),
    [source]
  );

  const changeFor = useCallback(
    (ids: string[]) => windowChange(seriesFor(ids), start).change,
    [seriesFor, start]
  );

  const shapeFor = useCallback(
    (id: string) => {
      const s = source.get(id) ?? [];
      if (!start || s.length === 0) return s;
      /* ONE POINT OF LEAD-IN, so the first day inside the window draws from the level it actually
         started at rather than from wherever the slice happened to open. */
      const from = s.findIndex((p) => p.day >= start);
      if (from < 0) return [];
      return s.slice(from > 0 ? from - 1 : 0);
    },
    [source, start]
  );

  const value = useMemo<ChartView>(
    () => ({
      kind,
      range,
      setKind,
      setRange,
      grain,
      setGrain,
      anchor,
      setAnchor,
      seriesFor,
      changeFor,
      shapeFor,
      periodLabel: CHANGE_LABELS[range],
      periodShort: RANGE_LABELS[range],
    }),
    [kind, range, grain, setGrain, anchor, seriesFor, changeFor, shapeFor]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
