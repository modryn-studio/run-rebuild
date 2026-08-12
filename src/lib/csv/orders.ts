// Parses a Tradovate "Orders" export into normalized order rows — the DECISION layer.
//
// Why this exists at all: fills record what happened, orders record what the trader chose.
// A fills-only view cannot tell an exit the trader took from an exit his stop took for him,
// and Run shipped a false read on exactly that confusion (see the removal note in
// extract/aggregate.ts). On one real session fills carry 9 events while orders carry 17 plus
// a version history, and the half that is missing is the half where discipline lives.
//
// Two things here exist nowhere else in the export set:
//   - CANCELS. An order placed and pulled is a decision with no fill to show for it.
//   - AMENDMENTS. `Version ID` differs from `orderId` when an order was modified, which is
//     the only evidence a stop was MOVED. Tradovate collapses each order to its final
//     version, so intermediate states are lost, but the fact of amendment survives.
//
// Like Position History, this export has NO UTC column — `Timestamp` and `Fill Time` are
// local wall-clock with no zone. They are parsed as *Local and the true instant is resolved
// downstream from the fills these orders reference (see desk/tape.ts).
import { parse } from 'csv-parse/sync';
import { ACCOUNT_ALIASES, accountRef, findColumn, toMicros, parseTimestamp } from './shared';

/** Tradovate's order types, normalized. Anything unrecognized is kept verbatim as `other`. */
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit' | 'other';
/** Only the two terminal states matter here; anything else is carried through as `other`. */
export type OrderStatus = 'filled' | 'canceled' | 'other';

export interface ParsedOrder {
  externalOrderId: string | null; // Tradovate orderId — the dedupe key (`o:<id>`)
  // The order's final VERSION id. When it differs from externalOrderId the order was
  // amended at least once. This is the only signal in the whole export set that a working
  // order was modified, and therefore the only way to see a stop being trailed.
  versionId: string | null;
  amended: boolean;
  accountName: string | null;
  symbol: string; // root product, e.g. "MNQ"
  contract: string | null; // specific contract, e.g. "MNQU6"
  side: 'buy' | 'sell';
  type: OrderType;
  typeRaw: string; // verbatim, so an unmapped type is still legible in the tape
  status: OrderStatus;
  statusRaw: string;
  qty: number; // the order's quantity, NOT the filled quantity
  limitPriceMicros: number | null;
  stopPriceMicros: number | null;
  filledQty: number | null;
  avgFillPriceMicros: number | null;
  // Local wall-clock, no zone (see file header). `placedAtLocal` is this order's FINAL
  // version's timestamp, so on an amended order it is when it was last modified, not when
  // it was first placed — Tradovate does not export the original.
  placedAtLocal: Date | null;
  filledAtLocal: Date | null;
  // Where the order came from, e.g. "Tradingview". Provenance, and occasionally the read:
  // an order routed from a chart platform is a different act than one typed into the DOM.
  source: string | null;
  raw: Record<string, unknown>;
}

const ALIASES = {
  orderId: ['order id', 'orderid'],
  versionId: ['version id'],
  side: ['b/s', 'buy/sell', 'side'],
  symbol: ['product', 'contract', 'symbol'],
  contract: ['contract'],
  type: ['type'],
  status: ['status'],
  qty: ['quantity'],
  limitPrice: ['limit price'],
  stopPrice: ['stop price'],
  filledQty: ['filled qty', 'filledqty'],
  avgFillPrice: ['avg fill price', 'avgprice'],
  placedAt: ['timestamp'],
  filledAt: ['fill time'],
  source: ['text'],
  account: ACCOUNT_ALIASES,
} as const;

function parseSide(raw: string): 'buy' | 'sell' {
  const v = raw.trim().toLowerCase();
  if (v === 'buy' || v === 'b') return 'buy';
  if (v === 'sell' || v === 's') return 'sell';
  throw new Error(`Unrecognized side value: "${raw}"`);
}

