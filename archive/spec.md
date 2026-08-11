# Spec — Run

> Phase 2 artifact. **Single source of truth for what v1 is.**
> If the code and this file disagree, one of them is a bug. Update this file *first*, always.

**Status:** draft — awaiting Luke's calls in §6
**Last amended:** 2026-08-11 — first draft

<!-- CLEAN-SLATE DOORS OPENED ·
     2026-08-11 · run-trading/docs/monarch-for-traders.md — five-row IA (§4.1), ship order
       (§4.5), the taxonomy call (§6.4), the row shape (§6.5), take/refuse list (§5).
     Luke's framing: use old Run's answers freely; the goal is better structure, not
     different conclusions. This spec is built ON that doc, not around it. -->

---

## 1. Problem brief (carried from phase 1)

| | |
|---|---|
| **Problem** | A trader who wants to know what's actually going wrong in their trading can't trust any tool that claims to tell them. The numbers are wrong, the sync dies quietly, and the insight just restates the chart. |
| **Who** | Switchers — prop/funded futures traders already paying for a journal and burned by it. Plus a first-timer minority. Luke is user #1. |
| **Today** | TradeZella / TraderSync / TradesViz / Tradervue. Wrong P&L, zombie trades, sync dying every 6–7 days, AI that defines profit factor. `MAX DRAWDOWN 1644.2%` shipped with a verdict attached. |
| **Spin** | A model of you that sharpens the longer you trade, told back as your own behavior with a dollar figure on it. Corpus = substance, the read = form. |
| **Kill signal** | If the wedge can't name a pattern Luke didn't already know about himself — stop. Testable on 187 real trades, today. |

**The problem is a sequence, and it sets the build order:** wrong record → incomplete record
→ worthless insight. Trust is bottom-up. Nothing above the record survives a broken record.

---

## 2. The critical path

**Two steps.** Connect and verify is one continuous motion, not two — a switcher importing
history and watching it reconcile is a single experience.

1. **Connect & verify** → Tradovate linked, history imported, and the trader can *see* the
   numbers are right. This is where a switcher decides whether to trust Run at all.
2. **The read** → one named pattern from their own trades, priced in dollars. This is where
   they find out Run is different from what they left.

**The one-sentence value claim:**
> A switching trader can connect Tradovate, confirm the record is correct, and be told one
> true thing about their own behavior they didn't already know — in a single sitting.

### Critical path is not the nav

`monarch-for-traders.md` §4.1 settles the **structure**: five rows — Home · Accounts ·
Sessions · Trades · Reports — ordered by the trader's questions. That stands, and this spec
does not reopen it.

But structure and first-run journey are different objects, and conflating them is how you
build five half-screens instead of one complete path. The critical path above crosses
`Trades` and `Home`; the other rows serve it or come later.

---

## 3. Scope — what v1 is

Per §4.5's ship order, **`Home` · `Accounts` · `Sessions` · `Trades`, then `Reports`.**
`Reports` is out of v1 by that doc's own gate. So v1 is four rows.

**Scope risk, flagged rather than hidden:** four rows is a large v1 for a solo build, and
M1–M3 (never knowing when a feature is done, never knowing what to start, feeling lost) are
most likely to recur on the widest scope. The aggressive alternative — `Trades` + `Home`
only, with `Accounts` and `Sessions` deferred — is a real option and is filed as an open
call in §6.

---

## 4. User stories

⭐ = critical path.

### ⭐ S1 — Connect Tradovate

> As a **switching prop trader**, I want to connect my Tradovate account, so that my trades
> arrive without me uploading anything.

- `WHEN the trader completes the Tradovate OAuth flow, THE SYSTEM SHALL begin importing their fill history and show import progress with a count of episodes processed.`
- `IF the OAuth flow fails or is cancelled, THEN THE SYSTEM SHALL return the trader to the connect screen with the reason stated in plain language and the action available again.`
- `IF the connection token expires at any later point, THEN THE SYSTEM SHALL surface the stale state on every affected surface and offer reconnection — silent failure is a bug, not a degraded state.`

Empty: no account connected — the screen's single action is Connect.
Error: named cause, retry available, no raw status codes in UI (§5 refuse-list).
Loading: progress with a real count, not an indeterminate spinner.

---

### ⭐ S2 — The record reconciles, visibly

> As a **switching trader**, I want to see that Run's numbers match my broker, so that I can
> trust everything built on top of them.

