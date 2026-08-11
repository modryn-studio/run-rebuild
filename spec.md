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
| **Who** | Switchers — prop/funded futures traders already paying for a journal and burned by it. Plus a first-timer minority. Luke is user #1. |
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
> A switcher can connect Tradovate, see their real history reconciled, and be told one true
> thing about their own trading they didn't already know — on day one.

**Noted:** steps 1 and 2 may collapse into one continuous motion (connect → watch it fill →
it's right). Treated as two below because they have separate acceptance criteria; if the
build shows they're one screen, that's a finding, not a spec change.

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

### Cross-cutting controls

One persistent filter bar under the header, carried in the URL so state is shareable:
**date range · account**. Taken from TradeZella, which does this better than Monarch — a
trader's questions are almost always scoped to a period and an account.

---

## 5. User stories

⭐ = critical path.

### ⭐ S1 — Connect a Tradovate account

> As a switcher, I want to link my Tradovate account, so that Run can read my trades without
> me uploading anything.

Acceptance criteria:
- `THE SYSTEM SHALL authenticate to Tradovate via read-only OAuth and never store the user's broker password`
- `WHEN a connection succeeds, THE SYSTEM SHALL display every account discovered under that login, including evaluation and funded accounts, before any import begins`
- `IF a connection fails, THEN THE SYSTEM SHALL display the reason and the single action that resolves it, and never a raw HTTP status code`
- `WHILE an import is running, THE SYSTEM SHALL display progress as trades imported against trades discovered, not an indeterminate spinner`

Edge cases:
- Empty: a login with no accounts — *"No accounts on this login yet. Connect a different Tradovate login, or check back once your firm activates the account."*
- Error: expired/revoked token — see S4, this is the field's defining failure
- Loading: determinate progress, count-based

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
- Empty: connected but no trades — *"No trades on this account yet. Run will pick them up as you trade."*
- Error: partial import — must never silently succeed (P12)
- Loading: determinate

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
| Does Connect + import collapse into one screen? | two screens / one continuous motion | end of wireframes | |
| What is a "session" exactly — CME day, calendar day, or a gap-based cluster of fills? | affects every grouping and every daily figure | before P4 data model | |
| Confidence threshold for naming a pattern in S5 | must be decidable before the wedge is built | P4 | |
| Does `Read` show one pattern or several? | one is bolder and matches the value claim; several hedges | before wireframes | |
| Tradovate vendor OAuth availability | blocks S1 entirely; may force a temporary path | before P5 build | |

---

## Phase 2 gate

- [ ] v1 describable in 60 seconds with no "and also"
- [x] Every critical-path story has testable acceptance criteria
- [x] Every story has empty / error / loading defined
- [x] NOT IN V1 is longer than the story list
- [ ] Wireframes drawn
- [ ] No open decision blocks the first slice
