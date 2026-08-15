// The RESOLVED TAPE — the thing that makes the desk call safe.
//
// Every ambiguity that produced a wrong read gets settled here, in code, before a model ever
// sees the data:
//   - DIRECTION. A short sells first. Reading raw CSVs, a lens called a +$134.50 winning
//     short a second loss, because "sold at a lower price" looks like a loss until you know
//     which way the position faced.
//   - OUTCOME. Winner or loser, stated, not inferred from price arithmetic.
//   - WHAT ENDED THE TRADE. A stop the market hit is not a decision the trader made. Run
//     shipped a false read on exactly this and told a disciplined trader to hold losers
//     longer, which would have cost him $960 on the trade in question.
//   - WHY AN ORDER WAS CANCELED. A bracket's protective leg auto-cancels when its target
//     fills. Counting that as "he pulled his stop" accuses a disciplined trader of the one
//     thing he is most defensive about.
//
// The model is free to reason; it is not free to invent. `verifiedNumbers` is the whitelist
// the output is checked against.
//
// DEDUPE IS NOT OPTIONAL. The database drops duplicates via namespaced keys and a partial
// unique index; the export folder is full of overlapping re-downloads. Concatenating two
// overlapping files without deduping shows twice the trading that happened, and would mean
// testing a different tape than production builds from the same files.
import type { ParsedFill } from '@/lib/csv/fills';
import type { ParsedRoundTrip } from '@/lib/csv/position-history';
import type { ParsedFee } from '@/lib/csv/cash-history';
import type { ParsedOrder, OrderType } from '@/lib/csv/orders';
import {
  allocateFees,
  FEE_CEILING_PER_CONTRACT_ROUND_TURN_CENTS,
  type NetPnlRow,
} from '@/lib/fees/allocate';
import { PRICE_SCALE } from '@/lib/csv/shared';
import { sessionDateFor, displayClock, SESSION_BOUNDARY_ZONE } from '@/lib/time/session';

export type Direction = 'long' | 'short';
export type Outcome = 'winner' | 'loser' | 'scratch';
/** Why a position ended. `unknown` when the exit fill's parent order is not in the export. */
export type ExitMechanism = 'stop_hit' | 'target_filled' | 'market_exit' | 'unknown';
/** Why an order was canceled. `oco_sibling` means the platform did it, not the trader. */
export type CancelCause = 'trader' | 'oco_sibling';

export interface TapeRoundTrip {
  pairId: string | null;
  contract: string | null;
  direction: Direction;
  outcome: Outcome;
  qty: number;
  entryPriceMicros: number;
  exitPriceMicros: number;
  grossCents: number;
  feeCents: number | null;
  netCents: number | null;
  entryOrderType: OrderType | null;
  exitOrderType: OrderType | null;
  exitMechanism: ExitMechanism;
  entryAt: Date | null;
  exitAt: Date | null;
  holdMs: number | null;
}

export interface TapeOrder {
  id: string | null;
  contract: string | null;
  side: 'buy' | 'sell';
  type: OrderType;
  qty: number;
  limitPriceMicros: number | null;
  stopPriceMicros: number | null;
  status: ParsedOrder['status'];
  amended: boolean;
  /** Null unless status is `canceled`. */
  cancelCause: CancelCause | null;
  placedAt: Date | null;
  filledAt: Date | null;
}

/** One position, flat to flat — what the trader actually put on. */
export interface TapeEpisode {
  contract: string | null;
  direction: Direction;
  /** Each add, with what it was actually worth. The economics are stated here rather than
   *  left to the reader because six of ten Phase 3 runs computed this same series by hand,
   *  and the one that slipped mixed gross and net inside a single list. When a read keeps
   *  deriving a figure, the figure belongs in the tape. */
  entries: {
    at: Date;
    qty: number;
    priceMicros: number;
    /** Distance from this add to the position's volume-weighted average exit. */
    pointsToAvgExit: number | null;
    /** What this tranche was worth at that exit, before and after fees. Null when point
     *  value is underivable. Fees use the tape's per-contract average, not an exact
     *  allocation, which is why the render says so. */
    grossCents: number | null;
    netCents: number | null;
  }[];
  peakQty: number;
  avgEntryPriceMicros: number;
  openedAt: Date;
  closedAt: Date;
  exitPriceMicros: number | null;
  /** Volume-weighted average exit. The single exit price is meaningless when a position was
   *  scaled out, and per-add economics measured against it would be wrong. */
  avgExitPriceMicros: number | null;
  /** How many separate fills closed the position. 1 means every add exited at one price. */
  exitFills: number;
  /** The protective stop working when this position closed, if one was. */
  workingStopMicros: number | null;
  /** How that stop left the book. `fired` means it filled and closed the position — the most
   *  protected a position gets. Reading its absence as "unprotected" is exactly backwards,
   *  and a read shipped that accusation on 12 of 21 positions before this field existed. */
  stopSource: 'fired' | 'canceled_with_position' | null;
  /** Signed, in PRICE POINTS. Positive means the stop sat on the profitable side of the
   *  average entry, i.e. the position was stopped INTO profit. */
  stopVsAvgEntryPoints: number | null;
  /** The same distance in REAL MONEY at peak size. Null when point value is underivable.
   *  These are two different units and conflating them renders 2.13 points as "$2.13" when
   *  the money at 4 MNQ is $17.04. */
  stopVsAvgEntryCents: number | null;
  grossCents: number;
}

/** One trading session, totalled by code.
 *
 *  ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────
 *  Three reads in a row derived a session-level figure and three got one slightly wrong:
 *  "883 contract round turns" when it was 884, "55 round trips" when it was 56, and "up $922"
 *  when the peak was $895. None was invented — each was arithmetic the model did itself over
 *  hundreds of rows, because the tape stated the parts and never the sum.
 *
 *  That is the oldest pattern in this project: every defect has been the model deriving
 *  something code already knew, and every fix moved the derivation into code rather than into a
 *  prompt. This is that fix for the session grain.
 *
 *  It is also the object `S5` needs — the Trades page groups under a session header carrying
 *  net, trade count and win rate — so the same computation serves the read and the record, and
 *  they cannot disagree about "your worst day". */
