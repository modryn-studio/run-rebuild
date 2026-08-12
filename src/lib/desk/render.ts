// Renders a resolved tape as the text a lens actually reads.
//
// Dense and tabular rather than prose: every ambiguity is already settled by the tape, so this
// is a record to be read, not an argument to be made. Nothing here characterizes, ranks, or
// hints at what matters — the moment this file starts deciding what is interesting it becomes
// the metric menu again, in a new costume.
//
// Columns say what was resolved and how. "ended by" is the one that matters most: a stop that
// fired and a target that filled are different events with the same shape in a fills export.
import type { Tape, TapeRoundTrip, TapeEpisode, TapeOrder } from './tape';
import { fmtMoney, fmtPrice, fmtDuration } from './tape';
import { sessionDateFor, displayClock } from '@/lib/time/session';

const pad = (s: string | number, n: number) => String(s).padEnd(n);
const lpad = (s: string | number, n: number) => String(s).padStart(n);
// ── FIXED: THESE BOTH PRINTED UTC TO A HUMAN ─────────────────────────────────────────────
// Was: `d.toISOString().slice(0, 10)` and `.slice(11, 19)`.
//
// The consequence was not subtle once you look for it. The deepest finding in the whole corpus
// is quoted in the reads as happening "17:29:51 to 17:50:23" — those are UTC, so the trades were
// at 12:29 to 12:50 Chicago time, midday. Every timestamp the product asserted was five hours
// off to the only person able to notice.
//
// The three time layers (docs/spec.md §8): STORE in UTC, BUCKET in the market's fixed zone,
// DISPLAY in the trader's own. `day` buckets, so it goes through the session module. `clock`
// displays, so it goes through the trader's zone. Nothing here may invent a third rule.
const day = (d: Date | null) => (d ? sessionDateFor(d) : '-');
const clock = (d: Date | null, tz: string) => (d ? displayClock(d, tz) : '-');

const MECHANISM: Record<TapeRoundTrip['exitMechanism'], string> = {
  stop_hit: 'stop hit',
  target_filled: 'target filled',
  market_exit: 'market exit',
  unknown: 'unknown',
};

function roundTripLine(r: TapeRoundTrip, i: number, tz: string): string {
  return (
    `${lpad(i + 1, 4)}  ${day(r.entryAt)} ${clock(r.entryAt, tz)}  ${pad(r.direction.toUpperCase(), 5)} ` +
    `${lpad(r.qty, 3)}  ${pad(r.contract ?? '-', 6)} ${lpad(fmtPrice(r.entryPriceMicros), 9)} -> ${lpad(fmtPrice(r.exitPriceMicros), 9)}  ` +
    `${lpad(fmtMoney(r.grossCents), 11)} gross  ${lpad(r.netCents === null ? '-' : fmtMoney(r.netCents), 11)} net  ` +
    `${lpad(r.holdMs === null ? '-' : fmtDuration(r.holdMs), 9)}  ${pad(r.outcome, 7)} ${MECHANISM[r.exitMechanism]}`
  );
}

