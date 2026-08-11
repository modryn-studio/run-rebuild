# Problem brief — Run

> Phase 1 artifact. **Status: LOCKED — gate passed and tagged `p1-gate`, 2026-08-11.**
> Last updated 2026-08-11.

<!-- FRICTION 2026-08-11 · P1 · The blueprint assumes discovery is an interview ("walk me
     through the last bad day"). Luke rejected the format outright and named the problem
     directly, then pointed at existing evidence. Candidate blueprint amendment: phase 1
     should branch on whether the builder is also the user and whether prior evidence
     exists — the story-interview is for when you're discovering someone else's problem,
     not documenting your own. Reacting to a draft > being interviewed, for this builder. -->

<!-- CLEAN-SLATE DOORS OPENED (log every one) ·
     2026-08-11 · run-trading/docs/competitor-failures.md — competitor evidence + first-hand
       TradeZella confirmation on Luke's 187 trades.
     2026-08-11 · run-trading/docs/spin.md — the corpus/twin thesis, Tradovate-first
       coverage, substance/form/action framing.
     Note: the earlier "carry evidence, leave the answers" stance is WITHDRAWN. Luke's
     framing 2026-08-11: he wants a better *process*, not different answers. Old Run's
     conclusions are inputs to be used freely. See the Q6 amendment in
     blueprint-instrumentation.md. -->

---

## Problem

*Signed off 2026-08-11.*

> A trader who wants to know what's actually going wrong in their trading can't trust any
> tool that claims to tell them. The numbers are wrong, the sync dies quietly, and the
> "insight" just restates what's already on the chart.

Note this is three distinct failures stacked, and they compound in a specific order:
**if the record is wrong, the sync gap makes it incomplete, and then the insight built on
top of it is worthless anyway.** Trust is sequential — nothing above the record survives a
broken record.

---

## Who

**Switchers, primarily** — prop/funded futures traders who already pay for a journal and
have been burned by it. Plus a minority of first-timers who have decided they need a tool
to trade better and are choosing one for the first time.

Luke (active NQ/ES futures trader) is user #1 and the test case.

**What "switchers" implies, and it's not small:** they arrive with history and a grievance.
Their first question is not "what does this do" — it's *"why should I move, and what happens
to my existing trades?"* Import/onboarding is not a checkbox for this audience, it's the
sales pitch. A switcher-first product looks different from an acquisition-first one.

The first-timer minority matters mainly as a constraint: the product can't be so
switcher-shaped that it's unusable with an empty account.

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

Sources: `run-trading/docs/spin.md` (the moat) and `competitor-failures.md` (the felt
product). They are the same idea at two altitudes and neither is complete alone.

> **A model of you that gets sharper the longer you trade — told back to you as your own
> specific behavior, with a dollar figure on it.**

**Substance — the corpus (why competitors can't follow).** A compounding, cross-firm
behavioral record: every fill, every context, every blown account, across every firm. The
journal is the data pipeline, not the product. The highest-signal data is the blow-up
session — failure is where a model learns you — and it is exactly what incumbents miss,
because they batch-sync and don't care if a breached account's session vanishes. A rival
copies the feature in a sprint; their corpus still starts at zero and cannot be
retroactively collected.

**Form — the read (why anyone pays in month one).** Insight the trader could not have read
off their own chart: *"you size up 40–60% after 3 losses; 70% of those are losers; ~$4,200
preventable."* Named behavior, real cost, their own data. The writing standard is Monarch,
on personal finance — *"Your largest expense was $29 at Massive.com on August 3… You've
used $39 of your $1,150 flex budget (3%)"* — names the thing, compares to the prior period,
paces against the plan. Nothing in trading writes like this.

### The tension to carry into phase 2

**The moat is worth nothing on day one.** A corpus is an accumulation; a new user has none.
Forward capture starts compounding immediately and a live account reads fully — but v1
cannot promise depth it has not yet earned. This directly constrains what the first screens
are allowed to claim, and it is a phase 2 scope decision, not a phase 1 one.

**The guard:** the moment the insight reads as "here's what your chart already shows," the
spin is gone and this is a better-looking competitor.

---

## Kill signal

**Confirmed by Luke, 2026-08-11:**

> If the depth wedge is built against Luke's own real trades and cannot name a single
> pattern he did not already know about himself — stop.

Checkable early, on real data, with Luke as the test case. If the read is something he could
have told you unprompted, it is a summary, and summaries are what the whole field already
ships.

### RESOLVED 2026-08-11 — 187 trades is enough

Luke, from direct knowledge of his own data: 187 trades is enough for a real pattern to
exist and be named. **The kill signal works as written, against data that exists today** —
no waiting, no data-collection phase before the wedge can be tested.

This also removes one half of the day-one problem. The moat still compounds over time, but
the *read* does not require a large corpus to produce something true. A user needs a real
history, not a long one.

**Synthetic data has a different job.** ~20,000 fabricated trades for **scale and
performance** — does the metrics engine hold, do queries stay fast, does the UI degrade.
That is a phase 6 hardening task, filed now so it isn't rediscovered late.

It cannot validate the wedge and should never be used to: patterns you generate are patterns
you invented, so detecting them proves only that the generator works.

---

## Phase 1 gate

- [x] Problem sentence signed off by Luke
- [x] "Who" narrowed to one specific person — switchers, prop + personal
- [x] Kill signal named — and pulled forward to build slice `S1`
- [x] Would still build it if it took 3× longer than expected — confirmed 2026-08-11
