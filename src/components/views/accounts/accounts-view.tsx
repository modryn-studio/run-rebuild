'use client';

import { useEffect, useMemo, useState } from 'react';

/* THE CLIENT BOUNDARY FOR `/accounts`, and it holds exactly one thing: whether a modal is open.
 *
 * The page stays a Server Component that reads the corpus, because it is the only source of truth
 * for what the trader owns. But the controls that open the add-account modal sit in unrelated
 * subtrees - the header is portalled into the shell's band, the empty-state call to action is inside
 * a card, the dashed row is at the foot of the list - so their common ancestor has to be a client
 * component. This is that ancestor and nothing more: the data arrives already read.
 */

import { AccountModalsProvider, useAddAccount } from './account-modals';
import { AccountsHeader } from './accounts-header';
import { AccountsRail } from './accounts-rail';
import { RosterCard } from './roster-card';
import { PnlChart } from './pnl-chart';
import { ChartViewProvider } from './chart-view';
import { ScopeTabs, inScope, type Scope } from './scope-tabs';
import type { RosterFilter } from '@/lib/accounts/roster-filter';
import { StickyRail } from '@/components/shell/sticky-rail';
import { sizeBase } from './trend-indicator';
import { cumulate, foldIntraday, type Point } from '@/lib/accounts/series';
import { sessionWindow } from '@/lib/time/session';
import type { DayPoint, RosterAccount } from '@/lib/accounts/read';

