# Spin — evolved from "prop-trade recorder" → the compounding trading twin

**Date:** 2026-07-07 (thesis) · **Status (2026-07-20): CONFIRMED** — wager locked, build-prep (Jobs/Kay/Ogilvy/Michelle/Rams) done, build-ready. **Name/domain LOCKED: `Run` / `run.trading`.**
(the "recorder/Blackbox" framing is the data-intake layer, not the product)

> **Current state (2026-07-20) — living state in [`context.md`](context.md).** The thesis below stands and is the canon. What's evolved since: **V1 widened to prop-futures Tradovate traders of ALL skill levels** (blow-up capture is the moat *under the hood*, not the front-page pitch); the **fills-READ is confirmed proven** (TradeZella/TradesViz read live + funded/prop trades via read-only OAuth — the 07-24 meeting is to get Run's vendor creds, not to confirm feasibility); the **moat is FORWARD capture** (a live account reads fully; only a breached-then-deleted account's data is gone). Build ~80% done at `modryn-builds/run-trading`; sprints in [`sprint-1.md`](sprint-1.md) / [`sprint-2.md`](sprint-2.md).

## How the idea moved (recon → future-state lens)

- Started: "black-box recorder — preserve blown-account trades before Tradovate deletes them."
- Recon killed the literal wedge: TradeZella/TradesViz/Tanto/TradeLog/Lune already sync prop fills to
  their own DB in near-real-time. Preservation is a solved, crowded, $13–49/mo commodity.
- Luke's real thesis surfaced: *the whole category is built on 2024 thinking; I'll build the 2030
  version.* Ranked three 2030 wedges: **(1) a personal model of you that compounds across every
  account and firm** [lead], (2) ambient/agentic surface, (3) native real-time agent.
- Year-Five doctrine + 2035 durability check reframed #1 as the moat.

## The thesis

**A compounding, cross-firm behavioral model of the trader — "your trading twin" — that accumulates
every fill, context, and blown account across every firm, acts in real time (#3), through an
ambient/agentic surface (#2).** The journal/recorder is the *data pipeline*, not the product.

**The reconciliation:** the original blown-account problem is the pipeline for the moat — and blown
accounts are the *highest-signal training data* (failure is where the model learns you). Incumbents
batch-sync and don't care if they miss the blow-up session; if that session feeds a model of you,
capturing it becomes existential. Same insight, correct altitude.

## Deep vs thin (Year-Five)

- **Deep (foundation, not roadmap):** capture pipeline that gets *everything incl. ephemeral deleted
  sessions* · **identity-centric** data model (the trader, not the account) · the personal-model layer.
- **Thin (wrap, don't over-build):** dashboard, charts, stats, compliance widgets — commodity.

## 2035 durability

Modeling commoditizes by 2035 (any frontier model reasons about any trader from raw data). The
**corpus** does not — the longitudinal data uniquely captured, *especially the blown-account sessions
Tradovate deleted that no one else has.* A 2035 super-model can't reason about data never recorded.
**Moat that survives = the proprietary captured corpus, not the AI.** ⇒ the most defensible single act
is capturing the ephemeral data everyone else lets vanish.

## Spin test

- **Switch reason:** compounds — longer use = knows you more = higher switching cost. Lock-in that
  per-account journals structurally lack. ✓
- **Reverse-clone:** incumbents copy the *feature* in a sprint but not the *corpus* (theirs starts at
  zero; can't retroactively collect deleted sessions). Account-centric compliance ≠ identity-centric
  compounding model — different data model, different business. ✓

## Open feasibility (carry into build-for-real)

- **Data path — resolved.** The **NinjaTrader Vendor Program** OAuth route (recon: prop accounts need a
  *vendor*, works device-off, cadence is our choice) streams fills / positions / working orders /
  drawdown server-side. This cleanly powers **#1 (corpus)** and **#2 (ambient model)** with no client on
  the trader's machine. Market data + account facts are the easy part.
- **The real open question is the intervention *surface*, not the data → full analysis in
  [`live-architecture.md`](live-architecture.md).** Traders execute *from the chart* — TradingView
  (Tradovate OAuth) or Tradovate's own platform — not in a Twin ticket, and TradingView's broker API is
  broker-side/agreement-gated, so Twin **can't inject into it**; a market order also gives **no pre-click
  window**. #3 resolves to four postures: **(A)** ambient co-pilot (server-side, advisory warning) ·
  **(B)** on-chart browser-extension overlay (proven but fragile) · **(C)** Twin-as-terminal (owns
  execution, fights how traders trade) · **(D)** the breakthrough — Tradovate exposes **risk controls by
  API** + a **trader Manual Lockout that can't be undone once armed**, so Twin's model can *tighten the risk
  envelope / arm the lockout* and **Tradovate enforces the block across every surface** (enforced, not
  advisory; surface-agnostic). **Recommended build: A (warn) + D (enforce).** Even A-alone beats the field.
  **Prototype implication:** the Live view's in-Twin order ticket quietly assumes posture C — reframe Live
  as the companion beside the real chart, lead #3 with the ambient red-zone, and make the enforcement beat
  read as "I armed your Tradovate lockout," not a dismissible modal. (Verify: can a *vendor token* write
  risk params on a prop account — a permissions question for the NinjaTrader vendor program.)
- Prototype (P3 round 2) can fake the corpus/model to test whether the *twin* experience sings — no
  real API needed yet.

## Next action

Rebuild the disposable prototype around the **twin** (not the graveyard): an agent that demonstrably
*knows this trader* — "I've watched 47 of your sessions across 3 firms; here's the setup that blows
your accounts; I'll stop you before the next one." Then plan-annotate loop to sharpen.

---

## UPDATE (Kay recon, 2026-07-18) — Tradovate-first reaches most of the micro-niche via one integration

Web-verified against **prop.tradovate.com/find-a-prop-firm** (2026-07-18): Tradovate Prop has matured
from "a broker several firms use" into a **unified prop platform product — "One Platform. Multiple Prop
Firms. Zero Relearning"** — that **20+ firms run on** (~28 listed, ~23 active: Take Profit Trader,
Tradeify, TradeDay, Funded Futures Family, BluSky, Lucid, FundedNext Futures, Elite Trader Funding,
Top One, Legends, The Trading Pit, Blue Guardian, FuturesElite, Phidias, HolaPrime, AquaFutures,
EmergeProfit, FXify, Goat Funded Futures, LifeUp; Apex also rides Tradovate). **Implication for the
wedge:** the single Tradovate-vendor integration reaches the **bulk of the funded-futures micro-niche**,
so **Tradovate-first is not a compromise start — it is near-full niche coverage from one adapter.**
NinjaTrader is the same company/ecosystem and is converging with Tradovate (near-free next adapter, not
a separate rail). The genuinely separate rails remain **Rithmic** and **ProjectX** (TopstepX / Topstep) —
V2. This strengthens, does not change, the Tradovate-first call. (Adapter principle: see
[`arch-reconciliation.md`](arch-reconciliation.md).)

---


Native real-time agent, not bolted-on AI. Incumbents glue "AI coach / AI query" onto a stats database after the trade. A 2030 version is an agent watching you trade live and intervening at the moment of the revenge trade — pre-trade, not post-mortem.
A personal model of you that accumulates across every account and firm. Not a per-account journal — a portable behavioral model that gets sharper the more you trade and follows you firm-to-firm. That's an accumulating asset per-account journals structurally don't build. (This is where your original "durable cross-firm record" instinct actually lives.)
Ambient / agentic, not a dashboard you visit. Always-on copilot you talk to, that's proactive.

The synthesis of all three, in order:

- #1 (deep — the moat): a compounding, cross-firm behavioral model of you — every fill, every context, every blown account, across every firm. "Your trading twin." Per the doctrine: a corpus that accumulates with every use and cannot be retroactively collected. 
- #2 (the surface): you don't visit a dashboard — it's ambient/agentic, it talks to you, it's proactive.
- #3 (the capability): the model acts in real time — pre-trade intervention, using what it's learned about you.

substance (#1) / form (#2) / action (#3)

- Accounts → #1, the ledger. "Every blown account, across every firm" is literally this screen — five sealed, one alive, all still held. This is the cross-firm + survives-deletion structure of the moat.
- Sessions → #1, the ledger. "Every fill, every context" — each session read and tagged. The raw compounding data itself.
- Your Twin → #1, the synthesis. The model/read rendered — the identity, the signature, the behavioral read. The moat made legible.
- Live → this is the odd one out — it's #3 (the action), riding on #1. It's where the synthesis acts in real time.
So: Accounts + Sessions are the corpus, Your Twin is the model of the corpus, Live is the model acting. Three views expressing the substance, one expressing the capability.

And the sharpest tell — notice #2 (ambient) is not a sidebar item at all. That's correct, and it's a good design signal: a form/paradigm shouldn't be a destination you navigate to. If "Ambient" or "Chat" showed up as a fifth tab, we'd have gotten #2 wrong — it'd be a chatbot you visit instead of a presence that's everywhere. The fact that it should live across all four views rather than as a single destination is the design signal we want — the specific surface it takes (top bar, bottom dock, side rail, invoked, …) is a prototype question, not a thesis one.