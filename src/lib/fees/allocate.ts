// Per-round-trip NET P&L: gross minus the fees that trade actually incurred.
//
// Ported from run-trading@desk-call `src/lib/extract/net-pnl.ts`, with the database query
// wrapper removed. The original imported `@/lib/db` at module scope purely for a convenience
// function, which forced every consumer — including a disk-only script — through env.ts and the
// server-only guard. The allocation itself was already pure; this is just that half.
//
// WHY THE SPLIT IS EXACT, NOT ESTIMATED
// Tradovate charges a flat rate per contract per side. Measured across a real 10-day export,
// every fee resolves to exactly two rates: MNQ $0.95/contract, NQ $2.88/contract. So a fill's
// cost is rate x qty, and a round trip's cost is pairedQty x (entry rate + exit rate). Summing
// that over every round trip reproduced the file's total fees to the cent, with no remainder and
// no unmatched trades. There is no pro-rata guesswork here.
//
// Cash History names no fill id, so fees key to fills by (local timestamp, contract) — see
// shared.ts `feeBucket`. When several fills share one bucket the rate comes from the bucket's
// own totals (fees / qty), which is still exact because the rate is per contract.

/**
 * The bound on a believable commission: $20 per contract per ROUND TURN.
 *
 * ONE COPY, imported by both callers. It used to be two — `FEE_CEILING_PER_CONTRACT_CENTS` in
 * `intake/preflight.ts` and `FEE_SANITY_CEILING_CENTS` in `desk/tape.ts` — with each file's
 * comment asserting the two agreed, under different names, so a grep for either one missed the
 * other. They did not agree: preflight divided by FILL quantity, which double-counts because
 * every contract appears in an entry fill and an exit fill, so it blocked at an effective $40
 * while the tape blocked at $20. The constant was never the thing that drifted. The denominator
 * was, and a shared constant with two denominators is not a shared bound.
 *
 * DELIBERATELY GENEROUS. A real futures commission is single-digit dollars per contract round
 * turn, so this sits far above any retail or prop schedule: it catches a broken export, it does
 * not police anyone's pricing.
 *
 * BOTH ENDS STILL CHECK, on purpose. Ingest is where it belongs (`spec.md` §S1: "plausibility
 * belongs at ingest, in code") because a read that flags a number is flagging one already written
 * to an append-only log. The tape keeps its own call because a corpus can also arrive through an
 * API that does not exist yet, and a read should not trust its input either.
 */
export const FEE_CEILING_PER_CONTRACT_ROUND_TURN_CENTS = 2_000;

export interface RoundTripNet {
  eventId: number;
  grossCents: number;
  feeCents: number; // negative
  netCents: number;
}

export interface NetPnl {
  byRoundTrip: Map<number, RoundTripNet>;
  grossCents: number;
  feeCents: number; // negative; the WHOLE tape's fees, allocated or not
  netCents: number;
  /** False when no fee data exists at all, i.e. no Cash History was ever read. */
  hasFees: boolean;
  /** Fees belonging to no completed round trip (an open or partially paired position). */
  unallocatedFeeCents: number;
}

export interface NetPnlRow {
  id: number;
  type: string;
  pnlCents: number | null;
  payload: Record<string, unknown>;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

export function allocateFees(rows: NetPnlRow[]): NetPnl {
  // 1. Fee totals and fill quantities per bucket, so a bucket's per-contract rate can be
  //    derived even when two fills share one timestamp+contract.
  const feeByBucket = new Map<string, number>();
  const qtyByBucket = new Map<string, number>();
  const fillBucket = new Map<string, string>(); // externalFillId -> bucketKey
  let feeTotal = 0;
  let grossTotal = 0;
  let feeRowCount = 0;
  const roundTrips: NetPnlRow[] = [];

  for (const r of rows) {
    if (r.type === 'fee') {
      feeRowCount++;
      feeTotal += r.pnlCents ?? 0;
      const key = str(r.payload.bucketKey);
      if (key) feeByBucket.set(key, (feeByBucket.get(key) ?? 0) + (r.pnlCents ?? 0));
    } else if (r.type === 'fill') {
      const key = str(r.payload.feeBucketKey);
      const id = str(r.payload.externalFillId);
      const qty = num(r.payload.qty) ?? 0;
      if (key) {
        qtyByBucket.set(key, (qtyByBucket.get(key) ?? 0) + qty);
        if (id) fillBucket.set(id, key);
      }
    } else {
      roundTrips.push(r);
      grossTotal += r.pnlCents ?? 0;
    }
  }

  if (feeRowCount === 0) {
    return {
      byRoundTrip: new Map(),
      grossCents: grossTotal,
      feeCents: 0,
      netCents: grossTotal,
      hasFees: false,
      unallocatedFeeCents: 0,
    };
  }

  // 2. Per-contract rate for each bucket. Negative, like the fee it came from.
  const rate = new Map<string, number>();
  for (const [key, fees] of feeByBucket) {
    const qty = qtyByBucket.get(key);
    if (qty && qty > 0) rate.set(key, fees / qty);
  }

  // 3. Allocate: pairedQty x (entry rate + exit rate).
  const byRoundTrip = new Map<number, RoundTripNet>();
  let allocated = 0;
  for (const rt of roundTrips) {
    const qty = num(rt.payload.qty) ?? 0;
    const gross = rt.pnlCents ?? 0;
    let perContract = 0;
    for (const side of ['buyFillId', 'sellFillId'] as const) {
      const fillId = str(rt.payload[side]);
      const bucket = fillId ? fillBucket.get(fillId) : undefined;
      const r = bucket ? rate.get(bucket) : undefined;
      if (r !== undefined) perContract += r;
    }
    // Round once, at the end: rates are exact per contract, so rounding per side would
    // accumulate a cent of drift per trade across hundreds of trades.
    const feeCents = Math.round(perContract * qty);
    allocated += feeCents;
    byRoundTrip.set(rt.id, { eventId: rt.id, grossCents: gross, feeCents, netCents: gross + feeCents });
  }

  return {
    byRoundTrip,
    grossCents: grossTotal,
    feeCents: feeTotal,
    netCents: grossTotal + feeTotal,
    hasFees: true,
    // Non-zero means fees exist for fills that never closed into a round trip. Reported rather
    // than hidden: it is the honest gap between per-trade nets and the account's real total.
    unallocatedFeeCents: feeTotal - allocated,
  };
}
