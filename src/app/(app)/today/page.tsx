import type { Metadata } from 'next';
import { requireTrader, getSessionUser } from '@/lib/trader';
import { PAGE_COLUMN } from '@/lib/shell';
import { SESSION_BOUNDARY_ZONE } from '@/lib/time/session';
import { cn } from '@/lib/cn';
import { getDailySeries, getIntradaySeries, getRoster } from '@/lib/accounts/read';
import { toFacetAccount, getTape } from '@/lib/trades/read';
import { accountLabel } from '@/lib/prop-firms';
import { readTradesFilter, EMPTY_FILTER } from '@/lib/trades/filter';
import { cumulate, foldIntraday, sizeBase } from '@/lib/accounts/series';
import { sessionWindow } from '@/lib/time/session';
import { NetPnl } from '@/components/views/today/net-pnl';
import { LastSession } from '@/components/views/today/last-session';
import { Greeting } from '@/components/views/today/greeting';
import { TodayHeader } from '@/components/views/today/today-header';

export const metadata: Metadata = { title: 'Today' };

/* HOW MANY ROWS `Last session` DRAWS, and it is the page's number because the page is what asks the
   database for them. Five (Luke, 2026-09-04). The card slices to the same count for its own render;
   fetching six to draw five would be a row nothing has a use for. */
const LAST_SESSION_ROWS = 5;

