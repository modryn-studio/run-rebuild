'use client';

/* THE ROSTER, AS A FILE — built on the client from rows already on the page.
 *
 * NO ROUTE, AND THAT IS THE DIFFERENCE FROM `/trades`. The tape's export exists because the tape is
 * a WINDOW over a corpus: the browser holds 300 rows of a possible 20,000, so the file has to be
 * assembled server-side from ids. A roster is not windowed — every account the trader owns is
 * already in this component's props, so a round trip would fetch back what it was handed.
 *
 * IT INCLUDES ACCOUNTS LEFT OUT OF TOTALS, and marks them. A file that silently dropped them would
 * not reconcile against the roster it came from, which is the one thing an export must do — and the
 * marker is what lets a reader see why their own sum differs from the rail's.
 *
 * IT RENDERS NOTHING WITH NOTHING TO EXPORT. An empty roster's export is an empty file, and a
 * control that produces one is a control that has already failed.
 */

import { useState } from 'react';
import { fmtMoney } from '@/lib/format';
import { accountRowTitle } from '@/lib/prop-firms';
import { STATUS_LABELS, TYPE_LABELS } from '@/lib/accounts/roster-filter';
import type { RosterAccount } from '@/lib/accounts/read';

/* RFC 4180: a field carrying a comma, a quote or a newline is quoted, and an inner quote is
   doubled. A name a trader typed is exactly where that bites, and getting it wrong shifts every
   column after it. */
function cell(v: string | number | null): string {
  const s = v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Money as a plain signed number, never `$1,234.56`: a spreadsheet reads the formatted form as
 *  text and every column total downstream becomes zero. */
const plain = (cents: number) => (cents / 100).toFixed(2);

export function DownloadRosterCsv({ accounts }: { accounts: RosterAccount[] }) {
  const [busy, setBusy] = useState(false);
  if (accounts.length === 0) return null;

  const save = () => {
    setBusy(true);
    try {
      const head = [
        'Account',
        'Firm',
        'Broker ID',
        'Type',
        'Status',
        'Size',
        'Trades',
        'Net P&L',
        'In totals',
      ];
      const rows = accounts.map((a) =>
        [
          cell(accountRowTitle(a)),
          cell(a.propFirm),
          cell(a.externalAccountId),
          cell(a.accountType ? TYPE_LABELS[a.accountType] : ''),
          cell(STATUS_LABELS[a.status]),
          cell(a.sizeDollars),
          cell(a.trades),
          cell(plain(a.netCents)),
          cell(a.excludedFromTotals ? 'No' : 'Yes'),
        ].join(',')
      );
      const blob = new Blob([[head.join(','), ...rows].join('\n')], {
        type: 'text/csv;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `accounts-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-rule border-t px-5 py-3 text-center">
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="hit-44 text-link text-body disabled:cursor-not-allowed disabled:opacity-60"
      >
        Download CSV
      </button>
    </div>
  );
}
