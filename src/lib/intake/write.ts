import 'server-only';
import type { ParsedFill } from '@/lib/csv/fills';
import type { ParsedRoundTrip } from '@/lib/csv/position-history';
import type { ParsedFee } from '@/lib/csv/cash-history';
import type { ParsedOrder } from '@/lib/csv/orders';

/* THE ONE PLACE A PARSED ROW BECOMES AN EVENT.
 *
 * Every intake funnels through here — CSV today, the broker's API later — so the event shape and
 * the dedupe rule exist once. Two intakes that each build their own row values is how the same
 * fill ends up in the corpus twice under two different keys, and the log is append-only, so that
 * is not a thing you fix afterwards.
 *
 * DEDUPE KEYS ARE NAMESPACED BY TYPE — `f:` fills, `p:` round trips, `x:` cash, `o:` orders.
 * Tradovate's ids are only unique within their own export, so a fill and a round trip can carry
 * the same number. Without the prefix the partial unique index on `(account_id, dedupe_key)`
 * would treat them as the same row and silently drop the second one.
 *
 * A NULL KEY IS NOT AN ERROR. The index is partial, so a row whose source gave it no id still
 * inserts — it just cannot be deduped, which is the honest outcome rather than inventing a
 * synthetic key that would differ between two exports of the same trade.
 */

export type IntakeSource = 'csv' | 'api';

export const fillDedupeKey = (f: ParsedFill): string | null => {
  if (f.externalFillId) return `f:${f.externalFillId}`;

  /* THE ORDER-ID FALLBACK NEEDS MORE THAN THE ORDER ID, and "a stable weak key beats no key at
   * all" — what this comment used to say — had it exactly backwards.
   *
   * One order filling in three partials produced three events with the identical `f:<orderId>`.
   * The partial unique index on `(account_id, dedupe_key)` then does what it is asked: Postgres
   * skips the duplicates under `onConflictDoNothing`, so TWO REAL EXECUTIONS ARE DROPPED, in
   * silence, and `rowsWritten` reports 1 where the parser produced 3 — indistinguishable from a
   * legitimate re-import. A null key would have inserted all three. So the weak key was not
   * weaker than no key, it was worse: it deleted data no key would have kept.
   *
   * The instant, side, quantity and price make the leg distinct while staying stable across two
   * exports of the same trade, which is the only property the key actually needs. */
  if (!f.externalOrderId) return null;
  const leg = [f.filledAt.toISOString(), f.side, f.qty, f.priceMicros].join('|');
  return `f:${f.externalOrderId}:${leg}`;
};
export const roundTripDedupeKey = (rt: ParsedRoundTrip): string | null =>
  rt.pairId ? `p:${rt.pairId}` : null;
export const feeDedupeKey = (fee: ParsedFee): string | null =>
  fee.transactionId ? `x:${fee.transactionId}` : null;
export const orderDedupeKey = (o: ParsedOrder): string | null =>
  o.externalOrderId ? `o:${o.externalOrderId}` : null;

/** How a round trip's true instant was arrived at. Recorded on the payload so a later reader can
 *  tell a resolved instant from a guessed one rather than trusting all of them equally. */
export type TimeSource = 'fills_utc' | 'position_local' | 'ingest_time';

export interface EventValues {
  traderId: string;
  accountId: string;
  importId: string;
  type: 'fill' | 'round_trip' | 'fee' | 'order';
  source: IntakeSource;
  payload: Record<string, unknown>;
  payloadVersion?: number;
  pnlCents?: number | null;
  symbol?: string | null;
  qty?: number | null;
  side?: string | null;
  occurredAt: Date;
  dedupeKey: string | null;
}

interface Common {
  traderId: string;
  accountId: string;
  importId: string;
  source: IntakeSource;
}

/** Fills. `pnl_cents` stays null: a single leg has no realised P&L, and writing a zero there
 *  would make it summable, which is exactly the arithmetic that must never happen. */
export function fillEventValues(c: Common, fills: ParsedFill[]): EventValues[] {
  return fills.map((fill) => ({
    ...c,
    type: 'fill',
    payload: { ...fill },
    symbol: fill.symbol,
    qty: fill.qty,
    side: fill.side,
    occurredAt: fill.filledAt, // already UTC out of the parser
    dedupeKey: fillDedupeKey(fill),
  }));
}

