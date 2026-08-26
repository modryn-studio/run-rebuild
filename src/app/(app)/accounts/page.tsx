import type { Metadata } from 'next';
import { requireTrader } from '@/lib/trader';
import { PAGE_COLUMN } from '@/lib/shell';
import { cn } from '@/lib/cn';
import { getDailySeries, getFreshness, getRoster } from '@/lib/accounts/read';
import { AccountsView } from '@/components/views/accounts/accounts-view';
import { AccountsRail } from '@/components/views/accounts/accounts-rail';
import { applyRosterFilter, readRosterFilter, rosterOptions } from '@/lib/accounts/roster-filter';

/* ACCOUNTS — "what I have" (`S6`).
 *
 * IT IS ALSO THE PRODUCT'S ONLY DOOR INTO THE INGEST, and that is why this slice came before the
 * rest of `S6`. `AddAccountModal` was mounted here and nowhere else, so clearing this page to an
 * empty shell on 2026-08-20 left the whole three-file import built, merged, gated and unreachable.
 * `S4` does not close until the control is back; this page is the control.
 *
 * A SERVER COMPONENT THAT READS THE CORPUS, with one client boundary inside it for modal state.
 * The roster, its totals and the rail are all derived from ONE read, so they cannot disagree about
 * what the trader owns — the same rule `/trades` follows for its tape and digest.
 *
 * THE RAIL IS `StickyRail` DIRECTLY, NOT `WithSummaryRail`, and that is a correction (2026-08-26,
 * Luke: "the accounts page STILL isn't the same as v2"). Reading both DOM trees side by side made
 * the reason structural rather than cosmetic:
 *
 *   v2   PAGE_COLUMN > [ chart card (FULL WIDTH) , grid( roster , rail ) ]
 *   here PAGE_COLUMN > WithSummaryRail > PAGE_COLUMN > grid( [chart, roster] , rail )
 *
 * Two faults fell out of that. The chart was INSIDE the grid's left column, so it stopped where the
 * roster stops instead of spanning the page over the rail — the single biggest reason the page did
 * not read like v2's. And `WithSummaryRail` applies `PAGE_COLUMN` itself, so nesting it inside this
 * page's own doubled the gutter to 32px.
 *
 * `WithSummaryRail` is still the right wrapper for `/trades`, where the tape is the only content and
 * the rail is a collapsible drawer with a header toggle. `/accounts` has a card ABOVE the split and
 * v2 stacks its rail below the roster on a phone rather than hiding it behind a control, so this
 * page takes the same `StickyRail` v2 does and lays the grid out itself.
 *
 * ─── STILL TO COME IN THIS SLICE ──────────────────────────────────────────────────────────────
 * The hero chart and per-row sparklines (`S6c`), `/accounts/details/<id>` (`S6d`) — which makes live
 * the two account links `/trades` already renders as plain strings — editing (`S6e`), the filter
 * panel and drag-to-reorder (`S6f`), and the mobile pass (`S6g`).
 */
export const metadata: Metadata = { title: 'Accounts' };

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; types?: string }>;
}) {
  const trader = await requireTrader();

  const filter = readRosterFilter(await searchParams);

  const [all, freshness, days] = await Promise.all([
    getRoster(trader.id),
    getFreshness(trader.id),
    getDailySeries(trader.id),
  ]);

  /* NARROWED HERE, BEFORE ANYTHING RENDERS, so the chart, the roster and the rail all receive the
     same set and cannot disagree about what "your accounts" means. The OPTIONS are counted off the
     UNFILTERED roster - otherwise filtering to Closed would hide the Status control that got you
     there, and the panel would offer only the option already picked. */
  const options = rosterOptions(all);
  const accounts = applyRosterFilter(all, filter);

  /* A `Map` DOES NOT CROSS THE RSC BOUNDARY AS ONE. It arrives as `{}` with no error and no type
     complaint, which is the same silent-shape trap `reviveTrade` exists for on the tape. Serialised
     here, rebuilt on the client. */
  const stamps = Object.fromEntries(
    [...freshness.entries()].map(([id, at]) => [id, at.toISOString()])
  );

  return (
    <div className={cn(PAGE_COLUMN, 'pb-8')}>
      {/* THE RAIL ARRIVES AS A PROP, not as a child of the client view. `AccountsRail` is a server
          component — it only reads and formats — and passing it through keeps it that way. Rendering
          it inside `AccountsView` would drag it across the client boundary for nothing. */}
      <AccountsView
        accounts={accounts}
        freshness={stamps}
        days={days}
        rail={<AccountsRail accounts={accounts} />}
        filter={filter}
        options={options}
      />
    </div>
  );
}
