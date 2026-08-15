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
   so introducing one inside its own parser would be a particularly bad joke.

   THE SHAPE IS NOT THE VALUE. Matching `\d{4}-\d{2}-\d{2}` accepts `2026-13-45` and `2026-02-30`
   quite happily, and a nonexistent date does not fail — it sorts outside every real window and is
   skipped forever, which is the silent kind of wrong. The parts are range-checked, February gets
   its leap year, and anything left over is a rejection rather than a row. */
function normalizeTradeDate(raw: string | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;

  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (us) [y, m, d] = [Number(us[3]), Number(us[1]), Number(us[2])];
  else return null;

  if (m < 1 || m > 12 || d < 1) return null;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (d > lengths[m - 1]) return null;

  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export interface ParsedStatement {
  days: ParsedBalanceDay[];
  /** Rows whose Trade Date could not be read. Counted, because a row dropped in silence is the
   *  receipt quietly getting weaker with nothing to show for it. */
  unreadableRows: number;
  /** The file did not carry the two columns this receipt needs. Distinct from "no rows": one is an
   *  empty statement, the other is a file that cannot witness anything, and returning `[]` for
   *  both made an unrecognisable statement look exactly like agreement. */
  unrecognised: boolean;
}

export function parseAccountBalanceHistory(csvText: string): ParsedStatement {
  const rows: Record<string, string>[] = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  if (rows.length === 0) return { days: [], unreadableRows: 0, unrecognised: false };

  const headers = Object.keys(rows[0]);
  const col = {
    account: findColumn(headers, ALIASES.account),
    brokerAccountId: findColumn(headers, ALIASES.brokerAccountId),
    tradeDate: findColumn(headers, ALIASES.tradeDate),
    balance: findColumn(headers, ALIASES.balance),
    net: findColumn(headers, ALIASES.net),
  };
  /* Without these two the file cannot witness anything. It returns `unrecognised` rather than an
     empty list, because the caller must be able to tell "the statement agrees" from "the statement
     could not be read" — collapsing them turned a broken file into a silent pass on the one
     receipt that can block. */
  if (!col.tradeDate || !col.net) return { days: [], unreadableRows: rows.length, unrecognised: true };

  const days: ParsedBalanceDay[] = [];
  let unreadableRows = 0;
  for (const row of rows) {
    const tradeDate = normalizeTradeDate(row[col.tradeDate]);
    /* A ROW WITH NO READABLE NET IS UNREADABLE, NOT A ZERO DAY. This used to be
       `toCents(row[col.net] ?? '0')`, which turned an absent cell into "the broker says you made
       nothing" — and that figure is the authority in a blocking check. `toCents` now throws on a
       blank, so the fallback is the last thing standing between a missing cell and a false zero. */
    const netRaw = row[col.net];
    if (!tradeDate || netRaw === undefined || netRaw.trim() === '') {
      unreadableRows++;
      continue;
    }
    let netRealizedCents: number;
    let balanceCents = 0;
    try {
      netRealizedCents = toCents(netRaw);
      const balRaw = col.balance ? row[col.balance] : undefined;
      // The balance is provenance only, so an unreadable one costs the row nothing.
      if (balRaw !== undefined && balRaw.trim() !== '') balanceCents = toCents(balRaw);
    } catch {
      unreadableRows++;
      continue;
    }
    days.push({
      accountName: col.account ? accountRef(row[col.account]) : null,
      brokerAccountId: col.brokerAccountId ? accountRef(row[col.brokerAccountId]) : null,
      tradeDate,
      balanceCents,
      netRealizedCents,
    });
  }
  return { days, unreadableRows, unrecognised: false };
}
