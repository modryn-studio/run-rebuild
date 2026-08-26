'use client';

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
import { RosterCard } from './roster-card';
import { PnlChart } from './pnl-chart';
import { ChartViewProvider } from './chart-view';
import type { RosterFilter } from '@/lib/accounts/roster-filter';
import { StickyRail } from '@/components/shell/sticky-rail';
import { sizeBase } from './trend-indicator';
import { cumulate, type Point } from '@/lib/accounts/series';
import type { DayPoint, RosterAccount } from '@/lib/accounts/read';
import type { AccountStatus, AccountType } from '@/lib/db/schema';

export function AccountsView({
  accounts,
  freshness,
  days,
  rail,
  filter,
  options,
}: {
  accounts: RosterAccount[];
  /* A PLAIN OBJECT, NOT A `Map`. `getFreshness` builds a Map because that is the right shape on the
     server, but a Map does not survive the RSC boundary as one - it arrives as `{}`, silently. The
     page converts on the way out and this converts back. */
  freshness: Record<string, string>;
  /** Per-account daily P&L, already windowed by the page. Folded here rather than on the server so
   *  one read serves the chart, the group headers and (next) the row sparklines. */
  days: DayPoint[];
  /** The summary rail, rendered on the server and passed through. */
  rail: React.ReactNode;
  filter: RosterFilter;
  options: {
    status: { value: AccountStatus; count: number }[];
    types: { value: AccountType; count: number }[];
    hasStatus: boolean;
    hasTypes: boolean;
  };
}) {
  /* THE CHART COUNTS WHAT THE TOTALS COUNT. An account excluded from totals is excluded here too,
     or the line above the roster would disagree with the numbers inside it - which is exactly the
     defect v2 shipped, where filtering left the rail reading +$954.99 under a chart reading
     -$26,995.06. */
  const counted = new Set(accounts.filter((a) => !a.excludedFromTotals).map((a) => a.id));
  const byDay = new Map<string, number>();
  for (const d of days) {
    if (!counted.has(d.accountId)) continue;
    byDay.set(d.day, (byDay.get(d.day) ?? 0) + d.cents);
  }
  const series = cumulate([...byDay.entries()].map(([day, cents]) => ({ day, cents })));

  /* THE PERCENTAGE'S DENOMINATOR, or null the moment one counted account has no stated size. A
     percentage against a partial base is a wrong number rather than a partial one - and it would
     drift toward looking right as more accounts got labelled, which is worse than being missing. */
  const baseDollars = sizeBase(accounts.filter((a) => !a.excludedFromTotals));

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

  return (
    <AccountModalsProvider>
      <ChartViewProvider byAccount={byAccount} endsOn={endsOn}>
        <AccountsHeader filter={filter} options={options} />

        {/* THE CHART SPANS THE PAGE, ABOVE THE SPLIT — v2's arrangement, and the thing that most
            decides whether this reads as the same page. Inside the grid's left column it stops
            where the roster stops, which leaves the curve describing the whole roster drawn at the
            width of part of it. */}
        <PnlChart series={series} counted={counted.size} baseDollars={baseDollars} />

        {/* 304px IS FIXED, and the roster takes whatever is left. v2 measured this at a 1280
            viewport: the two columns compute to 693.8 / 304.2 with a 16px gutter. Fixed rather than
            a fraction because the rail holds label/value pairs whose ideal width does not change
            with the viewport — letting it flex only stretches the whitespace between a word and its
            number.
            BELOW `lg` THE RAIL ORDERS LAST. On a phone it is a screenful of totals standing between
            the trader and the accounts they opened the page for. */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_304px]">
          <Roster accounts={accounts} freshness={freshness} />
          <StickyRail>{rail}</StickyRail>
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
