// THE THIRD RECEIPT: our net, per session date, against the broker's own daily statement.
//
// Run makes one claim — "our numbers are the broker's numbers" — and the intake now checks it
// three times, against three different things:
//
//   1. `round_trips_unmatched` / `fees_unmatched`   the rows LINE UP           (structure)
//   2. `pnl_unreconciled`                            the PAIRING is right      (gross)
//   3. this file                                     the COST is right, per day (net)
//
// Only the third can fail while the first two pass, and on the reference export it is the one
// that matters most: fees (-1,934.36) exceeded the gross loss (-1,840.50). A build can pair every
// trade perfectly, reconcile gross to the cent, and still be wrong by more than the entire loss.
//
// PER DAY, NEVER ON THE TOTAL, and this is the whole design.
//
// `Trade Date` in Account Balance History is Tradovate's own session-date assignment. Run derives
// `session_date` from `exit_at` across a 17:00 `America/Chicago` boundary. Comparing day by day
// puts those two answers to the same question side by side, which is why this check is per-day and
// not on the total: move an evening trade one day late and the grand total stays exact while two
// days are wrong in equal and opposite directions. That is the failure CLAUDE.md warns hardest
// about, and the word it uses is SILENTLY.
//
//   > `SESSION_BOUNDARY_ZONE` and `SESSION_BOUNDARY_HOUR` travel together. Pairing that zone with
//   > `18` (or New York with `17`) files an hour of every evening session under the wrong trade
//   > date, silently.
//
// WHAT THIS DOES NOT PROVE, measured 2026-08-15 and worth knowing before trusting it too far:
// the reference export contains ZERO trades at or after 17:00 Chicago. All 612 fills land between
// 08:00 and 14:59 — a pure day-session trader. So the 12-day $0.00 reconciliation on that file is
// real, but it says NOTHING about the boundary: set the hour to 18, or the zone to New York, and
// every one of those days still reconciles. The boundary is exercised by a synthetic evening
// round trip in `s4-gate.mts` instead, and that fixture is load-bearing rather than decorative —
// it is the only place the rule is tested at all. The first real evening trader to import is the
// first real test, which is an argument for keeping this check on rather than for trusting it.
import type { ParsedFill } from '@/lib/csv/fills';
import type { ParsedRoundTrip } from '@/lib/csv/position-history';
import type { ParsedFee } from '@/lib/csv/cash-history';
import type { ParsedBalanceDay } from '@/lib/csv/account-balance';
import { sessionDateFor } from '@/lib/time/session';
import { resolveRoundTripInstant } from './write';

export interface StatementDay {
  sessionDate: string;
  /** What the broker's statement says the day realised, net of fees. */
  brokerCents: number;
  /** What our round trips and fees say, for the same day. */
  ourCents: number;
  ourGrossCents: number;
  ourFeeCents: number;
  diffCents: number;
  roundTrips: number;
}

export interface StatementReconciliation {
  /** Days both sides can speak for. Days only one side knows about are not a disagreement. */
  compared: StatementDay[];
  /** The subset that disagree. Empty is the only acceptable result. */
  mismatched: StatementDay[];
  totalDiffCents: number;
  /** Statement days outside the upload's window. Reported, never counted as agreement. */
  outsideWindow: string[];
  /** Fees whose bucket reached no fill, so they could not be dated. Never silently binned. */
  unbucketedFeeCents: number;
}

/**
 * Reconcile an upload against the broker's daily statement.
 *
 * Pure, like the rest of preflight: everything needed is in the parsed files, so this runs before
 * a single row is written rather than after.
 */
export function reconcileAgainstStatement(args: {
  fills: ParsedFill[];
  roundTrips: ParsedRoundTrip[];
  fees: ParsedFee[];
  statement: ParsedBalanceDay[];
}): StatementReconciliation {
  const { fills, roundTrips, fees, statement } = args;

  const instantByFillId = new Map<string, Date>();
  const fillByBucket = new Map<string, ParsedFill>();
  for (const f of fills) {
    if (f.externalFillId) instantByFillId.set(f.externalFillId, f.filledAt);
    // First fill wins: a bucket is (local timestamp, contract), and every fill sharing one shares
    // its instant to the second, so which one answers for the day cannot differ.
    if (f.feeBucketKey && !fillByBucket.has(f.feeBucketKey)) fillByBucket.set(f.feeBucketKey, f);
  }

  const gross = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const rt of roundTrips) {
    /* THE SAME RESOLVER THE WRITE PATH USES, deliberately, and this is what makes the check
       meaningful. Recomputing the session date some other way here would test this file's
       arithmetic against the broker instead of testing what actually gets STORED. */
    const { at } = resolveRoundTripInstant(rt, instantByFillId);
    const d = sessionDateFor(at);
    gross.set(d, (gross.get(d) ?? 0) + rt.pnlCentsGross);
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }

  /* A FEE'S DAY COMES FROM ITS FILL, never from its own timestamp. Cash History timestamps carry
     no timezone (CLAUDE.md: fees key to fills on RAW strings, because parsing them shifts every
     fee by the server's offset). The bucket key reaches the fill, the fill carries a real UTC
     instant, and that instant goes through the one bucketer. A fee whose bucket matches nothing
     is dropped from this comparison rather than guessed at — `fees_unmatched` is the finding that
     exists for that, and silently binning it here would let a broken fee join land on a day. */
  const feeByDay = new Map<string, number>();
  let unbucketedFeeCents = 0;
  for (const fee of fees) {
    const fill = fee.bucketKey ? fillByBucket.get(fee.bucketKey) : undefined;
    if (!fill) {
      unbucketedFeeCents += fee.deltaCents;
      continue;
    }
    const d = sessionDateFor(fill.filledAt);
    feeByDay.set(d, (feeByDay.get(d) ?? 0) + fee.deltaCents);
  }

  /* SCOPED BY OUR WINDOW, NOT BY OUR ACTIVITY, and the difference is a real class of bug.
   *
   * The statement has its own date picker and routinely spans more days than the other exports.
   * Skipping days we know nothing about is right. But skipping every day we have no ROWS for is
   * wrong, because "the broker says you realised +$500 on Tuesday and we have no Tuesday" is
   * exactly the missing-trades failure this receipt should catch — and it is invisible to the
   * gross reconciliation, which can only compare trades it already has.
   *
   * So: compare every statement day that falls INSIDE the range our upload covers, with a missing
   * day scoring zero on our side. Outside the range, no opinion. */
  const ourDays = new Set([...gross.keys(), ...feeByDay.keys()]);
  const sorted = [...ourDays].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const compared: StatementDay[] = [];
  const outsideWindow: string[] = [];

  for (const s of statement) {
    // ISO `YYYY-MM-DD` compares correctly as a string, which is most of why the parser normalises.
    if (!first || s.tradeDate < first || s.tradeDate > last) {
      outsideWindow.push(s.tradeDate);
      continue;
    }
    const g = gross.get(s.tradeDate) ?? 0;
    const f = feeByDay.get(s.tradeDate) ?? 0;
    const ourCents = g + f;
    compared.push({
      sessionDate: s.tradeDate,
      brokerCents: s.netRealizedCents,
      ourCents,
      ourGrossCents: g,
      ourFeeCents: f,
      diffCents: s.netRealizedCents - ourCents,
      roundTrips: counts.get(s.tradeDate) ?? 0,
    });
  }

  const mismatched = compared.filter((d) => d.diffCents !== 0);
  return {
    compared,
    mismatched,
    totalDiffCents: mismatched.reduce((n, d) => n + d.diffCents, 0),
    outsideWindow,
    unbucketedFeeCents,
  };
}
