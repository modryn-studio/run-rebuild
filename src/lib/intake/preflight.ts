import type { ParsedFill } from '@/lib/csv/fills';
import type { ParsedRoundTrip } from '@/lib/csv/position-history';
import type { ParsedCashRow, ParsedFee } from '@/lib/csv/cash-history';
import type { ParsedBalanceDay } from '@/lib/csv/account-balance';
import { sessionDateFor } from '@/lib/time/session';
import { reconcileAgainstStatement, type StatementDay } from './statement';

/* THE LOUD FAILURES. Everything here runs BEFORE a single row is written.
 *
 * Each check exists because the silent version of it flatters the trader, and a journal whose one
 * claim is "our numbers are the broker's numbers" cannot be wrong in the flattering direction.
 *
 * PURE, AND THAT IS A DEPARTURE FROM v2. That build ran these against the database, because its
 * uploader took one file at a time and the fills might already be stored. This flow takes all four
 * files together (`wireframes.md` §2: *"All three are required"*), so the whole question is
 * answerable from the parsed sets — no round trip, no dependency on upload order, and the check
 * genuinely happens before anything commits rather than merely before the *next* write.
 *
 * FINDINGS ARE STRUCTURED, NOT STRINGS. v2 threw `new Error(message)`, which welds the check to its
 * copy: a screen cannot re-word it, a test asserting on prose breaks when the prose improves, and
 * there is nowhere to put the counts a good message needs. A code plus its numbers lets the caller
 * write the sentence and lets a gate assert on the cause.
 */

export type PreflightCode =
  | 'fills_empty'
  | 'accounts_differ'
  | 'rows_unnamed'
  | 'round_trips_unmatched'
  | 'fees_unmatched'
  | 'fees_implausible'
  | 'pnl_unreconciled'
  | 'statement_unreconciled';

export interface PreflightFinding {
  code: PreflightCode;
  /** Blocking findings stop the import. A warning is shown and does not. */
  blocking: boolean;
  /** Everything a message needs, so the copy lives with the screen rather than in here. */
  detail: {
    blocked?: number;
    total?: number;
    fillRange?: string | null;
    otherRange?: string | null;
    fillAccounts?: string[];
    otherAccounts?: string[];
    /** Cents per contract per round turn, for `fees_implausible`. */
    perContractCents?: number;
    /** `pnl_unreconciled`: what each independent source says, and the gap between them. */
    brokerCents?: number;
    ourCents?: number;
    diffCents?: number;
    comparedRoundTrips?: number;
    /** `statement_unreconciled`: the days that disagree, and how many were checked. */
    days?: StatementDay[];
    daysCompared?: number;
  };
}

export interface PreflightResult {
  ok: boolean;
  findings: PreflightFinding[];
  counts: {
    fills: number;
    roundTrips: number;
    fees: number;
    /** Round trips that found both their fills. The numerator in "fees resolved on N of M". */
    roundTripsMatched: number;
    /** Fee rows whose bucket key matches a fill in this upload. */
    feesMatched: number;
    /** Round trips both sources can speak for. The denominator of the reconciliation. */
    reconciledRoundTrips: number;
    /** Trading days checked against the broker's daily statement. */
    statementDays: number;
  };
}

/** A trade-date range from TRUE instants. Uses the one module that owns time buckets, so this
 *  agrees with everything else in the product about which day a fill belongs to. */
function utcRange(dates: Date[]): string | null {
  const valid = dates.filter((d) => d instanceof Date && !Number.isNaN(d.getTime()));
  if (valid.length === 0) return null;
  const days = valid.map((d) => sessionDateFor(d)).sort();
  return days[0] === days[days.length - 1] ? days[0] : `${days[0]} to ${days[days.length - 1]}`;
}

/* A range from LOCAL wall-clock, which Position History and Cash History are all that carry.
 *
 * FOR A MESSAGE ONLY, NEVER FOR BUCKETING, and the distinction is the whole reason this is a
 * second function rather than a parameter. These timestamps have no zone; turning one into a trade
 * date means guessing an offset, and a guess that is wrong by an hour moves an evening trade to the
 * wrong day. Telling a trader "your Cash History covers 07-08 to 07-21" can be a day out at the
 * edges without costing anything. Filing their money there cannot. */
function localRange(dates: (Date | null)[]): string | null {
  const valid = dates.filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()));
  if (valid.length === 0) return null;
  const iso = valid.map((d) => d.toISOString().slice(0, 10)).sort();
  return iso[0] === iso[iso.length - 1] ? iso[0] : `${iso[0]} to ${iso[iso.length - 1]}`;
}

