# Spec — Run

> Phase 2 artifact. Single source of truth for what v1 is.
> If the code and this file disagree, one of them is a bug. Update this file **first**, always.
> Point agents at this file, not at your memory of it.

**Status:** draft — awaiting Luke's sign-off at the phase 2 gate
**Last amended:** 2026-08-11 — first draft

<!-- CRAFT RECON SOURCE: run-trading/docs/ia-teardown.md (2026-08-10, read live from Luke's
     authenticated Monarch + TradeZella accounts). monarch-for-traders.md deliberately NOT
     read, at Luke's instruction — the IA below is derived independently from the teardown
     so it can be compared against that document afterward. -->

---

## 1. Problem brief (carried from phase 1)

| | |
|---|---|
| **Problem** | A trader who wants to know what's actually going wrong in their trading can't trust any tool that claims to tell them. The numbers are wrong, the sync dies quietly, and the insight just restates the chart. |
| **Who** | Switchers — futures traders already paying for a journal and burned by it, on **both** prop/funded accounts **and** personal live brokerage accounts. Plus a first-timer minority. Luke is user #1. |
| **Today** | TradeZella / TraderSync / TradesViz / Tradervue. Wrong P&L, zombie trades, silent sync death, AI that restates the chart. |
| **Spin** | A model of you that gets sharper the longer you trade, told back as your own specific behavior with a dollar figure on it. Corpus = substance; the read = form. |
| **Kill signal** | If the wedge can't name a pattern Luke didn't already know about himself — stop. |

---

## 2. The design principles this build is held to

Derived from the craft recon (`ia-teardown.md`). These are not preferences — they are the
standard every screen below is measured against, and they are what "Monarch for traders"
actually means.

| # | Principle | Evidence |
|---|---|---|
| P1 | **One flat level of navigation.** Depth lives in the page header, never in the sidebar. | Monarch: 11 rows, no sub-nav. TradeZella: 15 destinations across two permanent bars — an org chart rendered as an IA. |
| P2 | **Rows are ordered by the time horizon of the user's question**, not by product line. Reading top to bottom reads as the user's day widening into their year. | Monarch: state now → what I have → what happened → what it means → what's coming. |
| P3 | **A nav row is a promise, and promises can be withdrawn.** | Monarch is *deleting* Cash Flow into Reports, with an in-product banner saying so. The single most useful strategic signal in the teardown. |
| P4 | **The front door is your state, glanceable** — not a chat box and a link farm. | Monarch's dashboard answers "where do I stand" in one screen. TradeZella's Home is an AI launcher with nothing of *yours* on it. |
| P5 | **Freshness is stamped on every row, always visible.** | Monarch: `22 hours ago` on every account. This is the direct answer to "sync dies quietly." |
| P6 | **The summary digests the *filtered* set, not everything.** | Monarch's Transactions rail recomputes with the filter. |
| P7 | **Generated arrives; typed does not.** The ritual is delivered, not a blank page with a folder around it. | Monarch's Weekly Recap arrives staged. TradeZella's Notebook is a blank note you type. |
| P8 | **The product states what its own output depends on, every time.** | Monarch repeats the trust note on all five recap steps. This is data-integrity solved as a UI pattern rather than a promise. |
| P9 | **Empty states name the next action in the user's own vocabulary.** Never "no data". | Monarch: *"Please sync another investment account to see top movers."* |
| P10 | **AI is not a destination.** It is attached to the thing it's talking about. | Monarch's AI Assistant sits below the divider, with a per-widget button. If it becomes a nav row, it's a chatbot you visit. |
| P11 | **Prose names specifics, compares to a prior period, and paces against a plan.** | Monarch: *"Your largest expense was $29 at Massive.com on August 3… you've used $39 of your $1,150 flex budget (3%)."* Nothing in trading writes like this. |
| P12 | **Never show a number you cannot reconcile.** | TradeZella shipped `MAX DRAWDOWN / WATCH OUT / 1644.2%` as a headline card in its flagship AI artifact, on Luke's real data. |

---

## 3. The critical path

**Connect → The record → The read.**

Three steps, mirroring the problem statement's own chain: a wrong record makes an incomplete
record, which makes worthless insight. Each step earns the right to the next.

