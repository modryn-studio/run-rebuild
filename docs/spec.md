# Spec — Run

> Phase 2 artifact. Single source of truth for what v1 is.
> If the code and this file disagree, one of them is a bug. Update this file **first**, always.
> Point agents at this file, not at your memory of it.

**Status:** LOCKED at the phase 2 gate, 2026-08-11
**Last amended:** 2026-08-11 — session=exit, 3-layer time model, S9 cut + S9b added, daily read
reframed as pacing rather than discovery, confidence floor set

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
| P8 | **The product states what its own output depends on, every time.** For Run this is **provenance, not adjustability** — which file, which account, which range, last read when. *Amended 2026-08-11 when S9 was cut:* Monarch's note ends *"you can review and adjust"*; Run has nothing to adjust, so Run's note names the source instead. Stronger, because "this came from your Tradovate export of Aug 5" is checkable, while "you can adjust it" is an invitation to doubt. | Monarch repeats the trust note on all five recap steps. Data integrity solved as a UI pattern rather than a promise. |
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
3. **The read** — one named pattern, priced in dollars, and what yesterday did to it

**The 60-second description (Luke, 2026-08-11 — the phase 2 gate answer):**

> Run connects to your Tradovate account and pulls in your full history. It shows every trade,
> grouped by session, with the numbers reconciled against your broker — and when something
> can't be reconciled or has gone stale, it says so instead of guessing. Then once a day it
> names one pattern in your own trading and what it's costing you in dollars.

No "and also." Every clause maps to a story: connect (S1/S2), grouped by session (S3), says so
instead of guessing (S3/S4/P12), one pattern daily with a dollar cost (S5).

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

Below the divider, not nav rows: **Settings · Luke**.

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
Get 45% discount · Luke`. Run's is four rows, a divider, then **Settings · Luke**.

> **`Ask Run` is NOT IN V1 (Luke, 2026-08-11).** The slot below the divider is where it would
> go *if* it ships — the point of the divider rule is that adding it later never costs a nav
> row. v1 ships without a conversational surface at all. The reasoning below is retained
> because it governs where it lands whenever it arrives.

The rule: **above the divider are places in your trading. Below are things you carry, or
things about the app.**

Think of a school. Above the line are rooms — classroom, gym, cafeteria, library. Below the
line are the things that aren't rooms: your backpack, the nurse, your name tag.

- **A conversational surface is the backpack** (whenever it ships). You carry it into every
  room and open it where you are. Making it a room would mean walking away from your trades to
  ask about your trades — and it would be missing from the room where you actually needed it.
  Monarch's answer is an `Ask AI Assistant` button *inside* each widget and page rail.
- **Settings is the janitor's closet.** Necessary, not part of the day.
- **Luke is the name tag.**

**Taxonomy lives in Settings, not in the product surface.** Monarch keeps categories,
merchants, rules and tags in Settings even though the entire product runs on them — the
teardown found the whole taxonomy sitting under `/settings`. Run does the same with **setups,
symbols and tags**. They are the vocabulary the product computes against; they are not a place
you visit to do your trading. This is why `Read`'s analogue is not Monarch's categories.

**The counter-example, stated so it isn't repeated:** TradeZella's front door *is* the chat
box. The app opens on a question instead of your answer, and nothing on that screen is yours.
An AI that is a destination is a chatbot you visit; an AI that is everywhere is a presence.

### 4.2 The Read page, in depth

**Where this comes from.** Monarch's analogue is **not** categories (that's taxonomy → Run's
setups, symbols and tags, in Settings) and **not** notes. It is the **Weekly Recap**:
generated, written in specific prose, with the trust note repeated throughout.

**Two deliberate departures from Monarch (Luke, 2026-08-11):**

**1. Daily, not weekly.** A trading session is a day. A trader's unit of reflection is the
session they just finished, not a seven-day roll-up — and the whole product buckets on the CME
trade date, so a daily recap is the one cadence that lines up with everything else. Weekly
roll-ups can exist later as a view over dailies; the atom is the day.

**2. A destination, not a modal.** Monarch's recap is a dashboard widget that opens a
five-step modal walkthrough. Run does not do the modal. Luke's call, and it holds up: a modal
is right for something you glance at once and dismiss, and wrong for the thing that *is* the
product. `Read` is a page you can land on, link to, and come back to.

**What is kept from Monarch, and it's the important half:** the read **arrives generated**. It
is never a blank page you fill in (P7). That is the entire difference between Monarch's recap
and TradeZella's Notebook — one is delivered, the other is a folder around an empty note.

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

#### AMENDED 2026-08-11 — the intake is THREE files, and the third is required

Discovered in phase 4 against `run-trading@dev:docs/data-model.md`. This corrects a spec that
would have shipped a headline number wrong by roughly half.

| File | Becomes | Why it is required |
|---|---|---|
| **Fills** | `fill` events | The only export with a true UTC timestamp. The canonical intake. |
| **Position History** | `round_trip` events | **Tradovate's own entry→exit pairing**, including many-to-many splits. Run never builds a matching engine — see architecture §8. |
| **Cash History** | `fee` events | **Required, not optional.** |

**Why Cash History is required:** Tradovate charges four separate lines — Commission, Exchange,
Clearing, NFA. The Fills export's `commission` column is **only the first, measured at 42% of
true cost.** On a real 10-day export: gross −$1,840.50, fees −$1,934.36, net −$3,774.86. **The
fees exceeded the gross loss.** Gross-only reporting understates the real loss by half, on the
number this product exists to get right.

**Three failure modes that must be loud, each from a real bug:**

- `IF the three files do not cover overlapping date ranges, THEN THE SYSTEM SHALL name the ranges of each file and refuse the import whole` — a total mismatch already fails well; **partial overlap silently degrades unresolved round trips to local wall-clock or ingest time, which corrupts session bucketing permanently.** The guard must be per-round-trip, not all-or-nothing.
- `IF no fee resolves against any fill, THEN THE SYSTEM SHALL refuse the import and say the files do not line up` — otherwise every trade silently prices at zero fees and **net equals gross**, failing in the direction that flatters the trader.
- `IF an upload writes zero rows because everything was already saved, THEN THE SYSTEM SHALL say so` — "already saved" and "saved" need different next actions, and they currently look identical.

Acceptance criteria:
- `THE SYSTEM SHALL require all three Tradovate exports — Fills, Position History and Cash History — before committing an import`
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
- `THE SYSTEM SHALL display fees per round trip, and SHALL NOT present a net figure that excludes them` — **amended 2026-08-11: per round trip, not per fill.** Fees arrive on a separate export that names no fill id; they resolve to round trips by an exact per-contract-per-side split. A per-fill fee figure would be a fabrication.
- `THE SYSTEM SHALL indicate, on any surface showing a net figure, whether fees were imported for that range` — the alternative is a gross number labelled net
- `THE SYSTEM SHALL display, on every page presenting computed figures, the provenance of those figures — the source file or connection, the account, the range covered, and when it was last read` (P8)
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
- `IF an account's most recent import ends before the most recent completed session, THEN THE SYSTEM SHALL mark it stale and state which sessions are missing` — **amended 2026-08-11: staleness is upload-based, not token-based.** There is no broker token in v1, but the failure this story exists to prevent is unchanged: acting on a record that silently stopped being current. With CSV the gap is "you haven't uploaded since Tuesday" rather than "your token expired"
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