/* TODAY - the front door (`S8`, `wireframes.md` §5).
 *
 * "Where do I stand right now", and since `spec.md` §4 was amended on 2026-08-31 it is the ONLY
 * front door: `Read` came out of the nav and the daily read ships here as a card, which is where
 * the reference keeps its own recap.
 *
 * ─── THE GRID IS THE REFERENCE'S, READ OUT OF ITS MARKUP ───────────────────────────────
 *
 * Monarch's dashboard is `Row > Column > Column > Card`, two columns above `lg` and one below, with
 * each widget draggable inside its column. This ships the two columns and not the dragging: reorder
 * is a real feature (`useListDrag` already does it for the roster) and it is a feature of a page
 * that has enough widgets to reorder. One widget cannot be rearranged.
 *
 * ─── THE GREETING IS BACK, AND IT IS THE ORIGINAL CODE ──────────────────────────────────
 *
 * Adopted 2026-08-31, cut 2026-09-01, **RESTORED 2026-09-03** (Luke: *"we did have the greeting in
 * the header like monarch does it. that was a fully coded implementation... we need it back and it
 * needs to be the code we had before because i did research to find out exactly how to code the
 * greeting to make it work properly."*).
 *
 * RECOVERED WITH `git show`, NOT RETYPED, and that is the whole point of the instruction. The old
 * comment on this file argued the deletion was safe because *"a helper kept for its comments is
 * dead code with a story attached"* - which was true about the code and wrong about the value.
 * `hourIn` below carries three separate `Intl` failure modes, each MEASURED on this runtime rather
 * than recalled: `format()` returning `"00 Uhr"` in de-DE (so `Number()` gives `NaN`, so the
 * greeting reads "evening" permanently), `hour12: false` resolving to an implementation-defined
 * cycle that has already changed once between engines, and `RangeError` from an IANA zone that
 * stops resolving after a runtime update - a 500 on the front door, months later, for a salutation.
 * Re-deriving that from scratch is how one of the three comes back.
 *
 * SO THE SHELL'S `SELF_TITLED` SET CAME BACK TOO, and `/today` is again the one route that renders
 * no route title. Without it the band prints both the greeting and the word `Today`.
 *
 * ─── WHAT IS HERE AND WHAT IS NOT ────────────────────────────────────────────
 *
 * TWO CARDS AS OF 2026-09-04, and the second is `Last session` (`§A11`). It ships on the reads
 * `/trades` already owns, adds no schema, and needs no locked-doc amendment - the same three tests
 * card 1 passed. `monarch-dashboard-teardown.md` §3.9 carries WHY Run has it, which is the one
 * question that section was missing: their `Transactions` widget is an action queue for a chore Run
 * deleted, so this card inherits the placement and none of the purpose. Run's reason is that it is
 * the PROOF under card 1's figure - the only place on the front door showing the actual rows a
 * trader would recognise from their broker - and the place they would catch that an import is wrong.
 *
 * ONE CARD, `Net P&L`, AS OF 2026-09-03 - the first of the six the teardown's §8 settled
 * (`docs/monarch-dashboard-teardown.md` §A7). It is first because it is the only one of the six
 * that needs no new data and no locked-doc amendment: `getDailySeries` already exists, and the card
 * is what builds the grid and the picker vocabulary the other five inherit.
 *
 * `Your Daily Recap` WAS BUILT FIRST AND IS NOT HERE. It rendered a fixture the whole time, the
 * nightly job that would feed it is not shipping in the beta (Luke: "do not implement the nightly
 * job wired to the reading"), and on 2026-09-03 the card itself was reset to a blank sheet: *"i
 * want you to forget everything we have created for this and start from scratch."* The component
 * still compiles and still renders in `/kitchen-sink`, but it has no design authority any more, so
 * it is not one line away from coming back - it is a design session away. `§A3`.
 *
 * `/read` IS NO LONGER A 404 (2026-09-03) - it is a placeholder that says what is coming.
 *
 * ─── THE WAIT IS A SKELETON, AND `loading.tsx` BESIDE THIS FILE IS THE HOUSE ANSWER ──────────
 *
 * Settled 2026-09-03 for EVERY card this page will hold, not just the first, because a dashboard
 * whose cards wait in different shapes is a dashboard that flickers in six ways. `design-system.md`
 * §7 asks one question - do you know the SHAPE of what is arriving? - and on `/today` the answer is
 * always yes: a widget's geometry is fixed by `Widget` before any data exists. So: `Skeleton`, in a
 * boundary that occupies the page's own boxes. Not a spinner (buttons only), not the wordmark (a
 * cold entry into the app, which a tab-to-tab move inside a mounted shell is not).
 *
 * ─── THE ACCOUNT SCOPE IS THE PAGE'S, NOT A CARD'S (2026-09-03) ──────────────
 *
 * `?accounts=<uuid>` narrows the fold before any card sees it, so every widget on this page
 * describes the same set of accounts. A per-card picker would let three cards disagree about what
 * "your accounts" means, which is the fault v2 shipped as a rail reading `+$954.99` under a chart
 * reading `-$26,995.06`. `views/today/today-header.tsx` holds the control and the reasoning;
 * `monarch-dashboard-teardown.md` §A8 holds what is still deferred.
 *
 * READ THROUGH `readTradesFilter`, NOT PARSED HERE. That module already guards `accounts` against
 * `isUuid` - and it guards it because the unguarded version was a live 500: `trade.account_id` is a
 * `uuid` column, so `?accounts=x` made Postgres answer *"invalid input syntax for type uuid"*, the
 * Server Component throw, and the trader meet Next's bare error screen with no `error.tsx` under
 * `src/app` to soften it. A second parser here would be a second chance to omit that check.
 *
 * ─── WHY THE FOLD HAPPENS HERE AND NOT IN THE CARD ───────────────────────────
 *
 * `/accounts` folds its series inside `AccountsView` because that page also draws a line PER
 * ACCOUNT and a scope chip row that re-narrows the set - the fold has to move when the chips do.
 * This page draws one total and has no chips, so the fold is a server concern: it keeps the roster
 * off the wire, and `Point` is `{ day, cents }`, which crosses the RSC boundary as itself with no
 * `Date` to revive.
 */