1. **Connect** — Tradovate linked, history pulled in
2. **The record** — trades, correct and reconciled, and *visibly* so
3. **The read** — one named pattern, priced in dollars, from the trader's own trades

**The one-sentence value claim:**
> A switcher can bring in their real history, see it reconciled, and be told one true thing
> about their own trading they didn't already know — on day one.

**Where each step lives (Luke, 2026-08-11) — the path is not three new screens:**

| Step | Monarch equivalent | Run |
|---|---|---|
| 1. Connect | the `Add account` button on the Accounts page | the same button on Run's **Accounts** page |
| 2. The record | the Transactions page | Run's **Trades** page |
| 3. The read | **the Weekly Recap** — see §4.2 | Run's **Read** page |

This matters: the critical path is *the first trip through the product*, not a separate
onboarding wing. Every step happens on a page that exists for its own sake afterward.

**Noted:** steps 1 and 2 may collapse into one continuous motion (add → watch it fill → it's
right). Treated as two below because they have separate acceptance criteria; if the build
shows they're one screen, that's a finding, not a spec change.

### Audience note — personal accounts are in scope from v1

Carried from `widening-plan.md`. The two axes are independent and must not be fused:

- **Audience** (prop → personal) is nearly free. The data plane is account-type-agnostic by
  construction; the cost is a handful of copy strings and a picker label.
- **Rail** (Tradovate → NinjaTrader → Rithmic → ProjectX) is weeks per adapter and stays out
  of v1.

Two things this changes, and both are cheap now and expensive later:

1. **No copy may promise that Run preserves data "after your firm wipes your blown account."**
   That is true for prop and false for personal accounts, and it is the highest-stakes
   misleading string in the product.
2. **A connection must record its account type** (evaluation / funded / personal). Without it
   Run cannot tell a personal signup from a prop one, and the whole point of admitting the
   segment is learning what it does.

The moat argument is scoped accordingly and must be stated this way everywhere: **the corpus
moat protects the prop segment; personal accounts are added reach, not moated.** Never
"Run has no moat" — the prop moat is unaffected.

---

## 4. Information architecture

### The nav — four rows, one level

Derived by applying P1 + P2 to a trader's questions, ordered by time horizon:

```
Today      → where do I stand right now
Accounts   → what I have, across every firm
Trades     → what happened
Read       → what it means about me
```

Below the divider, not nav rows: **Ask Run · Settings · Luke**.

**Why four and not more.** Applying P3 up front rather than at the first cleanup: every row
is a promise v1 can keep. `Sessions` is deliberately *not* a fifth row — see below.
`Live` is the product's real-time capability and is explicitly out of v1 (§6), so it does
not get a promise it can't keep.

**Why `Sessions` is not a row.** Monarch groups transactions under a date header carrying
that day's net (`August 5, 2026 +$1,337.35`). The trading equivalent is stronger, because a
session is a more meaningful unit to a trader than a calendar day is to a spender. So the
session is the **grouping of the Trades page**, not a destination — a session header carries
its own net, trade count, and win rate. If sessions later need their own room, that's a
row we add on evidence, not on anticipation.

**Depth lives in page headers (P1).** `Trades` carries `All · By session`. `Read` carries
`Patterns · History`. Nothing new appears in the sidebar.

### 4.1 What sits below the divider, and why