#### The daily read is NOT "a new pattern every day" (Luke, 2026-08-11)

**This resolves a contradiction the spec was carrying unnoticed.** `Read` is daily, and S5
promised a named pattern — but **patterns are longitudinal.** They take weeks of sessions to
emerge. A daily read that owes the user a fresh revelation every morning **will start inventing
them by day four**, which is precisely the failure Run is positioned against.

**The daily read is: "here's your pattern, and here's what yesterday did to it."**

That is Monarch's actual model, correctly understood. The weekly recap does not uncover a new
truth each week — it paces you against the prior period and your plan. Same numbers, moved.

```
Your pattern:   you size up 40–60% after three losses
Yesterday:      it happened once. It lost $340.
This week:      9 of 12 times, −$4,200.
```

Three things fall out of this at once, and they're why it's the right model:

1. **The ritual has something to say every single day** without needing a discovery.
2. **The corpus visibly compounds.** The user watches the count and the dollar figure move —
   that is the moat becoming legible on the surface, daily.
3. **It never fabricates.** The honest daily answer is often *"it didn't happen yesterday"* —
   which is good news, and worth saying out loud.

**Three legitimate states for a daily read**, and no fourth:

| State | When | What it says |
|---|---|---|
| **Finding** | a pattern clears the floor | the pattern, what yesterday did to it, the running cost |
| **Watching** | a candidate exists below the floor | *"I'm watching this — 5 times so far"* — named as a candidate, not a finding |
| **Quiet** | the pattern didn't occur yesterday | says so plainly. This is a good day, not an empty one |

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

### ~~S9 — Correct the record~~ — CUT 2026-08-11 (Luke)

**Removed entirely. The option is not offered.**

> *"CSV files and Tradovate data doesn't lie. As long as Run displays the exact same info, no
> edits necessary. Don't even offer the option."*

