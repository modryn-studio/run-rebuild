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
  endsOn,
}: {
  children: React.ReactNode;
  /** Each counted account's cumulative line, keyed by account id. */
  byAccount: Map<string, Point[]>;
  /** The last day anything traded — the anchor every range is measured back from. Null when the
   *  corpus is empty, where no window is meaningful. */
  endsOn: string | null;
}) {
  const [kind, setKind] = useState<Kind>('cumulative');
  const [range, setRange] = useState<Range>('all');

  const start = useMemo(
    () => (endsOn === null ? null : windowStart(range, endsOn)),
    [range, endsOn]
  );

  const seriesFor = useCallback(
    (ids: string[]) => sumSeries(ids.map((id) => byAccount.get(id) ?? [])),
    [byAccount]
  );

  const changeFor = useCallback(
    (ids: string[]) => windowChange(seriesFor(ids), start).change,
    [seriesFor, start]
  );

  const shapeFor = useCallback(
    (id: string) => {
      const s = byAccount.get(id) ?? [];
      if (!start || s.length === 0) return s;
      /* ONE POINT OF LEAD-IN, so the first day inside the window draws from the level it actually
         started at rather than from wherever the slice happened to open. */
      const from = s.findIndex((p) => p.day >= start);
      if (from < 0) return [];
      return s.slice(from > 0 ? from - 1 : 0);
    },
    [byAccount, start]
  );

  const value = useMemo<ChartView>(
    () => ({
      kind,
      range,
      setKind,
      setRange,
      seriesFor,
      changeFor,
      shapeFor,
      periodLabel: CHANGE_LABELS[range],
      periodShort: RANGE_LABELS[range],
    }),
    [kind, range, seriesFor, changeFor, shapeFor]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
