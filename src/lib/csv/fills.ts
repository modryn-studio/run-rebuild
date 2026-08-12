// Parses a Tradovate "Fills" export into normalized fill rows — the atomic ground truth
// and canonical intake: the only export with a true UTC timestamp (`_timestamp`) plus
// commission per execution. The plain `Timestamp` column is LOCAL time and must not be
// used as the instant. A misread here corrupts Layer 1 (docs/data-model.md), so the
// parser throws on a missing required column rather than guessing.
import { parse } from 'csv-parse/sync';
import {
  ACCOUNT_ALIASES,
  BROKER_ACCOUNT_ID_ALIASES,
  accountRef,
  feeBucket,
  findColumn,
  toCents,
  toMicros,
  parseTimestamp,
} from './shared';

export interface ParsedFill {
  externalFillId: string | null; // Tradovate Fill ID — unique per execution (dedupe key)
  externalOrderId: string | null;
  accountName: string | null; // e.g. "FTDFYL100183704873" — which account this fill belongs to
  brokerAccountId: string | null; // Tradovate's numeric account id, e.g. "56963172"
  symbol: string; // root product, e.g. "MNQ"
  contract: string | null; // specific contract, e.g. "MNQU6"
  side: 'buy' | 'sell';
  qty: number;
  /** A QUOTE at micro precision (x1e6), NOT cents. See shared.ts toMicros. */
  priceMicros: number;
  // The export's `commission` column, which is ONLY Tradovate's commission line. Measured on
  // a real export it is 42% of the true per-trade cost — Exchange, Clearing and NFA fees are
  // separate rows that exist only in Cash History. Kept for provenance; never treat it as
  // the cost of trading (see cash-history.ts, which ingests all four as `fee` events).
  commissionCents: number | null;
  filledAt: Date; // UTC
  // The RAW local wall-clock string ("07/08/2026 08:32:45") - no zone of its own, never parsed
  // as an instant. Used only to derive the trader's true UTC offset (lib/trader/timezone.ts) by
  // diffing it against filledAt; null on the API path, which has no local-time source at all.
  localTimeRaw: string | null;
  // Join key to this fill's fee rows in Cash History (see shared.ts feeBucket). Null on the
  // API path, which has no fee source yet.
  feeBucketKey: string | null;
  raw: Record<string, unknown>; // CSV row (strings) or the raw API fill object
}

const ALIASES = {
  fillId: ['fill id', '_id'],
  orderId: ['order id', '_orderid', 'orderid'],
  symbol: ['product', 'contract', 'symbol'], // prefer the root product for aggregation
  contract: ['contract'],
  side: ['b/s', 'buy/sell', 'side'],
  qty: ['quantity', 'filled qty', 'filledqty', 'qty filled', '_qty'],
  price: ['price', 'avg fill price', 'avgprice', '_price'],
  time: ['_timestamp', 'fill time', 'timestamp', 'date'], // _timestamp is UTC — prefer it
  // The LOCAL wall-clock column, kept separately from `time`. Not an instant: its only job is
  // to key this fill to its Cash History fee rows, which carry the same local string.
  localTime: ['timestamp'],
  commission: ['commission'],
  status: ['status'],
  account: ACCOUNT_ALIASES,
  brokerAccountId: BROKER_ACCOUNT_ID_ALIASES,
} as const;

function parseSide(raw: string): 'buy' | 'sell' {
  const v = raw.trim().toLowerCase();
  if (v === 'buy' || v === 'b') return 'buy';
  if (v === 'sell' || v === 's') return 'sell';
  throw new Error(`Unrecognized side value: "${raw}"`);
}

export function parseTradovateFillsCsv(csvText: string): ParsedFill[] {
  const rows: Record<string, string>[] = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]);
  const col = {
    fillId: findColumn(headers, ALIASES.fillId),
    orderId: findColumn(headers, ALIASES.orderId),
    symbol: findColumn(headers, ALIASES.symbol),
    contract: findColumn(headers, ALIASES.contract),
    side: findColumn(headers, ALIASES.side),
    qty: findColumn(headers, ALIASES.qty),
    price: findColumn(headers, ALIASES.price),
    time: findColumn(headers, ALIASES.time),
    commission: findColumn(headers, ALIASES.commission),
    status: findColumn(headers, ALIASES.status),
    account: findColumn(headers, ALIASES.account),
    brokerAccountId: findColumn(headers, ALIASES.brokerAccountId),
    localTime: findColumn(headers, ALIASES.localTime),
  };

  const required = ['symbol', 'side', 'qty', 'price', 'time'] as const;
  const missing = required.filter((k) => col[k] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Fills CSV is missing required column(s): ${missing.join(', ')}. Found headers: ${headers.join(', ')}`
    );
  }

  const fills: ParsedFill[] = [];
  for (const [i, row] of rows.entries()) {
    // Orders export carries a status; only completed fills belong in the corpus. The
    // Fills export has no status column — every row is already a fill.
    if (col.status && !/filled/i.test(row[col.status] ?? '')) continue;

    const qty = Number(row[col.qty!]);
    if (!Number.isFinite(qty) || qty <= 0) throw new Error(`Row ${i + 2}: invalid quantity "${row[col.qty!]}"`);

    fills.push({
      externalFillId: col.fillId ? (row[col.fillId] ?? null) : null,
      externalOrderId: col.orderId ? (row[col.orderId] ?? null) : null,
      accountName: col.account ? accountRef(row[col.account]) : null,
      brokerAccountId: col.brokerAccountId ? accountRef(row[col.brokerAccountId]) : null,
      symbol: row[col.symbol!],
      contract: col.contract ? (row[col.contract] ?? null) : null,
      side: parseSide(row[col.side!]),
      qty,
      priceMicros: toMicros(row[col.price!]),
      commissionCents: col.commission && row[col.commission] ? toCents(row[col.commission]) : null,
      filledAt: parseTimestamp(row[col.time!]),
      localTimeRaw: col.localTime ? (row[col.localTime] ?? null) : null,
      feeBucketKey: feeBucket(col.localTime ? row[col.localTime] : undefined, col.contract ? row[col.contract] : undefined),
      raw: row,
    });
  }

  return fills;
}