function episodeLine(e: TapeEpisode, i: number, tz: string): string {
  // Each add priced out, rather than left as a price for the reader to do arithmetic on.
  // Six of ten Phase 3 runs computed exactly this series by hand; the one that slipped put
  // three gross figures and one net figure in the same list.
  const adds = e.entries
    .map((x) => {
      const head = `        ${x.qty} @ ${fmtPrice(x.priceMicros)}`;
      if (x.pointsToAvgExit === null || x.grossCents === null || x.netCents === null) return head;
      return (
        `${head}  ${x.pointsToAvgExit.toFixed(2)} pts to avg exit, ` +
        `worth ${fmtMoney(x.grossCents)} gross / ${fmtMoney(x.netCents)} net`
      );
    })
    .join('\n');
  // Two units, stated as two units. The earlier version passed a PRICE gap through fmtMoney,
  // so 2.13 points read as "$2.13" when the money at 4 MNQ was $17.04.
  const gap =
    e.stopVsAvgEntryPoints === null
      ? ''
      : `, ${e.stopVsAvgEntryPoints > 0 ? 'locked profit' : 'at risk'} ${Math.abs(e.stopVsAvgEntryPoints).toFixed(2)} points from avg entry` +
        (e.stopVsAvgEntryCents === null ? '' : ` = ${fmtMoney(Math.abs(e.stopVsAvgEntryCents))} at ${e.peakQty} lots`);
  const stop =
    e.workingStopMicros === null
      ? 'NO protective stop order found for this position'
      : `stop ${fmtPrice(e.workingStopMicros)} (${e.stopSource === 'fired' ? 'THIS STOP FIRED and closed the position' : 'canceled with the position when it closed another way'}${gap})`;
  return (
    `${lpad(i + 1, 4)}  ${day(e.openedAt)} ${clock(e.openedAt, tz)}-${clock(e.closedAt, tz)}  ${pad(e.direction.toUpperCase(), 5)} ` +
    `peak ${lpad(e.peakQty, 3)}  avg entry ${fmtPrice(e.avgEntryPriceMicros)}  ` +
    `avg exit ${e.avgExitPriceMicros === null ? '-' : fmtPrice(e.avgExitPriceMicros)}` +
    `${e.exitFills > 1 ? ` (scaled out over ${e.exitFills} fills)` : ''}  ${lpad(fmtMoney(e.grossCents), 11)} gross\n` +
    `${adds}\n` +
    `        ${stop}`
  );
}

function orderLine(o: TapeOrder, tz: string): string {
  const px =
    o.limitPriceMicros !== null
      ? `limit ${fmtPrice(o.limitPriceMicros)}`
      : o.stopPriceMicros !== null
        ? `stop ${fmtPrice(o.stopPriceMicros)}`
        : 'market';
  const why = o.status === 'canceled' ? (o.cancelCause === 'oco_sibling' ? ' [platform auto-cancel]' : ' [trader canceled]') : '';
  return (
    `      ${day(o.placedAt)} ${clock(o.placedAt, tz)}  ${pad(o.side, 4)} ${pad(o.type, 10)} ${lpad(o.qty, 3)}  ` +
    `${pad(px, 16)} ${pad(o.status, 9)}${o.amended ? ' [amended]' : ''}${why}`
  );
}