This is the stronger position and it sharpens the whole product. Run's claim is not *"our
numbers are editable"* — it is **"our numbers are the broker's numbers."** An edit feature
would quietly undermine that: the moment a user can adjust a figure, every figure becomes a
claim about what someone typed rather than what the broker recorded, and the reconciliation
promise in P12 loses its meaning.

It also removes a whole class of failure the field suffers from — user edits silently
overwritten on the next sync, or silently overwriting broker truth.

**What replaces it: provenance, not editing** (see the amended P8 below). If a number looks
wrong, the answer is not "adjust it here" — it's "here is exactly which file and which broker
record this came from," and the fix happens at the source.

**The one case still open:** a genuine parse failure, where Run misreads a file the broker
exported correctly. That is a Run bug, handled by quarantine (S2) and a fix, never by asking
the user to patch the data.

---

### S9b — Resolve a quarantined trade

> As a trader with a trade Run couldn't reconcile, I want a way to deal with it, so that the
> quarantine bin isn't a hole things fall into forever.

**Added 2026-08-11 (Luke), after S9 was cut.** S2 quarantines unreconcilable trades and excludes
them from every figure. With editing gone, they would sit there permanently with nothing the
user can do — **a bin with no door**, which is its own broken promise and undercuts P8: a
provenance note is hollow if the one thing that looks wrong can never be resolved.

**This is not editing.** Neither action writes to the trade. Neither touches broker truth. It's
roughly a tenth of S9's original weight, and it's the minimum that keeps quarantine honest.

Two actions, and nothing else:

- `WHEN a user re-syncs a quarantined trade, THE SYSTEM SHALL re-read it from source and reconcile again` — most mismatches are transient
- `WHEN a user excludes a quarantined trade, THE SYSTEM SHALL require a reason, record it, and keep the exclusion visible` — an acknowledged exclusion, never a silent one
- `THE SYSTEM SHALL NOT permit any modification of a trade's values through this flow`
- `THE SYSTEM SHALL keep excluded trades visible and countable, and SHALL NOT let an exclusion silently shrink the record`

Edge cases:
- Empty: nothing quarantined — the surface doesn't appear at all
- Error: re-sync fails again — say so, leave it quarantined, don't loop
- Loading: per-trade, not a page-level block

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
- ~~CSV upload as a primary path~~ — **struck 2026-08-11.** This line was written when OAuth was assumed available. It isn't, so CSV upload **is** the v1 path (S1). A scope-cut list only settles arguments if every line in it is still true
- *Reason: one adapter reaches most of the funded-futures niche. A second adapter before the first is proven is pure cost.*

**The rest of the AI surface**
- Conversational assistant / "Ask Run" — **no slot, no feature.** The divider rule means it can be added later without costing a nav row
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

**Drawn 2026-08-11 → [`wireframes.md`](wireframes.md).** All five, derived from the live
accessibility markup of Monarch's Accounts and Transactions pages (chrome-devtools CLI,
2026-08-11) rather than inferred from screenshots.

- `Accounts` ✅ — hero metric selector, groups carrying their own totals, freshness on every row
- `Add account (CSV)` ✅ — nothing commits until the count/range/rejects are confirmed
- `Trades` ✅ — session headers carrying net/count/win rate, filtered-set digest, read-only rows
- `Read` ✅ — daily, a page not a modal, one pattern, plus the History tab
- `Today` ✅ — Monarch's widget contract applied unchanged

---

## 8. Open decisions

| Question | Options | Decide by | Decided |
|---|---|---|---|
| Does Add-account + import collapse into one screen? | two screens / one continuous motion | end of wireframes | |
| ~~Entry or exit time decides a trade's session?~~ | — | — | **RESOLVED 2026-08-11 — exit.** See below |
| ~~Confidence threshold for naming a pattern in S5~~ | — | — | **RESOLVED 2026-08-11 — show the working; floor of 8 + baseline separation.** See below |
| ~~Does `Read` show one pattern or several?~~ | — | — | **RESOLVED 2026-08-11 — one, tracked over time.** The daily read paces one pattern rather than discovering new ones |

### RESOLVED — pattern confidence: always show the working (Luke, 2026-08-11)

**The move that dodges most of the argument: Run shows what the claim rests on.**

```
This happened 12 times. 9 lost. Your usual loss rate is 54%.
```

The user judges the confidence themselves. This is **P8 applied to the wedge** — the product
stating what its own claim depends on, exactly as the provenance note does for figures.

The consequence is that the threshold only has to be good enough to decide **what's worth
showing**, not good enough to be an unchallengeable verdict. That is a far easier bar, and it
removes the need to defend a magic number.

**The floor, below which nothing is presented as a finding:**

- **at least 8 occurrences**, AND
- **the outcome must differ clearly from the trader's own baseline** — a 60% loss rate is
  meaningless if their overall loss rate is 58%. The comparison is always against *themselves*,
  never against a general standard.