- `THE SYSTEM SHALL display only numbers it can reconcile to the broker record.`
- `WHEN any synced data is displayed, THE SYSTEM SHALL stamp its freshness.`
- `IF a value cannot be reconciled, THEN THE SYSTEM SHALL withhold it and state that it is withheld, rather than display an unverified figure.`
- `THE SYSTEM SHALL state what its output depends on, on any surface presenting derived figures` — the Monarch trust-note pattern (§2.5), data-integrity as a UI pattern rather than a promise.

Empty: import not yet run.
Error: reconciliation mismatch is surfaced, never silently rounded away.
Loading: skeleton rows, freshness pending.

---

### ⭐ S3 — Every trade is born named

> As a **trader**, I want every trade to arrive already identified, so that the ledger is
> scannable before I have named anything.

- `THE SYSTEM SHALL assign every position episode a derived descriptor of direction, instrument and clock time (e.g. "Long NQ · 09:47") at import, with no trader action required.`
- `THE SYSTEM SHALL group fills into position episodes — flat to flat, per instrument, per account — never into FIFO round-trips.`
- `THE SYSTEM SHALL assign every fill within an episode a role: initial · add · add-while-underwater · scale-out · stop · flatten.`

Empty: never empty by construction — this is the point of the story.
Error: an episode that cannot be closed (still open) is shown as open, never as complete.
Loading: skeleton.

---

### ⭐ S4 — The conditions strip

> As a **trader**, I want to see when a trade was taken unusually, so that the ledger means
> something before I have any vocabulary.

- `THE SYSTEM SHALL derive conditions from fills only — session bucket, hold time vs. the trader's own median, size as a percentile of their trailing distribution, sequence position, minutes since last loss, added-while-underwater, stop moved.`
- `THE SYSTEM SHALL display only deviations from the trader's own norm, never the full condition vector.`
- `THE SYSTEM SHALL NOT permit trader write access to derived conditions.`

The row reads:
```
Long NQ · 09:47      2× size · 3 min after a loss      TradeDay 50K      -$412
[name → setup]       [conditions: deviations only]     [account]         [P&L]
```

Empty: a trade with no deviations shows an empty strip — correct and meaningful, not a gap.
Error: insufficient history to compute a norm → strip withheld, not faked.

---

### ⭐ S5 — The read, rendered on arrival

> As a **trader**, I want a written read of my own behavior waiting for me, so that I get
> value without asking for it.

- `THE SYSTEM SHALL render the read as prose on Home, present before any interaction.`
- `THE SYSTEM SHALL NOT place the read behind a button or a chat box.`
- `THE SYSTEM SHALL name a specific behavior, quantify it, and price it in dollars` — e.g. *"you size up 40–60% after 3 losses; 70% of those are losers; ~$4,200 preventable."*
- `THE SYSTEM SHALL NOT surface an insight that could be read off the trader's own chart.`
- `THE SYSTEM SHALL NOT propose a name for a failure pattern` (§6.4 rule 4) — behavioral reads stay in prose, priced.
- `WHILE the corpus is too thin to support a behavioral claim, THE SYSTEM SHALL state groupings ("these six trades look like the same thing") rather than reads ("you revenge trade") — a grouping is a claim about the tape; a read is a claim about the person.`

Empty: too thin for a read → a grouping, or an honest nothing. Never a horoscope.
Error: no fabricated confidence.
Loading: the read is generated ahead of arrival, not on demand.

---

### S6 — Rename a trade, promoting it to a setup

> As a **trader**, I want to rename a trade I recognize, so that my own vocabulary enters the
> product without homework.

- `WHEN the trader renames a trade, THE SYSTEM SHALL promote that name to a setup entity.`
- `THE SYSTEM SHALL preserve the trader's wording exactly and SHALL NOT normalize it.`
- `THE SYSTEM SHALL NOT propose names` — it proposes the *scope* of a name the trader already chose.
- `WHEN a setup is created, THE SYSTEM SHALL offer to apply it to mechanically matching episodes ("6 other trades match this shape — call them this too?").`
- `THE SYSTEM SHALL freeze the predicate at naming` — the name labels stored derived conditions, so later membership is mechanical.
- `WHEN a trader renames an already-named trade, THE SYSTEM SHALL append rather than overwrite, and SHALL NOT badge the change.`

Empty: no setups yet — valid terminal state, no badge, no count, no nag.
Error: —

