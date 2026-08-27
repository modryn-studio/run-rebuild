'use client';

/* THE PARTS A ROSTER ROW IS MADE OF, racked because they were not (2026-08-27).
 *
 * `design-system.md`: "A component isn't done until it appears in /kitchen-sink in every state, in
 * the same commit." These four shipped without a rack entry, which is how a state nobody renders
 * deliberately becomes a state nobody has looked at - the status chip carried a 21px box against a
 * 12px line for a week before anyone measured it on a phone.
 *
 * The ROW itself is not here and should not be: it needs a `ChartViewProvider`, a freshness map and
 * a drag hook, so racking it would mean racking half the page. What is rackable is its vocabulary.
 */

import { AccountLogo } from '@/components/views/accounts/account-logo';
import { StatusChip } from '@/components/views/accounts/roster-card';
import { TrendIndicator } from '@/components/views/accounts/trend-indicator';
import { RefreshRoster } from '@/components/views/accounts/refresh-roster';
import { ACCOUNT_STATUSES } from '@/lib/db/schema';
import { Note, Row, Section } from '../_components/section';

export function RosterRowSection() {
  return (
    <Section
      id="roster-row"
      title="Roster row parts"
      intro="The marks and figures a /accounts row is assembled from. Each one is shown in every state it actually reaches, including the two that only appear when the data is missing."
    >
      <Row label="Account mark" note="40 on a row, 32 on a phone, 24 in a breadcrumb">
        <div className="flex items-end gap-4">
          <AccountLogo propFirm="Apex Trader Funding" />
          <AccountLogo propFirm="Tradeify" />
          <AccountLogo propFirm="Apex Trader Funding" size={32} />
          <AccountLogo propFirm="Apex Trader Funding" size={24} />
        </div>
      </Row>

      <Row label="...with no firm" note="the broker fallback, inset to 0.6 of the tile">
        {/* THE STATE THAT ONLY EXISTS BECAUSE THE DATA IS INCOMPLETE, which is precisely the one a
            rack has to carry: an unlabelled account is a NORMAL state in this product, not an error,
            and the mark has to say "not stated" without looking broken. */}
        <div className="flex items-end gap-4">
          <AccountLogo propFirm={null} />
          <AccountLogo propFirm={null} size={32} />
        </div>
      </Row>

      <Row label="Status chip" note="every value the column holds; active is hidden on a phone row">
        <div className="flex flex-wrap items-center gap-2">
          {ACCOUNT_STATUSES.map((s) => (
            <StatusChip key={s} status={s} />
          ))}
        </div>
      </Row>

      <Row label="Change line" note="up, down, and flat: no arrow and no colour on zero">
        <div className="flex flex-col gap-2">
          <TrendIndicator cents={91607} periodLabel="1 month change" periodShort="1 month" baseDollars={250000} />
          <TrendIndicator cents={-59130} periodLabel="1 month change" periodShort="1 month" baseDollars={250000} />
          {/* ZERO HAS NO DIRECTION, and drawing one - even a neutral one - is the interface
              insisting something happened. The rack is where that is checked rather than trusted. */}
          <TrendIndicator cents={0} periodLabel="1 month change" periodShort="1 month" baseDollars={250000} />
        </div>
      </Row>

      <Row label="...with no stated size" note="the percentage is ABSENT, never defaulted">
        {/* A PERCENTAGE AGAINST A PARTIAL BASE IS A WRONG NUMBER, not a partial one, so it is
            dropped the moment one account in scope is unsized. Racked so the two shapes can be seen
            beside each other and the missing figure reads as deliberate. */}
        <TrendIndicator cents={91607} periodLabel="1 month change" periodShort="1 month" baseDollars={null} />
      </Row>

      <Row label="...with the phone's trailing clause" note="coverage rides along below sm only">
        <TrendIndicator
          cents={91607}
          periodLabel="1 month change"
          periodShort="1 month"
          note="8 accounts"
          baseDollars={null}
        />
      </Row>

      <Row label="Refresh" note="pressing it re-reads the current route; the mark spins while it does">
        <RefreshRoster />
      </Row>

      <Note>
        The change line is 16px from <code>sm</code> and 12px below it, and the account mark is 40px
        and 32px on the same split. Narrow the window past 640px to see both move.
      </Note>
    </Section>
  );
}