Monarch's sidebar is eleven rows, a divider, then `AI Assistant · Help & Support ·
Get 45% discount · Luke`. Run's is four rows, a divider, then **Ask Run · Settings · Luke**.

The rule: **above the divider are places in your trading. Below are things you carry, or
things about the app.**

Think of a school. Above the line are rooms — classroom, gym, cafeteria, library. Below the
line are the things that aren't rooms: your backpack, the nurse, your name tag.

- **Ask Run is the backpack.** You carry it into every room and open it where you are. Making
  it a room would mean walking away from your trades to ask about your trades — and it would
  be missing from the room where you actually needed it. Monarch's answer is an `Ask AI
  Assistant` button *inside* each widget and page rail; Run does the same.
- **Settings is the janitor's closet.** Necessary, not part of the day. The taxonomy the whole
  product runs on lives here — Monarch keeps categories / merchants / rules / tags in Settings,
  and Run keeps setups / symbols / tags there for the same reason.
- **Luke is the name tag.**

**The counter-example, stated so it isn't repeated:** TradeZella's front door *is* the chat
box. The app opens on a question instead of your answer, and nothing on that screen is yours.
An AI that is a destination is a chatbot you visit; an AI that is everywhere is a presence.

### 4.2 The Read page, in depth

**Where this comes from.** Monarch's analogue is **not** categories (that's taxonomy → Run's
setups and tags, in Settings) and **not** notes. It is the **Weekly Recap**: generated, staged
across five steps, written in specific prose, with the trust note repeated on every step.

**The honest complication: in Monarch, the recap is not a nav row.** It is a dashboard widget
that opens a modal. A strict clone would make Run's read a widget too.

**Run promotes it to a row anyway, and the reason is a real difference between the products.**
For Monarch the recap sits on top of budgeting — the product is the budget, the recap is a
weekly nicety. For Run the read *is* the product; it is the entire reason a switcher moves.
Demoting the wedge to a widget would be copying Monarch's row rather than Monarch's reasoning.

**But it adopts Monarch's delivery wholesale:** the read *arrives*, generated and staged. It is
never a blank page you fill in (P7). `Today` carries a widget that opens it, exactly as
Monarch's dashboard does.

**Tab 1 — `Patterns` (the current read).**
- One named pattern, stated in prose in the recon register (P11): the behavior, how often, what
  it costs in dollars, compared to the prior period.
- The trades it was drawn from, openable inline (Monarch's transactions-inside-the-widget
  pattern).
- The trust note, stating what this read depends on and how to correct it (P8).
- If nothing clears the confidence threshold: it says so, and says what would let it find one.
  It never fills the space with a metric definition.

**Tab 2 — `History` (every read Run has ever produced).**

This is the tab neither competitor has, and it is where the corpus becomes visible.

Monarch's recaps are disposable — generated weekly, read once, gone. TradeZella keeps a
library (`Recaps & Insights`) but it is an archive of documents, not a tracked claim. Run's
History answers the only question that matters about a behavioral read:

> **Run told you about this pattern last month. Did it get better?**

Each past read carries its named pattern, its dollar cost then, and its dollar cost now. A
pattern that improves gets marked as such; one that doesn't stays open. **That is the
compounding model made legible** — and it is the thing a competitor cannot clone in a week,
because they have no history of ever having told you anything.

**What is NOT on this page:** a chart rack, a metric dump, a score, a chat box.

### Cross-cutting controls

One persistent filter bar under the header, carried in the URL so state is shareable:
**date range · account**. Taken from TradeZella, which does this better than Monarch — a
trader's questions are almost always scoped to a period and an account.

---

## 5. User stories

⭐ = critical path.

### ⭐ S1 — Add an account by CSV upload

> As a switcher, I want to add my account by uploading my broker export, so that I can use Run
> today without waiting on an integration.

**Corrected 2026-08-11 (Luke): v1 is CSV upload, not OAuth.** Run is not yet a registered
Tradovate OAuth partner — `client_id`/`secret` have not been issued. The OAuth path is
confirmed viable and is the right eventual answer (`tradovate-partner-api.md`: user-consent
delegation works cross-firm without the prop firm's cooperation, which is how TradingView and
TradersPost do it), but it is **not available to build against today.**

**This is not a downgrade, and the spec should not treat it as one.** CSV is the floor by
standing rule — the corpus must never be welded to a broker API. Building the CSV path first
means the data plane is proven independent of any rail before a rail exists.

Acceptance criteria:
- `THE SYSTEM SHALL accept a Tradovate CSV export and create or update an account from it`
- `THE SYSTEM SHALL record each connection's account type — evaluation, funded, or personal — at the time it is added`
- `WHEN a file is uploaded, THE SYSTEM SHALL report the count parsed, the date range covered, and the count rejected, before committing anything`
- `IF a file is not a recognised export, THEN THE SYSTEM SHALL name what it expected and SHALL NOT partially ingest it`
- `IF the same file is uploaded twice, THEN THE SYSTEM SHALL detect the overlap and SHALL NOT double-count any fill`
- `THE SYSTEM SHALL NOT display a raw HTTP status code or parser exception to a user`

