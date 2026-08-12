// Shared CSV helpers + Tradovate export-type detection. Each Tradovate account report
// (Fills, Position History, Cash History, Orders, …) has a distinct header signature;
// we detect which one was uploaded and route to the right parser rather than guessing.
export const normalizeHeader = (h: string) => h.trim().toLowerCase();

// Aliases are tried in order; the first present column wins.
export function findColumn(headers: string[], aliases: readonly string[]): string | undefined {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx !== -1) return headers[idx];
  }
  return undefined;
}

// MONEY as integer cents. Tolerates $, commas, and accounting-negative parens like "$(132.50)".
// Only for money — a QUOTE goes through toMicros below.
export function toCents(raw: string): number {
  return Math.round(scalar(raw) * 100);
}

// A QUOTE, at micro-unit precision (x 1e6). NOT cents, and the name says so on purpose.
//
// ── WHY THIS EXISTS: THE BUG IT REPLACES ─────────────────────────────────────────────────
// Prices used to go through toCents, i.e. round(price x 100). That is correct for money and
// silently wrong for a quote, because precision belongs to the instrument:
//
//     6E at 1.08500  ->  stored 109  ->  renders 1.09
//     6A at 0.65430  ->  stored  65  ->  renders 0.65
//
// A 6E trade from 1.08500 to 1.08600 stored as 109 -> 109: identical entry and exit printed
// beside a real profit, so a read would describe a trade that never moved. Confidently wrong,
// which is the one thing this project must not ship. MNQ and NQ are unaffected by the old scale,
// which is exactly why it was invisible and why fixing it now is free.
//
// 1e6 is chosen, not arbitrary: ES at 6850.25 becomes 6.85e9 and 6E at 1.085 becomes 1,085,000,
// both far inside Number.MAX_SAFE_INTEGER, and six decimals covers every listed decimal product
// including ones never seen. Lossless representation turns "unknown instrument" from a
// corruption risk into a non-event.
export const PRICE_SCALE = 1_000_000;

export function toMicros(raw: string): number {
  return Math.round(scalar(raw) * PRICE_SCALE);
}

function scalar(raw: string): number {
  const cleaned = raw.replace(/[$,]/g, '').trim();
  const negative = /^\(.*\)$/.test(cleaned);
  const n = Number(cleaned.replace(/[()]/g, ''));
  if (!Number.isFinite(n)) throw new Error(`Unparseable numeric value: "${raw}"`);
  return negative ? -n : n;
}

// The UTC `_timestamp` uses a space instead of 'T' ("2026-07-02 13:25:21.925Z");
// normalize so every engine parses it as UTC rather than local.
export function parseTimestamp(raw: string): Date {
  const trimmed = raw.trim();
  const normalized = /z$/i.test(trimmed) ? trimmed.replace(' ', 'T') : trimmed;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) throw new Error(`Unparseable timestamp: "${raw}"`);
  return d;
}

// Account identity, shared by every parser. Verified against a real six-file export
// (2026-07-22): the account NAME ("FTDFYL100183704873") is the only key present in ALL
// exports, so it is the natural identity. Tradovate's numeric id ("56963172") appears only
// in Fills and Account Balance History, so it is stored alongside when available rather
// than used as the key. Without this a copy-trader's accounts all collapse into one bucket,
// and the event log is append-only so it can never be re-tagged afterwards.
export const ACCOUNT_ALIASES = ['account', 'account name'] as const;
export const BROKER_ACCOUNT_ID_ALIASES = ['_accountid', 'account id'] as const;

// Trim to null: an absent account column and a blank cell must behave identically.
export function accountRef(raw: string | undefined): string | null {
  const v = raw?.trim();
  return v ? v : null;
}

// The join key between a FILL and its FEES. Cash History never names a fill id, but it does
// carry the same local wall-clock timestamp and contract as the fill that incurred the fee,
// so (timestamp, contract) is the link.
//
// Deliberately built from the RAW STRINGS, never parsed Dates: Cash History's timestamp has
// no timezone, so parsing it would resolve against whatever zone the server happens to run
// in, silently shifting every fee by the CT offset. String equality can't drift.
export function feeBucket(rawTimestamp: string | undefined, contract: string | undefined): string | null {
  const t = rawTimestamp?.trim();
  const c = contract?.trim();
  return t && c ? `${t}|${c}` : null;
}

export type TradovateFileType =
  | 'fills'
  | 'position_history'
  | 'cash_history'
  | 'orders'
  | 'account_balance'
  | 'performance';

// Detect by distinctive headers. Returns undefined if it matches none (caller decides
// whether to error). Checked most-specific first.
export function detectTradovateFileType(headers: string[]): TradovateFileType | undefined {
  const h = new Set(headers.map(normalizeHeader));
  if (h.has('pair id') && h.has('p/l')) return 'position_history';
  if (h.has('cash change type')) return 'cash_history';
  if (h.has('total realized pnl')) return 'account_balance';
  if (h.has('buyfillid') && h.has('sellfillid')) return 'performance';
  if (h.has('fill id') && (h.has('b/s') || h.has('_action'))) return 'fills';
  if (h.has('status') && h.has('filled qty')) return 'orders';
  return undefined;
}
