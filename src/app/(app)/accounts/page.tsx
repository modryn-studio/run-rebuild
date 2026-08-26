import type { Metadata } from 'next';
import { requireTrader } from '@/lib/trader';
import { PAGE_COLUMN } from '@/lib/shell';
import { cn } from '@/lib/cn';
import { WithSummaryRail } from '@/components/shell/summary-rail';
import { getFreshness, getRoster } from '@/lib/accounts/read';
import { AccountsView } from '@/components/views/accounts/accounts-view';
import { AccountsRail } from '@/components/views/accounts/accounts-rail';

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
 * THE RAIL IS THE SHELL'S, not a second implementation. `WithSummaryRail` already collapses rather
 * than unmounting, measures before it pins, restores its width before arming its transition and
 * answers the phone's back button. v2 has its own and this one is further along.
 *
 * ─── STILL TO COME IN THIS SLICE ──────────────────────────────────────────────────────────────
 * The hero chart and per-row sparklines (`S6c`), `/accounts/details/<id>` (`S6d`) — which makes live
 * the two account links `/trades` already renders as plain strings — editing (`S6e`), the filter
 * panel and drag-to-reorder (`S6f`), and the mobile pass (`S6g`).
 */
export const metadata: Metadata = { title: 'Accounts' };

export default async function AccountsPage() {
  const trader = await requireTrader();

  const [accounts, freshness] = await Promise.all([getRoster(trader.id), getFreshness(trader.id)]);

  /* A `Map` DOES NOT CROSS THE RSC BOUNDARY AS ONE. It arrives as `{}` with no error and no type
     complaint, which is the same silent-shape trap `reviveTrade` exists for on the tape. Serialised
     here, rebuilt on the client. */
  const stamps = Object.fromEntries(
    [...freshness.entries()].map(([id, at]) => [id, at.toISOString()])
  );

  return (
    <div className={cn(PAGE_COLUMN, 'pb-8')}>
      <WithSummaryRail rail={<AccountsRail accounts={accounts} />}>
        <AccountsView accounts={accounts} freshness={stamps} />
      </WithSummaryRail>
    </div>
  );
}