// Defaults to the zone the tape was BUILT for, so the render and the whitelist cannot be
// pointed at different clocks. Passing an override here is a bug unless the tape agrees.
export function renderTape(tape: Tape, displayTimezone = tape.displayTimezone): string {
  const tz = displayTimezone;
  const t = tape.totals;
  const m = tape.meta;
  const out: string[] = [];

  out.push('TRADING RECORD');
  out.push(
    `Account(s): ${tape.accounts.join(', ') || 'unnamed'}   ` +
      `${m.tradingDays.length} trading day${m.tradingDays.length === 1 ? '' : 's'}` +
      (m.tradingDays.length ? `, ${m.tradingDays[0]} to ${m.tradingDays[m.tradingDays.length - 1]}` : '')
  );
  // WHAT KIND OF ACCOUNT, STATED. It changes what survival means, and the risk lens used to
  // assert one answer for everybody. An evaluation or funded account is leased and can be ended
  // by a rule; a personal account has no firm above it and no rule that can take it away, only
  // real money. `unstated` is a real value and stays visible: an unanswered question beats an
  // assumed answer, and the lens is told to ask rather than guess.
  const TYPE_NOTE: Record<string, string> = {
    evaluation: 'leased, rule-governed: drawdown limit, daily loss limit, can be ended by a rule',
    funded: 'leased, rule-governed: drawdown limit, daily loss limit, can be ended by a rule',
    personal: "the trader's own money, no firm above it, no rule-based termination",
    unstated: 'NOT STATED for this import, so do not assume which',
  };
  for (const [name, type] of Object.entries(tape.accountTypes))
    out.push(`Account type, ${name}: ${type.toUpperCase()} (${TYPE_NOTE[type]}).`);
  out.push(
    `Totals: ${fmtMoney(t.grossCents)} gross, ${fmtMoney(t.feeCents)} fees, ${fmtMoney(t.netCents)} net.  ` +
      `${t.winners} winners, ${t.losers} losers across ${m.roundTrips} round trips.`
  );
  if (!t.hasFees) out.push('No fee data was supplied, so net equals gross and both understate cost.');
  if (t.unallocatedFeeCents !== 0)
    out.push(`${fmtMoney(t.unallocatedFeeCents)} of fees belong to no completed round trip (open or partly paired).`);
  if (tape.pointValue.byRoot.size)
    out.push(
      'Point value, derived from these round trips: ' +
        [...tape.pointValue.byRoot]
          .map(([root, pv]) => `${root} = ${fmtMoney(pv.cents)} per point per contract`)
          .join(', ') +
        '.'
    );
  // LOW CONFIDENCE IS RENDERED, NOT MERELY STORED. A `confidence` field nothing reads is
  // decoration. At n=1 the value is usable — it is solved arithmetic, not a sample — but a bad
  // row cannot be DETECTED yet, only survived, and the read has to know that to hedge correctly.
  // The personas already self-scope honestly when handed a fact, unprompted, so hand them this.
  for (const [root, pv] of tape.pointValue.byRoot)
    if (pv.lowConfidence)
      out.push(
        `Point value for ${root} is derived from a single paired trade, so treat dollar figures ` +
          `for that instrument as provisional.`
      );
  // A quarantined root has NO point value, and nothing downstream may price it. Said out loud
  // rather than silently omitted, because a missing figure the read cannot see is a figure the
  // read will try to reconstruct.
  for (const [root, why] of tape.pointValue.quarantined)
    out.push(`No point value for ${root}: ${why}. Dollar figures for that instrument are unavailable.`);
  // Stated by code because a read cannot be relied on to notice: given fees inflated fiftyfold,
  // one run in three built a confident breakeven rule on the bad figure rather than doubting it.
  if (t.feesImplausible)
    out.push(
      `WARNING, THE FEE DATA IN THIS EXPORT IS NOT CREDIBLE. It works out to ` +
        `${fmtMoney(t.feePerContractCents)} per contract round turn, where a real futures commission is a ` +
        `few dollars. Treat every net figure below as unreliable, say so plainly, and do not build ` +
        `advice on cost until the trader confirms it against a broker statement.`
    );
  out.push('');

  out.push('ROUND TRIPS');
  out.push('Direction, outcome and what ended each one are resolved from the order log, not inferred.');
  out.push('   #  date       time      dir    qty  sym       entry ->      exit        gross          net       hold   outcome ended by');
  tape.roundTrips.forEach((r, i) => out.push(roundTripLine(r, i, tz)));
  out.push('');

  out.push('POSITIONS (flat to flat)');
  out.push(
    'Each add is priced against the position\'s volume-weighted average exit, so no arithmetic is ' +
      'left to do. Net applies this tape\'s average fee of ' +
      `${fmtMoney(t.feePerContractCents)} per contract round turn, which is an average, not an exact ` +
      'per-trade allocation. The working stop is the protective order live when the position closed.'
  );
  // Counted here so a read never has to tally them itself. One did, and got it wrong.
  const p = m.positions;
  out.push(
    `${p.total} positions. ${p.closedByStopFiring} ended because a stop fired. ${p.stopWorkingAtClose} closed ` +
      `another way with a stop still working. ${p.noStopFound} had no protective stop order at all.`
  );
  tape.episodes.forEach((e, i) => out.push(episodeLine(e, i, tz)));
  out.push('');

  out.push('ORDERS');
  out.push(
    `${m.orders} total, ${m.cancels} canceled. Of the cancels, ${m.ocoCancels} were the platform ` +
      `retiring a bracket leg when its partner filled, and ${m.traderCancels} were the trader pulling the order himself. ` +
      `${m.amendments} order${m.amendments === 1 ? ' was' : 's were'} modified after being placed.`
  );
  const byDay = new Map<string, TapeOrder[]>();
  for (const o of tape.orders) {
    const k = day(o.placedAt);
    (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(o);
  }
  for (const [d, list] of [...byDay].sort()) {
    out.push(`    ${d}`);
    for (const o of list) out.push(orderLine(o, tz));
  }

  return out.join('\n');
}