export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const trader = await requireTrader();
  const user = await getSessionUser();
  const scope = readTradesFilter(await searchParams).accounts;

  /* IN PARALLEL, and the roster is not optional decoration: it decides WHICH accounts the total
     counts, which is the same rule `/accounts` applies (*"the chart counts what the totals
     count"*). It is also the read `Accounts`, the third card, is already specced against. */
  const [accounts, days] = await Promise.all([getRoster(trader.id), getDailySeries(trader.id)]);

  /* AN ACCOUNT SWITCHED OUT OF TOTALS IS OUT OF THIS FIGURE TOO. v2 shipped the other way and its
     rail read +$954.99 under a chart reading -$26,995.06. `hidden` is NOT a filter here: hiding
     takes a row off the roster and keeps it in the arithmetic, which is the whole difference
     between the two switches. */
  const counted = accounts.filter(
    /* THE SCOPE NARROWS BEFORE THE EXCLUSION, and both narrow before the fold. An account the
       trader has switched out of totals stays out even when it is the one they scoped TO - the
       switch is a statement about the arithmetic and the scope is a statement about attention, so
       the arithmetic wins. The card's own `allExcluded` state is what says so out loud. */
    (a) => !a.excludedFromTotals && (scope.length === 0 || scope.includes(a.id))
  );
  const countedIds = new Set(counted.map((a) => a.id));

  /* ONE BUCKET PER SESSION, SUMMED ACROSS ACCOUNTS, THEN CUMULATED. `getDailySeries` returns
     `(account, day)` rows already ordered by day, so the `Map`'s insertion order IS date order and
     `cumulate` gets what it needs without a sort. */
  const byDay = new Map<string, number>();
  for (const d of days) {
    if (!countedIds.has(d.accountId)) continue;
    byDay.set(d.day, (byDay.get(d.day) ?? 0) + d.cents);
  }
  const series = cumulate([...byDay.entries()].map(([day, cents]) => ({ day, cents })));

  /* THE SCOPED ACCOUNT'S NAME, or null. Composed through `toFacetAccount` AND `accountLabel`, so
     the card's trailing clause, the desktop menu's trigger and the phone sheet's ticked row are
     three renderings of one string rather than three chances to disagree.
     THAT SENTENCE WAS A CLAIM AND IS NOW A FACT (2026-09-03). It was written while this line joined
     the halves inline - a third copy of a formula the other two already had, and the only one of the
     three missing the `.trim()`. A rule asserted in prose is a rule nothing enforces; `accountLabel`
     in `lib/prop-firms.ts` is the enforcement, beside the two functions that build its halves.
     EXACTLY ONE, because that is the only case where a name is the useful fact: the filter panel
     on `/trades` can hold two, and "2 of 10 accounts" is a count question again. */
  const scoped = scope.length === 1 ? counted.find((a) => a.id === scope[0]) : undefined;
  const scopeName = scoped ? accountLabel(toFacetAccount(scoped)) : null;

  /* THE 1-DAY RANGE'S OWN READ, AND IT IS SECOND ON PURPOSE - the same shape `/accounts/page.tsx`
     takes, for the same reason its comment gives: the session it covers is the last day anything
     traded, which is not known until the daily fold has come back. One extra round trip for one
     range, rather than shipping every trade the trader has ever made so the client could find the
     day itself.
     `endsOn` COMES FROM THE COUNTED SERIES, not from `days`. A roster whose only recent trading is
     on an account switched out of totals would otherwise ask for a session this card draws nothing
     in - a 1-day chart that is empty for a reason the trader cannot see.
     FOLDED HERE rather than in the card, like the daily series: `/accounts` folds on the client
     because its chips re-narrow the set, and this page has no chips. */
  const endsOn = series.length > 0 ? series[series.length - 1].day : null;
  const intradayRows = endsOn ? await getIntradaySeries(trader.id, endsOn) : [];
  const intraday = endsOn
    ? foldIntraday(
        /* SCOPED BEFORE FOLDING, exactly as `byDay` is above. Folding first and filtering after
           would leave an excluded account's trades in the total, which is the
           chart-disagrees-with-the-rail defect arrived at through a different door. */
        intradayRows.filter((r) => countedIds.has(r.accountId)),
        sessionWindow(endsOn)
      ).total
    : [];

  /* ─── CARD 2'S SESSION, AND IT COSTS ONE QUERY BECAUSE CARD 1 ALREADY PAID FOR THE DATE ──────
   *
   * `endsOn` IS THE WHOLE TRICK. It is the newest day in the COUNTED series - the same value the
   * `1d` range is drawn from - so "the newest session that has trades in it" is already known by the
   * time this runs, and this card needs no round trip to find its own subject.
   *
   * IT IS NEVER "TODAY", which is the re-entry rule and not a convenience (§7 Q2, confirmed by Luke
   * 2026-09-04). Scoping to the current date would draw an empty card every Monday morning and every
   * day the trader did not trade, which is a state representing absence.
   *
   * SCOPED TO `countedIds`, NOT TO `scope`, and the two differ whenever an account is switched out
   * of totals. Card 1's figure counts exactly these accounts, so a row list built from a wider set
   * would put trades under a headline that does not include them - the chart-disagrees-with-the-rail
   * defect, arrived at through a third door.
   *
   * `limit: SHOWN + 1` WOULD BE WRONG AND `limit: 5` IS NOT AN UNDERCOUNT. `getTape` totals a
   * session in SQL over the whole `where` rather than folding the rows it returns - its own comment
   * says why: "a header built from a truncated session would state a total for trades it cannot
   * see". So the figure, the count and the win rate are the session's real ones at any limit. Five
   * is what the card draws, and there is no "and N more" line that would need a sixth. */
  const session =
    endsOn === null
      ? null
      : ((
          await getTape(
            trader.id,
            { ...EMPTY_FILTER, accounts: [...countedIds] },
            { from: endsOn, to: endsOn },
            { limit: LAST_SESSION_ROWS }
          )
        )[0] ?? null);

  /* ─── THE LINK OUT: THE SESSION'S DATE, AND THE TRADER'S OWN SCOPE. NOT THE COUNTED SET ──────
   *
   * THE FIRST BUILD SENT `counted` AND THE LIVE PAGE SHOWED WHY THAT WAS WRONG. On the real roster -
   * 11 accounts, 9 counted - it composed a **451-character URL carrying nine uuids**, which is a
   * link that reads as heavily filtered while filtering almost nothing. That was the visible half of
   * the mistake. The doctrinal half is worse.
   *
   * EXCLUSION IS A TOTALS DECISION AND `/trades` IS THE RECORD. `excluded_from_totals` takes an
   * account out of the arithmetic; it does not take its trades out of existence, and `CLAUDE.md` is
   * explicit that **an exclusion may never silently shrink the record**. A link that narrowed the
   * tape by the totals switch would do exactly that - the trader would open the session and find
   * trades missing, with nothing on screen saying why. The card's `7 trades` and the tape's rows are
   * answers to two different questions and are allowed to differ; hiding the difference is the bug,
   * not the difference.
   *
   * SO THIS PASSES THROUGH `scope` AND NOTHING ELSE - the param the band itself wrote, unchanged.
   * The URL is short, it says only what the trader asked for, and `§A8`'s open question (does the
   * band's scope follow a link out of this page?) stays Luke's to settle rather than being answered
   * by a side effect of this card. */
  const sessionHref = endsOn
    ? `/trades?${new URLSearchParams([
        ['from', endsOn],
        ['to', endsOn],
        ...scope.map((id) => ['accounts', id] as [string, string]),
      ])}`
    : '/trades';

  return (
    <div className={cn(PAGE_COLUMN, 'pb-8')}>
      {/* INTO THE HEADER BAND, where the route title would be. See `greeting.tsx`. */}
      <Greeting text={greetingFor(user?.name ?? null, trader.displayTimezone)} />

      {/* AND INTO THE BAND'S CONTROLS CELL, beside it.
          TWO FILTERS, ONE RULE: **a control over a figure may not offer an option that cannot be
          in it.** An account with no trades resolves to an empty chart under a picker implying
          there was something in it - and an account EXCLUDED FROM TOTALS cannot be in a figure
          made of totals, so it resolves to the same dead end by a different door.
          THE SECOND HALF WAS MISSING FOR A DAY (2026-09-03). Luke found it by probing the first:
          *"why does the /today page not show the 1 personal account with no activity?"* - which is
          the no-trades filter working, and asking the question exposed that the identical argument
          had not been applied to exclusion. Verified before the fix:
          `/today?accounts=<an excluded account>` rendered *"Every account is left out of totals"*,
          an honest message under a control that had just offered the option guaranteeing it.
          `a.trades > 0` STAYS (Luke: *"keep no-activity accounts filtered out"*). `/accounts` is
          where a trader checks whether an import landed, and the roster shows those rows there
          with a count of zero. */}
      <TodayHeader
        accounts={accounts
          .filter((a) => a.trades > 0 && !a.excludedFromTotals)
          .map(toFacetAccount)}
        selected={scope}
      />

      {/* TWO COLUMNS ABOVE `lg`, ONE BELOW - the reference's own breakpoint. `items-start` so a
          short widget does not stretch to match a tall one beside it, which is what makes a
          dashboard read as a set of cards rather than a table.
          `pt-4` NO LONGER SITS UNDER A PORTALLED GREETING, so it is the page's own top gutter and
          matches what `/accounts` and `/trades` put between the band and their first card. */}
      <div className="grid grid-cols-1 items-start gap-4 pt-4 lg:grid-cols-2">
        <NetPnl
          series={series}
          intradaySeries={intraday}
          counted={counted.length}
          scopeName={scopeName}
          /* WHETHER ANY COUNTABLE TRADE EXISTS AT ALL, which is NOT `series.length > 0`: switching
             every account out of totals empties the fold, and a card reading that as "nothing
             imported" would tell a trader holding a year of tape to go upload a file. `days` is
             already `COUNTABLE`-filtered, so this is exactly "Run holds a trade". */
          imported={days.length > 0}
          /* NULL THE MOMENT ONE COUNTED ACCOUNT IS UNSIZED, so the delta prints no percentage
             rather than a confident wrong one. Computed over the same set the series was folded
             from, or the numerator and the denominator would describe different accounts. */
          baseDollars={sizeBase(counted)}
          zone={trader.displayTimezone}
        />
        <LastSession
          session={session}
          href={sessionHref}
          counted={counted.length}
          imported={days.length > 0}
          zone={trader.displayTimezone}
        />
        {/* The remaining four land here in build order - §A7. */}
      </div>
    </div>
  );
}