export interface TapeSession {
  sessionDate: string;
  roundTrips: number;
  contracts: number;
  winners: number;
  losers: number;
  /** Percent, one decimal. Stated so a read quotes it instead of dividing two counts. */
  winRate: number;
  grossCents: number;
  feeCents: number;
  netCents: number;
  firstAt: Date | null;
  lastAt: Date | null;
  /** Per product root. This is the breakdown that makes an instrument switch visible as a fact
   *  rather than as something a reader has to notice across 82 rows. */
  byRoot: { root: string; roundTrips: number; contracts: number; netCents: number }[];
}

export interface Tape {
  accounts: string[];
  roundTrips: TapeRoundTrip[];
  orders: TapeOrder[];
  episodes: TapeEpisode[];
  totals: {
    grossCents: number;
    feeCents: number;
    netCents: number;
    hasFees: boolean;
    unallocatedFeeCents: number;
    winners: number;
    losers: number;
    /** Total fee cost per contract round-tripped. */
    feePerContractCents: number;
    /** True when that figure is too large to be a real commission. A read cannot be trusted
     *  to catch this on its own: given fees inflated fifty-fold, one run in three built a
     *  confident breakeven rule on the bad number instead of questioning it. */
    feesImplausible: boolean;
  };
  /** Dollars-per-point-per-contract, in cents, keyed by product ROOT, plus anything that would
   *  not resolve. Derived from the trader's own round trips rather than a seeded table: a
   *  hand-typed multiplier is a number that cannot be reconciled against the broker, and it is
   *  the only mechanism that can invert NQ and MNQ into a 10x error. See docs/architecture.md. */
  pointValue: PointValueResult;
  /** One row per trading session, oldest first. See `TapeSession`. */
  sessions: TapeSession[];
  /** Account name -> type, for the accounts on this tape. Stated rather than assumed, because
   *  what "survival" means depends on it and the risk lens used to hardcode one answer:
   *  "These traders are on funded accounts" is false for a personal account, where there is no
   *  firm above the trader and no rule that can take the account away. A missing entry stays
   *  missing — the render says the type is unstated, and the lens asks rather than guessing. */
  accountTypes: Record<string, AccountType | 'unstated'>;
  /** The zone every clock in this tape is rendered in, and the zone its whitelist was built
   *  against. ONE value, carried on the tape, because the render and the whitelist reading two
   *  different zones is what flagged every correctly-quoted timestamp on the first run. */
  displayTimezone: string;
  meta: {
    fills: number;
    roundTrips: number;
    orders: number;
    cancels: number;
    traderCancels: number;
    ocoCancels: number;
    amendments: number;
    /** Stated by code so a read quotes rather than counts. A read tallied these by hand and
     *  reported "eighteen of twenty-one closed by a stop" on a day where it was fourteen. */
    positions: { total: number; closedByStopFiring: number; stopWorkingAtClose: number; noStopFound: number };
    tradingDays: string[];
    /** Sum of every round trip's quantity. Rendered, because a read that has to reconstruct it
     *  from fees and a rounded rate arrives one contract short. */
    contractsTraded: number;
    /** Duplicate rows dropped, by kind. Non-zero is normal on overlapping re-downloads. */
    deduped: { fills: number; roundTrips: number; orders: number; fees: number };
    /** Local-to-UTC offset derived empirically from filled orders vs their fills, so the
     *  tape reads identically on a UTC server and on a UTC-5 laptop. */
    localOffsetMs: number;
  };
  /** Every figure the tape asserts, formatted as it would be written. The output whitelist. */
  verifiedNumbers: Set<string>;
}

/** What kind of account this is. Recorded per connection at the moment it is added
 *  (docs/architecture.md §1) — never inferred from the export, which does not carry it. */
export type AccountType = 'evaluation' | 'sim_funded' | 'personal';

export interface TapeInput {
  fills: ParsedFill[];
  roundTrips: ParsedRoundTrip[];
  fees: ParsedFee[];
  orders: ParsedOrder[];
  /** Account name -> type. Optional, and its ABSENCE is meaningful: the tape then says the type
   *  is unstated rather than letting a reader assume one. See the note on `Tape.accountTypes`. */
  accountTypes?: Record<string, AccountType>;
  /** The trader's own zone, for DISPLAY only. Defaults to the market zone rather than UTC: if a
   *  caller forgets one, the least-wrong clock is the one the sessions are cut in, never a clock
   *  nobody trades on. */
  displayTimezone?: string;
  /** `contract_spec.tick_size` by symbol root, in the same units as the price column. The caller
   *  reads it from the database; this module never does. Absent roots still price — they just
   *  fall through to the wide absurdity bound instead of the real tick-value check. */
  tickSizeByRoot?: Map<string, number>;
}

// ── formatting: one place, so verifiedNumbers and the rendered tape cannot disagree ──

