import { and, count, eq, sql } from 'drizzle-orm';
import { db, account, event } from '@/lib/db';
import { requireTrader } from '@/lib/trader';
import { AccountsView, type RosterAccount } from './accounts-view';
import { PAGE_COLUMN } from '@/lib/shell';

/* The accounts roster. `S4e` builds the minimum that makes the intake testable; `S6` is the real
 * page. See the note at the top of `accounts-view.tsx`.
 *
 * A SERVER COMPONENT READING THE CORPUS, which is why the modal calls `router.refresh()` when an
 * import finishes rather than pushing a new row into local state. One source of truth for what a
 * trader owns, and a new account appears because the database says so.
 */
export default async function AccountsPage() {
  const trader = await requireTrader();

  /* SCOPED BY `trader_id` FROM THE SESSION, never from the request, and by account in the join.
     The record is somebody's trading history.
     One query rather than a roster read plus a count per row: the trade count is what proves an
     import landed, so it is not decoration that can be fetched lazily. `round_trip` only — fills
     and fees are legs and costs, and counting them here would report a number the trader has no
     word for. */
  const rows = await db
    .select({
      id: account.id,
      externalAccountId: account.externalAccountId,
      displayName: account.displayName,
      propFirm: account.propFirm,
      accountType: account.accountType,
      sizeDollars: account.sizeDollars,
      trades: count(event.id),
    })
    .from(account)
    .leftJoin(event, and(eq(event.accountId, account.id), eq(event.type, 'round_trip')))
    .where(eq(account.traderId, trader.id))
    .groupBy(account.id)
    .orderBy(sql`${account.createdAt} desc`);

  const accounts: RosterAccount[] = rows.map((r) => ({ ...r, trades: Number(r.trades) }));

  /* CONNECTED LOGINS, not accounts. A firm issues one Tradovate login and a copy-trader runs many
     accounts under it, so the login count is the number a trader recognises. Zero until the OAuth
     rail turns on — there is no way to connect one yet, and the row that shows this is dark. */
  const connected = 0;

  /* THE GUTTER, which this page never had. `PAGE_COLUMN` is the shell's one horizontal rhythm and
     `/accounts` was rendering flush to the pane edge — invisible while the only thing on it was a
     title and a button, obvious the moment `S5c` put the roster beside `/trades`. Imported from
     `@/lib/shell` rather than through a client module: see that file's note on why. */
  return (
    <div className={PAGE_COLUMN}>
      <AccountsView accounts={accounts} connected={connected} />
    </div>
  );
}