/* THE TIME-OF-DAY GREETING. `wireframes.md` §5: "both Monarch and TradeZella do it; it's a
 * convention, adopt it."
 *
 * IN THE TRADER'S OWN ZONE, and this is the one place `display_timezone` is unambiguously correct
 * to read: "good afternoon" is a fact about the person, not about the market. `CLAUDE.md`'s rule is
 * that the zone is DISPLAY ONLY and must never reach the bucketing code, and a greeting is display
 * in the purest sense - nothing downstream of it is a number.
 *
 * THE NAME IS OPTIONAL BECAUSE IT IS NULLABLE. Google supplies one and the emailed-code path does
 * not (`schema.ts`), so half the traders who sign up have no name to greet. "Good afternoon" alone
 * is a complete sentence; "Good afternoon, null" is the bug that ships when a nullable column is
 * treated as a string.
 *
 * A STRING, NOT A COMPONENT. It is rendered by a portal into the shell's band, and the portal has
 * to be a client component; the hour has to come from a database column the shell does not carry.
 * So the server computes the sentence and hands it over finished, which is also what stops the HTML
 * and the hydrated tree disagreeing about what time it is.
 */
function greetingFor(name: string | null, zone: string): string {
  const hour = hourIn(zone);
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  /* FIRST NAME ONLY. The provider hands over whatever the trader typed into Google, which is a full
     name more often than not, and "Good afternoon, Luke Hanner" is a form letter. */
  const first = name?.trim().split(/\s+/)[0];
  return `Good ${part}${first ? `, ${first}` : ''}`;
}

