/* THE DETAILS PAGE'S RIGHT RAIL: what this account IS, and where its numbers came from.
 *
 * TWO CARDS, ported from `run-trading@v2` (`account-rail.tsx`), which took the shape from the
 * reference's Summary + Connection status and re-aimed the second one. Theirs reports a live bank
 * connection - last update, status, data provider. Run has no live broker socket yet; every account
 * here arrived as a CSV. So the slot keeps its job, "where did this data come from and how current
 * is it", and tells the truth about the answer: an import history. It becomes the sync card when
 * the vendor connection lands, without moving.
 *
 * A SERVER COMPONENT. It only reads and formats, so it ships no JS - which is why the one row that
 * opens a modal will be its own client island (`edit-account-link.tsx`) rather than a `'use client'`
 * at the top of this file.
 *
 * ─── THREE OF v2'S ROWS ARE NOT HERE, AND EACH FOR A DECIDED REASON ────────────────────────────
 *
 * `Daily loss line` — the column is CUT (`s6-plan.md` D2). It was dead in v2 too: nothing ever read
 *   `daily_line_cents`, v2 files that as its own issue, and `psychology.md` puts the armed-line
 *   ritual in a later slice. Luke confirmed the cut again on 2026-08-27 while scoping this page.
 *   It was v2's only actionable rail row, so this rail carries no accent until Edit lands.
 *
 * `Fills` — this build has no fill projection on a render path, by rule. `trades` is the unit the
 *   rest of the product speaks in and the one the tape below this rail counts, so a second, larger
 *   number beside it would raise a question the page cannot answer.
 *
 * `Fees on open positions` — v2 reads it off a fee allocation over the raw event log. Nothing may
 *   read `event.payload` on a render path here, and the `trade` projection stores ALLOCATED fees
 *   only, so the unallocated remainder is not a column yet. Deliberately ABSENT rather than
 *   approximated: it is the one number on v2's page that admits a gap, and a wrong one is worse
 *   than none.
 */

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/icon';
import { StatusChip } from './roster-card';
import { ImportIntoAccount } from './import-into-account';
import { fmtMoney } from '@/lib/format';
import { displayDayRange, displayDayShort } from '@/lib/time/session';
import {
  ACCOUNT_TYPE_LABELS,
  findPropFirm,
  isPersonalFirm,
  isPlaceholderAccountName,
  placeholderAccountTitle,
  sizeLabel,
} from '@/lib/prop-firms';
import type { Provenance, RosterAccount } from '@/lib/accounts/read';

