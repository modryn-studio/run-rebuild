/* THE ROSTER'S SUMMARY: a LEDGER, not a composition.
 *
 * NO PROPORTION BAR AND NO TOTALS/PERCENT TOGGLE, and `run-trading@v2` argues it well enough to
 * quote: a share-of-total bar "needs values that SUM, and a roster of P&L figures does not - a bar
 * cannot show a losing account as a share of a positive total, and half of these numbers can be
 * negative."
 *
 * ⚠ `wireframes.md` DRAWS A `[Totals | Percent]` TOGGLE HERE. The two documents disagree and this
 * build follows v2, because v2's objection is arithmetic rather than aesthetic. There IS an honest
 * percentage available for this audience - return on the account's stated SIZE, which `sizeDollars`
 * already carries - and it is a different number from the one the wireframe implies. Flagged for
 * Luke rather than silently resolved; if the toggle returns it should mean return-on-size, and it
 * has to be absent rather than defaulted whenever any account in scope has no stated size.
 *
 * A RULE BETWEEN GROUPS, NOT BETWEEN ROWS. Two rules instead of seven. A divider under every row in
 * a 304px column is a lot of chrome spent on a list of facts, and it makes a rail read as a table.
 *
 * A SERVER COMPONENT: it only reads and formats, so it ships no JavaScript.
 */

import { Card } from '@/components/ui/card';
import { DownloadRosterCsv } from './download-roster-csv';
import { fmtMoney } from '@/lib/format';
import { ACCOUNT_TYPE_LABELS, type AccountTypeKey } from '@/lib/prop-firms';
import type { RosterAccount } from '@/lib/accounts/read';

const GROUP_ORDER: AccountTypeKey[] = ['sim_funded', 'evaluation', 'personal'];
const signed = (cents: number): string => (cents > 0 ? `+${fmtMoney(cents)}` : fmtMoney(cents));

type Line = { label: string; value: string; strong?: boolean };

/* COUNTS COME FROM EVERY ACCOUNT, MONEY FROM THE COUNTED ONES, and mixing the two is a bug v2
   shipped: its rail read "Accounts 1 / Evaluation 0" when the trader's only account was excluded
   from totals. An excluded account still EXISTS; it just does not join a sum. */
function summarize(all: RosterAccount[]): Line[][] {
  const counted = all.filter((a) => !a.excludedFromTotals);

  if (all.length === 0) {
    return [[{ label: 'Accounts', value: '0' }], [{ label: 'Total P&L', value: fmtMoney(0) }]];
  }

  const groups: Line[][] = [];

  const what: Line[] = [{ label: 'Accounts', value: String(all.length) }];
  /* THE BREAKDOWN ONLY APPEARS WHEN THERE IS SOMETHING TO BREAK DOWN. One kind of account makes
     every line of it repeat the line above. */
  const kinds = new Set(all.map((a) => a.accountType ?? 'unlabelled'));
  if (kinds.size >= 2) {
    for (const key of GROUP_ORDER) {
      const n = all.filter((a) => a.accountType === key).length;
      if (n > 0) what.push({ label: ACCOUNT_TYPE_LABELS[key], value: String(n) });
    }
    const unlabelled = all.filter((a) => a.accountType === null).length;
    if (unlabelled > 0) what.push({ label: 'Not yet labelled', value: String(unlabelled) });
  }
  groups.push(what);

  const made: Line[] = [
    {
      /* `Total P&L`, NOT `Net P&L` (2026-08-26). The chart directly above this rail carries the
         eyebrow TOTAL P&L over the identical figure, so the page was calling one number two things
         within 300px of itself. v2 says Total in both places.
         `/trades` keeps `Net P&L` for a real reason that does not apply here: it flips to
         `Gross P&L` when no Cash History covers the range, which is how that page satisfies "any
         surface showing a net figure states whether fees were imported". This rail is a roster
         rollup across accounts whose fee coverage can differ per account, so one label cannot make
         that claim honestly for all of them - the per-account answer belongs on `/accounts/details`,
         where there IS one account to answer for. */
      label: 'Total P&L',
      value: signed(counted.reduce((n, a) => n + a.netCents, 0)),
      strong: true,
    },
  ];
  /* BEST AND WORST NEED AT LEAST TWO ACCOUNTS TO BE DIFFERENT NUMBERS. v2 printed the same figure
     three times at one account, and `Math.max()` of an EMPTY list is `-Infinity`, which it rendered
     as a literal `-$∞` once every account was excluded. A reduce over a guarded list is both fixes. */
  if (counted.length >= 2) {
    const nets = counted.map((a) => a.netCents);
    made.push({ label: 'Best account', value: signed(nets.reduce((a, b) => (b > a ? b : a))) });
    made.push({ label: 'Worst account', value: signed(nets.reduce((a, b) => (b < a ? b : a))) });
  }
  groups.push(made);

  groups.push([
    {
      label: 'Trades',
      value: counted.reduce((n, a) => n + a.trades, 0).toLocaleString('en-US'),
    },
  ]);

  return groups.filter((g) => g.length > 0);
}

export function AccountsRail({ accounts }: { accounts: RosterAccount[] }) {
  const groups = summarize(accounts);

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4">
        <h2 className="text-title text-text font-medium">Summary</h2>
      </div>
      <dl className="border-rule border-t pb-2">
        {groups.map((rows, gi) => (
          <div key={gi}>
            {gi > 0 && <div className="border-rule my-2 border-t" />}
            {rows.map((r) => (
              /* `items-start` so a value that wraps still lines up with the top of its label. */
              <div key={r.label} className="flex items-start justify-between gap-4 px-5 py-1.5">
                <dt className="text-body text-muted shrink-0">{r.label}</dt>
                <dd
                  className={`text-body min-w-0 text-right tabular-nums ${r.strong ? 'text-text font-medium' : 'text-text'}`}
                >
                  {r.value}
                </dd>
              </div>
            ))}
          </div>
        ))}
      </dl>
      <DownloadRosterCsv accounts={accounts} />
    </Card>
  );
}