Edge cases:
- Empty: no file yet — *"Upload your Tradovate export to get started."* with the export steps inline, not in a help article
- Error: unrecognised or partial file — named, rejected whole, re-uploadable
- Loading: determinate, count-based

**Deferred to v2, not v1:** OAuth connection, live sync, real-time fills. When it lands it is an
*additional* source into the same pipeline, never a replacement for it.

---

### ⭐ S2 — Import my full history

> As a switcher, I want my existing trades brought in completely, so that I'm not starting
> from zero after leaving a tool I already paid for.

Acceptance criteria:
- `THE SYSTEM SHALL import the full history available from the broker, not a fixed recent window`
- `WHEN an import completes, THE SYSTEM SHALL state the count imported, the date range covered, and the earliest trade found`
- `IF the broker returns a truncated or paginated result, THEN THE SYSTEM SHALL continue until exhausted and SHALL NOT present a partial import as complete`
- `IF any trade cannot be reconciled, THEN THE SYSTEM SHALL quarantine it, exclude it from all computed statistics, and surface it for review`

Edge cases:
- Empty: added but no trades — *"No trades on this account yet."*
- Error: partial import — must never silently succeed (P12)
- Loading: determinate

**Migration off TradeZella is a first-class path, not a footnote (Luke, 2026-08-11).** The
audience is switchers; the moment they decide is the moment they find out whether their history
comes with them. Run must document and support getting data *out* of TradeZella and into Run —
their export, their column layout, their quirks — with the same care as the Tradovate path.
`THE SYSTEM SHALL accept a TradeZella export and reconcile it against any overlapping
Tradovate data rather than duplicating it.` Filed as its own slice; the exact export format
needs a live read before criteria can be written.

---

### ⭐ S3 — See my record, and see that it's right

> As a switcher, I want to see my trades and be able to tell at a glance that the numbers are
> correct, so that I can trust anything built on top of them.

Acceptance criteria:
- `THE SYSTEM SHALL group trades under session headers carrying that session's net P&L, trade count, and win rate`
- `THE SYSTEM SHALL display fees and commissions per fill, and SHALL NOT present a net figure that excludes them`
- `THE SYSTEM SHALL display, on every page presenting computed figures, a statement of what those figures depend on and how to correct them` (P8)
- `WHEN a trade is quarantined, THE SYSTEM SHALL show it visibly excluded rather than omitting it silently`
- `THE SYSTEM SHALL recompute the summary digest against the current filter, not the full dataset` (P6)
- `THE SYSTEM SHALL NOT display any figure it cannot reconcile against the broker record` (P12)

Edge cases:
- Empty: filtered to nothing — *"No trades in this range. Widen the dates or switch accounts."*
- Error: reconciliation mismatch — named, quarantined, actionable
- Loading: skeleton rows preserving layout

---

### ⭐ S4 — Know my data is current

> As a trader burned by silent sync death, I want to know when each account was last read, so
> that I never act on a stale record without knowing it's stale.

Acceptance criteria:
- `THE SYSTEM SHALL display a relative freshness stamp on every account row, at all times` (P5)
- `IF an account has not synced within its expected interval, THEN THE SYSTEM SHALL mark it stale and state what to do about it`
- `IF a broker token expires, THEN THE SYSTEM SHALL surface it as a user-facing state and SHALL NOT allow sync to fail silently`
- `WHILE an account is stale, THE SYSTEM SHALL mark every figure derived from it as covering a period ending at the last successful sync`

Edge cases:
- Empty: never — freshness always renders, even as "never synced"
- Error: this story *is* the error case the field fails
- Loading: last-known value with a refreshing indicator, never a blank

---

### ⭐ S5 — Tell me one true thing about myself

> As a trader, I want Run to name a pattern in my own trading and tell me what it costs me,
> so that I learn something I could not have read off my chart.

This is the wedge. If it degrades into trend-summary, the product is a better-looking
competitor.

