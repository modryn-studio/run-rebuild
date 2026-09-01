/* WHAT A DAILY RECAP IS, AS A SHAPE — and nothing here reads the database yet.
 *
 * The engine that WRITES one is `lib/desk/read.ts` and it works: two lenses on the same tape, a
 * synthesizer, and a number check that refuses any figure the tape does not assert. What it has
 * never had is a home. It runs from `scripts/s1-read.mts` against CSV files on disk, and its output
 * has only ever been seen in a terminal.
 *
 * So this file is the CONTRACT between that engine and the card, written first and deliberately.
 * The card is built against fixtures shaped exactly like this; when the nightly job lands it fills
 * the same shape and the card does not change.
 *
 * ─── WHEN IT RUNS, AND IT IS NOT A PREFERENCE ──────────────────────────────────────────────────
 *
 * `market-hours.md` §1 gives three different hours and only one gap:
 *
 *   the trade date        17:00 CT -> 17:00 CT   the boundary a fill is DATED to
 *   the tradeable session 17:00 CT -> 16:00 CT   when the book is open
 *   the maintenance break 16:00 CT -> 17:00 CT   Globex is DOWN, Mon-Thu
 *
 * The session's fills are complete at 16:00, the book is shut until 17:00, and the date does not
 * roll until 17:00. **The maintenance break is the only hour where a session is finished and the
 * next one has not started**, which makes it the only honest time to read a day. A job at ~16:15 CT
 * reads a complete session and publishes before the trader could take another trade.
 *
 * ONE READ PER SESSION DATE (Luke, 2026-08-31), and it is both an economics rule and a product one.
 * `ai-economics.md` §1 measures a full desk read at **$1.58 billed** - $47 per trader per month
 * nightly, before the tape grows. And a read a trader can re-roll is a read they will re-roll until
 * they like it, which is the opposite of a record. So: one per `sessionDate`, and a manual "read it
 * now" SPENDS that day's allowance rather than adding to it.
 *
 * `ai-economics.md` §6 proposes a two-speed architecture - weekly discovery at Opus, nightly at
 * Haiku against open claims - which brings it to ~$4/trader/month. **That proposal assumes a
 * PATTERN**, and 2026-08-31 chose the reading. So the cost question is reopened rather than solved,
 * and it belongs to the slice that builds the job, not to this card.
 */

/** The state a card is in, and the four are exhaustive on purpose. */
export type RecapState =
  /** A read exists for a session. The normal case. */
  | 'ready'
  /** The session was too thin to say anything useful. The engine ran and declined. */
  | 'thin'
  /** The trader has a corpus but no read has ever been generated. Pre-job, and after a failure. */
  | 'pending'
  /** No trades at all. Day one. */
  | 'empty';

export interface Recap {
  state: RecapState;
  /** The session this covers, `YYYY-MM-DD`. NEVER a relative word - see below. */
  sessionDate: string;
  /* THE CLAIM. One sentence, and it is the ONLY place it appears (2026-08-31, Luke: *"not a lot of
     people like to get a modal with a face full of writing... we need low low low cognitive
     load"*). It is the card's line, and when the card opens it becomes the overlay's TITLE - so
     tapping a card that says X no longer produces a modal that opens by saying X again. That
     repetition was the actual wall, not the length. */
  lede?: string;
  /* THE WORKING, AND NOT THE CLAIM AGAIN. Everything after the first sentence: how it happened, what
     it cost, what separates it from the sessions around it. The engine writes one piece of prose;
     the first paragraph is `lede` and the rest is this, split when the read is stored rather than
     at the render. Absent unless `ready`. */
  body?: string;
  /** The trades it cites, in the order it cites them. Independent of `evidence` below: a read
   *  that draws a comparison still points at the trades the comparison was drawn from. */
  trades?: RecapTrade[];
  /** WHAT SHAPE THE EVIDENCE TAKES. See `RecapEvidence`. Absent means the citations alone. */
  evidence?: RecapEvidence;
  /** What it was built from, for the trust note. */
  provenance?: { roundTrips: number; accounts: number; fees: boolean };
}