---

### S7 — Sessions

> As a **trader**, I want to see how each day actually went, so that the corpus reads as days
> of a life rather than rows of a table.

- `THE SYSTEM SHALL group episodes by session, using the futures session boundary rather than the calendar day.`
- `THE SYSTEM SHALL present each session with date, net, a stats strip, and the trader's note.`

Empty: no session on a non-trading day — gracefully absent, never "no data yet".

---

### S8 — Accounts

> As a **trader**, I want every account across every firm in one place, alive and dead, so
> that my record survives an account dying.

- `THE SYSTEM SHALL retain all data from an account after that account is closed, breached, or deleted upstream.`
- `THE SYSTEM SHALL display sealed and active accounts together.`

Empty: no accounts — single action is Connect.

---

### S9 — Filter and summary rail

> As a **trader**, I want a stat digest of whatever I've filtered to, so that I get lenses
> without a taxonomy existing.

- `THE SYSTEM SHALL carry the active filter in the URL.`
- `THE SYSTEM SHALL present a stat digest of the currently filtered set, not of the whole corpus.`

This is what makes `Reports` not-missed for months (§4.5).

---

### S10 — Tags

> As a **trader**, I want to tag a trade with context that isn't a setup, so that "news day"
> or "tired" doesn't get forced into the name.

- `THE SYSTEM SHALL maintain tags as an axis separate from setup.`

---

## 5. NOT IN V1

Longer than the story list, by design. Each line is an argument not had later.

**Rows and surfaces**
- `Reports` — gated per §4.5; the filtered summary rail (S9) carries the load meanwhile
- `Live` as a nav row — a posture, not a destination (§4.2)
- A `Twin` / `AI` / `Chat` row — never; a mechanism is not a row (§4.2)
- Forecasting ("if you cut the size-up after two reds, here's the curve") — real, later
- Cash-flow analog — Monarch is deleting theirs; don't build it
- Advice / stock-article section — the field's weakest surface

**Capability**
- Real-time intervention and Tradovate risk-control enforcement (posture D) — the whole "during"
- Browser-extension chart overlay (posture B)
- In-Run order ticket / Run-as-terminal (posture C) — explicitly fiction
- Rithmic and ProjectX rails — Tradovate-first is near-full niche coverage
- NinjaTrader adapter — near-free later, still not v1
- Bars ingestion (location, MAE/MFE, VWAP/IB levels) — a real dependency for a *deep* taxonomy, priced separately
- Setup roll-up tier (ORB-5 / ORB-15 → ORB) — schema must not forbid it; don't build it
- Auto-tagger

**Product/business**
- Pricing and gating — deliberately parked
- Support tooling — roadmap item, not now
- Mobile app
- Multi-user / teams / sharing

**Refused permanently, not deferred** (§5 refuse-list — these never arrive)
- Score gauge, streak, emoji, "0/5 today"
- Two levels of permanent navigation
- Credit-metered AI
- `BETA` / `NEW` badges in primary nav
- Dashboard drag-to-reorder and `Customize`
- Metric definitions dressed as insight
- Badge counts on unfiled trades ("23 trades need review")

**Revisit when:** the four P0s hold (correct numbers, sync that doesn't die, a read about
you, no bloat) and named setups cover the majority of trades.

---

## 6. Open decisions — need Luke

| # | Question | Options | Recommendation |
|---|---|---|---|
| D1 | Is v1 four rows, or two? | Home·Accounts·Sessions·Trades **vs.** Trades·Home only | **Lead recommends two.** The critical path only crosses Trades and Home. Accounts and Sessions are structure, not first value. M1–M3 recur worst on wide scope. |
| D2 | `Sessions` or `Days` for row 3? | — | `Sessions` — carries RTH/ETH/Globex, which traders hold and `Day` doesn't. Wants one sentence from Luke (§8.4). |
| D3 | Does the S4 row shape hold? | React to the row, not the theory | §6.5's proposal, carried as written |
| D4 | Walking skeleton target | What is the thinnest end-to-end path deployed on day one? | Connect → one imported episode → rendered as a named row |

---

## Phase 2 gate

- [ ] Can describe v1 in 60 seconds with no "and also"
- [ ] Every critical-path story has testable acceptance criteria
- [ ] Every story has empty / error / loading defined
- [ ] NOT IN V1 is longer than the story list
- [ ] No open decision blocks the first slice
