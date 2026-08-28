import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireTrader } from '@/lib/trader';
import { getAccount, getProvenance, countPrefixSiblings } from '@/lib/accounts/read';
import {
  getTape,
  getTapeIds,
  getFacetRows,
  getDailySeriesFor,
  getIntradaySeriesFor,
  getDigest,
} from '@/lib/trades/read';
import { EMPTY_FILTER, type ResultToken } from '@/lib/trades/filter';
import { accountPrefix, accountRowTitle } from '@/lib/prop-firms';
import { AccountDetailView } from '@/components/views/accounts/account-detail-view';
import { AccountRail } from '@/components/views/accounts/account-rail';
import { RecentTrades } from '@/components/views/accounts/recent-trades';
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

export default async function AccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ products?: string; results?: string; q?: string }>;
}) {
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
  /* THE PANEL'S THREE AXES, READ OFF THE URL so a narrowed view survives a refresh and can be sent
     to somebody. Validated on the way in for the same reason `readTradesFilter` validates its own:
     a hand-typed `?results=banana` must not reach SQL as a token.
     NO DATE PARAM. This page's chart carries its own period menu, and a second control saying
     "which days" would be the page arguing with itself. */
  const query = await searchParams;
  const list = (v?: string) => (v ? v.split(',').filter(Boolean) : []);
  const applied = {
    products: list(query.products),
    results: list(query.results).filter((r): r is ResultToken => r === 'win' || r === 'loss'),
    q: query.q?.trim() || null,
  };

  /* ONE FILTER OBJECT, AND EVERY READ BELOW TAKES IT. The tape, the id map and the chart's series
     all narrow through `where()` in `lib/trades/read.ts`, so the line above the rows and the rows
     themselves are incapable of describing different sets. `accounts` is pinned to this page's own
     account and is not something the panel can change. */
  const filter = { ...EMPTY_FILTER, accounts: [account.id], ...applied };
  const window = { from: null, to: null };

  const [days, provenance, sessions, ids, facetRows] = await Promise.all([
    /* THE CHART OBEYS THE FILTER (v2, Luke 2026-08-03: "i dont think that filter changes are
       appling to the chart. just the trade table rows. shouldn't it apply to the chart as well?").
       It should, and in v2 it did not: filtering to MNQ narrowed the tape while the line above it
       still drew every contract, so the page stated two different answers to one question.
       v2 had to fold the filtered series in the BROWSER, because its fee events carry a contract
       where its round trips carry a product, so a filtered SQL aggregate dropped every fee. This
       build's `fee_cents` is a column on the round trip, so the same read narrows correctly in SQL
       and the fold has no reason to exist. */
    getDailySeriesFor(trader.id, filter, window),
    getProvenance(trader.id, account.id),
    getTape(trader.id, filter, window, { limit: FIRST_PAGE }),
    getTapeIds(trader.id, filter, window),
    getFacetRows(trader.id),
  ]);

  /* NARROWED MEANS "THE TRADER NARROWED IT", NOT "THE QUERY HAS A WHERE CLAUSE", and the difference
     is this page's whole shape. `isNarrowed(filter)` counts `accounts.length`, and this page pins
     `accounts` to its own id on every request - so it answered TRUE unconditionally. Two things
     went wrong at once, and both were visible: the rail printed "19 of 19" under a label reading
     "Net P&L, filtered" with nothing filtered, and the tape's empty state could never say "day one"
     because it always believed a filter had hidden the rows.
     Derived from `applied`, which is only ever what came off the URL. The account pin is the page,
     not a choice. */
  const narrowed =
    applied.products.length > 0 || applied.results.length > 0 || applied.q !== null;

  /* THE SIBLING COUNT, for the label form's "apply to your other TDFY accounts" switch. One integer
     rather than the whole roster - see `countPrefixSiblings`. Skipped entirely for a placeholder
     key, which has no prefix and therefore no siblings by construction. */
  const prefix = accountPrefix(account.externalAccountId);
  const siblingCount = prefix ? await countPrefixSiblings(trader.id, prefix, account.id) : 0;

  /* THE RAIL'S RECORD GROUP FOLLOWS THE FILTER, and it reads the SAME aggregate `/trades`' own rail
     does - one `where`, so the rail, the chart and the tape are three views of one query rather
     than three queries about one page. Only fetched when something is narrowing: unfiltered, the
     account's own folded figures are already on hand and a second round trip would buy nothing. */
  const digest = narrowed ? await getDigest(trader.id, filter, window) : null;

  /* THE OPTIONS ARE COUNTED ON THE WHOLE ACCOUNT, never on the filtered tape: an option that
     vanished because the current filter hid its trades could never be un-picked. */
  const own = facetRows.filter((r) => r.accountId === account.id);
  const productOptions = [...new Set(own.map((r) => r.product))]
    .sort()
    .map((value) => ({ value, label: value }));
  const resultOptions = [
    { value: 'win', label: 'Wins' },
    { value: 'loss', label: 'Losses' },
  ];

  /* THE 1-DAY RANGE'S OWN READ, SECOND ON PURPOSE: the session it covers is the last day THIS
     account traded, which is not known until `days` has come back. One extra round trip for one
     range, rather than shipping every trade so the client could find the day itself.
     `lastSession` COMES FROM THE FOLD, not from `account.lastSessionDate` - they agree today, and
     deriving it here keeps them incapable of disagreeing if the fold ever gains a window. */
  const lastSession = days.length > 0 ? days[days.length - 1].day : null;
  const intraday = lastSession ? await getIntradaySeriesFor(trader.id, filter, lastSession) : [];

  return (
    <AccountDetailView
      account={account}
      days={days}
      /* SERIALISED AT THE BOUNDARY. `at` is a `Date` on the server and arrives as a string on the
         client whether or not it is spelled that way — so it is spelled that way. */
      intradayRows={intraday.map((r) => ({ ...r, at: r.at.toISOString() }))}
      zone={trader.displayTimezone}
      hasFees={provenance.hasFees}
      siblingCount={siblingCount}
      filters={{ applied, products: productOptions, results: resultOptions, facetRows: own }}
      rail={
        <AccountRail
          account={account}
          provenance={provenance}
          view={digest ? { trades: digest.trades, netCents: digest.netCents } : null}
        />
      }
      /* FOUR ROWS AND A WAY TO THE REST, on the phone only. The SAME rows the tape is built from -
         one query, one order, so the short list and the long one can never disagree about what the
         most recent trade was. */
      recent={
        <RecentTrades
          trades={sessions.flatMap((d) => d.trades)}
          zone={trader.displayTimezone}
          allHref={`/accounts/details/${account.id}/trades`}
        />
      }
      tape={
        <TradesTape
          /* THE CARD NAMES ITSELF HERE AND NOT ON `/trades`, because there the shell's band already
             says the word and here it says the account. v2's `TradesCard` carries the same title on
             the same page for the same reason. */
          title="Trades"
          hasFees={provenance.hasFees}
          /* THE PAGE OWNS ITS COLUMNS, so the Columns control does not render. Account goes because
             every row belongs to the one account this page IS, and saying so on each row is noise
             (v2's `TradesCard` makes the same call). Time stays, always: that leaves one toggle,
             and a menu of one is not worth a control (Luke, 2026-08-27).
             The trader's own stored choice on `/trades` is neither read nor written here. */
          fixedColumns={['account']}
          sessions={sessions}
          total={ids.length}
          displayTimezone={trader.displayTimezone}
          /* EMPTY, AND THAT IS THE CORRECT ARGUMENT RATHER THAN A MISSING ONE. `accounts` feeds the
             tape header's account SELECTOR, which exists to switch between accounts - a control
             with no job on a page that IS one account. `AccountSelect` already renders nothing below
             two accounts, so this states the same thing the page means. */
          accounts={[]}
          selectedAccounts={[]}
          /* WHICH EMPTY STATE IS HONEST: "day one" or "the filter matched nothing". `isNarrowed`
             is the same predicate `/trades` uses, so the two pages cannot disagree about what
             counts as narrowed. */
          narrowed={narrowed}
          rest={{ ids }}
        />
      }
    />
  );
}

/** The rows sent with the HTML, matching `/trades`. Five windows of runway before the first fetch. */
const FIRST_PAGE = 300;
