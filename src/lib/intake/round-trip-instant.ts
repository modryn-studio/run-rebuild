// When a zoneless row actually happened, and how sure we are.
//
// Two of the four exports carry no timezone at all - Position History and Orders - so neither can
// become an instant without borrowing one. Both borrow the same way: from the FILLS they reference,
// which are the only rows in the batch carrying real UTC. One module, because it is one job.
//
// PURE, AND THAT IS THE REASON THIS FILE EXISTS SEPARATELY. This lived in `write.ts` until
// 2026-08-15, which was the natural home right up to the moment the reconciliation needed it:
// `write.ts` opens with `import 'server-only'`, so `statement.ts` importing the VALUE from there
// made `preflight.ts` server-only too — transitively, silently, and against the purity that
// `preflight.ts`'s own header advertises as its headline departure from v2.
//
// It typechecked and the gate passed, because the gate runs under `--conditions=react-server`.
// What it would have broken is the first `'use client'` file to import `preflight` — the upload
// preview screen being the obvious candidate — and CLAUDE.md's scar tissue is explicit that one
// value pulled from a server-guarded module into a client file fails the build with an error that
// does not name the cause.
//
// Nothing here touches the database, the filesystem, or the environment. Both callers get the same
// answer, which is the property that makes the reconciliation meaningful in the first place: the
// receipt must test what the write path actually stores, not a second derivation of it.
import type { ParsedRoundTrip } from '@/lib/csv/position-history';
import type { ParsedOrder } from '@/lib/csv/orders';

/** Which source answered for a round trip's instant. Recorded on the payload rather than being
 *  silently equivalent, because "we know" and "we guessed" must not read the same later. */
export type TimeSource = 'fills_utc' | 'position_local' | 'ingest_time';

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
 *
 * A CAVEAT THE CALLER OWNS: with only ONE of the two fills present, `Math.max` returns that one
 * and labels it `fills_utc`, i.e. authoritative. If the missing one is the exit, the round trip
 * gets its ENTRY's session date while claiming to be resolved. That is why `preflight` requires
 * both fills before an import may proceed rather than accepting either — see `round_trips_unmatched`.
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

/* AN ORDER'S INSTANT, by the same rule and with a sharper edge to it.
 *
 * Orders carry `placedAtLocal` and nothing else — no UTC column exists in that export at all. But
 * an order that FILLED is referenced by a fill, and that fill carries real UTC, so a filled order
 * can be dated exactly.
 *
 * AN UNFILLED ORDER CANNOT BE, and that is most of them: a cancelled stop, a rejected entry, a
 * working limit that never traded. There is genuinely no zone anywhere for those, so the local
 * clock is the only source and `position_local` is the honest label. That label is the whole
 * point — a later reader can tell an order dated from its own fill from one dated by parsing a
 * zoneless string, rather than trusting both equally.
 *
 * WHY THIS MATTERS MORE FOR ORDERS THAN IT LOOKS. Orders are in the corpus because they are the
 * only record of a stop being placed, moved or cancelled, which is the difference between a trade
 * the trader closed and one the platform closed for them. Putting a cancel on the wrong session
 * date attributes a decision to the wrong day.
 */
export function resolveOrderInstant(
  order: ParsedOrder,
  fillInstantByOrderId: Map<string, Date>
): { at: Date; timeSource: TimeSource } {
  const fromFill = order.externalOrderId ? fillInstantByOrderId.get(order.externalOrderId) : undefined;
  if (fromFill) return { at: fromFill, timeSource: 'fills_utc' };

  const local = order.filledAtLocal ?? order.placedAtLocal;
  if (local) return { at: local, timeSource: 'position_local' };

  return { at: new Date(), timeSource: 'ingest_time' };
}
