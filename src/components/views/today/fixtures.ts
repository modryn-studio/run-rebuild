/* HARDCODED READS, AND THEY ARE THE POINT OF THIS PASS.
 *
 * 2026-08-31, Luke: *"frontend only with fake read hardcoded"* - and the reason to do it in this
 * order is that the expensive half of the read (a bridge out of `event.payload`, a nightly job) is
 * expensive whatever the card looks like, while the card is the half most likely to be wrong on the
 * first try. This is the first time the product says anything in its own voice.
 *
 * THREE READS, NOT ONE, AND THE OTHER TWO ARE THE POINT. A fixture I write is a fixture that
 * flatters: it finds something sharp, it says it well, and it makes the card look better than the
 * engine will on a Tuesday. So the rack carries a STRONG read, a MEDIOCRE one, and a session with
 * nothing worth saying - because a card designed only for the good case is a card designed for one
 * day in five.
 *
 * EVERY NUMBER HERE IS INVENTED, and that is safe only because nothing reads it. The moment this is
 * wired, `checkNumbers` in `lib/desk/read.ts` refuses any figure the tape does not assert - the LLM
 * never computes one. These strings are prose written to look like that output, not output.
 *
 * THE PROSE FOLLOWS `psychology.md` §6, which governs every string on this surface: specificity in
 * place of evaluation, and ending on a position rather than a grade. None of these says "you did
 * badly". They say what happened and what it cost.
 */

import type { Recap } from '@/lib/desk/recap';
import { cumulate, type Point } from '@/lib/accounts/series';

/** The good day: one mechanism, named, priced, and three trades that show it. */
export const RECAP_STRONG: Recap = {
  state: 'ready',
  sessionDate: '2026-08-28',
  lede: 'You moved your stop three times today, all three further away, all three on MNQ.',
  body: [
    'The first was 22 minutes in. Price had gone eight points against the position and the stop was four away; you cancelled it and replaced it eleven points out. That trade closed at the new stop, for a loss of $112.50 rather than the $47.20 the original would have taken.',
    'The second and third followed the same shape within the hour, and both closed at the widened stop. Across the three, the distance you added cost $198.30 more than the stops you set when you entered.',
    'Every other trade today closed at the stop you set. The three that did not are the three you were watching when they went against you.',
  ].join('\n\n'),
  trades: [
    { id: 'f1', symbolRoot: 'MNQ', product: 'Micro Nasdaq-100', at: '9:41 AM', netCents: -4720 },
    { id: 'f2', symbolRoot: 'MNQ', product: 'Micro Nasdaq-100', at: '10:12 AM', netCents: -11250 },
    { id: 'f3', symbolRoot: 'MNQ', product: 'Micro Nasdaq-100', at: '11:03 AM', netCents: -8800 },
  ],
  provenance: { roundTrips: 19, accounts: 2, fees: true },
};

/* THE ORDINARY DAY, and it is the one the card has to survive. Nothing dramatic happened, the read
   says so, and it still ends on something the trader can hold. If the card only reads well over the
   fixture above, the card is wrong. */
export const RECAP_PLAIN: Recap = {
  state: 'ready',
  sessionDate: '2026-08-27',
  lede: 'A quiet session: eight trades, all on MES, and none of them held longer than four minutes.',
  body: [
    'Six closed at a target and two at a stop, which is the same shape as the previous four sessions. Net was +$63.40 after $41.60 in fees, so fees took 40% of the gross.',
    'Nothing in the executions separates today from the sessions around it.',
  ].join('\n\n'),
  trades: [
    { id: 'f4', symbolRoot: 'MES', product: 'Micro S&P 500', at: '8:34 AM', netCents: 2180 },
    { id: 'f5', symbolRoot: 'MES', product: 'Micro S&P 500', at: '9:02 AM', netCents: -1560 },
  ],
  provenance: { roundTrips: 8, accounts: 1, fees: true },
};

/* THE COMPARISON KIND, and the fixture exists because the shape is the point rather than the prose.
   Same card, same one screen - the evidence tier is a baseline instead of a list, because the claim
   is about a HABIT and a habit has no three trades to point at.
   THE BASELINE IS COUNTED IN TRADES (`recap.ts`, `RecapEvidence`), and 240 rather than "60 days"
   because a prop account can be deleted by the broker within hours of being failed. It is also the
   fixture that will find the copy-trade problem the day this is wired: a trader running five
   accounts off one decision has five round trips per decision, so 240 round trips can be 48
   decisions. `build-plan.md` §S8 holds that as an open question against the engine, not the card. */
export const RECAP_COMPARISON: Recap = {
  state: 'ready',
  sessionDate: '2026-08-25',
  lede: 'You held today’s losers for 47 seconds on average, and your winners for six minutes.',
  body: [
    'Nine trades, six of them losses. Every one of the six was closed inside two minutes of entry, and four of those were closed while price was still inside the range it had traded in the previous ten minutes.',
    'The three winners ran an average of six minutes and two of them closed at a target. Nothing about the entries separates the six from the three: same product, same size, same hour.',
  ].join('\n\n'),
  trades: [
    { id: 'f6', symbolRoot: 'MNQ', product: 'Micro Nasdaq-100', at: '9:16 AM', netCents: -3140 },
    { id: 'f7', symbolRoot: 'MNQ', product: 'Micro Nasdaq-100', at: '9:22 AM', netCents: -2980 },
  ],
  evidence: {
    kind: 'comparison',
    label: 'Average hold on a losing trade',
    session: '47 seconds',
    baseline: '4m 10s',
    over: 240,
  },
  provenance: { roundTrips: 9, accounts: 1, fees: true },
};

