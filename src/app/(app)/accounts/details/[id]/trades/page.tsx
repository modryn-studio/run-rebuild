import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireTrader } from '@/lib/trader';
import { getAccount } from '@/lib/accounts/read';
import { getTape, getTapeIds, getFacetRows, getDigest } from '@/lib/trades/read';
import { EMPTY_FILTER, type ResultToken } from '@/lib/trades/filter';
import { accountRowTitle } from '@/lib/prop-firms';
import { TradesTape } from '@/components/views/trades/trades-tape';
import { TradesRail } from '@/components/views/trades/trades-rail';
import { TradesSearchPill } from '@/components/views/trades/trades-controls';
import {
  AccountTradesScreen,
  ACCOUNT_TRADES_BAND_HOST,
} from '@/components/views/accounts/account-trades-screen';

/* ONE ACCOUNT'S WHOLE TAPE — the screen behind "View all trades" (2026-08-28, `S6d`).
 *
 * THE PHONE'S SCREEN, AND ONLY THE PHONE'S. `AccountTradesScreen` redirects to the details page
 * above `md`, where the full tape already sits beside its rail. See that file for why this is a
 * route rather than a layer over the page it came from: search and the filter sheet write to the
 * URL, and as a layer they would narrow the page underneath after the trader had left.
 *
 * IT RUNS THE DETAILS PAGE'S OWN READS, scoped identically. `accounts` is pinned to this account and
 * is not something the panel can change; the three axes come off the URL and are validated on the
 * way in, for the reason every filter in this codebase is - a hand-typed `?results=banana` must not
 * reach SQL as a token.
 *
 * THE DIGEST IS UNCONDITIONAL HERE, unlike on the details page. There it is fetched only when
 * something is narrowing, because the account's own folded figures are already on hand and a second
 * round trip would buy nothing. Here the digest IS the summary panel - win rate, average session,
 * best and worst - so it is the point of the screen rather than a correction to a figure.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const trader = await requireTrader();
  const account = await getAccount(trader.id, id);
  return { title: account ? `${accountRowTitle(account)} trades` : 'Trades' };
}

export default async function AccountTradesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ products?: string; results?: string; q?: string }>;
}) {
  const { id } = await params;
  /* SCOPED BY `trader_id` FROM THE SESSION, NEVER FROM THE REQUEST. `getAccount` puts the trader in
     the WHERE clause, so an id belonging to somebody else returns null and 404s here - it does not
     return a row this page then has to remember to check. */
  const trader = await requireTrader();
  const account = await getAccount(trader.id, id);
  if (!account) notFound();

  const query = await searchParams;
  const list = (v?: string) => (v ? v.split(',').filter(Boolean) : []);
  const applied = {
    products: list(query.products),
    results: list(query.results).filter((r): r is ResultToken => r === 'win' || r === 'loss'),
    q: query.q?.trim() || null,
  };
  const filter = { ...EMPTY_FILTER, accounts: [account.id], ...applied };
  const window = { from: null, to: null };

  const [sessions, ids, facetRows, digest] = await Promise.all([
    getTape(trader.id, filter, window, { limit: FIRST_PAGE }),
    getTapeIds(trader.id, filter, window),
    getFacetRows(trader.id),
    getDigest(trader.id, filter, window),
  ]);

  /* NARROWED MEANS "THE TRADER NARROWED IT", not "the query has a WHERE clause". `isNarrowed` counts
     `accounts.length`, and this screen pins that on every request - so it would answer true
     unconditionally and the empty state could never say "day one". Same derivation the details page
     makes, and for the defect it was written to fix. */
  const narrowed =
    applied.products.length > 0 || applied.results.length > 0 || applied.q !== null;

  /* THE OPTIONS ARE COUNTED ON THE WHOLE ACCOUNT, never on the filtered tape: an option that
     vanished because the current filter hid its trades could never be un-picked. */
  const own = facetRows.filter((r) => r.accountId === account.id);
  const products = [...new Set(own.map((r) => r.product))].sort();

  return (
    <AccountTradesScreen
      account={account}
      title={accountRowTitle(account)}
      /* THE SET ON SCREEN, NOT THE ACCOUNT. Identity and provenance live on the details page, which
         is the page about the account; this panel answers "how did these trades go", which is the
         question a screen with a filter on it raises. */
      rail={
        <TradesRail
          digest={digest}
          filter={filter}
          /* WHICH FIGURES A RESULT FILTER MAKES MEANINGLESS - the rail's own guard, and it takes the
             flag rather than re-deriving it so this screen and `/trades` cannot disagree about when
             a win rate is a tautology. */
          resultFiltered={applied.results.length === 1}
          ids={ids}
        />
      }
      searchPill={
        <TradesSearchPill
          hostId={ACCOUNT_TRADES_BAND_HOST}
          applied={filter}
          /* NO ACCOUNTS. The sheet's Accounts axis renders nothing for a single-account list
             already, and passing this screen's one account would offer a filter that cannot
             change the set. */
          accounts={[]}
          products={products}
          facetRows={own}
        />
      }
    >
      <TradesTape
        hasFees={digest.hasFees}
        /* THE PAGE OWNS ITS COLUMNS, so the Columns control does not render. Account goes because
           every row belongs to the one account this screen IS. Same call the details page makes. */
        fixedColumns={['account']}
        sessions={sessions}
        total={ids.length}
        displayTimezone={trader.displayTimezone}
        /* EMPTY, and that is the correct argument rather than a missing one: `accounts` feeds the
           tape header's account SELECTOR, a control with no job on a screen that IS one account. */
        accounts={[]}
        selectedAccounts={[]}
        narrowed={narrowed}
        rest={{ ids }}
      />
    </AccountTradesScreen>
  );
}

/** The rows sent with the HTML, matching `/trades` and the details page. */
const FIRST_PAGE = 300;
