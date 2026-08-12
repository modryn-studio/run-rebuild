// Parses a Tradovate "Cash History" export. This is the ONLY export that carries the real
// cost of trading, and it is the difference between a true number and a flattering one.
//
// Measured on a real 10-day export (2026-07-22):
//   gross realized P&L  -1,840.50   (Trade Paired rows == Position History's P/L)
//   all fees            -1,934.36
//   NET                 -3,774.86   (matches Account Balance History's Total Realized PNL,
//                                    to the cent, on all 10 trading days)
// The fees exceeded the gross loss. Reporting gross alone would have understated the real
// loss by half, so `fee` events are Layer 1 data, not a nicety.
//
// Tradovate charges FOUR separate lines per execution. The Fills export's `commission`
// column is only the first of them (42% of the true cost), which is why it must never be
// used as "the fees" — see fills.ts.
import { parse } from 'csv-parse/sync';
import { ACCOUNT_ALIASES, accountRef, feeBucket, findColumn, toCents } from './shared';

// The four cost lines, plus the realized-P&L credit. Matched case-insensitively against the
// "Cash Change Type" column. Anything else (Fund Transaction, withdrawals) is deliberately
// NOT a fee and must not be netted against trading performance.
export const FEE_KINDS = ['commission', 'exchange fee', 'clearing fee', 'nfa fee'] as const;
export type FeeKind = (typeof FEE_KINDS)[number];

export interface ParsedCashRow {
  transactionId: string | null;
  accountName: string | null;
  deltaCents: number; // signed: fees are negative, credits positive
  contract: string | null;
  occurredAtLocal: Date | null; // local wall-clock; the export carries no UTC column
  // Join key back to the FILL that incurred this fee (see shared.ts feeBucket). This is what
  // makes per-trade net P&L exact rather than estimated.
  bucketKey: string | null;
}

export interface ParsedFee extends ParsedCashRow {
  feeKind: FeeKind;
}

export interface ParsedCashHistory {
  // "Trade Paired" rows: gross realized P&L from an independent source, used to reconcile
  // against Position History's pairing. Not ingested as events (round_trip already carries it).
  tradePaired: ParsedCashRow[];
  fees: ParsedFee[];
}

const ALIASES = {
  changeType: ['cash change type'],
  delta: ['delta'],
  txnId: ['transaction id'],
  contract: ['contract'],
  account: ACCOUNT_ALIASES,
  timestamp: ['timestamp'],
} as const;

function matchFeeKind(changeType: string): FeeKind | null {
  const v = changeType.trim().toLowerCase();
  return FEE_KINDS.find((k) => k === v) ?? null;
}

// Local wall-clock ("07/08/2026 08:32:45"). Deliberately lenient: a fee's exact instant is
// not load-bearing (fees are summed per account/day), so a bad cell drops the timestamp
// rather than failing an import over it.
function localTime(raw: string | undefined): Date | null {
  const v = raw?.trim();
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseCashHistory(csvText: string): ParsedCashHistory {
  const rows: Record<string, string>[] = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
  if (rows.length === 0) return { tradePaired: [], fees: [] };

  const headers = Object.keys(rows[0]);
  const col = {
    changeType: findColumn(headers, ALIASES.changeType),
    delta: findColumn(headers, ALIASES.delta),
    txnId: findColumn(headers, ALIASES.txnId),
    contract: findColumn(headers, ALIASES.contract),
    account: findColumn(headers, ALIASES.account),
    timestamp: findColumn(headers, ALIASES.timestamp),
  };

  const missing = (['changeType', 'delta'] as const).filter((k) => col[k] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Cash History CSV is missing required column(s): ${missing.join(', ')}. Found headers: ${headers.join(', ')}`
    );
  }

  const tradePaired: ParsedCashRow[] = [];
  const fees: ParsedFee[] = [];

  for (const row of rows) {
    const changeType = row[col.changeType!] ?? '';
    const base: ParsedCashRow = {
      transactionId: col.txnId ? accountRef(row[col.txnId]) : null,
      accountName: col.account ? accountRef(row[col.account]) : null,
      deltaCents: toCents(row[col.delta!]),
      contract: col.contract ? accountRef(row[col.contract]) : null,
      occurredAtLocal: col.timestamp ? localTime(row[col.timestamp]) : null,
      bucketKey: feeBucket(col.timestamp ? row[col.timestamp] : undefined, col.contract ? row[col.contract] : undefined),
    };

    if (/trade paired/i.test(changeType)) {
      tradePaired.push(base);
      continue;
    }
    const feeKind = matchFeeKind(changeType);
    if (feeKind) fees.push({ ...base, feeKind });
    // Everything else (Fund Transaction, etc.) is account funding, not trading cost.
  }

  return { tradePaired, fees };
}
