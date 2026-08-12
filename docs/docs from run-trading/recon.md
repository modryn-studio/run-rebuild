# Recon — Twin (working slug: `twin`; began as the "prop-trade recorder", pivoted to the twin)

**Date:** 2026-07-07
**Seed type:** problem (not idea/market)
**Problem, in Luke's words:** Trades prop-firm eval + sim-funded futures on Tradovate. When an
account is blown / rules breached, Tradovate auto-deletes the account and its trade history within
minutes-to-hours. Luke downloads CSVs manually but can lose the tail. Personal-account API access
costs $25/mo + $1k balance — but he trades firm-provisioned accounts, not a personal one. Tradovate
pointed him at the **NinjaTrader Vendor Program** (free vendor API access) as the path.

**P0 micro-niche (provisional):** The prop-firm Tradovate trader who has blown ≥1 account and lost
the trade record. Framed as a *data-durability* problem ("your history survives the account dying"),
not a journaling-analytics problem.

**STATUS (2026-07-20) — the wedge evolved; this recon is the historical research that fed it.** The provisional P0 above
(narrow "blown-account data-durability") pivoted to the **compounding cross-firm trading twin** — thesis in
[`spin.md`](spin.md), living state in [`context.md`](context.md). Current: **name locked `Run` / `run.trading`**; **V1
widened to prop-futures Tradovate traders of ALL skill levels** (blow-up capture is the moat *under the hood*); the
**fills-READ is confirmed proven** (TradeZella/TradesViz read live + funded/prop trades via read-only OAuth, 2026-07-20 web
check — the 07-24 meeting is to get Run's vendor creds, not to confirm feasibility); build ~80% at `modryn-builds/run-trading`.
The competitive findings below stand as the evidence base.

---

## 🎯 COMPETITOR MASTER LIST (reference — keep current)

Every tool that captures/syncs Tradovate (prop) trade data to its own cloud. Cadence marked
*(claimed)* = vendor marketing, **not yet measured** — live-read verifies. ✓ native API sync ·
◑ CSV/manual only · ✗ no.

### Primary competitors — trade journals (do what Luke wants: sync prop fills → own DB)

| Tool | Tradovate prop sync | Sync cadence | Prop compliance | Pricing | Notes / positioning |
|---|---|---|---|---|---|
| **TradeZella** | ✓ native (Journal) | real-time *(claimed)* | ✓ + PropFirm Sync (Plaid finance) | $29–49/mo | **100K+ traders** (grown from 50k), 500+ brokers, 967 Trustpilot reviews @ 4.8, 20.2B trades journaled *(live-verified 2026-07-09)*. Two products: Journal (fills) + PropFirm Sync (spend/payouts). Repositioned as "AI Trading Partner." |
| **TradesViz** | ✓ native | "within minutes" / "continuous" *(claimed, also "1–2×/day" elsewhere)* | ✓ 34+ firms | free / $19 / $29 mo | Claims **150,000+ active traders** (bigger than TradeZella), free tier genuinely usable, 600+ stats. AI insight sample seen live: *"Revenge trades 8% WR vs baseline 49%... Cost: -$3,450 this month"* — near-identical framing to Twin's failure-signature, i.e. that pattern-language is already market-validated *(live-verified 2026-07-09)*. |
| **Tanto** (tradetanto) | ✓ native | real-time *(claimed)* | ✓ | ~$? | **Built specifically for prop-firm futures.** Native Tradovate/NinjaTrader/Rithmic/cTrader/Interactive Brokers/ProjectX/TopstepX, 35+ brokers/prop firms incl. Apex/Lucid/FTMO by name. Closest positioning to Luke's niche — but **no public scale/trust numbers**, young (footer copyright starts 2025), no AI/behavioral layer, pure sync+analytics (A–F trade grades, PnL calendar) *(live-verified 2026-07-09)*. |
| **TradeLog** (cot-reports) | ✓ native (vendor API) | real-time *(claimed)* | ✓ Apex/Tradeify/TTP | $? | Futures-first, R-multiples, equity curves, session heatmaps. |
| **Lune** (lunefi) | ✓ native | auto *(claimed)* | ✓ 100+ firms | $? | Rithmic + Tradovate, AI chat insights. |
| **Trademetria** | ✓ native API | "instant" *(claimed)* | partial | $? | Multi-asset (stocks/options/futures/fx/crypto), portfolio consolidation. |
| **TraderSync** | ◑ CSV only | manual import | partial | $? | 100k+ traders, 700+ brokers — but Tradovate is **CSV upload, not native**. |
| **Tradervue** | ◑ mostly | — | ✗ | $? | Oldest; equities/options center of gravity, futures secondary. |
| **Edgewonk** | ◑ CSV | manual | ✗ | one-time | Psychology/custom-metric focus, steep learning curve. |

### Adjacent — trade copiers (preserve fills as a side effect; core job = copying)

| Tool | Tradovate | Latency | Notes |
|---|---|---|---|
| **Tradesyncer** | ✓ (Rithmic/Tradovate) | <100ms | 1.1B+ trades copied, built-in journal, "no desktop, no missed fills when laptop sleeps." |
| **Tradecopia** | ✓ | <50ms | Desktop copier + P&L analytics dashboard. |
| **Replikanto** | ✓ (Rithmic/CQG/Tradovate) | low | NinjaTrader-ecosystem default, up to 100 followers. |
| **CrossTrade** | ✓ (webhooks) | — | Tradovate cloud automation/webhooks (alpha). |
| **PickMyTrade** | ✓ authorized vendor | — | TradingView→Tradovate, no API keys needed. |
| **Tradovate Group Trading** | ✓ native | 0ms | Built-in copy across 5 owned accounts, free. |

### Behavioral / AI-coach / real-time intervention — the Twin-pivot competitor set (most relevant now)

Post-pivot, **these** (not the fill-sync journals above) are Twin's real rivals — see Round 4 below.
✓ has it · ◑ partial/blunt · ✗ no.

| Tool | Real-time intervention (#3) | Cross-firm identity (#1) | Conversational (#2) | Pricing | Notes / positioning |
|---|---|---|---|---|---|
| **SuperTrader** (supertrader.me) | ✓ polls every 2 min, push alerts | ✗ per-account | ✗ | $? | **Closest #3 convergent rival** — tilt/size/session alerts; "2.3× → step back" copy near-verbatim ours. Pre-session briefing + weekly reports. No cross-firm ID, no survives-deletion. |
| **TILT** (tradelensapp) | ◑ Cooldown auto-lock after 3 losses; detection retrospective | ✗ tab-per-challenge | ✓ "Edge" chat (already ships #2) | $? | **Most-built rival.** Discipline Score /100 (5 axes), equity curve w/ inline "↑REVENGE", public demo. Warm-dark, Bebas Neue. Don't imitate the gauge. |
| **TMI** (tmi-ai.com) | ✗ post-session daily/weekly | ◑ "one journal for every prop account" but account-organized | ◑ AI Mentor | $? | **Closest #1 positioning match** (FTMO/Topstep/Apex) — but retrospective; no deleted-account story. |
| **TradingRehab** (tradingrehab.io) | ✗ live monitoring "coming soon" | ✗ | ✗ | $? | Marketing ahead of product. |
| **M1NDTR8DE** (m1nd.app) | ✗ retrospective bias detection | ✗ | ◑ | $? | AI psychology/bias detection, post-hoc. |
| **TradeZella** (Zella AI) | ✗ insight layer, not intervention | ◑ Prop Firm Sync 15+ firms, tab-per-account | ✓ Zella AI | $29–49/mo | Incumbent benchmark; same tab-per-account structure as TILT, broader/more mature. |
| **Edgewonk** (Tiltmeter) | ✗ retrospective | ✗ | ✗ | one-time | Tiltmeter behavioral metric; psychology focus (also in journals list). |

**None combine all three** (real-time pre-click intervention + persistent cross-firm identity that
survives deletion + conversational surface). TILT is closest — has #2, partial #3 — but is
tab-per-account, no identity. That intersection is Twin's whole thesis.

### The absent category

**Nobody** sells "preserve/study your **blown** accounts" or "your firm-independent permanent record."
All positioning = *real-time compliance so you don't blow up* / *pass more* / *copy faster*. Confirmed
positioning gap. Whether that's a product or a landing-page angle = the open question.

---

## Make-or-break feasibility question (RESOLVED by recon)

> Can a third-party app connect to a prop-firm-*provisioned* Tradovate account via API/OAuth?

- **You, personally: NO.** Prop accounts do not allow direct third-party API/OAuth access. The
  standard OAuth path (TradingView, TradersPost, PickMyTrade) works on **personal accounts only** —
  which is exactly why Tradovate quoted the $25/mo + $1k personal-account route.
- **A registered vendor: YES.** The **NinjaTrader Vendor Program** (the free path Tradovate emailed
  Luke about) authorizes a *vendor's app* at the platform level, and that app can then connect users'
  accounts **including prop accounts**. This is the mechanism that makes the whole category possible.
- **"Do I have to have the app open to auto-sync?"** Depends on the capture method:
  - Vendor-API server-side streaming → **no**, the vendor's cloud receives fills; your machine can be off.
  - Browser-extension capture (e.g. TradesViz) → **yes**, the platform/browser session must be open.

## Second finding (reshapes the idea): the space is NOT empty

Multiple tools already real-time-sync Tradovate **prop** accounts to their own cloud — which
inherently survives Tradovate's deletion, because your fill is already in *their* DB:

| Tool | What it does | Prop accounts? | Capture method | Survives deletion? |
|---|---|---|---|---|
| **TradeLog** | Real-time journal, streams every fill/order/position | Yes — names Apex, Tradeify, Take Profit Trader explicitly | Official NinjaTrader/Tradovate vendor API | Likely (cloud copy) |
| **TradesViz** | Auto-sync journal, "within minutes," 100s of metrics | Yes — "all Tradovate-based prop firms" | Tradovate API + browser extension | Likely, minus the tail |
| **Tradesyncer** | Real-time journal + trade copier | Yes | Vendor API, cloud | Likely |
| **TradeDupe / Tradecopia** | Real-time trade *copiers* (not journals) | Yes | Vendor API | N/A (copy, not record) |

## Broader landscape shift (dated)

- **ProjectX** (the multi-firm prop API gateway) went **exclusive to Topstep on 2026-02-28** and is
  now **TopstepX API** ($29/mo, has History endpoints). So Topstep traders have a first-party API;
  other firms (Apex, Tradeify, Take Profit) do **not** — they rely on the Tradovate vendor path.

## Corrections after round 2 (Luke was right on the DB point)

- **Synced fills live in the product's own DB, independent of Tradovate.** Deleting the sim account
  cannot erase already-synced data. Earlier "survives deletion? minus the tail" hedging was wrong.
- **App does NOT need to be open.** OAuth vendor integration holds the refresh token in the vendor's
  cloud; the link runs entirely server-side, computer can be off. (Browser-extension capture is a
  separate, weaker mode used by some tools — not the server-side OAuth model.)

## CORRECTION (round 3, Luke): TradeZella DOES sync trade fills

Earlier claim that TradeZella PropFirm Sync is *only* a money tracker was **wrong** (Luke corrected).
TradeZella has **both**: (a) Plaid bank-connect for prop-firm spend/payout tracking, AND (b) a
**PropFirm Syncer that uses OAuth API with Tradovate to sync actual trade fills/history.** So a
plain "capture your trades from a prop account" tool is **not a wedge** — a well-resourced incumbent
already does it. Also confirmed: **server-side OAuth sync works with the user's device fully off, and
the poll cadence is the vendor's choice — potentially every minute or event-driven.** Nothing
technical forces the daily/twice-daily batch incumbents use.

## The actual gap (this is the wedge — now narrower)

1. **Fill-syncing journals sync on a SCHEDULE, not continuously.** TradesViz auto-sync: *"trades are
   typically synced automatically once or twice daily."* The wedge is **cadence + completeness**, not
   "do they capture at all." NEEDS VERIFICATION per competitor via live-read (below): what is each
   incumbent's real sync interval, and does a fast intraday deletion actually beat it?

→ **The structural crack:** if an account blows intraday and Tradovate deletes it ~1hr later, the
tool's next scheduled daily sync fires *after the account is already gone*. The blow-up session —
the one that matters most — is the one most likely to **never be pulled**. Not "stored history lost";
"last session never captured." Matches Luke's exact lived experience (checks ~1hr later, it's gone).
A journal architected around daily batch sync can't trivially flip this on — real-time, event-driven
capture is a different backend.

## Deep recon round 3 — the incumbents (web + live-read)

**Pricing / scale:** TradeZella $29–49/mo, 500+ brokers, "50,000+ traders," real-time prop drawdown
tracking, multi-account. TradesViz $13–20/mo + free tier, 34+ prop firms, "continuous sync,"
600+ stats. Tradesyncer = copier + instant-sync journal. TradeLog = real-time vendor-API journal
(Apex/Tradeify/TTP). Demand is PROVEN and the space is crowded (clone-and-own logic: question is
the defensible spin, not whether demand exists).

**TradeZella structure (confirmed by live-read of /prop-firm-sync):** two connected products —
(1) **PropFirm Sync** = Plaid finance/spend/payout + compliance dashboard ("drawdown in real time");
(2) **TradeZella Journal** = trade-fill sync via Tradovate OAuth. Integrated. So TradeZella DOES sync
fills (Luke right) AND has the money layer (earlier claim, half-right).

**Cadence is fuzzy across sources:** same tools described as "real-time," "within minutes," AND
"once or twice daily." Marketing ≠ measured. Real cadence + whether a fast intraday deletion beats
it = the open question. **Only resolvable by live-read from inside a connected account.**

**Positioning gap (the interesting find):** every incumbent sells *real-time compliance so you DON'T
blow up*. NONE sells *"when you do blow up, your record survives and you can study it."* The
blown-account graveyard / post-mortem / learning-from-failure angle is absent from all positioning.
Functionally the data may already be preserved; emotionally/positionally it's an open lane. Thin,
but real. Whether it's a *product* or just a *landing page* is the question.

## Strategic read (honest)

The literal "capture before deletion" wedge is **mostly closed** — TradeZella/TradesViz sync prop
fills to their own DB, likely fast enough that Luke's lived pain ("gone an hour later") is solved by
a $13/mo tool. Three ways forward:
- **A — Park the recorder framing.** Problem is solved by incumbents; not worth building.
- **B — Hunt a different gap inside the same niche** (RECOMMENDED). Demand is proven; get inside
  TradeZella + TradesViz, run S3 (real complaints) + S4 (feature matrix) + gap-hunt, find what the
  compliance-obsessed incumbents structurally leave on the table. Decide the spin from real material.
- **C — Different problem entirely.**

Next action (B): Luke logs Claude into TradeZella in the open isolated browser → full teardown to
`projects/twin/reference/tradezella.md` → same for TradesViz → then run the spin test.

## Wedge (named — PROVISIONAL, may not survive round 3)

**Black-box recorder for prop trades:** capture every fill the instant it happens + flush on
breach-detection, so the blow-up session survives Tradovate's deletion — plus a durable,
firm-independent archive of every dead account, still reviewable. Incumbents' daily-batch sync
structurally loses the tail (the wedge); owning a permanent cross-firm record is the deeper moat.

## Luke's answers (round 2)

- Pain = **losing the data**; wants to review trades after failing an account. (Not ownership-framed.)
- Deletion timing: not 100% sure, but ~1hr after a failed account it's already gone from Tradovate.
- Firm-specificity: irrelevant to him — don't scope by firm.
- Confirmed the DB-independence point; corrected my hedging.

## Sources

- https://community.tradovate.com/t/api-access-for-propfirm-accounts/10348
- https://community.tradovate.com/t/prop-account-api-access/10430
- https://support.tradovate.com/s/article/Prop-Firm-and-Evaluation-Account-Inquiries-Tradovate
- https://gateway.docs.projectx.com/
- https://help.topstep.com/en/articles/11187768-topstepx-api-access
- https://damnpropfirms.com/best-prop-firm-trading-platforms/projectx/
- https://tradelog.cot-reports.com/integrations/tradovate
- https://www.tradesviz.com/brokers/Tradovate
- https://tradesyncer.com/trading-journal
- https://partner.tradovate.com/overview/prop-firm-management/create-and-manage-users

---

## Round 4 — Twin-pivot recon (2026-07-07): who covers wedges #1 and #3 today

**Context:** this round is post-pivot. The recorder framing above (rounds 1–3) was shelved — see
`spin.md` for the pivot to **Twin**: not a fill-syncing journal, but a compounding, cross-firm
behavioral model of the trader (#1 the moat), with real-time pre-trade intervention (#3), through an
ambient/conversational surface (#2, not yet built). This round pressure-tests #1 and #3 — the two
wedges the prototype already covers — against what's shipping today. Web search + live-read
(chrome-devtools CLI) of landing pages and, for TILT, its public unauthenticated demo dashboard.

### #3 — real-time pre-trade intervention

**SuperTrader (supertrader.me) is the closest convergent competitor.** Pure-black/white, Inter,
premium-minimal. Ships a live coaching engine polling **every 2 minutes** during market hours, three
alert types (tilt / position-size / session-length), fired as push-style notifications. Their tilt-alert
copy: *"3 consecutive losses. Your average loss after L3 is 2.3× your normal loss size. Step back for
15 minutes before your next entry."* — near-verbatim our own intervention script. Independent
convergence on the same insight (size-creep-after-losses as the #1 blowup signal). Also ships a
pre-session briefing (best setup, avoid-after time, tilt risk 0–10) and weekly/monthly written coaching
reports. **No cross-firm identity, no survives-deletion story — purely per-account, notification-based.**

Everyone else claiming "real-time" is softer than the marketing suggests: **TradingRehab**'s live
monitoring is "coming soon"; **M1NDTR8DE** and **TILT**'s bias detection are retrospective despite
active-sounding verbs; **TMI** is explicit daily/weekly post-session debriefs only.

**TILT (tradelensapp.com) ships the one real structural primitive worth noting:** a "Tilt Detector"
page with a Calm→Hot risk gauge and a **"Cooldown Mode: auto-lock after 3 losses"** toggle
("Start a 15-min cooldown"). A blunt threshold, not a per-trade judgment — but it's a real
account-level intervention primitive, not just a notification.

### #1 — cross-firm behavioral model

**TMI (tmi-ai.com) is the closest positioning match** — "one journal for every prop account,"
explicit FTMO/Topstep/Apex support, AI Mentor flagging revenge trading / overtrading — but it's
**post-session** (daily coaching, weekly debriefs), not real-time, and there's no deleted-account
narrative.

**TILT has the most-built identity visualization of anyone surveyed** — worth studying even though
it's the wrong direction for us to imitate directly:
- **Discipline Score, 0–100**, five axes (Consistency / Risk mgmt / Emotional control / Strategy
  adherence / Session quality), each shown as an /20 bar.
- **Equity curve with inline behavioral annotations** — "↑ REVENGE" marker directly on the curve,
  a highlighted "TILT WEEK" region.
- A full **"Edge" conversational risk-manager chat** embedded in the dashboard (quick-actions: "Analyze
  my last session," "What are my recurring patterns?") — i.e. **they have already shipped our #2**,
  the wedge Twin is deferring.
- **Prop Firm dashboard is tab-per-challenge** — "FTMO Challenge 100K" | "Apex 50K Evaluation" — each
  its own balance/drawdown/rules-compliance tracker. This is the tell: **TILT tracks accounts, not an
  identity.** When a challenge ends or blows, it's a dead tab. No persistent cross-firm "you."

**TradeZella** (incumbent benchmark) — Zella AI as an "insight layer in plain English," Prop Firm Sync
tracking FTMO/TopStep/Apex + 12 more in real time, pass-rate forecasting. Same tab-per-account
structure as TILT, just more mature/broader.

### The gap, sharpened by seeing theirs

Three things are differentiated and only one is currently load-bearing in the prototype's UI:

1. **Tab-per-account vs. one identity.** Every competitor surveyed — TILT, TradeZella, TMI — organizes
   around the account/challenge as the unit. Twin's "one Twin across Apex/Tradeify/Take Profit" inverts
   that. Currently under-visualized: a 4-metric stat strip + prose, not a signature diagram.
2. **Survives deletion.** Nobody syncs via CSV/API and then *also* claims to outlive the account once
   Tradovate deletes it. "5 of 6 accounts deleted — only I still have them" is a claim none of them can
   make. Currently a modest amber callout mid-page — should be the visual centerpiece, not a footnote.
3. **Pre-click, not post-hoc.** SuperTrader notifies every 2 min; TILT auto-locks after a blunt
   3-loss threshold. Neither catches the specific order as the hand is on the button. Twin's Live view
   already does this structurally — the intervention just needs to read as pre-click, not
   after-the-order-ticket.

**Do not imitate TILT's discipline-score gauge** — copying it makes Twin read as a worse TILT. The
right move is a signature visual that's identity-shaped, not metric-shaped: the corpus/moat rendered
as a diagram (a cross-firm account timeline with the sealed/deleted accounts marked), not a score.

**Note in Twin's favor:** SuperTrader, TILT, and TradeZella are all dark-only, aggressive/urgent in
tone. A calm, trustworthy light mode (shipped in the prototype) is currently a genuine, uncontested
differentiator among this set.

**Sources:** https://supertrader.me/ai-trading-coach/ · https://tradelensapp.com/ (+ /demo,
/dashboard/tilt-detector, /dashboard/propfirm — public, unauthenticated) · https://tmi-ai.com/ ·
https://www.tradingrehab.io/ · https://m1nd.app/blog/ai-psychology-detection ·
https://www.tradezella.com/

---

## Table-stakes checklist (mined from TMI, 2026-07-07 — infiltrated via chrome-devtools CLI)

TMI is a **low-threat, mine-freely** competitor: closest #1 *positioning* but built as a retrospective
journal+AI-coach ("You run the desk, TMI works the night shift" — nightly sync), no traction footprint,
weak craft. So its feature set = a free spec of what's *table stakes* in this niche. ✅ match it ·
⭐ where Twin does it differently (the edge) · ✗ skip for prototype.

| TMI feature | Verdict for Twin |
|---|---|
| Broker/account sync (Tradovate/NinjaTrader/MT5) | ✅ table stakes — but ⭐ Twin is **real-time/continuous**, not nightly |
| Low-friction intake (import, PnL-screenshot, **voice journaling**) | ✅ table stakes; voice is a nice cheap add |
| AI Mentor (pattern-spotting, revenge/overtrading coaching) | ✅ table stakes — but ⭐ Twin is **real-time + a compounding identity**, not a nightly debrief |
| Deep Analytics | ✅ table stakes (commodity — build thin) |
| Rule Tracker (FTMO/Topstep/Apex/5%ers drawdown + challenge) | ✅ table stakes (everyone has it) |
| Journal / Trades / Checklist / Weekly Debrief | ✅ table stakes (retrospective surface) |
| Connections (multi-account) | ✅ table stakes — ⭐ Twin unifies into **one identity**, not per-account tabs |
| Trust block (read-only access, encryption, EU hosting, "your data stays yours") | ✅ table stakes — ⭐ leans into Twin's **you-own-the-corpus** moat |
| Community (Discord, share setups, watch-live) | ✗ skip for prototype (growth layer, not core) |
| Pricing tiers (Free / Pro / Ultimate) | ✗ later (never gate before value) |

**Read:** nothing here is a moat — it's the commodity floor. Twin matches the floor thin, and spends
depth on the two things TMI (and the field) don't have: real-time intervention + the compounding
cross-firm identity that survives deletion.

---

## TradeZella infiltration (2026-07-07) — the resourced incumbent, from inside

Infiltrated authed via chrome-devtools CLI. The strongest #1-adjacent player (50k users) — and the read
strengthens the thesis: **even the leader hasn't built the twin.**

- **UI/UX — the anti-TMI.** Light `#f6f6f6`, **system fonts**, ~5 gradients, **0 pills, 0 glow, no
  emoji**, consistent 8/16px radius, clean nav; no scroll bugs across pages. Restrained + professional —
  but *plain*, not crafted-premium. Proves **restraint > flash**; the opening for us is real **craft**
  (Linear-tier), which neither the flashy-weak (TMI) nor the plain-strong (TradeZella) has.
- **#1 cross-firm is only the MONEY layer.** PropFirm Sync = Plaid spend/ROI/breaches, aggregated *By
  firm / account type / size* (cross-firm aggregate, not TILT's per-challenge tabs). No behavioral identity.
- **AI = discrete, credit-metered tasks.** "Agents" are configurable runs — Market Sentiment Briefing,
  Trade Auto-Tagger, **Session Review** (retrospective narrative) — each billed ~3–8 **credits/run**
  against a monthly cap. "Zella AI" is a chat; "Mentor Mode" is **human** mentor/student collaboration.
- **The tell:** even the incumbent treats AI as a **rationed, retrospective add-on**, not a compounding
  always-on model of you. Credit-metering structurally fights real-time (#3). No pre-trade intervention.

**Threat read:** real, but on **distribution/breadth** (backtesting, mentor network, Zella University,
50k users) — **not** the thesis. Reverse-clone risk medium: resourced enough to build it, but it fights
their journal-of-record architecture *and* their credit-metered-AI business model. **The twin wedge
(compounding identity + real-time intervention) is open even against the strongest player.**

**Table-stakes adds:** backtesting, trade auto-tagging, session-review narrative, mentor/student sharing,
education, referral — all ✅ table-stakes or ✗ skip; none change the moat picture.

---

## TILT infiltration (2026-07-07) — the completeness benchmark, closest to the twin

Public demo (tradelensapp.com/dashboard, /dashboard/tilt-detector). The one to actually watch.

- **UI/UX — the most crafted of the three.** Warm dark (`rgb(20,17,15)` / warm off-white `250,246,240`) —
  considered, not cold #000/#fff. **Chosen** display font (Cabinet Grotesk) + Geist Mono for numbers;
  all-caps condensed headings = a loud aggressive-sports character. Tells still present (115 pills,
  16 gradients). No scroll bugs. Best craft attempt in the set — but a distinct *loud/urgent* character,
  which leaves **calm-trust + craft** uncontested for us.
- **#1 behavioral — the strongest anyone's shipped, and it's specific.** The Tilt Detector names patterns
  with dollar costs + thresholds: *"23 revenge trades (within 8min of a >$400 loss), 70% losers, ~$4,200
  preventable"*; *"Monday overtrading 2.5×"*; *"size drift 40–60% after 3+ losses, CV 68%."* Plus a
  CALM→HOT risk gauge and "Behavioral Analysis" / "Cost of Tilt" sections. This is *exactly* Twin's "who
  you are" insight — already live, and concrete.
- **#3 — gauge + "auto-lock after 3 losses" cooldown.** But it's a **blunt threshold + retrospective
  detection**, not per-trade pre-click intervention. Doesn't catch *this* order as the hand is on the button.
- **#2 — "Edge" AI coach chat** (TALK TO EDGE) — shipped.
- **Structural gaps vs Twin (unchanged):** (1) account/challenge-based, per-challenge tabs — **not a
  persistent cross-firm identity**; (2) threshold cooldown, not order-level pre-click intervention;
  (3) no survives-deletion / compounding corpus.

**Lesson for our #1 surface:** *steal* the **specificity** (named patterns + dollar costs + thresholds —
that's what makes "it knows me" land); *beat* it by rendering as **one cross-firm identity** (not a
per-account dashboard-of-metrics), true **pre-click** intervention, and the compounding/survives-deletion
corpus; *avoid* the pill overload and the loud character (we own calm-trust + craft).

**Execution is weak (Luke, firsthand) — threat DOWNGRADED.** Production **signup is broken**: the
confirm-email button redirects to `http://localhost:3000/?code=…` — a dev-config leak, so you literally
can't confirm an account (the core onboarding loop is broken). Paired with a heavily vibe-coded look,
TILT is **best-ideas / weakest-execution**: their behavioral insight and feature set are the richest in
the field and worth mining freely, but the company is marketing-deep, not execution-deep. Don't fear
them — take the ideas. (Reinforces the doctrine: rank by *execution + traction*, not the pitch.)

---

## Edgewonk (Tiltmeter) — quick mine, low priority (2026-07-07)

Legacy journaling-psychology incumbent. Dated stack (Lato/Abel/Font Awesome 5 ≈ 2015-era), white,
import-based. Angle: *"Trading Psychology Lab — where trading psychology becomes measurable"* + the
**Tiltmeter** (a discipline/emotional-state metric) + "Automated Edge Finder." Multi-asset
(fx/stocks/futures/crypto), **not prop-focused**; retrospective, single-account, import-only, no real-time.
- **Mine:** the *"psychology made measurable"* framing and the single Tiltmeter discipline number.
- **Threat:** none — wrong axis (not cross-firm prop, not real-time, not identity-compounding). Legacy tool.

---

## Field mapped (#1) — the field

| Competitor | Craft | #1 identity | #3 real-time | Cross-firm | Threat |
|---|---|---|---|---|---|
| **TMI** | flashy-weak (vibe-code) | positioning only | ✗ nightly | journal | low (mine only) |
| **TradeZella** | plain-strong (restraint) | money layer only; AI = credit-metered tasks | ✗ | aggregate money | real on distribution, not thesis |
| **TILT** | vibe-coded/loud; **broken signup** | best *ideas*, per-account | ◑ blunt threshold | per-challenge tabs | ideas to mine; weak execution |
| **Edgewonk** | dated (~2015) | Tiltmeter metric, single-account | ✗ retrospective | multi-asset, not prop | none (legacy; mine the framing) |

**None** build: one persistent cross-firm identity + pre-click intervention + a compounding corpus that
survives deletion. That intersection is Twin — **open across the whole field.**

**Craft verdict across the field:** flashy-weak (TMI), plain-strong (TradeZella), vibe-coded-loud + broken
(TILT), dated (Edgewonk). **Nobody pairs restraint with real craft** — that lane, plus the twin intersection,
is Modryn's opening. Next: build our #1 identity surface.

---

## Round 5 — #3 recon (2026-07-08): real-time pre-trade intervention (direct competitors, CLI live-read)

Phase 1 of the two-phase recon (`playbooks/read-live-competitor.md`). Analogs → `analogous-products.md`.

The #3 gap is **confirmed real** — every direct competitor is a journal + AI-coach with a thin "real-time"
veneer; **true pre-*click*, order-level, pattern-matched intervention is unbuilt**:

- **SuperTrader** (supertrader.me) — closest. A live engine polling **~every 2 min** → tilt/size/session
  push-alerts. But the product positions as an AI *journal* ("trade better tomorrow"); black/Inter, 44 pills,
  claims 100k+ traders. Real-time is a feature, not the thesis.
- **TradeZap** (tradezap.app) — mobile journal + "Aura AI" conversational coach + live P&L; $89.99/yr.
  Coaching, not intervention.
- **M1NDTR8DE** (m1nd.app) — cleanest UI of the set (restrained dark, system+mono, ~6 pills) but
  **retrospective** ("trade like you review yourself" — import + review the why).
- **TradingRehab** (tradingrehab.io) — "AI therapist" emotional journal; **beta / "back soon"** — not live; 93 pills.
- (Ceiling of the category: TILT's *auto-lock after 3 losses* + SuperTrader's 2-min poll — both blunt and late.)

**Verdict:** the competitors coach *after* the session or alert *around* it on a timer/threshold — none
intervene **at the click, on the specific order, matched to your own history**. Twin's #3 is a genuine,
open gap. The *how-to-do-it-well* comes from other markets → see the #3 analogs in `analogous-products.md`.

**Sources:** https://supertrader.me/ · https://tradezap.app/ · https://m1nd.app/ · https://www.tradingrehab.io/

---

## Round 6 — #2 recon (2026-07-08): the ambient/agentic surface (direct competitors)

**The #2 job:** a proactive, always-present AI presence that surfaces the right thing at the right moment
without you opening it — it talks to you, it's ambient. **Not** a dashboard/chat tab you visit. (Ambient
AI = watches signals, infers what matters, acts proactively — the opposite of a chatbot you prompt.)

**What trading actually ships (all on-demand or scheduled — none ambient):**
- **TILT — "Edge" chat** — an embedded chat panel with quick-action buttons ("Analyze my last session,"
  "What are my recurring patterns?"). Real, but **reactive**: you open it and ask. Not ambient.
- **TradeZella — "Zella AI"** — credit-metered AI insight *tasks*, run on demand. Reactive.
- **TMI — AI Mentor** — scheduled daily/weekly post-session debriefs. Proactive but **not real-time /
  not glanceable** — a report that arrives, not a present surface.
- **SuperTrader** — "coach, always on" + 2-min-poll push alerts. The **closest to ambient** in the field,
  but it's *notifications*, not a persistent present surface, and it's threshold-based not model-of-you.

**Verdict:** trading's #2 is **on-demand chat tabs + scheduled debriefs**. Nobody builds a true ambient
surface (proactive + always-present + glanceable + surfaces-without-asking). This is the **least-built of
the three wedges** and a genuine open gap — but also the hardest, since "ambient" is a UX *pattern* more
than a feature. The proven pattern language lives entirely in other markets → `analogous-products.md` #2 analogs.

**Sources:** https://tradelensapp.com/ (Edge) · https://www.tradezella.com/ (Zella AI) · https://tmi-ai.com/ · https://supertrader.me/

---

## Round 7 — traction refresh (2026-07-09): TradeZella / TradesViz / Tanto live-verified

Live-read via chrome-devtools CLI (landing pages, no login) + web search, to confirm the master table above is
still current. **Field-order unchanged** — TradeZella still the resourced leader, TradesViz the value/scale
challenger, Tanto the tightest niche fit — but TradesViz's claimed user count (150K+) now edges past
TradeZella's (100K+), and TradesViz has quietly shipped an AI insight ("revenge trades ... cost $X this
month") that validates Twin's failure-signature framing is not a novel invention. Figures folded into the
master table inline. No change to the strategic read — nobody in this list builds cross-firm identity,
survives-deletion, or pre-click intervention; see Round 4–6 above.

**TradesViz prop-firm feature depth (from their public `/prop-firm-journal/` page — no login needed,
unusually thorough for a marketing page):** Compliance Dashboard (drawdown buffer gauge, profit-target
progress, daily-loss tracker, consistency score, MFE/MAE, payout readiness) · handles **all 4 drawdown
types automatically** (EOD-trailing, intraday-trailing, static, trailing-to-static-lock — mapped per firm,
e.g. Apex = intraday, FTMO = static) · **Retroactive Evaluation Simulator** — run historical trades through
any firm's rules for an instant PASSED/FAILED/ACTIVE verdict, "before paying for an evaluation" ·
**Challenge Mode** — free practice evaluations inside their simulator, real-time rule enforcement, auto-pause
on violation · Multi-Account Compliance Overview for traders running several evaluations at once · 35+
prop-firm profiles, 60+ account-size variants. This is deeper and more prop-specific than TradeZella's
PropFirm Sync (which is money/Plaid-layer) — **TradesViz is the compliance-depth leader**, not just the
value pick. Still zero cross-firm identity or survives-deletion story — purely "don't fail the eval."
Attempted an AgentMail-assisted authed signup for the in-app UI (per the auto-signup loop above); the
session's safety classifier blocked autonomous account creation on a third-party site — Luke signed up by
hand instead. **Authed read:** every Tools-menu feature on the free Basic tier is PRO-gated, including
(seemingly) Prop Firm Compliance itself — couldn't locate a live instance of the widget in the sidebar/Tools
list without a Prop Firm Profile applied or a paid plan, so didn't push further (no upgrade purchased).
Visual craft of the authed app: plain white dashboard, blue accent, stock Chart.js-style line/bar charts,
dense functional left-nav — closer to TradeZella's "plain-strong" register than TILT's crafted-loud one,
not premium-crafted. The public `/prop-firm-journal/` page remains the best source for feature depth.

---

## Round 8 — the execution-surface question (2026-07-10): *where does the intervention actually happen?*

**The question Luke raised (backend-for-the-UI, not backend-to-build):** #3 is "pre-click intervention."
But *where does the click live?* Prop-futures traders don't execute inside a Twin ticket — the #1 way they
execute is **from the chart itself**, on a surface they already own:
- **TradingView** — link a Tradovate/prop account by one-click **OAuth** (no API keys), then trade directly
  on the chart. Prop/eval accounts get TradingView access *managed by the firm* (select "Demo" on the
  account screen; no paid add-on). Full order entry + firm risk controls (daily-loss cap, profit target,
  volume) live on the chart.
- **Tradovate's own web/desktop platform** — charting + DOM ladder + order entry built in; every prop
  trader on a Tradovate-broker firm gets live data automatically.

⇒ The current Live view — an **order ticket inside Twin** with a "Place order" button Twin then blocks — is
**fiction about where the trade happens.** It quietly assumes Twin owns execution, the least-realistic path.

> **This question got a full deep-research pass → see [`live-architecture.md`](live-architecture.md)**
> (the canonical decision doc: four postures, the Tradovate risk-API breakthrough, UI implications, open
> questions). Summary below; that doc supersedes this section for depth.

**What's technically true (2026):**
- **You cannot inject into TradingView's chart.** Its Broker Integration API is **broker-side**, gated
  behind a signed partner agreement, "intended for brokerages, not retail." Twin isn't the broker of record.
- **A market order gives no server-side pre-click window** — it fills essentially instantly; only a resting
  limit/working order can be caught pre-fill (the minority of impulse entries).
- **The vendor-API path is real and device-off** — streams fills/positions/orders/drawdown server-side,
  powering #1 + #2 with no client. **The data is the easy part.**
- **Breakthrough:** Tradovate exposes **risk controls via API** (`/userAccountRiskParameter`,
  `/accountRiskStatus`) + a **trader-controlled Manual Lockout that can't be undone once armed**. Enforcement
  can therefore ride the **account layer** (surface-agnostic), not the chart UI.

**Four postures** (full detail in `live-architecture.md`): **A** ambient co-pilot (server-side, advisory
warning) · **B** on-chart browser-extension overlay (proven but fragile — DeltaScout/akumidv confirm
DOM-scrape works and rots on TV CSS changes) · **C** Twin-as-terminal (owns execution, fights how traders
trade) · **D** Tradovate-native enforcement (Twin's model *tightens the risk envelope / arms the lockout*;
Tradovate blocks the trade across *every* surface — enforced, not advisory). **Recommendation: build A + D.**

**Verify in build:** whether a *vendor OAuth token* (vs. the trader in-UI) can *write* trader-level risk
params on a firm-provisioned prop account. Capability + endpoints exist and are trader-permitted; it's a
permissions question for the NinjaTrader vendor program.

---

## Round 9 — the complaint mine (2026-07-24): what users actually *hate* about the field

The `widening-plan.md §7` "additive Round 9" — real-user complaints across the journal + psychology field
(prop **and** retail, since widening walks Run into both). Sources: Trustpilot 1-star pages read verbatim via
the chrome-devtools CLI (TradeZella, TraderSync, TradesViz), the SuperTrader App Store reviews, and review
aggregators (StockBrokers.com, Trader's Second Brain, TradingJournal.com). This is the **S3 (real complaints)**
pass `recon.md:178,181` always wanted — the gold for the spin is not their feature lists, it's their 1-star pages.

**The field's Trustpilot floor:** TradeZella 4.8 (marketing-heavy, but 37% of its *negative* reviews cite bugs
as the #1 issue), TraderSync ~mixed/low, **Tradervue 2.6** (aging-out). The high aggregate scores hide a
remarkably uniform set of things users despise once inside.

### The seven complaints that repeat across every competitor

1. **Data integrity failures — the cardinal sin, and it's everywhere.** A journal's one job is an accurate
   record, and that is precisely what breaks. Verbatim: TraderSync *"applying the wrong currency base... messing
   up commissions, fees, profit calculations"*, *"API Parsing Failures ('Zombie Trades')"*, *"many trades show
   as open so you manually need to enter a counter-trade to 'close' it."* TradesViz *"lots of discrepancies in
   the PnL numbers... couldn't find the connection,"* *"inaccurate data imports."* TradeZella *"shows all open
   positions as 100% profits,"* *"completely screws up all the stats."* SuperTrader *"faulty P&L showing activity
   on weekends,"* and one user *lost 7 months of data overnight.* → **This is Run's single biggest opening.**
   Run's whole thesis is a *trustworthy compounding record*; the incumbents can't keep the numbers right for one
   session. Correctness (the Vera gate) is not table stakes here — it is an unmet promise across the whole field.
2. **Broker sync is "works till it doesn't."** Token expiry (TradeZella + thinkorswim/Schwab OAuth dies every
   6–7 days → silent trade gaps), *"broker synchronization often gets stuck and keeps loading,"* *"syncs one day,
   not the next."* Ties straight to Run's **cadence + completeness** wedge (`recon.md:135-145`) — but note the
   bar is lower than we thought: users aren't asking for real-time, they're asking for *reliable at all.*
3. **The "automated" journal creates MORE manual work.** The most damning recurring theme: *"I spend more time
   trying to fix up import issues than actually documenting trades,"* *"I have to reapply my default chart
   template EVERY single time,"* Edgewonk's *"tedious"* CSV reformatting, TradesViz manual re-entry. The category
   sells automation and delivers busywork. → validates Run's **ambient/ritual, low-friction-intake** posture as
   a real differentiator, not a nicety.
4. **AI is shallow — "nothing an Excel sheet couldn't do."** Verbatim, unprompted, from paying users:
   TraderSync *"the AI tool isn't really giving you anything extra. It simply sums up a few trends... nothing a
   simple Excel sheet couldn't do,"* TradesViz *"'AI' also sucks and tells you everything you could interpret
   from the chart yourself."* → **direct validation of Twin's #1 depth wedge.** The field ships "AI insight" that
   restates the chart. The named-pattern-with-dollar-cost failure signature (the TILT-grade specificity Round 4
   flagged) is exactly the gap the incumbents' shallow AI leaves wide open.
5. **Commercial dark-patterns — the trust collapse.** *No free trial + no refunds* (TradeZella, TradesViz,
   TraderSync all cited), *"asked for a refund 1h after purchase, told they don't do refunds,"* charged for
   **months after cancelling** (TraderSync + TradesViz both), *"paywalled features the 'free trial' won't let you
   test."* → Run's **never-gate-before-value / lazy-registration** doctrine (`feedback_lazy_registration`) is a
   marketing weapon here, not just a principle. "Try it on your real data, free, before any card" is a wedge the
   whole field structurally refuses.
6. **Support is non-existent, slow, or rude.** Near-universal: *"customer support simply non-existent,"* TraderSync
   *"7 months"* on an open bug, *"the dev team are looking into it"* as a permanent state, rude-by-name reps.
   Table stakes for us to beat, not a moat — but it's the #2 driver of 1-star reviews after data bugs.
7. **Two failure poles on complexity — and nobody hits the middle.** TradesViz = *"too many bells and whistles...
   lacks simplicity so much you can't have a PnL chart on a trade-by-trade basis"*; Tradervue/Edgewonk = *dated,
   stale, "looks the same as it did five years ago," no AI, no replay.* Bloated-but-current vs. simple-but-abandoned.
   → the **restraint-with-craft** lane (`recon.md:407-409`) is empty from both ends, confirmed again from the user side.

### Read for the spin

- **Lead with correctness-as-trust, not features.** The field's own users say the numbers can't be trusted. "The
  record that's actually *right*, and survives the account dying" beats any feature-parity pitch. Wire it to the
  Vera gate as a *marketed* property, not just an internal standard.
- **The behavioral/psychology tools (SuperTrader, BullMood, TradingPal, TraderShape, the newer entrants) are
  vibe-coded and fragile** — data loss, fake demo data bleeding into real tracking, weekend-P&L bugs. The
  *positioning* (emotion/tilt/revenge) is crowding fast, but the *execution* is weak; same TILT lesson (best
  ideas, worst execution). Mine the language, don't fear the builders.
- **Widening caution (from `widening-plan.md §6`):** these complaints are the *retail* field too. Widening is
  into a crowded, complaint-ridden market — the defensible entry is exactly the four things none of them do well:
  right numbers, real reliability, non-shallow behavioral depth, and honest pricing.

**Sources:** trustpilot.com/review/{tradezella.com, tradersync.com, tradesviz.com}?stars=1 (verbatim, CLI) ·
apps.apple.com SuperTrader reviews · stockbrokers.com/review/tools/{tradezella,tradervue} ·
traderssecondbrain.com/guides/{tradezella-review, tradesviz-review, tradervue-review, edgewonk-alternative} ·
tradingjournal.com/review/tradervue.

---

## Round 10 — TradeZella re-read from inside (2026-08-10): the IA moved, and three claims above need qualifying

Full authed walk of every surface via the chrome-devtools CLI on Luke's own account → **[`ia-teardown.md`](ia-teardown.md) §2**
(structure read from the a11y tree, not from pixels). Run alongside a first-ever authed walk of **Monarch**, which
Luke has now made Run's IA model → [`monarch-for-traders.md`](monarch-for-traders.md). Caveat on the read: Luke's
TradeZella subscription is **inactive**, so labels and structure are fully readable but many controls render
`disabled`, and Mentor Mode is hard-paywalled.

**What changed since the 07-07 / 07-09 reads.** The product has been restructured around AI:

- **Home is no longer a dashboard.** It is an AI launcher — a `Good afternoon, Luke` greeting, a large
  "Ask Zella AI" box with four seeded prompts (*"Rule breach risk today?"*, *"What should I focus on today?"*),
  then `Explore Products` / `Recommended focus` / `Resources` link lists. Nothing on the front door is *your state*.
- **Nav is now two permanent levels, 15 destinations.** `Home · Journal · Backtesting · Agents · Mentor Mode ·
  PropFirm Sync [BETA]`, and inside Journal a second nine-row bar (`Dashboard · Day View · Trade View · Notebook ·
  Reports · Strategies · Trade Replay · Progress Tracker · Resources`). **The rows are their product lines, not the
  trader's questions.** This is the structural gap Run attacks.
- **Zella AI is the best-built thing they ship** and is genuinely agentic: it states its calling context
  (`Opened from: Dashboard`), changes its suggestions per surface, and carries a separate **`TAKE ACTION`** group —
  *"Tag my last 20 trades by setup"*, *"Add a rule to block my worst setup"*. It **writes**, it does not only answer.
  Round 6's verdict ("trading's #2 is on-demand chat tabs") is now too kind to the field's laggards and too harsh on
  TradeZella specifically: this is closer to ambient than anything Round 6 saw. **But see the meter, below.**

**Three claims above that now need qualifying:**

1. **"AI = discrete, credit-metered tasks"** (line ~334) — half stale. **A periodic generated recap is now a
   first-class object**: `Reports → Recaps & Insights` is a document library filtered `First Import Analysis ·
   Monthly Recap · Weekly Recap`, with columns TYPE / CREATED / ACCOUNT / DATE RANGE / TRADES / STATUS. (Only
   `First Import` rows were present on Luke's inactive subscription, so the weekly/monthly cadence firing was
   not itself observed — the types and the library are.) **The metering is
   unchanged and is still the structural point**: `Agents` shows *"Agent runs count toward your monthly AI credit
   limit"* with per-agent prices (Market Sentiment Briefing **~10.88 credits/run**, Session Review ~7.78,
   Trade Auto-Tagger ~2.26). A presence you ration is not a presence — that argument survives intact.
2. **"The absent category — nobody sells preserve/study your BLOWN accounts"** (line ~77) — narrowed.
   `PropFirm Sync` now ships **Breach insights** (*"Understand why your accounts get breached and spot patterns"*,
   tabs Evaluation / Funded) alongside **Passing insights** (by firm / account type / size / strategy) and **ROI on
   the cost of trying** (eval fees and resets vs payouts). It analyses breaches **from their own synced record**, so
   the ephemeral-capture moat in `context.md:15-16` is untouched — what narrowed is the **positioning** gap.
   ⇒ **Stop treating "study your failures" as unclaimed language.**
3. **"None of them ship a persistent identity / stated-intent record"** — partly false now.
   `Progress Tracker → Current rules` ships a table of **RULE | CONDITION | RULE STREAK | AVERAGE PERFORMANCE |
   FOLLOW RATE** — e.g. *"Start my day by 09:30 | 09:30 | 0 | **14:07** | 0%"*. That is **stated intent measured
   against actual behaviour**, which `widening-plan.md` §3.2 calls the genuinely non-derivable residue of Run's
   corpus. It is already in market. Their rules editor even groups rules as **`PREPARE` / `TRADE` / `REFLECT`** —
   Run's before / during / after, shipped. **The differentiator is not the three phases; it is that Run's content
   is generated from the corpus rather than typed into a settings form.**

**What is confirmed, first-hand, on real data — Round 9's two biggest complaints, inside the flagship AI artifact.**
Their `First Import Analysis` (187 trades, 9 days, titled *"What your trade data reveals"*) renders four verdict
cards and a Key Takeaway. It contains:
- **`MAX DRAWDOWN / WATCH OUT / 1644.2%`** — a number that cannot be right, shipped with a verdict attached
  (Round 9 §1 / `competitor-failures.md` §1).
- Advice that is true of any losing trader (*"Focus on reducing losses and improving trade quality… rather than
  increasing trade frequency"*), and an explainer card that opens with **a textbook definition** of profit factor.
  No pattern named, no time of day, no setup, no dollar cost of a specific behaviour (Round 9 §4 /
  `competitor-failures.md` §4). **The depth wedge is real and it is wide open at the leader.**
- Elsewhere: **Mentor Mode renders `402 / Payment is needed`** — a raw HTTP status as UI.

**Craft verdict, re-measured:** unchanged from 2026-07-07. System font stack (no chosen typeface), pure `#000` ink,
`#f6f6f6` page, 10px cards with no shadow, Highcharts 12.1.2 defaults, `BETA`/`NEW` badges in primary nav. Still
**plain-strong** — restraint by absence of decisions rather than by decision. **`recon.md:407-409` holds: nobody
pairs restraint with real craft.**
