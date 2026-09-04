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
import { cumulate, foldIntraday, sizeBase, type Point } from '@/lib/accounts/series';
import { sessionWindow } from '@/lib/time/session';
import { accountRowTitle } from '@/lib/prop-firms';
import type { DayPoint, RosterAccount } from '@/lib/accounts/read';
import type { Option as FilterOption } from './detail-filters';
import type { FacetRow } from '@/lib/trades/facets';
import type { ResultToken } from '@/lib/trades/filter';

export function AccountDetailView({
  account,
  days,
  intradayRows,
  zone,
  filters,
  rail,
  tape,
  recent,
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
  /* THE PHONE'S FOUR ROWS AND ITS WAY TO THE REST. Built by the route, like the tape and the rail,
     because it is the same query's rows. */
  recent: ReactNode;
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
    /* THE MODAL PROVIDER IS THE SEGMENT LAYOUT'S NOW, not this component's (2026-08-28). It has to
       be: the phone's bar lives up there and its Edit control calls `useLabelAccount`, so the
       context must sit above the layout's own chrome rather than above only what this page renders.
       What stays here is the chart's, which is genuinely narrower - the card and its controls are
       the only readers, and a page about a different subject hands it a different set. */
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
        /* `Net P&L`, UNCONDITIONALLY (2026-09-04). This used to branch on `hasFees`; the whole
           argument for retiring that branch is on `label` in `pnl-chart.tsx`. Short version: the
           import path now blocks a fee-less file, so `Gross` was unreachable on any account with
           trades and was reaching only the EMPTY one, where it read as a fee problem. */
        chartLabel="Net P&L"
        /* THE FEE NOTE IS GONE (2026-09-04, Luke: *"why are we saying 'no fee data imported' on
           accounts that have no data? that is unnecessary copy."*). It read *"No fee data imported
           for this account yet"*, and it was reachable on exactly one kind of account: one with no
           trades at all - where it answered a question about costs that the trader had not incurred.
           The case it was WRITTEN for - fees genuinely missing from real trades - has been
           unreachable since `preflight.ts` made `fees_empty` blocking.
           ITS 2026-08-27 ARGUMENT STILL STANDS AND IS WHY NOTHING REPLACES IT. Luke, then: *"of
           course it is p&l with commissions and fees included. when is it ever always?"* NET is the
           rule for every money figure in Run, so a sentence saying so under one card is noise. */
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
        recent={recent}
        />
    </ChartViewProvider>
  );
}
