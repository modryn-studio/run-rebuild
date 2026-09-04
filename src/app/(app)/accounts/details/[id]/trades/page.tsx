import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireTrader } from '@/lib/trader';
import { getAccount } from '@/lib/accounts/read';
import { getTape, getTapeIds, getFacetRows, getDigest } from '@/lib/trades/read';
import { DEFAULT_RANGE, rangeWindow, readTradesFilter } from '@/lib/trades/filter';
import { sessionDateFor } from '@/lib/time/session';
import { accountRowTitle, accountShortTitle, UNLABELLED_FIRM } from '@/lib/prop-firms';
import { TradesTape } from '@/components/views/trades/trades-tape';
import { TradesRail } from '@/components/views/trades/trades-rail';
import { TradesSearchPill } from '@/components/views/trades/trades-controls';
import { AccountTradesScreen } from '@/components/views/accounts/account-trades-screen';
import { ImportIntoAccountButton } from '@/components/views/accounts/import-into-account';
import { ACCOUNT_TRADES_BAND_HOST } from '@/components/views/accounts/detail-panel-header';

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
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  /* SCOPED BY `trader_id` FROM THE SESSION, NEVER FROM THE REQUEST. `getAccount` puts the trader in
     the WHERE clause, so an id belonging to somebody else returns null and 404s here - it does not
     return a row this page then has to remember to check. */
  const trader = await requireTrader();
  const account = await getAccount(trader.id, id);
  if (!account) notFound();

  /* THE SAME PARSER `/trades` USES, NOT A HAND-ROLLED ONE (2026-08-28, postcheck). This page read
     three params off a typed object and pinned `window` to nulls - so the filter sheet's Date range
     row, which renders unconditionally and commits on tap, wrote `?range=last30` to the URL and
     changed nothing. A dead control that also leaves a lying address. `status` and `types` were
     dead the same way and survived only because the sheet hides those rows when the screen has one
     account, which is an accident of this page rather than a guarantee.
     ONE PARSER MEANS THE WRITER AND THE READER CANNOT DISAGREE, which is the whole reason
     `readTradesFilter` exists and why it also carries the guards - a hand-edited `?from=2026-13-45`
     is dropped here rather than reaching SQL. */
  const requested = readTradesFilter(await searchParams);
  /* THE ACCOUNT IS PINNED LAST, so no `?accounts=` in the URL can widen this screen past the one
     account it is about. */
  const filter = { ...requested, accounts: [account.id] };
  const window = rangeWindow(filter, sessionDateFor(new Date()));

  const [sessions, ids, facetRows, digest] = await Promise.all([
    getTape(trader.id, filter, window, { limit: FIRST_PAGE }),
    getTapeIds(trader.id, filter, window),
    getFacetRows(trader.id, account.id),
    getDigest(trader.id, filter, window),
  ]);

  /* NARROWED MEANS "THE TRADER NARROWED IT", not "the query has a WHERE clause". `isNarrowed` counts
     `accounts.length`, and this screen pins that on every request - so it would answer true
     unconditionally and the empty state could never say "day one". Same derivation the details page
     makes, and for the defect it was written to fix. */
  const narrowed =
    filter.products.length > 0 ||
    filter.results.length > 0 ||
    filter.status.length > 0 ||
    filter.types.length > 0 ||
    filter.range !== DEFAULT_RANGE ||
    filter.from !== null ||
    filter.to !== null ||
    filter.q !== null;

  /* THE OPTIONS ARE COUNTED ON THE WHOLE ACCOUNT, never on the filtered tape: an option that
     vanished because the current filter hid its trades could never be un-picked. */
  /* ALREADY THIS ACCOUNT'S - the read is scoped, so there is nothing left to filter out here. */
  const own = facetRows;
  const products = [...new Set(own.map((r) => r.product))].sort();

  return (
    <AccountTradesScreen
      accountId={account.id}
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
          resultFiltered={filter.results.length === 1}
          ids={ids}
        />
      }
    >
      {/* THE SEARCH ROW PORTALS INTO THE LAYOUT'S BAND, directly under the bar and outside the
          scroller - a row that does not scroll does not belong to the thing that scrolls. It is a
          child here rather than a prop because a Server Component may hand finished JSX to a Client
          Component and may not hand it a builder. */}
      <TradesSearchPill
        hostId={ACCOUNT_TRADES_BAND_HOST}
        applied={filter}
        /* THE ACCOUNT IS PASSED AND LOCKED (2026-08-28, Luke: "it will be locked so user cant add or
           remove. it is just there to show that we are on that account"). This shipped as `[]` on
           the reasoning that an axis which cannot change the set has no job - true of the CONTROL
           and false of the STATEMENT. The sheet's Accounts row now says which account the tape is
           pinned to, as a chip with the firm's mark and no x, and does not drill in. It is also
           what makes the badge's `1` name something rather than being a number with no referent. */
        /* BUILT THE WAY `getFacets` BUILDS ONE, field for field, so the chip here and a chip on
           `/trades` name the same account identically. `firm` + `short` rather than the whole
           title: the chip composes them, and `accountShortTitle` is the half that does not repeat
           the firm the mark beside it already shows. */
        accounts={[
          {
            id: account.id,
            name: accountRowTitle(account),
            firm: account.propFirm ?? UNLABELLED_FIRM,
            short: accountShortTitle(account),
            status: account.status,
            accountType: account.accountType,
          },
        ]}
        lockedAccounts={[account.id]}
        products={products}
        facetRows={own}
      />

      <TradesTape
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
        /* NO `action`: this screen is phone-only and the tape's header row is `max-md:hidden`, so
           a control passed there would render nowhere. The EMPTY STATE is visible at this width,
           and it was a dead end - reachable by a pasted link on an account with no trades, since
           `RecentTrades`' button only appears once there is a row to show. `Empty` drops it on the
           narrowed branch, which is the common case here. Scoped, like every import launched from
           inside this account. */
        emptyAction={<ImportIntoAccountButton accountId={account.id} cta />}
        rest={{ ids }}
      />
    </AccountTradesScreen>
  );
}

/** The rows sent with the HTML, matching `/trades` and the details page. */
const FIRST_PAGE = 300;