**Below the floor, the answer is `Watching`, not silence:**

> *"I'm watching this — 5 times so far."*

Named as a **candidate**, not a finding. This turns the thin-data early days from a dead screen
into something interesting, and it makes the corpus legible from session one rather than from
session fifteen. It is a legitimate third state, not a placeholder.

`THE SYSTEM SHALL display, with every named pattern, the occurrence count, the outcome count, and the trader's own baseline for comparison`
`THE SYSTEM SHALL NOT present as a finding any pattern below 8 occurrences or without clear separation from the trader's baseline`
`WHERE a candidate exists below the floor, THE SYSTEM SHALL present it as watched, with its current count, and SHALL NOT state a cost as though established`
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

**Also worth stating, because the codebase has said both and looked self-contradictory**
(`market-hours.md`): the **trade date** is 5pm→5pm (the 24 hours a fill is dated to) and the
**tradeable session** is 5pm→4pm (when the book is actually open). The hour between is the
Globex maintenance break. Both statements are true; neither is complete alone. Run buckets on
the *trade date*.

### RESOLVED — a trade belongs to the session it EXITED in

**Corrected 2026-08-11. My earlier recommendation of entry was wrong**; `market-hours.md`
settles it, and the reasoning generalises better than either default.

**For prop accounts the question does not arise.** No prop position survives the close — every
firm force-flattens well before the 4:00pm CT close (Topstep 3:10pm CT, Apex/Tradeify 3:59pm CT,
Bulenox ~3:55pm, TradeDay ~3:50pm). Confirmed on Luke's own exports: **0 of 729 round trips
span a 5:00pm boundary; longest hold 35 minutes.** Bucketing by close is therefore *identical*
to bucketing by open, and no metric can double-count or drop a session-crossing trade.

**For personal accounts, which can hold overnight, exit is the correct answer.** Luke's
framing: a trade opened on a Monday and closed six months later does not reflect that Monday's
P&L — it belongs to the day it was realised. Conventional, and it keeps a session's net equal
to the P&L actually realised in that session.

So: **exit, universally.** One rule, no branch on account type, and it is the rule that stays
correct as the audience widens.

**Consequence for the wedge, stated so it isn't discovered later:** behavioral reads are
grouped by the session a trade *closed* in. For prop traders — where the whole wedge currently
lives — entry and exit are in the same session by rule, so nothing is lost. For a personal
trader holding overnight, a "sized up after three losses" read groups by realisation, not
decision. If that ever proves wrong for behavioral analysis specifically, the fix is a separate
decision timestamp on the trade, **not** a change to the session rule.

### RESOLVED — time zones are three separate layers (Luke, 2026-08-11)

Never one zone used for everything. Three layers, each with its own job:

| Layer | Zone | Why |
|---|---|---|
| **Store** | UTC | The absolute instant. Never changes. |
| **Session boundary** | a fixed US market zone, **always** — never the user's | A market fact. It does not move because the trader moved. |
| **Display** | the user's own zone | Their trade happened at *their* 9:31am. |

**Precision on the boundary layer, because getting it wrong costs an hour:** Luke specified
`America/New_York`. That works — `America/New_York` and `America/Chicago` observe DST
transitions at the same instants, so they are always exactly one hour apart and either can
express the boundary. But the constant must match the zone:

- `America/New_York` → the boundary is **18:00**
- `America/Chicago` → the boundary is **17:00**

Writing `America/New_York` with `17:00` silently files an hour of every evening session under
the wrong trade date. **Pick one pair, name it in one constant, and never inline the other.**

The load-bearing rule either way: **a named IANA zone, never a fixed UTC offset.** An offset
breaks twice a year.

**Other implementation notes:**
- Friday close (4:00pm CT) to Sunday open (5:00pm CT) is not a session. Weekend has no bucket.
- Holiday sessions and early closes follow the CME calendar, not a weekday rule.
- **A session with no trades still exists** — needed for streaks, gaps, and "you don't trade
  Mondays" reads.
- Equity-index RTH (8:30am–3:15pm CT, ~70% of volume) is **not** the boundary and must never be
  used as one. It's the window most traders work in — relevant to time-of-day reads only.
- The agricultural complex keeps different hours and is deliberately unhandled. If an ag
  contract appears in a real import, fill this in from CME's product pages before bucketing it.

---

## Phase 2 gate

- [x] v1 describable in 60 seconds with no "and also"
- [x] Every critical-path story has testable acceptance criteria
- [x] Every story has empty / error / loading defined
- [x] NOT IN V1 is longer than the story list
- [x] Wireframes drawn
- [x] No open decision blocks the first slice
