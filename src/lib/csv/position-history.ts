// Parses a Tradovate "Position History" export into normalized round-trips. Each row is
// one matched entry→exit pairing (Tradovate's OWN pairing — it handles the messy
// many-to-many splitting of a 12-lot exit across four entries, so we never build or
// mis-build a matching engine). This is where realized P&L comes from.
//
// IMPORTANT: the P/L here is GROSS (before fees). Net requires Cash History fees. We
// store gross and label it, never conflating it with the account's net number.
// Position History has no UTC timestamp column, so the round-trip's true UTC instant is
// resolved later from the referenced fill events (Buy/Sell Fill ID) at ingest.
import { parse } from 'csv-parse/sync';
import { ACCOUNT_ALIASES, accountRef, findColumn, toCents, toMicros, parseTimestamp } from './shared';

export interface ParsedRoundTrip {
  pairId: string | null; // Tradovate Pair ID — unique per round-trip (dedupe key)
  buyFillId: string | null; // provenance → fill events
  sellFillId: string | null;
  accountName: string | null; // which account this round-trip belongs to
  symbol: string; // root product, e.g. "MNQ"
  contract: string | null;
  qty: number;
  buyPriceMicros: number;
  sellPriceMicros: number;
  pnlCentsGross: number; // GROSS realized P&L (before fees)
  boughtAtLocal: Date | null; // local wall-clock from the export (no tz); see note above
  soldAtLocal: Date | null;
  raw: Record<string, unknown>; // CSV row (strings) or the raw API fill-pair object
}

const ALIASES = {
  pairId: ['pair id'],
  buyFillId: ['buy fill id'],
  sellFillId: ['sell fill id'],
  symbol: ['product', 'contract', 'symbol'],
  contract: ['contract'],
  qty: ['paired qty', 'qty'],
  buyPrice: ['buy price'],
  sellPrice: ['sell price'],
  pnl: ['p/l', 'pnl'],
  boughtAt: ['bought timestamp'],
  soldAt: ['sold timestamp'],
  account: ACCOUNT_ALIASES,
} as const;

export function parseTradovatePositionHistoryCsv(csvText: string): ParsedRoundTrip[] {
  const rows: Record<string, string>[] = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]);
  const col = {
    pairId: findColumn(headers, ALIASES.pairId),
    buyFillId: findColumn(headers, ALIASES.buyFillId),
    sellFillId: findColumn(headers, ALIASES.sellFillId),
    symbol: findColumn(headers, ALIASES.symbol),
    contract: findColumn(headers, ALIASES.contract),
    qty: findColumn(headers, ALIASES.qty),
    buyPrice: findColumn(headers, ALIASES.buyPrice),
    sellPrice: findColumn(headers, ALIASES.sellPrice),
    pnl: findColumn(headers, ALIASES.pnl),
    boughtAt: findColumn(headers, ALIASES.boughtAt),
    soldAt: findColumn(headers, ALIASES.soldAt),
    account: findColumn(headers, ALIASES.account),
  };

  const required = ['symbol', 'qty', 'buyPrice', 'sellPrice', 'pnl'] as const;
  const missing = required.filter((k) => col[k] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Position History CSV is missing required column(s): ${missing.join(', ')}. Found headers: ${headers.join(', ')}`
    );
  }

  const localTime = (v: string | undefined) => (v && v.trim() ? parseTimestamp(v) : null);

  const roundTrips: ParsedRoundTrip[] = [];
  for (const [i, row] of rows.entries()) {
    const qty = Number(row[col.qty!]);
    if (!Number.isFinite(qty) || qty <= 0) throw new Error(`Row ${i + 2}: invalid paired qty "${row[col.qty!]}"`);

    roundTrips.push({
      pairId: col.pairId ? (row[col.pairId] ?? null) : null,
      buyFillId: col.buyFillId ? (row[col.buyFillId] ?? null) : null,
      sellFillId: col.sellFillId ? (row[col.sellFillId] ?? null) : null,
      accountName: col.account ? accountRef(row[col.account]) : null,
      symbol: row[col.symbol!],
      contract: col.contract ? (row[col.contract] ?? null) : null,
      qty,
      buyPriceMicros: toMicros(row[col.buyPrice!]),
      sellPriceMicros: toMicros(row[col.sellPrice!]),
      pnlCentsGross: toCents(row[col.pnl!]),
      boughtAtLocal: col.boughtAt ? localTime(row[col.boughtAt]) : null,
      soldAtLocal: col.soldAt ? localTime(row[col.soldAt]) : null,
      raw: row,
    });
  }

  return roundTrips;
}