export const fmtMoney = (cents: number): string => {
  const abs = (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${cents < 0 ? '-' : ''}$${abs}`;
};
// A QUOTE, from micro-units. NEVER a fixed two decimals: that was the second half of the price
// bug, and fixing only the storage would have left every 6E quote rendering as 1.09 from a
// perfectly stored 1085000. Trailing zeros are trimmed but never below two decimals, so an index
// future still reads 19204.25 rather than 19204.25000.
export const fmtPrice = (micros: number): string => {
  // Trim the padding first, THEN restore the two-decimal floor. Doing it the other way round
  // lets the trim eat the floor: 29312.500000 became "29312.5" sitting in a column beside
  // "29318.00", which is the same number rendered two ways in one table.
  let s = (micros / PRICE_SCALE).toFixed(6).replace(/0+$/, '');
  if (s.endsWith('.')) s = s.slice(0, -1);
  const dot = s.indexOf('.');
  const decimals = dot === -1 ? 0 : s.length - dot - 1;
  if (decimals < 2) s += (dot === -1 ? '.' : '') + '0'.repeat(2 - decimals);
  return s;
};
export const fmtDuration = (ms: number): string => {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m === 0 ? `${s}s` : `${m}m ${s % 60}s`;
};

// ── dedupe ──

// Same identity rule the database enforces (namespaced keys + partial unique index): first
// occurrence wins, later duplicates are dropped. Rows with no key cannot be deduped and are
// kept, which matches the partial index skipping null keys.
function dedupe<T>(rows: T[], key: (r: T) => string | null): { kept: T[]; dropped: number } {
  const seen = new Set<string>();
  const kept: T[] = [];
  let dropped = 0;
  for (const r of rows) {
    const k = key(r);
    if (k === null) {
      kept.push(r);
      continue;
    }
    if (seen.has(k)) {
      dropped++;
      continue;
    }
    seen.add(k);
    kept.push(r);
  }
  return { kept, dropped };
}

// ── local-time resolution ──

// Orders and Position History carry local wall-clock with no zone, so parsing them yields an
// instant that depends on the machine's own zone. Fills carry true UTC. Diffing a filled
// order's local stamp against its fill's real instant gives the offset; the median makes it
// robust to a single odd row. Zero when nothing can be paired, which only degrades absolute
// display, never ordering or durations.
function deriveLocalOffsetMs(orders: ParsedOrder[], fillByOrderId: Map<string, ParsedFill>): number {
  const diffs: number[] = [];
  for (const o of orders) {
    if (!o.externalOrderId || !o.filledAtLocal) continue;
    const fill = fillByOrderId.get(o.externalOrderId);
    if (!fill) continue;
    diffs.push(fill.filledAt.getTime() - o.filledAtLocal.getTime());
  }
  if (diffs.length === 0) return 0;
  diffs.sort((a, b) => a - b);
  // Snap to the nearest minute: sub-second fill latency is noise, not offset.
  const median = diffs[Math.floor(diffs.length / 2)];
  return Math.round(median / 60_000) * 60_000;
}

// ── episodes ──

// Walk net exposure flat to flat, per ACCOUNT + CONTRACT. Keyed by account too because a
// copy-trader runs one strategy across many funded accounts, so the same entry arrives N
// times; walking those as one stream reports a position N times its real size.
function buildEpisodes(fills: ParsedFill[], orderTypeByFill: Map<string, OrderType>): TapeEpisode[] {
  const byKey = new Map<string, ParsedFill[]>();
  for (const f of fills) {
    const k = `${f.accountName ?? 'none'}::${f.contract ?? f.symbol}`;
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(f);
  }

  const episodes: TapeEpisode[] = [];
  for (const group of byKey.values()) {
    group.sort((a, b) => a.filledAt.getTime() - b.filledAt.getTime());
    let net = 0;
    let peak = 0;
    let entries: TapeEpisode['entries'] = [];
    let openedAt: Date | null = null;
    let direction: Direction | null = null;
    let lastExitPrice: number | null = null;
    let exits: { qty: number; priceMicros: number }[] = [];

    for (const f of group) {
      const signed = (f.side === 'buy' ? 1 : -1) * f.qty;
      if (net === 0) {
        direction = signed > 0 ? 'long' : 'short';
        openedAt = f.filledAt;
        entries = [];
        exits = [];
      }
      // An "entry" is a fill that increases exposure in the position's own direction.
      const adds = direction === 'long' ? signed > 0 : signed < 0;
      if (adds) entries.push({ at: f.filledAt, qty: f.qty, priceMicros: f.priceMicros, pointsToAvgExit: null, grossCents: null, netCents: null });
      else {
        lastExitPrice = f.priceMicros;
        exits.push({ qty: f.qty, priceMicros: f.priceMicros });
      }

      net += signed;
      peak = Math.max(peak, Math.abs(net));

      if (net === 0 && openedAt && direction) {
        const totalQty = entries.reduce((s, e) => s + e.qty, 0);
        const avg = totalQty > 0 ? entries.reduce((s, e) => s + e.priceMicros * e.qty, 0) / totalQty : 0;
        const exitQty = exits.reduce((s, e) => s + e.qty, 0);
        const avgExit = exitQty > 0 ? Math.round(exits.reduce((s, e) => s + e.priceMicros * e.qty, 0) / exitQty) : null;
        episodes.push({
          contract: f.contract ?? f.symbol,
          direction,
          entries,
          peakQty: peak,
          avgEntryPriceMicros: Math.round(avg),
          openedAt,
          closedAt: f.filledAt,
          exitPriceMicros: lastExitPrice,
          avgExitPriceMicros: avgExit,
          exitFills: exits.length,
          workingStopMicros: null, // filled in below, once cancels are classified
          stopSource: null,
          stopVsAvgEntryPoints: null,
          stopVsAvgEntryCents: null,
          grossCents: 0, // filled in from round trips below
        });
        peak = 0;
        entries = [];
        exits = [];
        openedAt = null;
        direction = null;
        lastExitPrice = null;
      }
    }
    // A trailing non-flat run is an open position: it cannot be classified, so it is dropped
    // rather than half-reported.
  }

  void orderTypeByFill;
  return episodes.sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());
}

// ── instrument economics ──

// Dollars per point per contract, in cents, recovered from the trader's own completed round
// trips: gross / (points moved x contracts). Empirical rather than a lookup table, because a
// hand-typed multiplier is a number that cannot be reconciled against the broker — which is
// what P12 forbids — and a seeded table is the only mechanism that can invert NQ and MNQ into a
// 10x error across every figure in the product. See docs/architecture.md.
//
// ── FIXED: THE ORIGINAL TOOK A MEDIAN, AND ITS OWN PLAN SAID NEVER TO ────────────────────
// The ported code sorted the samples and took the middle one. That is a MASKER: a median
// silently absorbs a corrupt row and emits a subtly wrong number with no flag at all. For an
// architecture whose premise is that a confidently wrong number must not ship, a DETECTOR beats
// a masker. A median also does not begin to function until n=3 — a median of two is a mean,
// which one bad row poisons outright.
//
// So: agreement, or quarantine. Never a middle value.
//
// ── AND IT KEYED ON THE CONTRACT MONTH, NOT THE ROOT ─────────────────────────────────────
// Point value is a property of the PRODUCT. Keying on `MNQU6` splits the sample at every roll
// and leaves a thin month solving from two or three trades. Episodes still key on the specific
// contract, which is correct — both months can be held at once — but economics key on the root.
const AGREEMENT_TOLERANCE = 0.02; // 2%: absorbs a cent of rounding, not a wrong row.

// ── THE SANITY BOUND IS ON THE TICK, NOT THE POINT. Rewritten 2026-08-12 (S2). ───────────────
//
// It used to bound the POINT value to $0.10-$250, described as "the outer edge of retail-
// accessible products." That sentence was true of the equity-index complex and false of
// everything else, and it was written from a corpus containing exactly MNQ and NQ.
//
// Measured against CME's own published specs for the 59 roots a prop trader can reach
// (`scripts/seed-contract-spec.mts`), point value spans EIGHT ORDERS OF MAGNITUDE:
//
//   MET  $0.10/point  ...  MNQ $2  ...  ES $50  ...  CL $1,000  ...  6J $12,500,000/point
//
// No single bound over that range can call anything absurd. Worse, the old one was inside it:
// crude, gold's big brother, every rate and every FX pair quarantined with the message
// "derived point value $1,000.00 per point is not plausible for a listed future" — a false
// statement, about a real trade, shown to the trader. A wrong quarantine reason is worse than
// no quarantine, because the product's one claim is that its numbers are the broker's.
//
// TICK VALUE IS THE COMPARABLE QUANTITY, and it is not a coincidence — exchanges deliberately
// size a tick so it is worth roughly the same to trade. Over the same 59 roots:
//
//   MET $0.05  ·  MNQ/MYM/M2K/MBT $0.50  ·  CL/GC/NG $10  ·  ES/HG/ZC $12.50  ·  PA $50
//
// A thousand-to-one range collapses to a thousand-to-one... no: to 0.05-50, THREE orders of
// magnitude narrower. The bound below is an order of magnitude outside that on each side, so it
// still catches a derived $0.0003 or $47,000 from a parse error or a shifted column, which was
// always the job.
//
// THE UNIT MUST MATCH THE QUOTE. tickValue = pointValue x tickSize only holds when `tickSize` is
// expressed in the same units as the price column the point value was derived from. CME publishes
// corn's tick as 0.0025 (dollars per bushel) while brokers quote it in cents — a 100x difference
// that would produce a confident, wrong tick value. That is why `contract_spec` is seeded only for
// roots whose quote convention is verified, and why an unseeded root falls through to the wide
// bound below rather than being priced against a guess.
const TICK_VALUE_FLOOR_CENTS = 1; // $0.01, an order of magnitude under MET's $0.05
const TICK_VALUE_CEILING_CENTS = 50_000; // $500, an order of magnitude over PA's $50

// The fallback when no tick size is known for the root. Deliberately wide enough to admit 6J at
// $12.5M per point, which makes it a nonsense-catcher rather than a plausibility check — and the
// code says so rather than implying a rigour it does not have. A root with no `contract_spec` row
// quarantines at ingest anyway (architecture.md), so this guards only the disk-script path.
const POINT_VALUE_ABSURD_FLOOR_CENTS = 1; // $0.01
const POINT_VALUE_ABSURD_CEILING_CENTS = 10_000_000_000; // $100,000,000 per point

export interface PointValue {
  cents: number;
  /** How many round trips solved it. 1 is usable; see below. */
  samples: number;
  /** True at n=1: usable, but a bad row cannot be DETECTED yet, only survived. */
  lowConfidence: boolean;
}

/** Exposed for the S1 gate only. The point-value derivation is the one piece of this file whose
 *  FAILURE path has to be asserted — a poisoned row must quarantine rather than be averaged away
 *  — and that cannot be provoked through `buildTapeFromParsed` without corrupting a fixture. */
export interface PointValueResult {
  /** Keyed by symbol ROOT (`MNQ`), not contract month. */
  byRoot: Map<string, PointValue>;
  /** Roots that would not resolve, with why. Nothing downstream may price these. */
  quarantined: Map<string, string>;
}

// `rootOf` maps a specific contract (`MNQU6`) to its product root (`MNQ`). Built from the fills,
// which carry both columns, rather than by parsing month codes out of a contract string — a
// parser would need a table of month letters and would be wrong on the first unfamiliar venue.
export function derivePointValueCents(
  roundTrips: TapeRoundTrip[],
  rootOf: Map<string, string>,
  /** `contract_spec.tick_size` by root, in the SAME units as the price column. Absent roots fall
   *  through to the wide absurdity bound — see the constants above. Passed in rather than read,
   *  because nothing in `lib/` touches the database. */
  tickSizeByRoot?: Map<string, number>
): PointValueResult {
  const samples = new Map<string, number[]>();
  for (const r of roundTrips) {
    const points = Math.abs(r.exitPriceMicros - r.entryPriceMicros) / PRICE_SCALE;
    const root = r.contract ? (rootOf.get(r.contract) ?? r.contract) : null;
    if (!root || points === 0 || r.qty === 0 || r.grossCents === 0) continue;
    // gross / (points x qty): four knowns and one unknown, SOLVED rather than estimated. That
    // is why one clean row is enough — a "minimum sample" rule would treat exact arithmetic
    // like a noisy measurement, and discarding a probably-correct value is the same
    // conservatism as a "not enough data yet" placeholder, which this product rejects.
    const v = Math.abs(r.grossCents) / (points * r.qty);
    (samples.get(root) ?? samples.set(root, []).get(root)!).push(v);
  }

  const byRoot = new Map<string, PointValue>();
  const quarantined = new Map<string, string>();

  for (const [root, xs] of samples) {
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);

    // Agreement first. Disagreement means one of these rows is lying and we cannot know which,
    // so we refuse to pick rather than averaging the liar in.
    if (xs.length >= 2 && hi - lo > lo * AGREEMENT_TOLERANCE) {
      quarantined.set(
        root,
        `derived point value disagrees across ${xs.length} round trips: ${fmtMoney(Math.round(lo))} to ${fmtMoney(Math.round(hi))} per point`
      );
      continue;
    }

    // They agree (or there is only one), so any of them is the answer.
    const cents = Math.round(xs.reduce((s, v) => s + v, 0) / xs.length);

    // The real check, when the root's tick size is known: is one TICK worth a plausible amount?
    const tickSize = tickSizeByRoot?.get(root);
    if (tickSize !== undefined && tickSize > 0) {
      const tickValue = cents * tickSize;
      if (tickValue < TICK_VALUE_FLOOR_CENTS || tickValue > TICK_VALUE_CEILING_CENTS) {
        quarantined.set(
          root,
          `derived tick value ${fmtMoney(Math.round(tickValue))} is not plausible for a listed future ` +
            `(${fmtMoney(cents)} per point x tick ${tickSize})`
        );
        continue;
      }
    } else if (cents < POINT_VALUE_ABSURD_FLOOR_CENTS || cents > POINT_VALUE_ABSURD_CEILING_CENTS) {
      quarantined.set(root, `derived point value ${fmtMoney(cents)} per point is not a real number`);
      continue;
    }

    byRoot.set(root, { cents, samples: xs.length, lowConfidence: xs.length === 1 });
  }

  return { byRoot, quarantined };
}

// IMPORTED, NOT REDECLARED, since 2026-08-15. This was a second `2_000` under a different name,
// with a comment claiming it matched the one in `intake/preflight.ts`. It did not: preflight
// divided by fill quantity rather than round-trip quantity, so it blocked at an effective $40
// while this blocked at $20, and a corrupted export between the two reached the log. The shared
// constant carries the full note.
const FEE_SANITY_CEILING_CENTS = FEE_CEILING_PER_CONTRACT_ROUND_TURN_CENTS;

// ── cancel classification ──

// THE RULE, and it is deliberately conservative: a cancel counts as the TRADER's decision
// only when it cannot be explained as a bracket's protective leg dying with its position.
// An order that was working inside an open position and pointed the way that would flatten
// it is a protective leg; when the position closed some other way, the platform canceled it.
//
// Getting this backwards is not a cosmetic error. On the reference tape three of eight
// cancels are OCO siblings, including the stop on the best trade of the session — reporting
// those as decisions tells a trader he pulled his own protection.
function classifyCancel(order: ParsedOrder, offsetMs: number, episodes: TapeEpisode[]): CancelCause {
  const at = order.placedAtLocal ? order.placedAtLocal.getTime() + offsetMs : null;
  if (at === null) return 'trader';

  for (const ep of episodes) {
    if (order.contract && ep.contract && order.contract !== ep.contract) continue;
    // Inclusive at both ends: a protective leg's final version is stamped at the instant its
    // partner fills, which is exactly the episode's close.
    if (at < ep.openedAt.getTime() || at > ep.closedAt.getTime()) continue;
    const flattens = ep.direction === 'long' ? order.side === 'sell' : order.side === 'buy';
    if (flattens) return 'oco_sibling';
  }
  return 'trader';
}

// ── the build ──

export function buildTapeFromParsed(input: TapeInput): Tape {
  const fillsD = dedupe(input.fills, (f) => (f.externalFillId ? `f:${f.externalFillId}` : null));
  const rtD = dedupe(input.roundTrips, (r) => (r.pairId ? `p:${r.pairId}` : null));
  const ordersD = dedupe(input.orders, (o) => (o.externalOrderId ? `o:${o.externalOrderId}` : null));
  const feesD = dedupe(input.fees, (f) => (f.transactionId ? `x:${f.transactionId}` : null));

  const fills = fillsD.kept;
  const roundTrips = rtD.kept;
  const orders = ordersD.kept;
  const fees = feesD.kept;

  // Indexes.
  const fillById = new Map<string, ParsedFill>();
  const fillByOrderId = new Map<string, ParsedFill>();
  for (const f of fills) {
    if (f.externalFillId) fillById.set(f.externalFillId, f);
    if (f.externalOrderId && !fillByOrderId.has(f.externalOrderId)) fillByOrderId.set(f.externalOrderId, f);
  }
  const orderById = new Map<string, ParsedOrder>();
  for (const o of orders) if (o.externalOrderId) orderById.set(o.externalOrderId, o);

  // fill id -> the type of the order that produced it. This is what turns "the position
  // ended" into "his stop was hit" or "his target filled".
  const orderTypeByFill = new Map<string, OrderType>();
  for (const f of fills) {
    if (!f.externalFillId || !f.externalOrderId) continue;
    const o = orderById.get(f.externalOrderId);
    if (o) orderTypeByFill.set(f.externalFillId, o.type);
  }

  const offsetMs = deriveLocalOffsetMs(orders, fillByOrderId);

  // Fee allocation reuses the tested per-contract math rather than reimplementing it. The
  // payloads the database stores are just the parsed rows spread, so they reconstruct
  // exactly. Synthetic ids are index-based and used only to key the result map.
  const netRows: NetPnlRow[] = [
    ...fills.map((f, i) => ({ id: 1_000_000 + i, type: 'fill', pnlCents: null, payload: { ...f } as Record<string, unknown> })),
    ...fees.map((f, i) => ({ id: 2_000_000 + i, type: 'fee', pnlCents: f.deltaCents, payload: { ...f } as Record<string, unknown> })),
    ...roundTrips.map((r, i) => ({ id: i, type: 'round_trip', pnlCents: r.pnlCentsGross, payload: { ...r } as Record<string, unknown> })),
  ];
  const net = allocateFees(netRows);

  // Round trips, fully resolved.
  const tapeRoundTrips: TapeRoundTrip[] = roundTrips.map((rt, i) => {
    const buyFill = rt.buyFillId ? fillById.get(rt.buyFillId) : undefined;
    const sellFill = rt.sellFillId ? fillById.get(rt.sellFillId) : undefined;
    const buyAt = buyFill?.filledAt ?? rt.boughtAtLocal;
    const sellAt = sellFill?.filledAt ?? rt.soldAtLocal;

    // A SHORT sold before it bought. This single line is what the lens got wrong on raw CSVs.
    const isShort = !!(buyAt && sellAt && sellAt.getTime() < buyAt.getTime());
    const direction: Direction = isShort ? 'short' : 'long';

    const entryFillId = isShort ? rt.sellFillId : rt.buyFillId;
    const exitFillId = isShort ? rt.buyFillId : rt.sellFillId;
    const entryOrderType = entryFillId ? (orderTypeByFill.get(entryFillId) ?? null) : null;
    const exitOrderType = exitFillId ? (orderTypeByFill.get(exitFillId) ?? null) : null;

    const exitMechanism: ExitMechanism =
      exitOrderType === 'stop' || exitOrderType === 'stop_limit'
        ? 'stop_hit'
        : exitOrderType === 'limit'
          ? 'target_filled'
          : exitOrderType === 'market'
            ? 'market_exit'
            : 'unknown';

    const allocated = net.byRoundTrip.get(i);
    const entryAt = isShort ? sellAt : buyAt;
    const exitAt = isShort ? buyAt : sellAt;

    return {
      pairId: rt.pairId,
      contract: rt.contract ?? rt.symbol,
      direction,
      outcome: rt.pnlCentsGross > 0 ? 'winner' : rt.pnlCentsGross < 0 ? 'loser' : 'scratch',
      qty: rt.qty,
      entryPriceMicros: isShort ? rt.sellPriceMicros : rt.buyPriceMicros,
      exitPriceMicros: isShort ? rt.buyPriceMicros : rt.sellPriceMicros,
      grossCents: rt.pnlCentsGross,
      feeCents: allocated?.feeCents ?? null,
      netCents: allocated?.netCents ?? null,
      entryOrderType,
      exitOrderType,
      exitMechanism,
      entryAt: entryAt ?? null,
      exitAt: exitAt ?? null,
      holdMs: entryAt && exitAt ? Math.abs(exitAt.getTime() - entryAt.getTime()) : null,
    };
  });

  const episodes = buildEpisodes(fills, orderTypeByFill);

  // Attach each round trip's gross to the episode that contains it, so an episode reports
  // the money the position actually made rather than a re-derived guess.
  for (const rt of tapeRoundTrips) {
    if (!rt.exitAt) continue;
    const ep = episodes.find(
      (e) => rt.exitAt!.getTime() >= e.openedAt.getTime() && rt.exitAt!.getTime() <= e.closedAt.getTime()
    );
    if (ep) ep.grossCents += rt.grossCents;
  }

  // Cancels, classified — and the classification is what identifies each episode's working
  // protective stop, so the two must happen in this order.
  const tapeOrders: TapeOrder[] = orders.map((o) => ({
    id: o.externalOrderId,
    contract: o.contract ?? o.symbol,
    side: o.side,
    type: o.type,
    qty: o.qty,
    limitPriceMicros: o.limitPriceMicros,
    stopPriceMicros: o.stopPriceMicros,
    status: o.status,
    amended: o.amended,
    cancelCause: o.status === 'canceled' ? classifyCancel(o, offsetMs, episodes) : null,
    placedAt: o.placedAtLocal ? new Date(o.placedAtLocal.getTime() + offsetMs) : null,
    filledAt: o.filledAtLocal ? new Date(o.filledAtLocal.getTime() + offsetMs) : null,
  }));

  // Contract -> product root, from the fills, which are the only rows carrying both.
  const rootOf = new Map<string, string>();
  for (const f of fills) if (f.contract && f.symbol) rootOf.set(f.contract, f.symbol);

  const pointValue = derivePointValueCents(tapeRoundTrips, rootOf, input.tickSizeByRoot);
  // Resolve a specific contract to its product's point value, in cents. Null when the root
  // quarantined or never resolved — and null must stay null all the way to the render, never a
  // zero and never a default, because a defaulted multiplier is the 10x error made silently.
  const pvFor = (contract: string | null): number | null => {
    if (!contract) return null;
    const root = rootOf.get(contract) ?? contract;
    return pointValue.byRoot.get(root)?.cents ?? null;
  };

  // An episode's working stop. THE ORIGINAL VERSION LOOKED ONLY FOR OCO-CANCELED STOPS, and
  // that is backwards on the most important case: a stop that FIRES is filled, not canceled,
  // so the field came back null on exactly the positions where the protection did its job.
  // On one day that was 12 of 21 positions, and a read duly told the trader he had closed
  // eleven of twenty-one with nothing protecting them. A filled stop counts.
  //
  // Positive stopVsAvgEntry means the whole position was stopped INTO profit, which is the
  // difference between pyramiding and risk-taking and is invisible in fills.
  for (const ep of episodes) {
    const protective = tapeOrders.filter(
      (o) =>
        (o.cancelCause === 'oco_sibling' || o.status === 'filled') &&
        (o.type === 'stop' || o.type === 'stop_limit') &&
        o.stopPriceMicros !== null &&
        o.placedAt !== null &&
        o.placedAt.getTime() >= ep.openedAt.getTime() &&
        o.placedAt.getTime() <= ep.closedAt.getTime() &&
        (ep.direction === 'long' ? o.side === 'sell' : o.side === 'buy')
    );
    if (protective.length === 0) continue;
    // If one of them fired, that is unambiguously the stop that was working at the close.
    const fired = protective.find((o) => o.status === 'filled');
    const last = fired ?? protective[protective.length - 1];
    ep.workingStopMicros = last.stopPriceMicros;
    ep.stopSource = fired ? 'fired' : 'canceled_with_position';

    const points =
      (ep.direction === 'long'
        ? last.stopPriceMicros! - ep.avgEntryPriceMicros
        : ep.avgEntryPriceMicros - last.stopPriceMicros!) / PRICE_SCALE;
    ep.stopVsAvgEntryPoints = points;
    const pv = pvFor(ep.contract);
    ep.stopVsAvgEntryCents = pv === null ? null : Math.round(points * pv * ep.peakQty);
  }

  const contractsTraded = tapeRoundTrips.reduce((s, r) => s + r.qty, 0);
  const feePerContract = contractsTraded === 0 ? 0 : Math.round(Math.abs(net.feeCents) / contractsTraded);

  // Per-add economics. Measured against the VOLUME-WEIGHTED average exit, not the last exit
  // fill: a position scaled out at three prices has no single exit, and pricing every add
  // against the last one would invent a number rather than state one.
  for (const ep of episodes) {
    const pv = pvFor(ep.contract);
    if (pv === null || ep.avgExitPriceMicros === null) continue;
    for (const e of ep.entries) {
      const points =
        (ep.direction === 'long' ? ep.avgExitPriceMicros - e.priceMicros : e.priceMicros - ep.avgExitPriceMicros) /
        PRICE_SCALE;
      e.pointsToAvgExit = points;
      e.grossCents = Math.round(points * pv * e.qty);
      e.netCents = e.grossCents - feePerContract * e.qty;
    }
  }

  // ── FIXED: THIS WAS A UTC CALENDAR DATE ────────────────────────────────────────────────
  // Was: `fills.map((f) => f.filledAt.toISOString().slice(0, 10))`.
  //
  // A UTC slice is not the date the exchange or the broker files a trade under. CME's trade date
  // rolls at 17:00 America/Chicago, so a fill at 17:29 CT belongs to the NEXT date, while the
  // UTC slice files it under the current one. Tradovate computes its daily figures from 17:00 CT
  // and prop firms reset the daily loss limit there, so calendar-day bucketing disagrees with
  // the broker on every evening session — a number Run cannot reconcile.
  //
  // Both sources go through the same function, so they cannot disagree with each other:
  //   - a round trip is dated by its EXIT, because a trade belongs to the session it was
  //     realised in (spec.md §8)
  //   - a fill is included too, so a day the trader traded without closing anything is still a
  //     day on the tape rather than a hole
  const dayKeys = new Set<string>();
  for (const r of tapeRoundTrips) if (r.exitAt) dayKeys.add(sessionDateFor(r.exitAt));
  for (const f of fills) dayKeys.add(sessionDateFor(f.filledAt));
  const tradingDays = [...dayKeys].sort();

  // Sessions, totalled here so nothing downstream has to add up rows. Keyed on the round trip's
  // EXIT, because a trade belongs to the session it was realised in (spec.md §8) — the same rule
  // `tradingDays` above uses, from the same function, so the two can never disagree about which
  // day a trade landed on.
  const sessions: TapeSession[] = [...dayKeys].sort().flatMap((sessionDate) => {
    const rows = tapeRoundTrips.filter((r) => r.exitAt && sessionDateFor(r.exitAt) === sessionDate);
    if (rows.length === 0) return [];

    const byRootMap = new Map<string, { roundTrips: number; contracts: number; netCents: number }>();
    for (const r of rows) {
      const root = r.contract ? (rootOf.get(r.contract) ?? r.contract) : 'unknown';
      const e = byRootMap.get(root) ?? { roundTrips: 0, contracts: 0, netCents: 0 };
      e.roundTrips += 1;
      e.contracts += r.qty;
      e.netCents += r.netCents ?? r.grossCents;
      byRootMap.set(root, e);
    }

    const winners = rows.filter((r) => r.outcome === 'winner').length;
    const losers = rows.filter((r) => r.outcome === 'loser').length;
    const times = rows.map((r) => r.exitAt!.getTime());
    return [
      {
        sessionDate,
        roundTrips: rows.length,
        contracts: rows.reduce((s, r) => s + r.qty, 0),
        winners,
        losers,
        // Against round trips, not against winners+losers: a scratch is a trade that happened.
        winRate: Math.round((winners / rows.length) * 1000) / 10,
        grossCents: rows.reduce((s, r) => s + r.grossCents, 0),
        feeCents: rows.reduce((s, r) => s + (r.feeCents ?? 0), 0),
        netCents: rows.reduce((s, r) => s + (r.netCents ?? r.grossCents), 0),
        firstAt: new Date(Math.min(...times)),
        lastAt: new Date(Math.max(...times)),
        byRoot: [...byRootMap]
          .map(([root, v]) => ({ root, ...v }))
          .sort((a, b) => b.contracts - a.contracts),
      },
    ];
  });
  const cancels = tapeOrders.filter((o) => o.status === 'canceled');

  const displayTimezone = input.displayTimezone ?? SESSION_BOUNDARY_ZONE;
  const accountNames = [...new Set(fills.map((f) => f.accountName).filter((a): a is string => !!a))];

  const tape: Tape = {
    accounts: accountNames,
    accountTypes: Object.fromEntries(accountNames.map((n) => [n, input.accountTypes?.[n] ?? 'unstated'])),
    displayTimezone,
    roundTrips: tapeRoundTrips,
    orders: tapeOrders,
    episodes,
    totals: {
      grossCents: net.grossCents,
      feeCents: net.feeCents,
      netCents: net.netCents,
      hasFees: net.hasFees,
      unallocatedFeeCents: net.unallocatedFeeCents,
      winners: tapeRoundTrips.filter((r) => r.outcome === 'winner').length,
      losers: tapeRoundTrips.filter((r) => r.outcome === 'loser').length,
      feePerContractCents: feePerContract,
      feesImplausible: net.hasFees && feePerContract > FEE_SANITY_CEILING_CENTS,
    },
    pointValue,
    sessions,
    meta: {
      fills: fills.length,
      roundTrips: roundTrips.length,
      orders: orders.length,
      cancels: cancels.length,
      traderCancels: cancels.filter((o) => o.cancelCause === 'trader').length,
      ocoCancels: cancels.filter((o) => o.cancelCause === 'oco_sibling').length,
      amendments: tapeOrders.filter((o) => o.amended).length,
      positions: {
        total: episodes.length,
        closedByStopFiring: episodes.filter((e) => e.stopSource === 'fired').length,
        stopWorkingAtClose: episodes.filter((e) => e.stopSource === 'canceled_with_position').length,
        noStopFound: episodes.filter((e) => e.stopSource === null).length,
      },
      tradingDays,
      contractsTraded,
      deduped: { fills: fillsD.dropped, roundTrips: rtD.dropped, orders: ordersD.dropped, fees: feesD.dropped },
      localOffsetMs: offsetMs,
    },
    verifiedNumbers: new Set<string>(),
  };

  // Built last, from the finished tape, so a figure can never be whitelisted without also
  // being asserted. Every money value in both signed and bare form, since a sentence may
  // write either.
  const v = tape.verifiedNumbers;
  const addMoney = (c: number) => {
    v.add(fmtMoney(c));
    v.add(fmtMoney(Math.abs(c)));
  };
  const addCount = (n: number) => v.add(String(n));
  // A price renders as 29162.00 and a writer types 29162. Same assertion, so whitelist both,
  // or the checker flags the tape's own figure for being written naturally.
  const addPrice = (c: number) => {
    v.add(fmtPrice(c));
    if (c % 100 === 0) v.add(String(c / 100));
  };
  // The tape renders "5m 27s"; a writer types "5m27s". Same claim.
  const addDuration = (ms: number) => {
    const d = fmtDuration(ms);
    v.add(d);
    v.add(d.replace(/ /g, ''));
  };
  // Clock times must be whitelisted, not skipped by the checker. A read that says "you were
  // back in at 09:31" is making a claim about the tape exactly as much as a dollar figure is,
  // and an invented timestamp is a class-1 error. Both HH:MM:SS as rendered and the HH:MM a
  // writer will naturally shorten it to.
  //
  // ── FIXED, AND THE BUG WAS INTRODUCED BY THE CLOCK FIX ITSELF ─────────────────────────────
  // This used `d.toISOString()` — UTC — while the render moved to the trader's zone. So the
  // whitelist held 13:25:21 while the tape showed 08:25:21, and every timestamp a read quoted
  // CORRECTLY was flagged as unverified. Measured on the first small run: three flags, all three
  // real figures, zero fabrications.
  //
  // That is the two-code-paths-for-one-value failure this codebase has a rule against, and
  // fixing the render without following it here is how I created it. The repair is structural
  // rather than a matching edit: both now read `tape.displayTimezone` and go through the same
  // formatters, so they cannot drift apart again.
  const addClock = (d: Date | null) => {
    if (!d) return;
    const clock = displayClock(d, displayTimezone); // HH:MM:SS, 24-hour, zero-padded
    v.add(clock);
    v.add(clock.slice(0, 5));
    // FORMAT COUNTS AS QUOTING, exactly as rounding does. A writer types the time the way a
    // person says it, and the tape's zero-padded 24-hour rendering is not that. Measured across
    // two runs: "8:38", "8:32", "9:28", "8:43", "8:45", "9:32" and "1:34pm" were all flagged,
    // and every one was a correctly-quoted figure the whitelist could not recognise. Six of
    // seven flags on one run were this, which is the noise-buries-signal failure the number
    // check's own record warns about.
    const [h, m] = clock.split(':');
    const h24 = Number(h);
    v.add(`${h24}:${m}`); // 8:38
    v.add(`${h24}:${m}:${clock.slice(6)}`); // 8:38:12
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const suffix = h24 < 12 ? 'am' : 'pm';
    v.add(`${h12}:${m}`); // 1:34
    v.add(`${h12}:${m}${suffix}`); // 1:34pm
    v.add(`${h12}:${m} ${suffix}`); // 1:34 pm
    const day = sessionDateFor(d);
    v.add(day);
    v.add(day.slice(5));
    // 7/13, the way a trader writes a date in a sentence.
    const [, mm, dd] = day.split('-');
    v.add(`${Number(mm)}/${Number(dd)}`);
    v.add(`${mm}/${dd}`);
  };
  for (const rt of tape.roundTrips) {
    addClock(rt.entryAt);
    addClock(rt.exitAt);
    addMoney(rt.grossCents);
    if (rt.feeCents !== null) addMoney(rt.feeCents);
    if (rt.netCents !== null) addMoney(rt.netCents);
    addPrice(rt.entryPriceMicros);
    addPrice(rt.exitPriceMicros);
    addCount(rt.qty);
    if (rt.holdMs !== null) addDuration(rt.holdMs);
  }
  for (const o of tape.orders) {
    addCount(o.qty);
    if (o.limitPriceMicros !== null) addPrice(o.limitPriceMicros);
    if (o.stopPriceMicros !== null) addPrice(o.stopPriceMicros);
    addClock(o.placedAt);
    addClock(o.filledAt);
  }
  for (const ep of tape.episodes) {
    addClock(ep.openedAt);
    addClock(ep.closedAt);
    for (const e of ep.entries) addClock(e.at);
    addCount(ep.peakQty);
    addPrice(ep.avgEntryPriceMicros);
    if (ep.avgExitPriceMicros !== null) addPrice(ep.avgExitPriceMicros);
    for (const e of ep.entries) {
      addPrice(e.priceMicros);
      if (e.pointsToAvgExit !== null) v.add(Math.abs(e.pointsToAvgExit).toFixed(2));
      if (e.grossCents !== null) addMoney(e.grossCents);
      if (e.netCents !== null) addMoney(e.netCents);
    }
    addMoney(ep.grossCents);
    if (ep.workingStopMicros !== null) addPrice(ep.workingStopMicros);
    if (ep.stopVsAvgEntryCents !== null) addMoney(ep.stopVsAvgEntryCents);
    if (ep.stopVsAvgEntryPoints !== null) v.add(Math.abs(ep.stopVsAvgEntryPoints).toFixed(2));
  }
  for (const pv of tape.pointValue.byRoot.values()) addMoney(pv.cents);
  addMoney(tape.totals.feePerContractCents);
  addMoney(tape.totals.grossCents);
  addMoney(tape.totals.feeCents);
  addMoney(tape.totals.netCents);
  addCount(tape.totals.winners);
  addCount(tape.totals.losers);
  addCount(tape.meta.orders);
  addCount(tape.meta.cancels);
  addCount(tape.meta.traderCancels);
  addCount(tape.meta.ocoCancels);
  addCount(tape.meta.amendments);
  addCount(tape.meta.roundTrips);
  addCount(tape.meta.tradingDays.length);
  addCount(tape.meta.contractsTraded);
  for (const s of tape.sessions) {
    addMoney(s.grossCents);
    addMoney(s.feeCents);
    addMoney(s.netCents);
    addCount(s.roundTrips);
    addCount(s.contracts);
    addCount(s.winners);
    addCount(s.losers);
    v.add(String(s.winRate));
    v.add(String(Math.round(s.winRate)));
    v.add(s.sessionDate);
    v.add(s.sessionDate.slice(5));
    addClock(s.firstAt);
    addClock(s.lastAt);
    for (const r of s.byRoot) {
      addCount(r.roundTrips);
      addCount(r.contracts);
      addMoney(r.netCents);
    }
  }
  for (const n of Object.values(tape.meta.positions)) addCount(n);

  return tape;
}