/** $20 per contract. See the note at the check itself. Kept in step with
 *  `FEE_SANITY_CEILING_CENTS` in `lib/desk/tape.ts` — two bounds on one question that disagree
 *  would be worse than one in the wrong place. */
const FEE_CEILING_PER_CONTRACT_CENTS = 2_000;

const namesOf = (rows: { accountName: string | null }[]): string[] => [
  ...new Set(rows.map((r) => r.accountName).filter((n): n is string => !!n)),
];

export interface PreflightInput {
  fills: ParsedFill[];
  roundTrips: ParsedRoundTrip[];
  fees: ParsedFee[];
  /** Cash History's "Trade Paired" rows: the broker's OWN realised P&L, and the only independent
   *  witness to the number Position History reports. Optional because an upload can arrive without
   *  Cash History; absent means "no opinion", which is not the same as agreement. */
  tradePaired?: ParsedCashRow[];
  /** Account Balance History: the broker's own daily statement. Optional — it is a fifth file,
   *  and absent means no opinion rather than agreement. */
  statement?: ParsedBalanceDay[];
}

/**
 * Check an upload before it is written.
 *
 * Returns every finding rather than the first, because a trader who re-exports to fix one problem
 * should not then discover a second. One trip to the files, one list of what is wrong.
 */