export function AccountRail({
  account,
  provenance,
  view,
}: {
  account: RosterAccount;
  provenance: Provenance;
  /* WHAT THE PAGE IS CURRENTLY SHOWING, when that is not the whole account (2026-08-27, Luke:
     "make the rail follow the filter too").
     ONLY THE RECORD GROUP MOVES. Identity and terms - broker, firm, type, size, status, the
     account's own number - are facts about the ACCOUNT and cannot be narrowed by a filter; a rail
     that hid the firm because the trader ticked Wins would be answering a question nobody asked.
     What CAN be narrowed is the record: how many trades and what they made.
     WHY IT MOVES AT ALL, and this is the whole reason: before this, ticking Wins left the rail
     reading `Net P&L +$521.60` beside a chart headline reading `$907.96` - one page, one label,
     300px apart, two numbers. That is the defect `chart-view.tsx` exists to prevent and the one v2
     shipped in the other direction. Null when nothing is narrowing. */
  view: { trades: number; netCents: number } | null;
}) {
  const firm = account.propFirm ? findPropFirm(account.propFirm) : undefined;
  const manual = isPlaceholderAccountName(account.externalAccountId);

  return (
    <div className="flex flex-col gap-4">
      <Card className={RAIL_CARD}>
        <RailHead>Summary</RailHead>
        <dl className="border-rule border-t pb-2 max-md:pb-1">
          {/* BROKER AND FIRM ARE TWO DIFFERENT FACTS, and collapsing them was a real bug in v2
              (Luke, 2026-07-31: "the summary card says Firm: Personal. the firm is tradovate").
              That row read `propFirm`, which stores the literal `Personal` sentinel for a personal
              account - so the page named a prop firm that does not exist and dropped the one it did
              know. The broker is always there; a prop firm sits ABOVE it and only some accounts
              have one. */}
          <Line label="Broker">
            <span className="text-text">{brokerName(account.platform)}</span>
          </Line>
          {isPersonalFirm(account.propFirm) ? null : (
            <Line label="Firm">
              {account.propFirm ? (
                <span className="text-text">{account.propFirm}</span>
              ) : (
                <span className="text-muted">Not named yet</span>
              )}
            </Line>
          )}
          {firm && (
            <Line label="Website">
              {/* `noopener noreferrer` because this opens a third-party site in a new tab: without
                  `noopener` that page gets a handle on this one through `window.opener`. The mark
                  says it is leaving Run, which a bare link does not. */}
              <a
                href={`https://${firm.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link inline-flex items-center gap-1"
              >
                {firm.domain}
                <Icon name="external" size={13} className="shrink-0" />
              </a>
            </Line>
          )}

          <Group />

          <Line label="Type">
            {account.accountType ? (
              <span className="text-text">{ACCOUNT_TYPE_LABELS[account.accountType]}</span>
            ) : (
              <span className="text-muted">Not stated</span>
            )}
          </Line>
          {account.sizeDollars !== null && (
            <Line label="Size">
              <span className="text-text">{sizeLabel(account.sizeDollars)}</span>
            </Line>
          )}
          {account.productName && (
            <Line label="Product">
              <span className="text-text">{account.productName}</span>
            </Line>
          )}
          <Line label="Status">
            <StatusChip status={account.status} />
          </Line>
          {/* Only on a closed account, and it is the fact the chip cannot carry: WHEN. A trader
              looking back at a failed evaluation wants the date more than the word. */}
          {account.closedOn && (
            <Line label="Closed">
              <span className="text-text">{displayDayShort(account.closedOn)}</span>
            </Line>
          )}

          <Group />

          {/* STACKED, unlike every other row here, because a 24-character identifier in a 304px rail
              beside its own label had nowhere to go: `break-all` split it mid-number across two
              lines, and this is the one string on the page a trader reads digit by digit against
              what Tradovate shows them. Given the full width it fits on one line. */}
          <div className="px-5 py-1.5">
            <dt className="text-body text-muted">Account</dt>
            {/* NEVER THE RAW KEY. v2 found this on 2026-08-03, when a hand-added account showed
                `pending:66ca1f7f-082f-4f4c-be32-4b02a1fdf5a6` to the trader. `pending:` and
                `default-` are Run's own bookkeeping and may never reach a person; this row was the
                one place that leaked them. A real Tradovate name still prints verbatim, because
                comparing it against Tradovate's own screen is the whole point of showing it. */}
            <dd className={`text-body mt-0.5 ${manual ? 'text-muted' : 'text-text tabular-nums'}`}>
              {placeholderAccountTitle(account.externalAccountId)}
            </dd>
          </div>
          {/* `12 of 19` RATHER THAN A BARE `12`, so the row cannot be misread as the account's own
              count. It states both facts in the space of one, which is why the group needs no
              "filtered" caption above it explaining itself. */}
          <Line label="Trades">
            <span className="text-text tabular-nums">
              {view
                ? `${view.trades.toLocaleString('en-US')} of ${account.trades.toLocaleString('en-US')}`
                : account.trades.toLocaleString('en-US')}
            </span>
          </Line>
          {/* THE LABEL STATES WHETHER FEES ARE IN IT, and this page is the only place that claim can
              be made honestly. `accounts-rail.tsx` says so in as many words: a roster rollup spans
              accounts whose fee coverage can differ, so one label there cannot answer for all of
              them - "the per-account answer belongs on `/accounts/details`, where there IS one
              account to answer for". */}
          {/* THE SAME FIGURE THE CHART IS DRAWING, so the two cannot disagree. The `of` form does
              not work for money - "$907.96 of $521.60" is nonsense when a filtered subset exceeds
              the whole - so the label carries the qualifier instead. */}
          {/* OFF ON A PHONE (2026-08-28). The chart states this exact figure 300px above, and the
              `, filtered` half of the label is about a Filters control that does not exist at this
              width - it moved to `/accounts/details/<id>/trades`, which is the screen with a list
              worth narrowing. A row that restates the headline under a qualifier that can never be
              true is two kinds of noise at once. */}
          <Line className="max-md:hidden"
            label={`${provenance.hasFees ? 'Net P&L' : 'Gross P&L'}${view ? ', filtered' : ''}`}
          >
            <span className="text-text tabular-nums">
              {signed(view ? view.netCents : account.netCents)}
            </span>
          </Line>
        </dl>
      </Card>

      <Card className={RAIL_CARD}>
        <RailHead>Data</RailHead>
        <dl className="border-rule border-t pb-2 max-md:pb-1">
          {/* v2 HARDCODED "CSV upload" HERE, on every account including one the trader typed in by
              hand that has never seen a file - directly contradicting the "Last import: Never" row
              underneath it. An account whose key is still a placeholder has by definition never been
              matched to an export.
              "Added manually" rather than "Added by hand" (Luke, 2026-08-03: "do we have that in
              copy ANYWHERE? NO! we use 'add manually'"). The row describing the result says the same
              words back as the control that produced it. */}
          <Line label="Source">
            <span className="text-text">{manual ? 'Added manually' : 'CSV upload'}</span>
          </Line>
          {/* THE FOURTH FACT, WHICH v2 DOES NOT HAVE. `spec.md`'s amended P8 wants four - source,
              account, range covered, last import - and v2's Data card carries three. This is the
              range Run HOLDS, off `session_date` on the countable trades, not the range the FILES
              claimed: a file whose rows all duplicated an earlier upload widens the second and not
              the first, and P8 is a statement about the output's dependencies. */}
          {/* `displayDayShort`, NOT `displaySessionDate`, and the time module's own comment names
              this exact case: the long form is "Thursday, July 9, 2026", and a RANGE of two of
              those wrapped to two lines in a 304px rail (measured). One module owns both lengths,
              so this is a choice of formatter rather than a second one written here.
              The range itself goes through `displayDayRange`, which prints the shared year once -
              "Jul 6, 2026 to Jul 9, 2026" still wrapped, and the repeated year was the waste. */}
          <Line label="Range covered">
            {provenance.firstDay && provenance.lastDay ? (
              <span className="text-text">
                {displayDayRange(provenance.firstDay, provenance.lastDay)}
              </span>
            ) : (
              /* AN ACCOUNT WITH NO TRADES IS A NORMAL STATE, not an error - a hand-added evaluation
                 bought this morning is exactly the row this page has to render. `getRoster` LEFT
                 JOINs for the same reason. */
              <span className="text-muted">Nothing yet</span>
            )}
          </Line>
          <Line label="Last import">
            {provenance.lastImportAt ? (
              <span className="text-text">{when(provenance.lastImportAt)}</span>
            ) : (
              <span className="text-muted">Never</span>
            )}
          </Line>
          {/* THE ROW THAT STATES THE GAP IS THE ROW THAT OFFERS TO CLOSE IT. An account with no
              import is usually one the trader added by hand this morning, and its whole purpose is
              to fill — so the offer belongs here, directly under the "Never" that says it has not.
              THIS IS ALSO WHAT MAKES THE ADOPTION PATH TRUSTWORTHY: an import launched from THIS
              account's page is the trader asserting the file belongs to this row, which is the one
              signal that can rename a `pending:` placeholder. See `import-trades-modal.tsx`.

              `md:hidden` ON THE RECURRING VARIANT ONLY (2026-09-02), and the asymmetry is the
              point. The tape card's header now carries this same action as the page's CTA
              (`import-into-account.tsx`), so on a desktop keeping this row too is two controls
              firing one action on one page. The PHONE has no such header - `max-md:hidden` takes
              the whole tape toolbar and `RecentTrades` carries a caption rather than a toolbar
              (Luke, 2026-08-28) - so this row is the only steady-state way in at that width and
              stays. The FIRST-RUN variant stays at both widths: "Never" one row up is a statement
              this page makes on both, and the sentence that closes it belongs beside it. */}
          <Line
            label={provenance.lastImportAt ? 'Add more' : 'Get started'}
            className={provenance.lastImportAt ? 'md:hidden' : undefined}
          >
            <ImportIntoAccount
              accountId={account.id}
              label={provenance.lastImportAt ? 'Import trades' : 'Import your first file'}
            />
          </Line>
          {/* HOW MANY FILES THIS ACCOUNT IS BUILT FROM. One line of provenance v2 leaves implicit,
              and cheap here because the count rides on the same row the stamp does. Absent at zero,
              where "Last import: Never" one row up has already said it. */}
          {provenance.imports > 0 && (
            <Line label="Imports">
              <span className="text-text tabular-nums">{provenance.imports}</span>
            </Line>
          )}
        </dl>
      </Card>
    </div>
  );
}

/* THE ONE RULE THAT SURVIVED, between GROUPS rather than between rows. Measured on the reference
 * (v2, 2026-08-01): its Summary rows carry `border-bottom: 0` and lean on spacing, with a single
 * hairline under the card header.
 * Luke's objection to that is the interesting part - "we have a lot more info". True: theirs has
 * four rows and this has ten, and ten label/value pairs with nothing between them IS harder to scan
 * than four. But nine hairlines in a 304px column is a lot of chrome spent on a list of facts, and
 * it makes a rail read as a table. So the divider stays and stops meaning "next row". It means NEXT
 * GROUP - identity, then terms, then the record - a distinction the rail always had and never
 * showed. `my-2`, so the space around it is bigger than the space between the rows it separates; a
 * divider with equal space either side reads as another row. */
function Group() {
  return <div className="border-rule my-2 border-t" />;
}

/* One label/value row. `dt`/`dd` rather than two spans, because that is what this is - a list of
 * terms and their definitions - and saying so costs nothing.
 * `items-start` so a value that wraps still lines up with the top of its label. */
function Line({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 py-1.5 max-md:px-4 max-md:py-2', className)}>
      <dt className="text-body text-muted shrink-0">{label}</dt>
      <dd className="text-body min-w-0 text-right">{children}</dd>
    </div>
  );
}

/* THESE ARE CARDS ON A DESKTOP AND TABLES ON A PHONE (2026-08-28, Luke: "so right now on the
 * /account/details page for mobile we are using cards for the summary and data info. we dont want to
 * do that. we want those to be consistent with the trades table").
 *
 * FULL BLEED, NO RADIUS, NO SHADOW below `md` - the same three cancellations `TradesTape` and
 * `RecentTrades` make at this width, so the three surfaces stacked down the phone's column share one
 * left edge and one ground instead of reading as three floating sheets. Above `md` nothing changes:
 * the rail is a column of cards beside the tape and always was.
 */
const RAIL_CARD = 'overflow-hidden max-md:-mx-4 max-md:rounded-none max-md:shadow-none';

/* THE CARD'S TITLE, WHICH BECOMES A TABLE HEADER ROW ON A PHONE. `min-h-13` and the row's own
 * gutter, matching `RecentTrades`' caption exactly - three tables down one column whose headers
 * disagreed about height would read as three components rather than one page.
 * `text-title` STAYS ABOVE `md`, where this is a card heading beside a chart and a tape. */
function RailHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 max-md:flex max-md:min-h-13 max-md:items-center max-md:px-4 max-md:py-0">
      <h2 className="text-title text-text max-md:text-body-lg font-medium">{children}</h2>
    </div>
  );
}

/** `+` on a gain, the minus `fmtMoney` already carries on a loss — the tape's own rule. */
const signed = (cents: number): string => (cents > 0 ? `+${fmtMoney(cents)}` : fmtMoney(cents));

/* `tradovate` -> `Tradovate`. A lookup would be a table of one; when a second platform lands
 * (`widening-plan.md` §5.5) this becomes one, and until then capitalising the stored key is the
 * truth rather than a placeholder for it. */
const brokerName = (platform: string) => platform.charAt(0).toUpperCase() + platform.slice(1);

/* "2h ago" for anything recent, an absolute date past a week. Relative is what you want for "is this
 * current"; absolute is what you want for "when exactly", and the crossover is roughly the point at
 * which nobody counts days in their head any more.
 *
 * NOT `roster-card.tsx`'s `ago()`, and the difference is deliberate rather than drift: that one is a
 * six-character stamp at the end of a dense row and stays coarse forever, this one is a labelled row
 * in a rail of facts and can afford the exact date once the relative form stops being useful. Two
 * jobs, two shapes; if a third caller appears they share one. */
function when(at: Date): string {
  const mins = Math.max(0, Math.round((Date.now() - at.getTime()) / 60_000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days <= 7) return days === 1 ? 'Yesterday' : `${days}d ago`;
  return at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
