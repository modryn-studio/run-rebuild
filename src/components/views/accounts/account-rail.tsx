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
import { Icon } from '@/components/ui/icon';
import { StatusChip } from './roster-card';
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
}: {
  account: RosterAccount;
  provenance: Provenance;
}) {
  const firm = account.propFirm ? findPropFirm(account.propFirm) : undefined;
  const manual = isPlaceholderAccountName(account.externalAccountId);

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden">
        <div className="px-5 py-4">
          <h2 className="text-title text-text font-medium">Summary</h2>
        </div>
        <dl className="border-rule border-t pb-2">
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
          <Line label="Trades">
            <span className="text-text tabular-nums">{account.trades.toLocaleString('en-US')}</span>
          </Line>
          {/* THE LABEL STATES WHETHER FEES ARE IN IT, and this page is the only place that claim can
              be made honestly. `accounts-rail.tsx` says so in as many words: a roster rollup spans
              accounts whose fee coverage can differ, so one label there cannot answer for all of
              them - "the per-account answer belongs on `/accounts/details`, where there IS one
              account to answer for". */}
          <Line label={provenance.hasFees ? 'Net P&L' : 'Gross P&L'}>
            <span className="text-text tabular-nums">{signed(account.netCents)}</span>
          </Line>
        </dl>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-4">
          <h2 className="text-title text-text font-medium">Data</h2>
        </div>
        <dl className="border-rule border-t pb-2">
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
function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-1.5">
      <dt className="text-body text-muted shrink-0">{label}</dt>
      <dd className="text-body min-w-0 text-right">{children}</dd>
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