export function preflight({
  fills,
  roundTrips,
  fees,
  tradePaired = [],
  statement = [],
}: PreflightInput): PreflightResult {
  const findings: PreflightFinding[] = [];

  const fillById = new Map<string, ParsedFill>();
  for (const f of fills) if (f.externalFillId) fillById.set(f.externalFillId, f);

  const fillRange = utcRange(fills.map((f) => f.filledAt));

  /* #74a — Position History with no Fills to place it against.
   * Distinguished from the partial case below because the remedy is different: this trader has to
   * upload a file, that one has to re-export a window. Telling them the same thing sends the
   * second trader to fetch a file they already gave you. */
  if (roundTrips.length > 0 && fills.length === 0) {
    findings.push({
      code: 'fills_empty',
      blocking: true,
      detail: { total: roundTrips.length, otherRange: localRange(roundTrips.map((r) => r.soldAtLocal)) },
    });
  }

  /* #74b — the files are from DIFFERENT ACCOUNTS. Checked before the unmatched count, because
   * every round trip will be unmatched in this case and "187 of 187 have no fills" describes the
   * symptom while hiding the cause. A copy-trader with five accounts hits this by picking the
   * wrong one in the export dialog, which is a normal slip. */
  const fillAccounts = namesOf(fills);
  const rtAccounts = namesOf(roundTrips);
  if (fills.length > 0 && roundTrips.length > 0 && fillAccounts.length > 0 && rtAccounts.length > 0) {
    const shared = rtAccounts.filter((a) => fillAccounts.includes(a));
    if (shared.length === 0) {
      findings.push({
        code: 'accounts_differ',
        blocking: true,
        detail: { fillAccounts, otherAccounts: rtAccounts },
      });
    }
  }

  /* #74c — SOME round trips cannot find their fills. This is the case the previous build shipped
   * without for months: its guard fired only when NOTHING resolved, and exporting three files over
   * slightly different windows is the likely slip where exporting two fully disjoint ranges takes
   * effort. The count is in the finding because "12 of your 87" is a different problem to a trader
   * than "none of them", and a message that cannot tell them apart sends both to the same remedy. */
  const unmatched = roundTrips.filter((rt) => {
    const ids = [rt.buyFillId, rt.sellFillId].filter((id): id is string => !!id);
    return ids.length === 0 || !ids.some((id) => fillById.has(id));
  });
  const roundTripsMatched = roundTrips.length - unmatched.length;

  if (fills.length > 0 && unmatched.length > 0) {
    findings.push({
      code: 'round_trips_unmatched',
      blocking: true,
      detail: {
        blocked: unmatched.length,
        total: roundTrips.length,
        fillRange,
        otherRange: localRange(unmatched.flatMap((r) => [r.boughtAtLocal, r.soldAtLocal])),
      },
    });
  }

  /* #75 — NOT ONE FEE MATCHES A TRADE, which is the most dangerous of the four because it is the
   * only one that produces a plausible number instead of an obvious hole.
   *
   * Cash History names no fill id. A fee reaches its trade through `feeBucket` — the RAW
   * (local timestamp, contract) string it shares with the fill that incurred it. When Cash History
   * covers a different window than the fills, not one bucket matches, every round trip allocates
   * `feeCents: 0`, and NET P&L SILENTLY EQUALS GROSS.
   *
   * On the real ten-day export the fees EXCEEDED the gross loss. So the failure is not "slightly
   * optimistic": it reports about half the real loss, on a number a prop account passes or fails
   * on, in the one direction that flatters the trader.
   *
   * ONLY WHEN THERE ARE FILLS THAT COULD MATCH. Fees uploaded with no fills is a different
   * situation entirely, and refusing there would blame the wrong file. */
  /* ROWS THAT NAME NO ACCOUNT ARE REFUSED, not swept into a default.
   *
   * The previous build routed them to a per-trader fallback so an odd export still landed
   * somewhere — and its own comment admits the cost: every real Tradovate export names its
   * account, so the fallback only ever created a junk `default-<traderId>` row that then appeared
   * in the roster as a phantom account. Verified here on the real ten-day set: 612 fills, 360
   * round trips, 2,448 cash rows and 1,009 orders, every single one named.
   *
   * So an unnamed row means the file is not what it claims to be, and quietly filing somebody's
   * money under an invented account is the kind of silent absence this product forbids. */
  const unnamed =
    fills.filter((f) => !f.accountName).length +
    roundTrips.filter((r) => !r.accountName).length +
    fees.filter((f) => !f.accountName).length;
  if (unnamed > 0) {
    findings.push({
      code: 'rows_unnamed',
      blocking: true,
      detail: { blocked: unnamed, total: fills.length + roundTrips.length + fees.length },
    });
  }

  const feeKeys = new Set(fees.map((f) => f.bucketKey).filter((k): k is string => !!k));
  const fillKeys = new Set(fills.map((f) => f.feeBucketKey).filter((k): k is string => !!k));
  const feesMatched = [...feeKeys].filter((k) => fillKeys.has(k)).length;

  if (feeKeys.size > 0 && fillKeys.size > 0 && feesMatched === 0) {
    findings.push({
      code: 'fees_unmatched',
      blocking: true,
      detail: {
        total: fees.length,
        fillRange,
        otherRange: localRange(fees.map((f) => f.occurredAtLocal)),
      },
    });
  }

  /* FEE PLAUSIBILITY AT INGEST, WHICH IS WHERE `spec.md` §S1 says it belongs.
   *
   * It already existed in `lib/desk/tape.ts` — but that is the READ path, and by the time a read
   * flags a number the corrupted fees are already in an append-only log that cannot be corrected.
   * The spec is explicit that this check belongs "at ingest, in code", and the doc review on
   * 2026-08-14 found it living one layer too late. The tape keeps its copy: a corpus can also be
   * corrupted by an API that has not been written yet, and the read should never trust its input.
   *
   * WHY IT CANNOT BE LEFT TO THE READ, measured: with fees inflated roughly fiftyfold by a column
   * shift, ONE MODEL RUN IN THREE built a confident 45-point breakeven rule on the corrupted
   * number and never questioned it. It invented nothing — it faithfully reported what it was
   * handed. A one-in-three miss is not a prompting problem.
   *
   * DELIBERATELY GENEROUS. A real futures commission is single-digit dollars per contract round
   * turn, so $20 is far above any retail or prop schedule. This catches a broken export, it does
   * not police anyone's pricing. Same ceiling as the tape's, and the two are meant to agree. */
  const contracts = fills.reduce((n, f) => n + Math.abs(f.qty), 0);
  const feeCents = fees.reduce((n, f) => n + Math.abs(f.deltaCents), 0);
  if (contracts > 0 && feeCents > 0) {
    // Per contract per SIDE doubled is a round turn, which is how a commission schedule is quoted.
    const perContractCents = Math.round(feeCents / contracts);
    if (perContractCents > FEE_CEILING_PER_CONTRACT_CENTS) {
      findings.push({
        code: 'fees_implausible',
        blocking: true,
        detail: { perContractCents, total: fees.length },
      });
    }
  }

  /* THE RECONCILIATION ITSELF, and the reason this file exists at all.
   *
   * Every other check here is STRUCTURAL: are the rows named, do the windows overlap, did the fees
   * find their trades. None of them look at the P&L figure. This one does, and it is the only
   * check that can answer the product's one claim — "our numbers are the broker's numbers" —
   * because it is the only place two INDEPENDENT sources state the same quantity.
   *
   * Cash History's "Trade Paired" rows are the broker's own realised P&L, posted to the account.
   * Position History's `P/L` column is the broker's own pairing of entries to exits. They are
   * produced by different parts of Tradovate and exported as different files. If they agree to the
   * cent, the number can be shown. If they do not, something is wrong with the export, the parse,
   * or an assumption — and which one hardly matters, because none of them permit showing the
   * figure. `tradePaired` was parsed from S1 with a comment saying "used to reconcile" and then
   * read by nothing at all until 2026-08-15.
   *
   * SCOPED THROUGH ONE INTERSECTION, BOTH SIDES. A Trade Paired row reaches its round trip the same
   * way a fee does: the raw (local timestamp, contract) bucket it shares with the CLOSING fill. A
   * row is compared only if it reaches a round trip, and a round trip only if a row reaches it.
   *
   * v2 scoped only the round-trip half and summed every Trade Paired row against it. That is a
   * false failure waiting for the first trader who exports a wider Cash History window than
   * Position History — which is the easy slip, since the two exports have separate date pickers.
   * Symmetry is what makes "they disagree" mean disagreement rather than a window mismatch.
   *
   * A WARNING, NOT A BLOCK, and this is the one judgement call in the file. The other blocking
   * findings each have a remedy the trader can act on (re-export, widen the window). A cent of
   * disagreement does not, and refusing the import would strand a corpus that is almost certainly
   * fine over a rounding artefact nobody has seen yet. It is loud, it is counted, and the import
   * carries it. Revisit once there is a real one in the wild — the same call v2 made, for the
   * same reason, and the only one of its decisions here worth keeping unchanged. */
  const pairedBuckets = new Set(
    tradePaired.map((p) => p.bucketKey).filter((k): k is string => !!k)
  );
  const closingFillIds = new Set(
    fills
      .filter((f) => f.feeBucketKey && pairedBuckets.has(f.feeBucketKey))
      .map((f) => f.externalFillId)
      .filter((id): id is string => !!id)
  );
  const compared = roundTrips.filter(
    (rt) =>
      (rt.buyFillId && closingFillIds.has(rt.buyFillId)) ||
      (rt.sellFillId && closingFillIds.has(rt.sellFillId))
  );
  // The other half of the symmetry: only rows that actually reached one of those round trips.
  const reachedBuckets = new Set(
    compared.flatMap((rt) =>
      [rt.buyFillId, rt.sellFillId]
        .map((id) => (id ? fillById.get(id)?.feeBucketKey : null))
        .filter((k): k is string => !!k && pairedBuckets.has(k))
    )
  );
  const comparedPaired = tradePaired.filter((p) => p.bucketKey && reachedBuckets.has(p.bucketKey));

  if (compared.length > 0 && comparedPaired.length > 0) {
    const brokerCents = comparedPaired.reduce((n, p) => n + p.deltaCents, 0);
    const ourCents = compared.reduce((n, rt) => n + rt.pnlCentsGross, 0);
    if (brokerCents !== ourCents) {
      findings.push({
        code: 'pnl_unreconciled',
        blocking: false,
        detail: {
          brokerCents,
          ourCents,
          diffCents: brokerCents - ourCents,
          comparedRoundTrips: compared.length,
          total: roundTrips.length,
        },
      });
    }
  }

  /* THE THIRD RECEIPT — our NET, per day, against the broker's own statement. See `statement.ts`
   * for the arithmetic and for what this does and does not prove.
   *
   * The other two receipts check structure and gross. This is the only one that checks COST, and
   * on the reference export cost is the larger number: fees (-$1,934.36) exceeded the gross loss
   * (-$1,840.50). A build can pair every trade correctly, reconcile gross to the cent, and still
   * be wrong by more than the entire loss.
   *
   * BLOCKING, unlike `pnl_unreconciled`, and the difference is that this one has a remedy. A gross
   * mismatch is a cent of drift with nothing a trader can do about it. A statement mismatch means
   * a day is missing or misfiled — re-export the window and it resolves. It is also the failure
   * that must never reach a corpus, because a wrong day survives every later correction: the log
   * is append-only, and `session_date` is what every read groups by. */
  const stmt = reconcileAgainstStatement({ fills, roundTrips, fees, statement });
  if (stmt.mismatched.length > 0) {
    findings.push({
      code: 'statement_unreconciled',
      blocking: true,
      detail: {
        days: stmt.mismatched,
        daysCompared: stmt.compared.length,
        diffCents: stmt.totalDiffCents,
      },
    });
  }

  return {
    ok: findings.every((f) => !f.blocking),
    findings,
    counts: {
      fills: fills.length,
      roundTrips: roundTrips.length,
      fees: fees.length,
      roundTripsMatched,
      feesMatched,
      reconciledRoundTrips: compared.length,
      statementDays: stmt.compared.length,
    },
  };
}
