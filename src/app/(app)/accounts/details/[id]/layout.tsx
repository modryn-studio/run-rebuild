import { notFound } from 'next/navigation';
import { requireTrader } from '@/lib/trader';
import { getAccount, countPrefixSiblings } from '@/lib/accounts/read';
import { accountPrefix, accountRowTitle } from '@/lib/prop-firms';
import { DetailShell } from '@/components/views/accounts/detail-shell';

/* THE SEGMENT'S CHROME, AND THE REASON IT IS A LAYOUT AT ALL.
 *
 * 2026-08-28, Luke, two complaints with one cause: "the header slides up with it. that is not
 * supposed to happen" and "sometimes it takes a second to load the /accounts/details page. can we
 * load the head instantly?"
 *
 * A layout mounts ONCE for the segment and persists while the boundary hands over to the page. So
 * the bar is painted as soon as THIS file's data resolves, which is one cached single-row read -
 * not the chart's series, the tape's first three hundred rows, the provenance rollup and the
 * sibling count the page waits on. And because it never unmounts, only the body underneath it can
 * travel, which is the other half of what he asked for.
 *
 * ONE QUERY, SHARED. `getAccount` is wrapped in React's `cache`, so this, the page and
 * `generateMetadata` are one round trip rather than three identical ones.
 *
 * THE MODAL PROVIDER IS `DetailShell`'S, not this file's, and the reason is a boundary rule: the
 * provider takes a CALLBACK, and a Server Component may not hand a function to a Client Component.
 * So this sends the sibling COUNT and the client shell closes over it. It still sits above the
 * whole segment, which is what both the phone's bar and the desktop header inside the page need.
 *
 * THE 404 LIVES HERE AS WELL AS IN THE PAGE, and that is not redundancy: a layout renders before its
 * page, so without this an unknown id would paint a bar titled after nothing while the page
 * resolved. `getAccount` returns null both for a malformed id and for one belonging to another
 * trader, so the two read the same from outside - an "excluded" or "not found" that only appeared
 * for real ids would confirm which ids exist.
 */
export default async function AccountDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  /* SCOPED BY `trader_id` FROM THE SESSION, NEVER FROM THE REQUEST. `getAccount` puts the trader in
     the WHERE clause rather than returning a row this then has to remember to check. */
  const trader = await requireTrader();
  const account = await getAccount(trader.id, id);
  if (!account) notFound();

  /* THE SIBLING COUNT, for the label form's "apply to your other TDFY accounts" switch. One integer
     rather than the whole roster. Skipped entirely for a placeholder key, which has no prefix and
     therefore no siblings by construction. */
  const prefix = accountPrefix(account.externalAccountId);
  const siblingCount = prefix ? await countPrefixSiblings(trader.id, prefix, account.id) : 0;

  return (
    <DetailShell
      account={account}
      title={accountRowTitle(account)}
      siblingCount={siblingCount}
    >
      {children}
    </DetailShell>
  );
}