export function AccountsView({
  accounts,
  freshness,
  days,
  filter,
  allAccounts,
  intradayRows,
  zone,
}: {
  accounts: RosterAccount[];
  /* A PLAIN OBJECT, NOT A `Map`. `getFreshness` builds a Map because that is the right shape on the
     server, but a Map does not survive the RSC boundary as one - it arrives as `{}`, silently. The
     page converts on the way out and this converts back. */
  freshness: Record<string, string>;
  /** Per-account daily P&L, already windowed by the page. Folded here rather than on the server so
   *  one read serves the chart, the group headers and (next) the row sparklines. */
  days: DayPoint[];
  filter: RosterFilter;
  /* THE UNFILTERED ROSTER, for the filter panel alone. Its account tree and its option lists must
     offer what the filter is currently HIDING - narrowing to one firm would otherwise remove every
     other firm from the panel that got you there, and the counted axes would offer only the option
     already picked. */
  allAccounts: RosterAccount[];
  /* THE LAST SESSION'S ROUND TRIPS, for the 1-day range. `at` arrives as a STRING: a `Date` does
     not survive the RSC boundary and TypeScript will not say so - the same silent-shape trap
     `reviveTrade` exists for on the tape. Revived at the boundary below, never at a call site. */
  intradayRows: { accountId: string; at: string; cents: number }[];
  /** `trader.display_timezone`. Labels the 1-day axis; it never reaches the bucketing. */
  zone: string;
}) {
  /* WHICH SLICE OF THE ROSTER THE WHOLE SCREEN IS ABOUT, and it is PHONE-ONLY state. It lives here
     rather than in `ChartViewProvider` because it governs more than the view: the chart's series,
     its account count, its percentage base and the roster's own rows are all derived below, and one
     of them reading a different scope from the others is precisely the "page states two different
     answers to one question" defect this build keeps guarding against.
     EPHEMERAL, DELIBERATELY. It resets on reload like every other view control here - a scope is
     what you are looking at right now, not a preference. */
  const [scope, setScope] = useState<Scope>('all');

  /* THE SCOPE CANNOT SURVIVE THE CONTROL THAT SETS IT — found by v2's postcheck (2026-07-30) and
     ported with the tabs, because the failure is a property of the arrangement rather than of that
     codebase. `ScopeTabs` is `sm:hidden`, so a trader who picks "Personal" on a phone and then turns
     it landscape (844px, well past the breakpoint) would keep a filtered chart and a filtered roster
     with the control gone and no way back. A filter with no visible control is not a view state, it
     is a page quietly lying about how many accounts you have.
     `matchMedia`, not a resize listener: it fires on the CROSSING rather than on every pixel of a
     drag, and `sync()` runs once on mount so a page first rendered wide is already correct. */
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const sync = () => {
      if (mq.matches) setScope('all');
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  /* NARROWED ONCE, HERE, and everything below reads `scoped`. `accounts` survives only for the chip
     row itself, which has to offer the groups the current scope is hiding - the same rule the filter
     panel follows with `allAccounts`. */
  const scoped = accounts.filter((a) => inScope(a, scope));

  /* THE CHART COUNTS WHAT THE TOTALS COUNT. An account excluded from totals is excluded here too,
     or the line above the roster would disagree with the numbers inside it - which is exactly the
     defect v2 shipped, where filtering left the rail reading +$954.99 under a chart reading
     -$26,995.06. */
  const counted = new Set(scoped.filter((a) => !a.excludedFromTotals).map((a) => a.id));
  const byDay = new Map<string, number>();
  for (const d of days) {
    if (!counted.has(d.accountId)) continue;
    byDay.set(d.day, (byDay.get(d.day) ?? 0) + d.cents);
  }
  const series = cumulate([...byDay.entries()].map(([day, cents]) => ({ day, cents })));

  /* THE PERCENTAGE'S DENOMINATOR, or null the moment one counted account has no stated size. A
     percentage against a partial base is a wrong number rather than a partial one - and it would
     drift toward looking right as more accounts got labelled, which is worse than being missing. */
  const baseDollars = sizeBase(scoped.filter((a) => !a.excludedFromTotals));

  /* ONE CUMULATIVE LINE PER ACCOUNT, from the same read the chart above uses. Built here rather
     than on the server because it is a fold over rows already on the page - a second query would be
     the same rows a render later, with a real chance of the two disagreeing after an import lands
     between them. INCLUDES excluded accounts: an excluded row keeps its own real figure and its own
     shape, it simply does not join a total. */
  const perAccount = new Map<string, Map<string, number>>();
  for (const d of days) {
    if (!d.accountId) continue;
    const m = perAccount.get(d.accountId) ?? new Map<string, number>();
    m.set(d.day, (m.get(d.day) ?? 0) + d.cents);
    perAccount.set(d.accountId, m);
  }
  const byAccount = new Map<string, Point[]>(
    [...perAccount.entries()].map(([id, m]) => [
      id,
      cumulate([...m.entries()].map(([day, cents]) => ({ day, cents }))),
    ])
  );

  /* THE ANCHOR EVERY RANGE MEASURES BACK FROM is the last day anything traded, not today. A roster
     whose accounts all stopped in March must not have "1 month" ask for a window in August and come
     back blank under a headline still reading a real total - which is the defect v2 shipped and
     Luke caught. */
  const endsOn = series.length > 0 ? series[series.length - 1].day : null;

  /* THE LAST SESSION'S OWN SHAPE. Folded here, beside the daily fold, for the same reason: it is
     arithmetic over rows already on the page. The window's instants come from the ONE bucketer, so
     the anchor and the tail sit exactly where `session_date` says the session did.
     `endsOn` IS THE SESSION, not today - a roster whose last trade was in March gets March's day,
     which is the only 1-day chart that could contain anything. */
  const intraday = useMemo(() => {
    if (endsOn === null) return { total: [] as Point[], byAccount: new Map<string, Point[]>() };
    /* SCOPED TO THE COUNTED ACCOUNTS BEFORE FOLDING, exactly as `byDay` is above. Folding first and
       filtering after would leave an excluded account's trades in the total - the chart-disagrees-
       with-the-rail defect, arrived at through a different door. */
    return foldIntraday(
      intradayRows
        .filter((r) => counted.has(r.accountId))
        .map((r) => ({ ...r, at: new Date(r.at) })),
      sessionWindow(endsOn)
    );
  }, [intradayRows, endsOn, counted]);

  return (
    <AccountModalsProvider>
      <ChartViewProvider byAccount={byAccount} intraday={intraday.byAccount} endsOn={endsOn}>
        <AccountsHeader filter={filter} accounts={allAccounts} />

        {/* ABOVE THE CHART, WHICH IS WHERE THE THING IT CHANGES BEGINS. Monarch puts the same row in
            the same place, and it is the only position that reads as scoping the whole screen rather
            than as a control belonging to one card. */}
        <ScopeTabs accounts={accounts} scope={scope} onScope={setScope} className="sm:hidden" />

        {/* THE CHART SPANS THE PAGE, ABOVE THE SPLIT — v2's arrangement, and the thing that most
            decides whether this reads as the same page. Inside the grid's left column it stops
            where the roster stops, which leaves the curve describing the whole roster drawn at the
            width of part of it. */}
        <PnlChart
          series={series}
          intradaySeries={intraday.total}
          counted={counted.size}
          baseDollars={baseDollars}
          zone={zone}
        />

        {/* 304px IS FIXED, and the roster takes whatever is left. v2 measured this at a 1280
            viewport: the two columns compute to 693.8 / 304.2 with a 16px gutter. Fixed rather than
            a fraction because the rail holds label/value pairs whose ideal width does not change
            with the viewport — letting it flex only stretches the whitespace between a word and its
            number.
            BELOW `lg` THE RAIL ORDERS LAST. On a phone it is a screenful of totals standing between
            the trader and the accounts they opened the page for. */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_304px]">
          <Roster accounts={scoped} freshness={freshness} />
          {/* SCOPED, LIKE EVERYTHING ELSE ON THE PAGE. It used to arrive from the server as finished
              JSX over the unscoped roster, which is how it came to disagree with the chart above it
              the moment the phone's chips could narrow one and not the other. */}
          <StickyRail>
            <AccountsRail accounts={scoped} />
          </StickyRail>
        </div>
      </ChartViewProvider>
    </AccountModalsProvider>
  );
}

/* A CHILD, because a component cannot consume a context that it renders the provider for itself -
   the hook would resolve against whatever is ABOVE this component, not the provider inside it. */
function Roster({
  accounts,
  freshness,
}: {
  accounts: RosterAccount[];
  freshness: Record<string, string>;
}) {
  const add = useAddAccount();
  const stamps = new Map<string, Date>(
    Object.entries(freshness).map(([id, iso]) => [id, new Date(iso)])
  );
  return <RosterCard accounts={accounts} freshness={stamps} onAdd={add} />;
}