Acceptance criteria:
- `THE SYSTEM SHALL name a specific behavior, state its frequency, and state its dollar cost, computed from the user's own trades`
- `THE SYSTEM SHALL cite the trades a pattern is drawn from, and SHALL allow the user to open them`
- `THE SYSTEM SHALL NOT present a definition of a metric as an insight` (the TradeZella failure)
- `THE SYSTEM SHALL NOT present a statement that would be true of any losing trader`
- `IF no pattern meets the confidence threshold, THEN THE SYSTEM SHALL say so plainly and state what would let it find one`
- `THE SYSTEM SHALL write in the recon standard: name the specific, compare to a prior period, pace against a stated intent` (P11)

Edge cases:
- Empty: not enough data — *"Run needs more sessions before it can name a pattern it's sure about. It has ⟨n⟩ of ⟨m⟩."* Never a fabricated insight.
- Error: pattern computed from quarantined trades — must be impossible by construction
- Loading: generated content arrives; it is not typed (P7)

---

### S6 — Where do I stand (the front door)

> As a returning trader, I want one screen that tells me where I stand, so that I don't have
> to assemble it from four pages.

Acceptance criteria:
- `THE SYSTEM SHALL present the current state as glanceable widgets, each with a title linking to its full page, one headline value with its delta, and a scope control` (P4)
- `WHEN a widget has no data, THE SYSTEM SHALL present a specific next action in the user's own vocabulary` (P9)
- `THE SYSTEM SHALL NOT make the front door a chat input` (the TradeZella failure)

---

### S7 — Account and session integrity across firms

> As a prop trader, I want accounts from every firm held in one place, so that a blown account
> doesn't take its history with it.

Acceptance criteria:
- `THE SYSTEM SHALL model the trader as the primary identity and the account as a child of it`
- `THE SYSTEM SHALL retain all trades from an account after that account is closed, breached, or removed by the broker`
- `THE SYSTEM SHALL group accounts by state (funded, evaluation, closed) with each group carrying its own totals`

---

### S8 — Sign up and sign in

> As a new user, I want an account, so that my connection and history persist.

- `THE SYSTEM SHALL require an account before any broker connection is made`
- `THE SYSTEM SHALL rate-limit authentication attempts`

---

### S9 — Correct the record

> As a trader, I want to fix or annotate a trade Run got wrong, so that the record is mine and
> the trust note isn't hollow.

- `WHEN a user adjusts a trade, THE SYSTEM SHALL recompute every derived figure and mark the trade as user-adjusted`
- `THE SYSTEM SHALL never silently overwrite a user adjustment on the next sync`

---

### S10 — Export my data

> As a switcher who has been burned, I want to get my data out, so that I'm not trapped again.

- `THE SYSTEM SHALL export the full trade record as CSV, scoped to the current filter`

---

## 6. NOT IN V1

Longer than the story list, on purpose. Every line is an argument not had at 1am.

**The whole real-time capability**
- Live view / in-app order ticket — the capability, not the road to first value
- Pre-trade intervention, red-zone warnings, ambient presence
- Tradovate risk-control writes, armed lockouts, enforcement of any kind
- *Reason: the critical path delivers full value without it, and enforcement is a separate trust contract. This is v2's headline, not v1's.*

**Every broker except Tradovate**
- Rithmic, ProjectX/TopstepX, NinjaTrader, anything non-futures
- CSV upload as a primary path
- *Reason: one adapter reaches most of the funded-futures niche. A second adapter before the first is proven is pure cost.*

