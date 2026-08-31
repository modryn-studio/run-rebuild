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

/** The good day: one mechanism, named, priced, and three trades that show it. */
export const RECAP_STRONG: Recap = {
  state: 'ready',
  sessionDate: '2026-08-28',
  lede: 'You moved your stop three times today, all three further away, all three on MNQ.',
  body: [
    'You moved your stop three times today, all three further away, all three on MNQ.',
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
    'A quiet session: eight trades, all on MES, and none of them held longer than four minutes.',
    'Six closed at a target and two at a stop, which is the same shape as the previous four sessions. Net was +$63.40 after $41.60 in fees, so fees took 40% of the gross.',
    'Nothing in the executions separates today from the sessions around it.',
  ].join('\n\n'),
  trades: [
    { id: 'f4', symbolRoot: 'MES', product: 'Micro S&P 500', at: '8:34 AM', netCents: 2180 },
    { id: 'f5', symbolRoot: 'MES', product: 'Micro S&P 500', at: '9:02 AM', netCents: -1560 },
  ],
  provenance: { roundTrips: 8, accounts: 1, fees: true },
};

/** The engine ran and declined. Four trades on one account is not a session to read. */
export const RECAP_THIN: Recap = { state: 'thin', sessionDate: '2026-08-26' };

/** A corpus exists, no read has been generated yet. Pre-job, and after a failed run. */
export const RECAP_PENDING: Recap = { state: 'pending', sessionDate: '2026-08-29' };

/** Day one. The only state with nothing behind it at all. */
export const RECAP_EMPTY: Recap = { state: 'empty', sessionDate: '2026-08-31' };
