// Parses a Tradovate "Account Balance History" export: the broker's own end-of-day statement,
// one row per account per trading day.
//
// THIS FILE IS NOT INGESTED AS EVENTS, and that is the point of it. `spec.md` §S1 calls it
// "a fifth file and a different job". Every other export is a source of record; this one is a
// WITNESS against the record we built from the other four. Writing it as events would make it
// agree with itself by construction, which is the one thing a witness must not do.
//
// WHAT IT SETTLES that nothing else can. `Total Realized PNL` is NET — after all four fee lines.
// Measured on the real ten-day export (2026-07-22):
//
//   gross realized P&L  -1,840.50   (Position History's P/L, == Cash History's Trade Paired)
//   all fees            -1,934.36
//   NET                 -3,774.86   == the sum of this file's Total Realized PNL column
//
// So the Trade Paired reconciliation proves the PAIRING, and this one proves the COST. They are
// not redundant: fees exceeded the gross loss on that export, so a build could pair every trade
// perfectly and still be wrong by more than the entire loss.
//
// `Trade Date` IS THE BROKER'S OWN SESSION DATE, which makes this file worth more than its total.
// Run derives session_date from exit_at across a 17:00 America/Chicago boundary; this column is
// Tradovate's answer to the identical question. Comparing DAY BY DAY therefore tests the boundary
// itself — and a grand total cannot, because filing an evening trade one day late leaves the total
// correct and two days wrong in opposite directions. That is precisely the silent failure
// CLAUDE.md's doctrine names when it says the zone and the hour travel together.
import { parse } from 'csv-parse/sync';
import { ACCOUNT_ALIASES, BROKER_ACCOUNT_ID_ALIASES, accountRef, findColumn, toCents } from './shared';

export interface ParsedBalanceDay {
  accountName: string | null;
  brokerAccountId: string | null;
  /** The broker's own trade date, `YYYY-MM-DD`, compared against our `session_date`. */
  tradeDate: string;
  /** End-of-day account balance. Provenance only; nothing reconciles against it yet. */
  balanceCents: number;
  /** The day's realised P&L, NET of all fees. This is the figure that reconciles. */
  netRealizedCents: number;
}

const ALIASES = {
  account: ACCOUNT_ALIASES,
  brokerAccountId: BROKER_ACCOUNT_ID_ALIASES,
  tradeDate: ['trade date'],
  balance: ['total amount'],
  net: ['total realized pnl'],
} as const;

/* The column is already `YYYY-MM-DD` on every export seen. Normalised rather than trusted, and
   NEVER through `new Date()`: a date-only string parses as UTC midnight, so any later formatting
   in a western zone hands back the previous day. This file exists to catch off-by-one-day errors,
   so introducing one inside its own parser would be a particularly bad joke. */
function normalizeTradeDate(raw: string | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (iso) return v;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  return null;
}

export function parseAccountBalanceHistory(csvText: string): ParsedBalanceDay[] {
  const rows: Record<string, string>[] = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]);
  const col = {
    account: findColumn(headers, ALIASES.account),
    brokerAccountId: findColumn(headers, ALIASES.brokerAccountId),
    tradeDate: findColumn(headers, ALIASES.tradeDate),
    balance: findColumn(headers, ALIASES.balance),
    net: findColumn(headers, ALIASES.net),
  };
  // Without these two the file cannot witness anything, and a partial witness is worse than none.
  if (!col.tradeDate || !col.net) return [];

  const out: ParsedBalanceDay[] = [];
  for (const row of rows) {
    const tradeDate = normalizeTradeDate(row[col.tradeDate]);
    if (!tradeDate) continue;
    out.push({
      accountName: col.account ? accountRef(row[col.account]) : null,
      brokerAccountId: col.brokerAccountId ? accountRef(row[col.brokerAccountId]) : null,
      tradeDate,
      balanceCents: col.balance ? toCents(row[col.balance] ?? '0') : 0,
      netRealizedCents: toCents(row[col.net] ?? '0'),
    });
  }
  return out;
}