/* THE HOUR, 0-23, AND THREE WAYS THE OBVIOUS SPELLING BREAKS.
 *
 * The first version was `Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false,
 * timeZone: zone }).format(new Date()))`. Each of the three changes below has a reason, and one of
 * them is smaller than it first looked - recorded that way rather than tidied, because the next
 * reader deserves to know which of these is a live bug and which is defence.
 *
 * ─── 1. `hourCycle: 'h23'` — DEFENCE, NOT A FIX (checked, 2026-08-31) ──────────────────────────
 *
 * `hour12: false` does not name a cycle; it lets the implementation resolve one, and the two have
 * historically disagreed - SpiderMonkey resolving `h23` while V8 resolved `h24`, under which
 * MIDNIGHT FORMATS AS "24". That would have made `24 < 12` false, `24 < 17` false, and told a
 * trader "good evening" at 00:30.
 *
 * **It does not reproduce here.** Run on this runtime (Node 22.19, ICU 77) across eight locales,
 * `hour12: false` resolves to `h23` in every one and midnight formats "00". So this was not a
 * shipped bug and the comment does not get to claim it was. `hourCycle: 'h23'` stays because it
 * STATES the cycle rather than relying on a resolution that is implementation-defined and has
 * already changed once. https://github.com/tc39/ecma402/issues/402
 *
 * ─── 2. `formatToParts`, NOT `format` — THIS ONE IS REAL ──────────────────────────────────────
 *
 * `format()` returns a string for human eyes and decorates it per locale. Measured on this runtime,
 * same options, one field requested:
 *
 *     de-DE  "00 Uhr"      fr-FR  "00 h"      ja-JP  "0時"      ko-KR  "0시"
 *
 * `Number("00 Uhr")` is `NaN`, and `NaN < 12` and `NaN < 17` are both false - so the greeting would
 * read **evening, permanently**. The old code was safe only because it pinned `'en-US'`, which is a
 * locale hardcoded to protect a numeric parse rather than to serve a reader. `formatToParts` hands
 * the hour back as DATA, so the parse cannot be broken by a decoration.
 *
 * ─── 3. AN UNKNOWN ZONE THROWS, ON A RENDER PATH ──────────────────────────────────────────────
 *
 * `Intl.DateTimeFormat` throws `RangeError` on a zone it cannot resolve (confirmed). `trader.ts`
 * validates on WRITE - `isKnownTimezone` asks `Intl` rather than matching a pattern - so a bad zone
 * cannot be stored today. But the IANA database renames and merges zones, so a row written this
 * year can stop resolving after a runtime update, and the failure would be a 500 on the front door
 * months later, for a greeting.
 *
 * IT FALLS BACK TO THE MARKET ZONE, which is the answer `trader.ts` already gives for a zone that
 * was never detected: "the least-wrong clock to show a futures trader is the one their sessions are
 * cut in, never a clock nobody trades on." */
function hourIn(zone: string): number {
  for (const z of [zone, SESSION_BOUNDARY_ZONE]) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hourCycle: 'h23',
        timeZone: z,
      }).formatToParts(new Date());
      const h = Number(parts.find((p) => p.type === 'hour')?.value);
      if (Number.isInteger(h) && h >= 0 && h <= 23) return h;
    } catch {
      // Falls through to the market zone, then to noon.
    }
  }
  /* UNREACHABLE unless `America/Chicago` stops resolving, which would mean the runtime has no time
     zone data at all. Noon rather than 0: if the clock is unknowable, the least-wrong greeting is
     the one that is right for the longest stretch of a trading day. */
  return 12;
}