// Stop-limit is checked before the bare forms: Tradovate writes it as "Stop Limit", which
// would otherwise match "stop" and silently lose the limit leg.
function parseType(raw: string): OrderType {
  const v = raw.trim().toLowerCase();
  if (v.includes('stop') && v.includes('limit')) return 'stop_limit';
  if (v.includes('market')) return 'market';
  if (v.includes('limit')) return 'limit';
  if (v.includes('stop')) return 'stop';
  return 'other';
}

function parseStatus(raw: string): OrderStatus {
  const v = raw.trim().toLowerCase();
  if (v.includes('filled')) return 'filled';
  if (v.includes('cancel')) return 'canceled';
  return 'other';
}

export function parseTradovateOrdersCsv(csvText: string): ParsedOrder[] {
  const rows: Record<string, string>[] = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]);
  const col = {
    orderId: findColumn(headers, ALIASES.orderId),
    versionId: findColumn(headers, ALIASES.versionId),
    side: findColumn(headers, ALIASES.side),
    symbol: findColumn(headers, ALIASES.symbol),
    contract: findColumn(headers, ALIASES.contract),
    type: findColumn(headers, ALIASES.type),
    status: findColumn(headers, ALIASES.status),
    qty: findColumn(headers, ALIASES.qty),
    limitPrice: findColumn(headers, ALIASES.limitPrice),
    stopPrice: findColumn(headers, ALIASES.stopPrice),
    filledQty: findColumn(headers, ALIASES.filledQty),
    avgFillPrice: findColumn(headers, ALIASES.avgFillPrice),
    placedAt: findColumn(headers, ALIASES.placedAt),
    filledAt: findColumn(headers, ALIASES.filledAt),
    source: findColumn(headers, ALIASES.source),
    account: findColumn(headers, ALIASES.account),
  };

  const required = ['symbol', 'side', 'type', 'status', 'qty'] as const;
  const missing = required.filter((k) => col[k] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Orders CSV is missing required column(s): ${missing.join(', ')}. Found headers: ${headers.join(', ')}`
    );
  }

  const cell = (row: Record<string, string>, c: string | undefined) => {
    const v = c ? row[c]?.trim() : undefined;
    return v ? v : undefined;
  };
  // A limit and a stop are QUOTES, not money — micro precision, see shared.ts.
  const quote = (v: string | undefined) => (v === undefined ? null : toMicros(v));
  const localTime = (v: string | undefined) => (v === undefined ? null : parseTimestamp(v));

  const orders: ParsedOrder[] = [];
  for (const [i, row] of rows.entries()) {
    const qty = Number(row[col.qty!]);
    if (!Number.isFinite(qty) || qty <= 0) throw new Error(`Row ${i + 2}: invalid quantity "${row[col.qty!]}"`);

    const orderId = cell(row, col.orderId) ?? null;
    const versionId = cell(row, col.versionId) ?? null;
    const filledQtyRaw = cell(row, col.filledQty);

    orders.push({
      externalOrderId: orderId,
      versionId,
      // Both must be present to claim an amendment. A missing Version ID means the export
      // did not say, which is not the same as saying it was never modified.
      amended: orderId !== null && versionId !== null && orderId !== versionId,
      accountName: col.account ? accountRef(row[col.account]) : null,
      symbol: row[col.symbol!],
      contract: cell(row, col.contract) ?? null,
      side: parseSide(row[col.side!]),
      type: parseType(row[col.type!]),
      typeRaw: row[col.type!].trim(),
      status: parseStatus(row[col.status!]),
      statusRaw: row[col.status!].trim(),
      qty,
      limitPriceMicros: quote(cell(row, col.limitPrice)),
      stopPriceMicros: quote(cell(row, col.stopPrice)),
      filledQty: filledQtyRaw === undefined ? null : Number(filledQtyRaw),
      avgFillPriceMicros: quote(cell(row, col.avgFillPrice)),
      placedAtLocal: localTime(cell(row, col.placedAt)),
      filledAtLocal: localTime(cell(row, col.filledAt)),
      source: cell(row, col.source) ?? null,
      raw: row,
    });
  }

  return orders;
}