/** The engine ran and declined. Four trades on one account is not a session to read. */
export const RECAP_THIN: Recap = { state: 'thin', sessionDate: '2026-08-26' };

/** A corpus exists, no read has been generated yet. Pre-job, and after a failed run. */
export const RECAP_PENDING: Recap = { state: 'pending', sessionDate: '2026-08-29' };

/** Day one. The only state with nothing behind it at all. */
export const RECAP_EMPTY: Recap = { state: 'empty', sessionDate: '2026-08-31' };

/* ─── `Net P&L`'S SPECIMENS (2026-09-03) ───────────────────────────────────────────────────────
 *
 * A CORPUS LONG ENOUGH FOR THE PICKER TO MEAN SOMETHING. `pnl-plot.tsx`'s fixture is 14 days,
 * which is right for racking the plot and useless for racking a period control: every range from
 * `1m` up would return the same fourteen points, so the menu would look broken. 84 sessions is
 * three months, so `1w`, `1m` and `3m` each draw a visibly different window and `all` differs
 * again.
 *
 * WEEKDAYS ONLY, and that is not cosmetic. The x axis is REAL TIME rather than position in an
 * array, so a fixture with no weekends in it never exercises the one thing that spacing buys - a
 * flat Saturday drawn as wide as a Tuesday. `cumulate` fills the gaps.
 *
 * IT CROSSES ZERO AND ENDS DOWN. A curve that only ever climbs never shows where the dashed
 * baseline sits, and a card racked exclusively on a green figure is a card nobody has seen on a
 * bad month - which for this product is most of them.
 */
const SESSION_CENTS = [
  41_250, -18_400, -63_900, 12_050, 88_700, -24_300, -51_100, 9_400, 76_800, -13_200, 44_600,
  -92_500, 31_900, 58_300, -27_650, 15_400, -8_900, 62_100, -44_300, 5_750, -71_200, 23_800,
  37_450, -16_900, -55_600, 48_200, 11_300, -29_750, 84_100, -62_400, 7_900, 19_650, -38_200,
  53_700, -14_100, -47_900, 26_300, 68_500, -22_750, 3_400, -59_100, 41_800, 17_250, -33_600,
  72_900, -18_050, -66_400, 9_850, 35_200, -27_300, 51_600, -43_900, 14_700, 22_400, -71_800,
  38_950, -12_600, 57_100, -35_400, 8_200, -49_700, 63_300, 25_850, -18_900, -54_200, 42_100,
  16_400, -31_750, 79_600, -58_300, 11_950, 20_700, -40_100, 49_800, -13_500, -52_400, 28_600,
  64_200, -25_900, 2_850, -61_300, 39_400, 15_100, -46_750,
];

/** Weekday sessions ending 2026-09-02, so the fixture's own "last trading day" - which is what
 *  every range is anchored on - is the day before the card was built. */
const SESSION_DAYS = (() => {
  const days: string[] = [];
  const d = new Date(Date.UTC(2026, 8, 2));
  while (days.length < SESSION_CENTS.length) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) days.unshift(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return days;
})();

/** The cumulative line the card is handed. Cumulated HERE rather than in the rack, so the rack
 *  and the page hand the component the same shape from the same helper. */
export const NET_PNL_SERIES: Point[] = cumulate(
  SESSION_DAYS.map((day, i) => ({ day, cents: SESSION_CENTS[i] }))
);

/** ONE SESSION. `cumulate` pads a zero anchor at the day before, so this draws the move OFF the
 *  baseline rather than a floating dot - and every range collapses to those same two points, which
 *  is the state a card racked only on a long corpus never shows you. */
export const NET_PNL_ONE: Point[] = cumulate([{ day: '2026-09-02', cents: -46_750 }]);

/* ONE SESSION, KEYED BY INSTANT - what the `1d` range hands the plot, and the running total is
 * summed here rather than by `cumulate`. That helper fills the GAPS between calendar days, so it
 * reads `dayBefore` on every key and THROWS on an ISO instant; the product never asks it to,
 * because the intraday curve comes from `foldIntraday`, a different fold for a different key
 * space. (`pnl-plot.tsx`'s section 500'd on exactly this the first time it rendered.)
 *
 * IT OPENS AT THE SESSION'S OWN ZERO and ends where `SESSION_CENTS` ends, so picking `1 day` on
 * the racked card lands on the same figure the last daily point carries. A fixture whose ranges
 * disagree with each other is a fixture that makes the control look broken. */
export const NET_PNL_INTRADAY: Point[] = [0, 12_400, -31_800, 8_900, -4_200, -32_050].reduce<Point[]>(
  (acc, cents, i) => [
    ...acc,
    {
      day: new Date(Date.UTC(2026, 8, 1, 22 + i, 15)).toISOString(),
      cents: (acc[acc.length - 1]?.cents ?? 0) + cents,
    },
  ],
  []
);
