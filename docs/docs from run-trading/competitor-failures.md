<!-- Competitor-failure focus doctrine. Author: orchestrator (Claude), 2026-07-24, at Luke's direction.
     Trigger: Luke, 2026-07-24 - reacting point-by-point to the Round 9 complaint mine (recon.md), asking to
     "document these failures and make 100% sure we put our main focus into this stuff."
     Source evidence: recon.md Round 9 (verbatim Trustpilot 1-star reads + App Store + review aggregators).
     Naming note: "Twin" was the prototype; "Run" (run.trading) is the live build at modryn-builds/run-trading.
     From here on this doctrine says Run. No mass-rename of older docs - not worth the churn (Luke's call). -->

# What the field gets wrong - and where Run must not

**Status:** working doctrine. The point of this doc: every competitor complaint in `recon.md` Round 9 is either a
**thing Run must nail** or a **thing Run must refuse**. This is the focus list, ranked by Luke's own reaction to
each on 2026-07-24. Craft is table stakes; *these four* are where the product is won or lost.

---

## The four we MUST nail (P0 - this is the main focus)

### 1. Data integrity - the numbers must be *right*. (Luke: "put our main focus into this stuff")
**The field's cardinal sin.** Paying users across every rival say the record can't be trusted: TraderSync
*"wrong currency base... messing up commissions, fees, profit calculations,"* *"Zombie Trades,"* trades stuck
open; TradesViz *"discrepancies in the PnL numbers,"* *"inaccurate data imports"*; TradeZella *"open positions
show as 100% profits,"* *"screws up all the stats"*; SuperTrader lost a user 7 months of data.

**Why it's Run's biggest opening:** Run's entire thesis is a *trustworthy compounding record that survives the
account dying.* If the numbers are wrong, the moat is worthless. Correctness is not hygiene here - it is the
**marketed** differentiator. This is the Vera gold-standard gate (`project_trading_bench`) promoted from an
internal standard to a public promise.

> **CONFIRMED FIRST-HAND, 2026-08-10** (`recon.md` Round 10 / [`ia-teardown.md`](ia-teardown.md) §2.4). Read inside
> TradeZella on Luke's real data, in their **flagship AI artifact** (`First Import Analysis`, 187 trades):
> **`MAX DRAWDOWN / WATCH OUT / 1644.2%`** - a number that cannot be true, rendered as a headline card with a
> verdict word attached to it. This is no longer a Trustpilot quote from a stranger. It is the leader's marquee
> output, on the same instrument Run reads, this month.
>
> **The pattern to copy is Monarch's, not anyone's in trading.** Their Weekly Recap repeats the same line on
> *every* step: *"Note: Your recap reflects your connected accounts, transaction categorization, and recurring
> items. If anything looks off, you can review and adjust ahead of next week's recap."* Telling the user what
> your output depends on, every time, is §1 solved as a UI pattern rather than as a promise.

**Already tracked - this is the correctness backbone, treat as P0 not backlog:** fee/cash parity
([#23](https://github.com/modryn-studio/run-trading/issues/23)), sync truncation + backoff
([#24](https://github.com/modryn-studio/run-trading/issues/24)), CSV+API dedupe quarantine-on-divergence
([#16](https://github.com/modryn-studio/run-trading/issues/16)), per-fill fees
([#36](https://github.com/modryn-studio/run-trading/issues/36)), round-trip P&L point-value
([#14](https://github.com/modryn-studio/run-trading/issues/14)), CME-day bucketing
([#40](https://github.com/modryn-studio/run-trading/issues/40)), double CSV-detection drift
([#28](https://github.com/modryn-studio/run-trading/issues/28)).
**Commitment:** a number Run shows is a number Run can reconcile to the broker, or Run does not show it.

### 2. Sync reliability - "works till it doesn't" is the bar to beat. (Luke: agreed, same focus)
Token expiry killing sync silently every 6-7 days (TradeZella/Schwab), *"sync gets stuck and keeps loading,"*
*"works one day not the next."* **The bar is lower than we assumed** - users aren't begging for real-time, they're
begging for *reliable at all*. Run's cadence+completeness wedge (`recon.md:135-145`) wins here **only if the
baseline is rock-solid first.** Fast-but-flaky loses to the incumbents' own failure mode.
**Commitment:** reliability before cadence. A missed fill is a bug, not a tuning knob.

### 4. The depth wedge - insight that is NOT "nothing Excel couldn't do." (Luke: "the MOST important part")
Unprompted, from paying users: TraderSync *"the AI simply sums up a few trends... nothing a simple Excel sheet
couldn't do"*; TradesViz *"'AI' tells you everything you could interpret from the chart yourself."* **The entire
field ships shallow AI that restates the chart.** Run's #1 wedge is the opposite: the named-pattern-with-dollar-
cost **failure signature** - *"you size up 40-60% after 3 losses, 70% of those are losers, ~$4,200 preventable"*
(the TILT-grade specificity, `recon.md:360-373`) - a compounding model of *you*, not a summary of your trades.

**This must actually work in Run, not just in the pitch.** The depth lives in the corpus + metrics engine
(`extract/aggregate.ts`, relative/account-agnostic by construction) and the ritual record. **Do not let it
degrade into trend-summary AI** - the moment Run's insight reads as "here's what your chart already shows," Run
has become a better-looking TradesViz and the wedge is gone. Depth is the product; guard it above every feature.
**Commitment:** every insight Run surfaces must be something the trader could *not* have read off the chart -
his own pattern, priced, over time. If it fails that test, it doesn't ship.

> **CONFIRMED FIRST-HAND, 2026-08-10** (`recon.md` Round 10 / [`ia-teardown.md`](ia-teardown.md) §2.4). Verbatim
> from the leader's `First Import Analysis`, generated on Luke's own 187 trades. Its **Key Takeaway**:
> *"Focus on reducing losses and improving trade quality (profit factor, win/loss ratio, Sortino) rather than
> increasing trade frequency to raise your Zella Score."* - true of every losing trader alive. Its first explainer
> card opens: *"Profit factor compares gross profits to gross losses; a value >1.5 is strong…"* - **a textbook
> definition**. Across the whole artifact: no pattern named, no time of day, no setup, no dollar cost of any
> specific behaviour. **The wedge is not theoretical and it is wide open at the top of the field.**
>
> **And the bar is set outside trading.** Monarch's weekly recap, on a personal-finance dataset, writes:
> *"Your largest expense was $29 at Massive.com on August 3… Compared to last week - when spending was dominated
> by Uncategorized ($100 at Anthropic) and Gas ($53 at ExxonMobil) - this week's activity focused more on
> Electronics. You've used $39 of your $1,150 flex budget (3%), with $1,111 remaining for the rest of the month."*
> Names the merchant, compares to the prior period, paces against the plan. **That is the writing standard for
> Run's reckoning** - not anything shipping in trading.

### 7. Anti-bloat - "too many bells and whistles" is the trap. (Luke: "the big one... we HAVE to stay away")
Two failure poles, and nobody hits the middle: TradesViz *"too many bells and whistles... can't even get a PnL
chart on a trade-by-trade basis"* vs. Tradervue/Edgewonk *dated, stale, 2.6 Trustpilot, "looks the same as five
years ago."* **Run's whole visual thesis (calm, restraint-with-craft, `recon.md:407-409`) IS the answer to this**
- but restraint is a discipline that erodes one "small addition" at a time.
**Commitment:** every feature must earn its place against the empty middle. When in doubt, cut. The token-drift /
consistency work ([#18](https://github.com/modryn-studio/run-trading/issues/18)) is this same discipline at the
design-system level. Bells-and-whistles is a hard no, not a taste preference.

> **MEASURED, 2026-08-10** ([`ia-teardown.md`](ia-teardown.md) §3). TradeZella now ships **two permanent levels of
> navigation, 15 destinations** (6 product rows, and 9 more inside Journal), ordered by their product lines rather
> than the trader's questions. Monarch ships **one flat level, 11 rows**, ordered by the questions a user asks -
> **and is deleting one of them** (Cash Flow, folded into Reports, with a banner in the product saying so).
> A company at Monarch's scale subtracting a nav row is the only existing proof that this discipline survives
> growth. Run's proposed answer is **five rows** ([`monarch-for-traders.md`](monarch-for-traders.md) §4), and the
> shell already carries the rule that makes it stick: *"a nav row is a promise."*

---

## The three we handle deliberately, later (not the focus - but on the record)

### 3. Manual-work friction - largely already answered. (Luke: "good info")
The field's *"I spend more time fixing imports than journaling,"* re-apply-template-every-trade busywork. Run's
live-capture + ambient ritual is the structural answer - and the residual friction is already tracked: the
3-file evening CSV upload ([#41](https://github.com/modryn-studio/run-trading/issues/41) /
[#43](https://github.com/modryn-studio/run-trading/issues/43)), removed by live capture. Keep intake friction at
zero as a standing rule; no new action needed.

### 5. Pricing / gating - decided later, on purpose. (Luke's call, 2026-07-24)
The field's dark-patterns (no free trial, no refunds, charges-after-cancel) are a real trust weapon *against*
them - but **Run's posture is Luke's deliberate choice, not the field's inverse.** Run **has an email sign-up gate
and that is intended** (`context.md:51-55` - account before connect/ingest). Run does **not** follow the strict
never-gate rule to the letter, and that's fine. **How Run charges is genuinely undecided and deferred.**
**Placeholder filed:** [#48](https://github.com/modryn-studio/run-trading/issues/48) - genuinely parked, no
trigger set. Consumer anchors already in the docs if useful later (Whoop $30/mo, Oura $5.99/mo, Monarch
$14.99/mo, `analogous-products.md:33-42`).

### 6. Support - a when-live roadmap item, "new-aged support." (Luke: "need to work on when we are live")
Non-existent/slow/rude support is the field's #2 driver of 1-star reviews. **Not a now-problem: solo dev, zero
users - Run can take it slow.** But it belongs on the roadmap explicitly so it isn't an afterthought at launch.
Luke's framing: **"new-aged support"** - not a ticket queue that goes silent for 7 months (TraderSync's actual
record), but something better-fit for a solo studio. Tracking issue filed on run-trading (see below).

---

## The one-line focus

**Run wins by being the journal whose numbers are right, whose sync doesn't silently die, whose insight tells you
something about *you* that you couldn't read off the chart - and by refusing the bells-and-whistles bloat that
makes every rival simultaneously overloaded and untrustworthy.** Everything else is table stakes or later.

**See also:** `recon.md` Round 9 (the evidence), `widening-plan.md §6` (these are the retail complaints too).