/* THE EVIDENCE VOCABULARY — a CLOSED SET THE ENGINE SELECTS FROM, never a UI it generates.
 *
 * 2026-09-01, Luke: *"what about using generative ui on that step depending on what the ai call
 * brings back for a recap?"* Yes, with one word changed, and the word is load-bearing. The engine
 * picks a `kind`; SQL fills the payload; this file names every shape that exists. What it never
 * does is let the model emit markup or numbers - `CLAUDE.md` already has the rule (*the LLM never
 * computes a number*), and the generative-UI literature converged on the same one from the other
 * side: data inside a rendered card comes from a real backend call, or the interface is a more
 * convincing way to present a hallucination.
 *
 * WHY THE FIELD EXISTS BEFORE THE SECOND KIND IS WORTH RENDERING. `CLAUDE.md`: scope every read
 * from the first query, *free now, unretrofittable once four surfaces depend on it*. The job, the
 * card, the overlay and the eventual `/read` archive will all read this. Adding it after they
 * exist is four migrations; adding it now is one field.
 *
 * IT DEGRADES BY CONSTRUCTION. The overlay's switch ends on a `default` that renders the cited
 * rows, so a `kind` this build has never heard of - a newer job writing into an older client -
 * renders the evidence every read has rather than an empty box.
 *
 * `intraday` IS THE PLANNED THIRD AND IS DELIBERATELY NOT HERE YET. When the claim is about SHAPE
 * OVER TIME (*up $290 at 10:40, closed -$653*) a sentence cannot carry it and a running-P&L line
 * can; `getIntradaySeries` in `lib/accounts/read.ts` already computes the series, and
 * `views/accounts/pnl-chart.tsx` already draws one. It is left out because a `kind` that is
 * typed and not rendered is a hole with a name on it. `build-plan.md` §S8 holds the plan.
 */
export type RecapEvidence =
  /** The default, and everything shipped before 2026-09-01: the cited rows and nothing else. */
  | { kind: 'trades' }
  /* THIS SESSION AGAINST THE TRADER'S OWN BASELINE, which is the one thing the competitor does
     genuinely well and the coaching literature is unanimous about: feedback lands when it is
     comparative and specific, and a figure with no baseline beside it is not information.
     COUNTED IN TRADES, NEVER IN DAYS (2026-09-01, Luke: *"60 days? no. 60 trades maybe. users a
     day traders here. who's accounts last maybe a couple days before they are blown"*), and
     `prop-firm-identity.md` is the evidence rather than the anecdote: a prop account is deleted
     BY TRADOVATE within minutes-to-hours of being failed (§6), most accounts renew monthly
     including failed ones (§1), and a trader holds several at once across several firms. A
     window in days assumes an account that lives for weeks. A window in trades does not.
     `over` IS THE COUNT, AND IT IS PRINTED. A baseline whose width is not stated is a number the
     trader has to take on faith, which is the one thing this product does not ask for. */
  | {
      kind: 'comparison';
      /** What is being compared, in the read's own words. "Average hold on a loser". */
      label: string;
      /** This session's figure, already formatted. The engine never computes it; SQL does. */
      session: string;
      /** The same figure over the baseline window. */
      baseline: string;
      /** How many of the trader's own trades the baseline spans. Printed, never implied. */
      over: number;
    };

export interface RecapTrade {
  id: string;
  symbolRoot: string;
  product: string;
  at: string;
  netCents: number;
}

/* THE SESSION IS NAMED, NEVER "TODAY" OR "YESTERDAY" (2026-08-31, Luke: "so if it was nightly, the
 * trader would get their daily recap as a 'Your yesterday recap' right?").
 *
 * He is right that the relative word breaks, and the boundary is why: a session closing at 16:00 CT
 * is read within the hour, so the SAME read is "today's" to a trader who looks that evening and
 * "yesterday's" to one who looks in the morning. Any relative label is wrong half the time.
 *
 * Monarch already solved this and it is why its card says `August 23rd-29th` rather than "last
 * week". Naming the period is true at every hour.
 *
 * THE SECOND REASON IS DOCTRINE. "Yesterday's recap" on a Wednesday quietly says you missed
 * Tuesday, and `CLAUDE.md`'s re-entry rule is that NO STATE MAY REPRESENT ABSENCE. Naming the
 * session states a fact; naming the distance from now states a gap.
 *
 * PARSED AS UTC, because a session date is a plain calendar string with no time in it - reading it
 * as local shifts the day back for anyone west of Greenwich. */
export function recapPeriod(sessionDate: string): string {
  return new Date(`${sessionDate}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