**The rest of the AI surface**
- Conversational assistant / "Ask Run" as a working feature (the nav slot exists; the feature doesn't)
- Auto-tagging, playbook checking, agents, anything that writes
- Backtesting, trade replay, strategy/playbook objects
- *Reason: S5 is the wedge. Everything else here is what the field already ships, and shipping it early is how S5 degrades into trend-summary.*

**Rules, discipline, scoring**
- Rules engine, stated-intent-vs-actual tracking, streaks, contribution heatmaps, daily checklists
- Any composite score
- *Reason: TradeZella already collects stated-intent-vs-actual. Matching it isn't a wedge, and a score invites gaming the score.*

**Reporting depth**
- Composable/custom charts, saved reports, cohort compare, PDF export
- The ~45-metric dump
- *Reason: commodity. The spin is the read, not the chart rack.*

**Everything else**
- Payout/prop-fee tracking, passing rates, breach analytics
- Notes, notebook, journaling-by-typing, tags, folders
- Mobile app (responsive web only), teams/sharing/mentors, notifications, email digests
- Billing and pricing (genuinely undecided, deliberately deferred)
- Onboarding tours, checklists, gamification

**Revisit when:** the critical path is live and a real switcher has completed it.

---

## 7. Wireframes

Boxes and labels only. Structure, not styling.

- `Connect` → *pending*
- `Today` → *pending*
- `Accounts` → *pending*
- `Trades` (grouped by session) → *pending*
- `Read` → *pending*

---

## 8. Open decisions

| Question | Options | Decide by | Decided |
|---|---|---|---|
| Does Add-account + import collapse into one screen? | two screens / one continuous motion | end of wireframes | |
| Entry or exit time decides a trade's session? | entry (recommended) / exit (TradeZella's choice) | before P4 data model | |
| Confidence threshold for naming a pattern in S5 | must be decidable before the wedge is built | P4 | |
| Does `Read` show one pattern or several? | one is bolder and matches the value claim; several hedges | before wireframes | |
| ~~Tradovate OAuth availability~~ | ~~blocks S1~~ | — | **RESOLVED** — not available; v1 is CSV (S1) |
| ~~What is a "session"?~~ | — | — | **RESOLVED 2026-08-11 — CME day.** See below |

### RESOLVED — a session is the CME trading day (5:00pm CT → 5:00pm CT)

Researched 2026-08-11 rather than assumed. **A Run session runs from 17:00 `America/Chicago`
to 17:00 the next day, and carries the date of the day it ends** — matching the exchange's own
trade-date roll.

**The evidence:**

| Source | Convention |
|---|---|
| **CME Globex** | Trading day 5:00pm CT → 4:00pm CT next day, maintenance break 4–5pm CT. The **trade date rolls at 5pm CT to the next calendar date**; Globex reopens at 5pm CT "for the next trade date." |
| **Tradovate** | Session starts 5:00pm CT. Daily profit and daily loss are computed on net P&L **from 5pm CT**, including realised *and* open P&L, fees and commissions. A daily-loss lock holds the account **until 5:00pm CT** when the next session begins. |
| **Prop firms** | Futures firms reset the daily loss limit at the CME boundary. That boundary *is* the trader's risk day. |
| **TradeZella** | Buckets by **Close Date** on a calendar-month grid. No CME-day handling observed (read live, 2026-08-11). |

**Three reasons, in order of weight:**

1. **The 5pm CT trader.** A trader who starts at the open on Monday evening is trading
   **Tuesday's** session — that is what Tradovate says and what their firm settles against.
   Calendar-day bucketing splits one continuous session across two rows.
2. **It breaks the wedge, specifically.** "You size up after three losses" requires the losses
   to be in one session. Cut the session at midnight and the pattern is invisible for every
   trader who works the evening open — a large share of the audience.
3. **It breaks P12.** Tradovate computes the daily figure from 5pm CT. A calendar-day daily
   P&L *disagrees with the broker* for anyone trading the evening session. That is a number
   Run cannot reconcile, which is the exact failure this product is built against.

**Implementation notes that are easy to get wrong:**
- The boundary is **17:00 `America/Chicago`**, not a fixed UTC offset. Hardcoding an offset
  breaks the product twice a year at DST.
- Friday close (4:00pm CT) to Sunday open (5:00pm CT) is not a session. Weekend has no bucket.
- Holiday sessions and early closes follow the CME calendar, not a weekday rule.
- **A session with no trades still exists** — needed for streaks, gaps, and "you don't trade
  Mondays" reads.

---

## Phase 2 gate

- [ ] v1 describable in 60 seconds with no "and also"
- [x] Every critical-path story has testable acceptance criteria
- [x] Every story has empty / error / loading defined
- [x] NOT IN V1 is longer than the story list
- [ ] Wireframes drawn
- [ ] No open decision blocks the first slice
