# Problem brief — Run

> Phase 1 artifact. **Status: draft — two boxes unfilled.**
> Last updated 2026-08-11.

<!-- FRICTION 2026-08-11 · P1 · The blueprint assumes discovery is an interview ("walk me
     through the last bad day"). Luke rejected the format outright and named the problem
     directly, then pointed at existing evidence. Candidate blueprint amendment: phase 1
     should branch on whether the builder is also the user and whether prior evidence
     exists — the story-interview is for when you're discovering someone else's problem,
     not documenting your own. Reacting to a draft > being interviewed, for this builder. -->

<!-- CLEAN-SLATE DOOR OPENED 2026-08-11 · Luke explicitly authorized reading
     run-trading/docs/competitor-failures.md. Evidence carried forward; commitments and
     solutions in that doc deliberately NOT carried — those are phase 2 decisions to
     re-derive. Logged for Q6. -->

---

## Problem

*Draft — needs Luke's sign-off.*

> A trader who wants to know what's actually going wrong in their trading can't trust any
> tool that claims to tell them. The numbers are wrong, the sync dies quietly, and the
> "insight" just restates what's already on the chart.

Note this is three distinct failures stacked, and they compound in a specific order:
**if the record is wrong, the sync gap makes it incomplete, and then the insight built on
top of it is worthless anyway.** Trust is sequential — nothing above the record survives a
broken record.

---

## Who

*UNFILLED — needs Luke.* Current candidates, unresolved:

- Luke himself (active NQ/ES futures trader) — user #1, definitely
- Retail futures traders on prop/funded accounts
- Any serious retail trader already paying for a journal and burned by it

**The sharpening question:** the evidence base is *people who already pay for a journal and
are angry*. That is a much narrower and more valuable "who" than "traders." It means the
market is switchers, not the unconvinced — a different product and a different pitch.

---

## Today — how they cope, and what it costs

Documented complaints from paying users across the field (source:
`run-trading/docs/competitor-failures.md`, drawn from Trustpilot 1-star reviews, App Store,
and review aggregators — plus first-hand confirmation 2026-08-10):

**The record can't be trusted.**
- TraderSync — wrong currency base corrupting commissions, fees, P&L; "zombie trades" stuck open
- TradesViz — "discrepancies in the PnL numbers," inaccurate imports
- TradeZella — open positions showing as 100% profits, "screws up all the stats"
- SuperTrader — a user lost 7 months of data

**Sync works until it doesn't.**
- Token expiry silently killing sync every 6–7 days (TradeZella/Schwab)
- "Sync gets stuck and keeps loading," "works one day not the next"
- The bar is lower than assumed: users aren't asking for real-time, they're asking for *reliable at all*

**The insight is shallow.**
- TraderSync — "the AI simply sums up a few trends… nothing a simple Excel sheet couldn't do"
- TradesViz — "'AI' tells you everything you could interpret from the chart yourself"

**Confirmed first-hand, 2026-08-10**, inside TradeZella on Luke's real data (187 trades),
in their flagship AI artifact:
- `MAX DRAWDOWN / WATCH OUT / 1644.2%` — a number that cannot be true, rendered as a
  headline card with a verdict attached
- Key Takeaway: *"Focus on reducing losses and improving trade quality… rather than
  increasing trade frequency"* — true of every losing trader alive
- First explainer card opens with a textbook definition of profit factor
- Across the whole artifact: no pattern named, no time of day, no setup, no dollar cost of
  any specific behavior

**And the field's other pole:** Tradervue/Edgewonk — dated, 2.6 Trustpilot, "looks the same
as five years ago." Nobody occupies the middle. The choice today is overloaded-and-wrong or
stale.

**What it costs:** money paid for a record that is wrong, and — worse — decisions made on
top of it. A trader acting on a corrupted stat is worse off than one with no journal at all.

---

## Spin

*Draft — the strongest candidate, but must survive phase 2 scrutiny before it's locked.*

> **Insight the trader could not have read off their own chart** — their specific pattern,
> named, priced in dollars, tracked over time. A model of *the trader*, not a summary of
> the trades.

The shape, from the evidence: *"you size up 40–60% after 3 losses; 70% of those are losers;
~$4,200 preventable."* Named behavior, real cost, their own data.

**Why it resists cloning:** it isn't a feature, it's an accumulation. A competitor can copy
the screen in a week; they cannot copy a history of a specific trader's behavior they never
recorded. The moat compounds with time, which means it's worth nothing on day one and a
great deal in month six — a real strategic constraint, not just a nice line.

**The standard to write to is outside trading.** Monarch, on personal finance: *"Your
largest expense was $29 at Massive.com on August 3… Compared to last week… You've used $39
of your $1,150 flex budget (3%)."* Names the thing, compares to the prior period, paces
against the plan. Nothing in trading writes like this.

**The guard:** the moment the insight reads as "here's what your chart already shows," the
spin is gone and this is a better-looking competitor.

---

## Kill signal

*UNFILLED — needs Luke.*

What would have to be true for you to stop? Candidates to react to, not adopt:

- The depth wedge can't actually be built from available data — the patterns aren't there,
  or aren't specific enough to name and price
- Correctness against a real broker turns out to be a permanent tax rather than a one-time
  build
- Traders who complain loudly about their journal won't actually switch

---

## Phase 1 gate

- [ ] Problem sentence signed off by Luke
- [ ] "Who" narrowed to one specific person
- [ ] Kill signal named
- [ ] Would still build it if it took 3× longer than expected
