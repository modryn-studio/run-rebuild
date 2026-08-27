import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireTrader } from '@/lib/trader';
import {
  getAccount,
  getDailySeries,
  getIntradaySeries,
  getProvenance,
} from '@/lib/accounts/read';
import { getTape, getTapeIds } from '@/lib/trades/read';
import { EMPTY_FILTER } from '@/lib/trades/filter';
import { accountRowTitle } from '@/lib/prop-firms';
import { AccountDetailView } from '@/components/views/accounts/account-detail-view';
import { AccountRail } from '@/components/views/accounts/account-rail';
import { TradesTape } from '@/components/views/trades/trades-tape';

/* ONE ACCOUNT'S OWN PAGE (`S6d`), reached by tapping a roster row.
 *
 * IT CLOSES A HOLE RATHER THAN ADDING A FEATURE. `S6b` shipped the roster with every row wrapped in
 * `<Link href={`/accounts/details/${id}`}>` and this route did not exist, so the primary interaction
 * of `/accounts` returned a 404 - measured 2026-08-27, before this file. The roster has been a list
 * of dead links since it shipped.
 *
 * `/accounts/details/<id>` RATHER THAN `/accounts/<id>`, matching `run-trading@v2`'s shape at Luke's
 * request. The segment costs nothing and it keeps `/accounts/<word>` free: `/accounts/new` would
 * otherwise be ambiguous with an account whose id happened to be "new".
 *
 * THE LAYOUT IS `SubjectPage`, NOT THIS FILE. v2 wrote it inline, which was right while this was the
 * only page with the shape and wrong the moment a second was planned. What is left here is the part
 * that is genuinely about an account: the queries, the authorization, and which header and rail to
 * hand over. See `subject-page.tsx`.
 *
 * THE CHART IS THE ROSTER'S CARD, REUSED, with the provider handed one account instead of all of
 * them - which is the whole reason the chart's controls live in `ChartViewProvider`. Scoping is a
 * prop, so this page gets the period menu, the cumulative/breakdown switch and the 1-day crosshair
 * without a second implementation of any of it.
 *
 * ─── WHAT IS NOT HERE YET, AND IN WHICH COMMIT ────────────────────────────────────────────────
 * C2: the Filters dropdown (products, results, search) and the chart obeying it.
 * C3: Edit - `LabelAccountForm`, `FirmPicker`, `AccountFields` and the `/api/accounts` write path.
 * Close, Delete and "Set the line" are OUT of this slice by decision, not by omission.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const trader = await requireTrader();
  const account = await getAccount(trader.id, id);
  /* THE TAB SAYS WHICH ACCOUNT, because a trader comparing two of them has two tabs open and
     "Account" twice tells them nothing. Falls back rather than 404ing here - the page body below
     owns that answer, and a metadata function that threw would turn a clean not-found into an
     error. */
  return { title: account ? accountRowTitle(account) : 'Account' };
}

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  /* SCOPED BY `trader_id` FROM THE SESSION, NEVER FROM THE REQUEST. `getAccount` puts the trader in
     the `where`, so another trader's id comes back empty rather than coming back. Without that this
     route is an id-guessing oracle over somebody else's trading. */
  const trader = await requireTrader();
  const account = await getAccount(trader.id, id);

  /* A 404, AND THE SAME 404 FOR BOTH CAUSES. An id that never existed and an id belonging to
     somebody else must read identically from out here: a "forbidden" that appeared only for real
     ids would confirm which ids are real. `getAccount` returns null for both, and for a string that
     is not a uuid at all, so a hand-typed URL lands here too rather than throwing from the driver. */
  if (!account) notFound();

  /* EVERY READ ON THIS PAGE IS SCOPED TO THIS ACCOUNT IN SQL, not narrowed after the fact. The
     roster reads all accounts because it draws all accounts; a page about one that pulled the whole
     corpus and filtered in memory would be the shape CLAUDE.md calls "unretrofittable once four
     surfaces depend on it". `trade_account_session_idx` is on `(account_id, session_date)`, which
     is exactly this access pattern. */
  const filter = { ...EMPTY_FILTER, accounts: [account.id] };
  const window = { from: null, to: null };

  const [days, provenance, sessions, ids] = await Promise.all([
    getDailySeries(trader.id, { accountId: account.id }),
    getProvenance(trader.id, account.id),
    getTape(trader.id, filter, window, { limit: FIRST_PAGE }),
    getTapeIds(trader.id, filter, window),
  ]);

  /* THE 1-DAY RANGE'S OWN READ, SECOND ON PURPOSE: the session it covers is the last day THIS
     account traded, which is not known until `days` has come back. One extra round trip for one
     range, rather than shipping every trade so the client could find the day itself.
     `lastSession` COMES FROM THE FOLD, not from `account.lastSessionDate` - they agree today, and
     deriving it here keeps them incapable of disagreeing if the fold ever gains a window. */
  const lastSession = days.length > 0 ? days[days.length - 1].day : null;
  const intraday = lastSession
    ? await getIntradaySeries(trader.id, lastSession, account.id)
    : [];

  return (
    <AccountDetailView
      account={account}
      days={days}
      /* SERIALISED AT THE BOUNDARY. `at` is a `Date` on the server and arrives as a string on the
         client whether or not it is spelled that way — so it is spelled that way. */
      intradayRows={intraday.map((r) => ({ ...r, at: r.at.toISOString() }))}
      zone={trader.displayTimezone}
      hasFees={provenance.hasFees}
      rail={<AccountRail account={account} provenance={provenance} />}
      tape={
        <TradesTape
          /* THE CARD NAMES ITSELF HERE AND NOT ON `/trades`, because there the shell's band already
             says the word and here it says the account. v2's `TradesCard` carries the same title on
             the same page for the same reason. */
          title="Trades"
          hasFees={provenance.hasFees}
          /* EVERY ROW BELONGS TO THIS ACCOUNT, so saying so on each one is noise - v2's
             `TradesCard` makes the same call on the same page. It is a fact about the page, not a
             preference: the trader's own stored column choice on `/trades` is untouched. */
          showAccount={false}
          sessions={sessions}
          total={ids.length}
          displayTimezone={trader.displayTimezone}
          /* EMPTY, AND THAT IS THE CORRECT ARGUMENT RATHER THAN A MISSING ONE. `accounts` feeds the
             tape header's account SELECTOR, which exists to switch between accounts - a control
             with no job on a page that IS one account. `AccountSelect` already renders nothing below
             two accounts, so this states the same thing the page means. */
          accounts={[]}
          selectedAccounts={[]}
          /* NOTHING IS NARROWING YET, so an empty tape here means "day one" rather than "the filter
             matched nothing" - which is the distinction the empty state turns on. C2's filter is
             what makes this ever true. */
          narrowed={false}
          rest={{ ids }}
        />
      }
    />
  );
}

/** The rows sent with the HTML, matching `/trades`. Five windows of runway before the first fetch. */
const FIRST_PAGE = 300;
