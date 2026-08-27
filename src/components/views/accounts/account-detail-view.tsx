'use client';

/* THE CLIENT BOUNDARY FOR `/accounts/details/<id>`, and it holds exactly as little as `/accounts`'
 * own does: the chart's view state, and the fold that feeds it.
 *
 * WHY A BOUNDARY AT ALL. `PnlChart` reads `useChartView()` - the period, the kind, and the window
 * every figure on the page is measured over - and that is browser state by definition: it resets on
 * reload, which is correct for a view control and wrong for a preference. So the provider has to be
 * a client component, and so does anything rendering the chart inside it.
 *
 * WHAT STAYS ON THE SERVER, AND HOW. The rail and the tape arrive as PROPS, already rendered. A
 * Server Component may hand finished JSX to a Client Component, and that is what keeps
 * `AccountRail` shipping no JavaScript even though a client component lays it out. The route builds
 * them; this only positions them.
 *
 * THE FOLD IS HERE RATHER THAN IN SQL, matching `accounts-view.tsx` exactly and for its reason: it
 * is arithmetic over rows already on the page. A second query would be the same rows a render later,
 * with a real chance of the two disagreeing after an import lands between them.
 */

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { ChartViewProvider } from './chart-view';
import { AccountDetailHeader } from './account-detail-header';
import { SubjectPage } from '@/components/views/subject-page';
import { cumulate, foldIntraday, type Point } from '@/lib/accounts/series';
import { sessionWindow } from '@/lib/time/session';
import { accountRowTitle } from '@/lib/prop-firms';
import { sizeBase } from './trend-indicator';
import type { DayPoint, RosterAccount } from '@/lib/accounts/read';
import type { Option as FilterOption } from './detail-filters';
import type { FacetRow } from '@/lib/trades/facets';
import type { ResultToken } from '@/lib/trades/filter';

export function AccountDetailView({
  account,
  days,
  intradayRows,
  zone,
  hasFees,
  filters,
  rail,
  tape,
}: {
  account: RosterAccount;
  /** THIS ACCOUNT'S days only. The route scopes the read; nothing is filtered here. */
  days: DayPoint[];
  /* THE LAST SESSION'S ROUND TRIPS, for the 1-day range. `at` arrives as a STRING: a `Date` does
     not survive the RSC boundary and TypeScript will not say so - the same silent-shape trap
     `reviveTrade` exists for on the tape. Revived at this boundary, never at a call site. */
  intradayRows: { accountId: string; at: string; cents: number }[];
  /** `trader.display_timezone`. Labels the 1-day axis; it never reaches the bucketing. */
  zone: string;
  /* WHETHER A FEE LINE COVERS THIS ACCOUNT, which decides whether the chart's eyebrow may say NET.
     `/trades` makes the same call for its window and `accounts-rail.tsx` defers the per-account
     answer to this page, because a roster rollup spans accounts whose coverage can differ. */
  hasFees: boolean;
  /** Everything the band's `Filters` control needs. Passed straight through rather than read here:
   *  this component owns the chart's view state and nothing else. */
  filters: {
    applied: { products: string[]; results: ResultToken[]; q: string | null };
    products: FilterOption[];
    results: FilterOption[];
    facetRows: FacetRow[];
  };
  rail: ReactNode;
  tape: ReactNode;
}) {
  const series = useMemo(
    () => cumulate(days.map((d) => ({ day: d.day, cents: d.cents }))),
    [days]
  );

  /* THE ANCHOR EVERY RANGE MEASURES BACK FROM is the last day THIS ACCOUNT traded, not today. A
     closed account that stopped in March must not have "1 month" ask for a window in August and come
     back blank under a headline still reading a real total - the defect v2 shipped and Luke caught
     on the roster. It bites harder here: a page about one closed account is the case. */
  const endsOn = series.length > 0 ? series[series.length - 1].day : null;

  const byAccount = useMemo(
    () => new Map<string, Point[]>([[account.id, series]]),
    [account.id, series]
  );

  const intraday = useMemo(() => {
    if (endsOn === null) return new Map<string, Point[]>();
    return foldIntraday(
      intradayRows.map((r) => ({ ...r, at: new Date(r.at) })),
      sessionWindow(endsOn)
    ).byAccount;
  }, [intradayRows, endsOn]);

  const total = useMemo(() => intraday.get(account.id) ?? [], [intraday, account.id]);

  const title = accountRowTitle(account);

  return (
    <ChartViewProvider byAccount={byAccount} intraday={intraday} endsOn={endsOn}>
      <SubjectPage
        header={
          <AccountDetailHeader
            account={account}
            title={title}
            applied={filters.applied}
            products={filters.products}
            results={filters.results}
            facetRows={filters.facetRows}
          />
        }
        /* THE EYEBROW STATES WHETHER FEES ARE IN THE FIGURE, which is the claim `/trades` makes for
           its window and the roster cannot make for its rollup. One account, one honest answer. */
        chartLabel={hasFees ? 'Net P&L' : 'Gross P&L'}
        /* A NOTE ONLY WHEN THE NUMBER IS NOT WHAT IT LOOKS LIKE (2026-08-27, Luke: "why do we have
           'Net of commissions and fees on this account'. i think that is unnecessary copy. of
           course it is p&l with commissions and fees included. when is it ever always?").
           He is right, and v2 reached the same place from the other side: NET is the rule for every
           money figure in Run, so saying it under one card is noise rather than information - and
           the eyebrow directly above already says the word. GROSS is the exception, and it earns a
           sentence because it changes what the number MEANS: fees are missing, and nothing else on
           the page would tell you why the figure is bigger than the broker's. v2 keeps its note on
           the subject pages for exactly this case and removed it from the roster for exactly the
           other. */
        chartNote={hasFees ? undefined : 'No fee data imported for this account yet.'}
        /* OFF. "Across 1 account" is a sentence about a set, and this page is one account. */
        showCoverage={false}
        series={series}
        intradaySeries={total}
        /* THE PERCENTAGE'S DENOMINATOR, THROUGH THE ROSTER'S OWN HELPER rather than reading
           `sizeDollars` directly. A percentage against a missing base is a WRONG number, not a
           partial one, and `sizeBase` is where that rule is spelled - passing a one-account list
           keeps this page and the roster incapable of disagreeing about when the figure is
           available. It returns whole DOLLARS, which is what `TrendIndicator` expects. */
        baseDollars={sizeBase([account])}
        zone={zone}
        rail={rail}
        tape={tape}
      />
    </ChartViewProvider>
  );
}