/** Round trips. The caller resolves `occurredAt` (see `resolveRoundTripInstant`) because only it
 *  holds the fills this trip references.
 *
 *  `pnlBasis: 'gross'` is stamped on the payload deliberately. Net is DERIVED at read time and
 *  never stored — the batch ingests fills, then position history, then cash history, so at the
 *  moment this row is written its fees do not exist yet, and an append-only log cannot revise it
 *  afterwards. A reader that finds this number and forgets it is pre-fee reports gross as net. */
export function roundTripEventValues(
  c: Common,
  items: { rt: ParsedRoundTrip; occurredAt: Date; timeSource: TimeSource }[]
): EventValues[] {
  return items.map(({ rt, occurredAt, timeSource }) => ({
    ...c,
    type: 'round_trip',
    payload: { ...rt, pnlBasis: 'gross', timeSource },
    symbol: rt.symbol,
    qty: rt.qty,
    pnlCents: rt.pnlCentsGross,
    occurredAt,
    dedupeKey: roundTripDedupeKey(rt),
  }));
}

/** Fees. The SIGNED cash delta goes in `pnl_cents` (negative for a cost), which is what makes net
 *  P&L a single sum over `round_trip` + `fee` rather than a join.
 *
 *  `occurredAt` IS THE FILL'S INSTANT, passed in by the caller — never Cash History's own local
 *  string. That column carries no zone, so parsing it resolves against the server's offset and
 *  files an evening fee under the previous trade date: the trade is then found by a windowed query
 *  and its fee is not, so it prices at zero fees and reads net on one page and gross on another. */
export function feeEventValues(
  c: Common,
  fees: { fee: ParsedFee; occurredAt: Date }[]
): EventValues[] {
  return fees.map(({ fee, occurredAt }) => ({
    ...c,
    type: 'fee',
    payload: { ...fee },
    symbol: fee.contract,
    pnlCents: fee.deltaCents,
    occurredAt,
    dedupeKey: feeDedupeKey(fee),
  }));
}

/** Orders. Carries no P&L — an order is an intention, and most of them never fill. They are in
 *  the corpus because they are the only record of a stop being placed, moved or cancelled, which
 *  is the difference between a trade the trader closed and one the platform closed for them. */
export function orderEventValues(
  c: Common,
  items: { order: ParsedOrder; occurredAt: Date; timeSource: TimeSource }[]
): EventValues[] {
  return items.map(({ order, occurredAt, timeSource }) => ({
    ...c,
    type: 'order',
    payload: { ...order, timeSource },
    symbol: order.symbol,
    qty: order.qty,
    side: order.side,
    occurredAt,
    dedupeKey: orderDedupeKey(order),
  }));
}

/* A ROUND TRIP'S TRUE INSTANT COMES FROM ITS FILLS.
 *
 * Position History carries local wall-clock only, with no zone — so its own timestamps cannot
 * become an instant without guessing an offset. The fills it references DO carry UTC, so the
 * resolution order is: the fills, then the export's local time, then ingest time. Each outcome is
 * labelled on the payload rather than being silently equivalent.
 *
 * THE LATER OF THE TWO FILLS, which is the close. `session_date` derives from `exit_at` (CLAUDE.md)
 * — a trade belongs to the session it was realised in — so taking the open would file every
 * overnight trade under the wrong day.
 */
export function resolveRoundTripInstant(
  rt: ParsedRoundTrip,
  fillInstantByExternalId: Map<string, Date>
): { at: Date; timeSource: TimeSource } {
  const fromFills = [rt.buyFillId, rt.sellFillId]
    .map((id) => (id ? fillInstantByExternalId.get(id) : undefined))
    .filter((d): d is Date => d instanceof Date);
  if (fromFills.length > 0) {
    return { at: new Date(Math.max(...fromFills.map((d) => d.getTime()))), timeSource: 'fills_utc' };
  }

  const local = [rt.boughtAtLocal, rt.soldAtLocal].filter((d): d is Date => d instanceof Date);
  if (local.length > 0) {
    return { at: new Date(Math.max(...local.map((d) => d.getTime()))), timeSource: 'position_local' };
  }

  // Deliberately last, and deliberately labelled: an ingest-time instant is not when the trade
  // happened, and anything bucketing on it is reporting the upload rather than the trading.
  return { at: new Date(), timeSource: 'ingest_time' };
}
