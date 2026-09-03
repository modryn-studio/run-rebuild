# Monarch's dashboard, torn down for Run's `/today`

*2026-09-03. Read out of the running app's DOM on Luke's authenticated tab via the standalone
chrome-devtools CLI (v1.8.0, `--pageId 2`), at 1440×900 and 390×844. Every widget's text, links,
controls and picker options below were pulled with `evaluate_script`; screenshots were taken and
looked at, but nothing here is inferred from pixels. Web reads are cited at the end.*

> **AMENDED, SAME DAY. `§8` IS THE CURRENT LIST — READ IT BEFORE ACTING ON §1–§7.** Six of the
> twelve verdicts below have changed, every phone observation is void, and `§A8` settles where the
> page-level account scope lives. Nothing above is edited: the doc is locked, and a superseded
> argument is worth more visible than deleted.

**The question this answers:** Monarch has twelve dashboard cards. What is each one *for*, and what
is Run's version of it on `/today` — for a beta that ships **without** the nightly read
(Luke, 2026-09-03: *"do not implement the nightly job wired to the reading"*)?

**The short answer:** three cards ship, and they are the three `build-plan.md` §S8 already names —
but each one now carries a control set ported from the Monarch card it maps to, and the doc says
which nine Monarch cards Run does *not* build and why. §4 is the list Luke asked for.

---

## 1. The page's shape

| | Measured |
|---|---|
| Header | `Good morning, Luke!` (time-of-day, in the trader's zone) + one control, **Customize** |
| Grid | **Two columns above `lg`, one below.** 12 widgets, each with a drag handle, user-ordered |
| Customize | A dialog: *"Select the widgets you want to see on your dashboard"* — 12 switches, all on for Luke |
| Dismissable upsells | **Business tracking** carries an `×` in its header; Credit score, Investments and Advice do not, they carry a CTA instead |
| Phone (390) | **One column, same order as the desktop's left-then-right reading**, zero horizontal overflow. Nothing is dropped on the phone; every card, every picker survives |

The twelve, in Luke's order, with the page each title links to:

```
Getting Started  →  /accounts          Business tracking  →  /settings/businesses
Your Weekly Recap →  /dashboard/weekly-recap
Budget           →  /budget            Spending           →  /cash-flow
Credit score     →  (enable CTA)       Transactions       →  /transactions
Net worth        →  /accounts          Recurring          →  /recurring
Goals            →  /goals/savings     Investments        →  /investments
                                       Advice             →  /advice
```

**Run already has the greeting decision** — adopted 2026-08-31, cut 2026-09-01, `user-guide.md` §5d.
Not reopened here. Run has three pages; the band naming the page you are on beats being greeted.

## 2. The widget contract, confirmed in the markup

`widget.tsx` already carries the measured shape (78px header, rule beneath, title 18/500, period
inline). What this read adds is the **control vocabulary**, which is the part `/today` has to get
right and had not measured:

| Part | What Monarch does | Where |
|---|---|---|
| Title | The whole header block is the link to the concept's page | every card |
| Headline | One value beside the title, with a delta: `-$334,452 net worth · $2,969.64 (0.9%)` | Net worth, Spending, Goals, Recurring |
| **Period label** | Static text beside the title, *not* a control: `September 2026`, `this month`, `This month` | Budget, Goals, Recurring |
| **Picker** | A `react-select` inside the header's right edge. Opens on `mousedown`. Options portalled | Budget, Spending, Transactions, Net worth |
| **✦ AI affordance** | A sparkle beside the headline, on six cards. It is the `Ask AI Assistant` entry | Budget, Net worth, Goals, Spending, Transactions, Recurring |
| Body | A chart, a list, or a **specific** empty state with a CTA in the user's own vocabulary | all |

**The four pickers, every option, read from the opened menus:**

| Card | Picker | Options |
|---|---|---|
| Net worth | `1 month` | 1 month · 3 months · 6 months · Year to date · 1 year · All time |
| Spending | `This month vs. last month` | This week vs. last week · This month vs. last month · This month vs. last year · **This month vs. average month** · This year vs. last year |
| Transactions | `All transactions` | All transactions · Needs Review by… Anyone (4) · Luke |
| Budget | `Expenses` | Summary · Expenses |

Two things worth more than the rest of the table:

- **Goals and Recurring have no picker.** Their `this month` is a label. A period control appears
  only where more than one period is *answerable* — which is `ColumnsMenu`'s rule in Run already
  (*"absent, not empty, when the page owns its columns"*).
- **Spending's picker is a comparison, not a range.** Every option is `X vs. Y`. That is the one
  place Monarch's dashboard does what `psychology.md` §6 asks for — comparison **only to your own
  prior period** — and `vs. average month` is the strongest shape in it.

**Two details the first teardown flagged, still true:** the Transactions widget's rows are live
comboboxes (re-categorise without leaving the dashboard), and every empty state names the next
action rather than saying "no data".

---

## 3. Every card: what it is, why it exists, what it does — and Run's version

Read each row as: *the card* → *why Monarch has it* → *what it does for the user* → **Run**.

### 3.1 Getting Started — `5/5 · Congratulations Luke, you've set up your account · I'll explore on my own`

A five-step onboarding checklist that stays on the dashboard **after completion** until you dismiss
it. It exists to move a new user through connect → categorise → budget, and to make the first
session feel like progress. For the user it is a to-do list that turns into a trophy.

**Run: no card.** A completed checklist that lingers is a streak in a costume — it rewards *having
opened the app*, which `psychology.md` §7 bans outright (*"anything that rewards opening the
app"*). The onboarding *job* is real, and Run already answers it two ways: the widget contract's
**specific empty states** (P9: *"No accounts yet. Add your Tradovate export and Run will read it"*)
and the **first-import reveal** filed as `S11`, deferred. Neither needs a persistent card.

### 3.2 Your Weekly Recap — `August 23rd–29th · See how your net worth and spending changed last week, and see what's coming up this week ›`

The AI read. A card that names the period and teases the content, opening a five-step walkthrough.
Monarch has it because it is the one surface that turns a dashboard into a *conversation about you*;
for the user it is the reason to come back on Monday. Torn down in full in `ia-teardown.md` §1.6
and `recap-job.md` §3a.

**Run: `Your Daily Recap` — built 2026-09-01, unmounted 2026-09-03, not in the beta.** The card,
modal, thumbs and evidence vocabulary exist in `views/today/` and `/kitchen-sink`; the nightly job
does not. One line to bring back when it does. **What to keep from this read even so:** the card's
body is a *teaser sentence naming what changed*, not a metric — that is the register Run's card
already uses (`lede`), and it is the right one.

### 3.3 Budget — `September 2026 · [Summary | Expenses] · "You haven't added any expense budgets…"`

Plan versus actual. Monarch has it because a budget is the user's *stated intention*, and the
dashboard's job is to hold today against it. For the user: *am I on plan this month?*

**Run: not in beta, and it is the most valuable card on this list once it exists.** The trading
analogue is not a budget, it is the **self-set loss line** — *"the number he said out loud while
calm, against what he then did"* (`widening-plan.md` §3.2), which that doc names as the genuinely
non-derivable half of Run's corpus, and §5.2 makes the spine of Live: *"build the self-set loss
line as the spine; treat firm rulebooks as an optional overlay."* TradeZella's Progress Tracker
already collects stated-vs-actual (`ia-teardown.md` §2.5). Nothing in Run stores a stated number
today, so the card has nothing to read. **File it, do not fake it.**

### 3.4 Credit score — `ⓘ · Monitor your credit score · Track credit score changes and get notified if anything's off · Enable credit score →`

An external score, surfaced as a headline number with alerts. Exists because a single number people
already recognise is the cheapest possible engagement hook, and because it upsells a partner (Spinwheel).

**Run: never.** `psychology.md` §4 takes TradeZella's Zella Score apart as *self-refuting*, and §6
rule 5 — *delete the volume dimension from any metric* — is why no composite score survives contact
with a trader: it will be farmed. Run's headline number is net P&L, reconciled to the cent, and that
is the whole point of it.

### 3.5 Net worth — `-$334,452 net worth · $2,969.64 (0.9%) · [1 month ▾] · line chart` → `/accounts`

The one number. Headline, delta over the picked period, a chart of the period. Monarch has it
because it is the answer to *where do I stand* in a single glance; for the user it is the reason
the dashboard exists.

**Run: `Net P&L` — ships, and first.** Same shape exactly: net over the period, delta versus the
prior period of the same length, a line of `getDailySeries()` under it, title linking to `/trades`.
**Port the picker whole:** `1 month · 3 months · 6 months · Year to date · 1 year · All time` — Run's
`/accounts` chart already offers a range chip set and `yearToDateWindow` / `sessionWindow` exist in
`lib/time`. The one rule that is Run's and not Monarch's: **net, never gross**, and the card states
which it is showing when fees are absent (`hasFees === false → "Gross, no fees imported"`, the tape's
own line).

### 3.6 Savings goals — `$0.00 this month · Emergency fund · No target date`

Progress toward a number the user typed in. Exists because a goal turns a balance into a story with
an ending; for the user it is motivation with a bar on it.

**Run: no card in beta.** The prop analogue is **profit-target progress** (*"$2,140 of $3,000"*) and
it is exactly what a trader in an evaluation wants to see first — but the target lives in the firm's
rulebook, which Run does not hold and **must not ask for** (`prop-firm-identity.md` §4: *"asking a
trader to transcribe one is asking them to be the database"*). The retail analogue is a self-set
goal, which is homework. Both belong to the same future as 3.3.

### 3.7 Business tracking — `× · One view for personal and business finances · Try business tracking`

An upsell for a paid tier, with a screenshot of itself. Dismissable.

**Run: no.** Nothing to say beyond: the `×` is the one honest thing about it, and Run has no tier to
upsell in beta.

### 3.8 Spending trend — `-$1,700.00 this month · ✦ · [This month vs. last month ▾] · two-line chart, Day 1…Day 31`

Not a total — a **comparison**. Two lines on one axis, this period against the picked prior one,
day by day. Exists because a number without its own history is not information; for the user it is
*am I doing what I usually do?*

**Run: hold, and take the shape when it ships.** The trading translation of "spending" is **fees** —
what it costs to trade — and `session.feesCents` already holds it per day. But the stronger use of
this card's *shape* is net P&L **this month vs. last month, day by day**, which is `getDailySeries()`
twice. And the option Monarch buries fourth — **vs. average month** — is the one `psychology.md` §6
would put first: comparison to your own baseline, never to anyone else's. Not in beta because the
three cards in §4 already carry a chart and a comparison card beside Net P&L is two charts saying
one thing; revisit when `S10`'s subject pages give it somewhere to link.

### 3.9 Transactions — `Most recent ✦ · [All transactions ▾] · 4 rows, each with live merchant + category comboboxes` → `/transactions`

The atomic record, newest first, **editable in place**. Exists so the dashboard is somewhere you can
*do* the daily chore (categorise) without navigating; for the user it is the inbox.

**Run: `Last session` — ships.** The rows are `TradeRow`, the same row the tape and `RecentTrades`
already draw, so the card is the row the trader knows. Two departures from Monarch, both doctrine:
**nothing is editable** (trades are the broker's or they are nothing — the whole reason the comboboxes
do not come across), and the scope is **the newest session**, not "most recent N", because a
trader's unit is the day. Headline: the session's net, trade count and win rate off `getDigest()`;
title links to `/trades` filtered to that date. **Port the picker as an account scope:** Monarch's
`All transactions · Anyone · Luke` becomes `All accounts · <each account>`, which `AccountSelect`
already is — and, like `AccountSelect`, it renders nothing below two accounts.

### 3.10 Recurring — `$0 remaining due · This month · UW Credit Union · Every month · +$3,244.14 · in 14 days` → `/recurring`

What is coming. Exists because money has a calendar; for the user it is *what hits next, and when.*

**Run: no card in beta — and it is a real card later.** The prop trader's recurring cost is the
account itself: *"most accounts renew monthly unless cancelled, **including failed ones**"*
(`prop-firm-identity.md` §1), so a dead evaluation can still be billing. *"Apex 50K renews in 9 days
· $147"* is a card a prop trader would pay for. Run holds no billing data and no renewal dates, so it
cannot ship; filed beside 3.3 and 3.6 as the set that needs stated or crawled data.

### 3.11 Investments — `See all your investments · Sync your brokerage for a live view of your portfolio · Sync investments` → `/investments`

The holdings ledger, shown here in its empty state. Exists because accounts are the *sources* and a
dashboard owes you a look at them; for the user it is *what do I have, and is it current?*

**Run: `Accounts` — ships.** `getRoster()` + `getFreshness()`, both existing. Headline: the count by
type (*2 funded · 1 eval*) and net across them; body: a short list of accounts with net and
freshness; title links to `/accounts`. **The one rule this card is most likely to break is Run's
own:** freshness may read *"read 2h ago"* and never *"9 days since your last import"* — the
re-entry doctrine, `CLAUDE.md`. No picker: like Goals and Recurring, there is one period to answer.

### 3.12 Advice — `Prioritized by you · Unlock personalized money advice · Answer a few quick questions and get action items tailored to you · Resume` → `/advice`

A questionnaire that produces an action list. Exists to convert intent into a plan the app can
nudge against; for the user it is homework that promises to pay off.

**Run: no.** The nearest thing is the daily read, and the read's whole argument is that it needs
**no questionnaire** — it reads the tape. `competitor-failures.md` P0 #3 (*manual-work friction*)
and `psychology.md` §5 (*zero logging burden attacks the top two abandonment causes*) both say the
same thing: the moment Run asks the trader to fill something in, it has become the journal it
exists to end.

---

## 4. The list: Monarch's card → Run's card

| # | Monarch | Run on `/today` | Beta | Reads |
|---|---|---|---|---|
| 5 | Net worth | **Net P&L** — same picker (1m · 3m · 6m · YTD · 1y · All) | **ships, first** | `getDailySeries` |
| 9 | Transactions | **Last session** — newest session's rows, read-only, account picker | **ships** | `getTape` + `getDigest` |
| 11 | Investments | **Accounts** — count by type, net, freshness | **ships** | `getRoster` + `getFreshness` |
| 2 | Weekly Recap | Daily Recap — built, unmounted | held: no nightly job | — |
| 8 | Spending trend | Month vs. month, day by day (or fees) | hold: second chart | `getDailySeries` ×2 |
| 3 | Budget | **Self-set loss line** vs. actual | no: nothing stated yet | needs a new table |
| 6 | Savings goals | Profit-target progress | no: firm rules not held | needs rulebook |
| 10 | Recurring | Account renewals due | no: no billing data | needs new data |
| 1 | Getting Started | — (empty states + `S11` do the job) | never | — |
| 4 | Credit score | — | never (§3.4) | — |
| 7 | Business tracking | — | never | — |
| 12 | Advice | — | never (§3.12) | — |

**Three ship.** They are `build-plan.md` §S8's own three; what this read adds is the picker on
Net P&L, the account scope on Last session, the freshness wording on Accounts, and the order.

**Order, on both widths:** Net P&L · Last session · Accounts. That is Monarch's own reading order
for the three they map to (Net worth, then Transactions, then Investments), and it puts the one
number first, the record second, the sources third — the same sequence as Run's nav.

**No Customize, no dragging.** Three cards cannot be rearranged into anything better. The plan's
existing note stands: reorder is a feature of a page with enough widgets to reorder.

---

## 5. What the trading field puts first, and why Run cannot yet

Every prop-trader tool found in the web read leads its dashboard with the **rule buffer**: daily
loss remaining, trailing-drawdown remaining, profit-target progress, consistency ratio
([TradesViz](https://www.tradesviz.com/blog/prop-firm-compliance-tracking/),
[TraderTrack](https://tradertrack.io/),
[a 2026 guide](https://traderssecondbrain.com/guides/prop-firm-drawdown-tracker) that argues the
most important number is not P&L but *remaining buffer*). That is the honest first card for an
evaluation trader, and it is the one Monarch has no analogue for.

Run cannot ship it in beta for one reason, already decided: **the rules are not in the export and
Run will not ask for them** (`prop-firm-identity.md` §4 — *"do not ask the trader, and do not
guess"*). The rulebook crawl is *not V1*, and `widening-plan.md` §5.2 makes the self-set loss line
the spine with firm rules as an overlay, so that the same card serves a retail trader who has no
firm. Both of those are the right calls. The consequence is that §4's three cards are the
*record*, and the *risk* card waits — which is the same shape as the read waiting: the beta ships
the reconciled truth and defers the two things that interpret it.

**What that means for the marketing pages:** the front door describes a record, not a risk
manager. Say that.

## 6. What not to port, in one place

- **A persistent checklist or a completed-trophy** (3.1) — rewards opening the app. `psychology.md` §7.
- **Any composite score** (3.4) — will be farmed; the Zella Score is the proof. §4, §6 rule 5.
- **Editable rows** (3.9) — trades are the broker's. `CLAUDE.md` doctrine.
- **A questionnaire** (3.12) — the journal Run exists to end.
- **Any freshness phrased as elapsed absence** (3.11) — the re-entry rule. The trader who has been
  away is the one this page is worth most to.
- **The greeting** — already decided; not reopened. **VOID: see `§A9`.**

## 7. Open, for Luke

1. **Net P&L's default period.** Monarch defaults Net worth to `1 month`. A trader's month is not a
   calendar month; `1 month` here should probably mean *the last 30 sessions* or *this month to
   date*. `lib/time` owns the bucket either way. Pick one before the card is built.
2. **Last session on a day with no trades.** The card reads *the newest session with trades*, never
   "today" — otherwise a Monday morning shows an empty card, which is the absence state. Confirm.
3. **Does Accounts show hidden accounts?** The roster keeps them in a flap. The card has no flap.
   Suggest: count them in the headline (*3 hidden*), do not list them.
4. **Whether §3.8's comparison card is worth a fourth slot** once the three are live and dogfooded.

---

*Sources read for §5:* [Prop Firm Consistency Rule Explained (2026)](https://www.eltraderfinanciado.com/en/blog/prop-firm-consistency-rule) ·
[Futures Prop Firm Evaluation Rules Explained (2026)](https://godloveuniversity.com/futures-prop-firm-evaluation-rules/) ·
[TradesViz prop-firm compliance dashboard](https://www.tradesviz.com/blog/prop-firm-compliance-tracking/) ·
[TraderTrack](https://tradertrack.io/) ·
[Prop Firm Drawdown Tracker: the buffer you must see](https://traderssecondbrain.com/guides/prop-firm-drawdown-tracker) ·
[5 Best Trading Journals for 2026](https://www.stockbrokers.com/guides/best-trading-journals) ·
[Monarch: Customizing Your Dashboard](https://help.monarch.com/hc/en-us/articles/360058127551-Customizing-Your-Dashboard).

---

# 8. Amendments — 2026-09-03, later the same day

**§1–§7 above are frozen as written.** Nothing in them is edited; where an amendment below
contradicts one, **the amendment wins** and the original stays visible so the reasoning that was
wrong is still readable. Luke's instruction: *"all updates to the doc shall be amendments. treat
the doc as locked."*

Six changes, in Luke's order, then the revised card list and the build order.

## A1 — Every phone observation in §1–§7 is VOID

**Struck:** §1's `Phone (390)` row, and §4's *"Order, on both widths"*.

Luke: *"remove all the phone/mobile stuff because i will be building the mobile version based on
monarch's mobile app, which is differently laid out and has different options."* That is the same
call already on record for `/accounts` and `/trades` (2026-08-24: *"i am deliberately copying and
using monarch's mobile app for UI/UX/IA"*), and it is why the 390px read in §1 was the wrong
evidence: **Monarch's responsive web is not Monarch's phone product**, and porting a narrowed
desktop grid would put Run's phone on a reference Luke has already rejected once.

So this teardown is a **desktop teardown**, full stop. `/today`'s phone layout is its own read, of
the iOS app, and it gets its own document. Until that read exists, `/today` on a phone is *not
designed* — the same explicit deviation from the seven-point definition of done that `build-plan.md`
§S3b records for the pages before it.

## A2 — §3.1 Getting Started: REWRITTEN. Run builds it

**§3.1's "Run: no card" is withdrawn.** It was reasoned off a 5/5 account — Luke's own, fully set
up — which is the one state that makes the card look like a trophy. Luke: *"it is not a persistent
card per say on monarch. it just doesn't disappear automatically when all the 5 items are
fulfilled… i think run would want this. especially during a user's first sign up."*

**What the DOM actually says** (read 2026-09-03, `getting_started`, after expanding the collapsed
section — so this is the completed state's own record of the incomplete one):

| Part | Measured |
|---|---|
| Header | title → `/accounts` · description `Congratulations Luke, you've set up your account` |
| Progress | a **52px SVG ring**, `r=19.5`, `stroke-width=5`, `stroke-linecap=round`, `5/5` centred in it |
| Body | a `data-mds="collapsible"`, **closed**, labelled **`Completed items`** |
| The five | `Add an account 🏦` · `Review your spending 💳` · `Customize categories ✨` · `Create a budget 📈` · `Create a goal 🎯` |
| Each step | a **`<button>`, not a link** — the step opens its flow in place rather than navigating away |
| Dismiss | `I'll explore on my own` — a button, not an `×` |

**The behaviour, now that the collapse is visible:** incomplete steps are the open list; a step that
completes **folds into `Completed items`**. So the card is not a checklist that goes quiet — it is a
list that *empties itself*, and at 5/5 it is one collapsed line plus a ring. It stops being a task
list and becomes a receipt. It is hideable from Customize, and dismissable in place.

**Why the original objection does not apply.** `psychology.md` §7 bans *"anything that rewards
opening the app"* — a streak, a login trophy. This is not that: it is a **progress indicator toward
a working record**, it counts only steps the trader took, and it can only ever be completed once.
The failure mode is the 5/5 state persisting, and Monarch's own answer to that is the collapse plus
the dismiss.

**Run's version — `Set up Run`, and the important part is step 4:**

| # | Step | Opens | Done when |
|---|---|---|---|
| 1 | Add an account | the account sheet | one `account` row exists |
| 2 | Import your first export | the import panel | one committed statement |
| 3 | Name your accounts | the label layer | no account left on its broker id |
| 4 | **Set your daily loss line** | the Edit layer's new field | `daily_line_cents` is not null |
| 5 | **Set your profit target** | same field group | `profit_target_cents` is not null, or the account is not an eval |

**Note what Monarch's own steps 4 and 5 are: `Create a budget` and `Create a goal`.** Their
onboarding exists to *acquire the two stated numbers* that make their two most valuable cards
readable. That is exactly the relationship A4 and A5 create in Run, and it is the answer to the
question those cards raise — *how does the number get stated without nagging?* **It gets stated
once, during setup, by a card that then deletes itself.** The checklist and the loss line are one
system, not two features.

**Three rules Run's version carries that Monarch's does not need:**

1. **It counts steps, never days.** No "set up 2 days ago", no elapsed anything — the re-entry
   doctrine (`CLAUDE.md`).
2. **At 5/5 it unmounts itself**, rather than collapsing to a trophy. Monarch keeps it because
   Customize is a settings surface a user may never open; Run has no Customize, so a finished card
   that lingers is page spent on nothing. The dismiss (`I'll explore on my own`) stays, for the
   trader who wants it gone at 2/5.
3. **A skipped step is not a debt.** Steps 4 and 5 are genuinely optional; the card completes at
   3/5 for a trader who declines them, and says so.

## A3 — §3.2 Weekly Recap: RESET. Everything built for the daily recap is now a blank sheet

Luke: *"i'd like to go more detail into this. i want you to forget everything we have created for
this (the daily recap card) and start from scratch."*

**So `Your Daily Recap` — the card, the modal, the thumbs, the `lede` register, the evidence
vocabulary, built 2026-09-01 on a fixture — is no longer the starting point for anything.** It is
not deleted (it still renders in `/kitchen-sink`, and `views/today/daily-recap.tsx` still compiles),
but it has **no design authority**: the next pass at this card starts from the problem, not from
that component. §3.2's closing advice — *"keep the teaser register, it is the right one"* — is
withdrawn along with the rest; that is exactly the kind of inherited assumption a reset exists to
clear.

**This is a design session Luke has scheduled, not a card to plan here.** What it will have to
settle, listed so the session starts from a question list rather than from a component:

1. **Daily or weekly?** Monarch's is *weekly* and names its range (`August 23rd–29th`). Run assumed
   daily from `spec.md` §5-S5. A week has more pattern in it and costs a seventh as much
   (`ai-economics.md` §1: $1.58 a read).
2. **Card, page, or both?** Monarch's card is a teaser that opens a five-step walkthrough. `/read`
   is currently a placeholder page. Two doors to one artefact is what `build-plan.md` §S8 assumed.
3. **What is in the card when the job has never run** — which is every trader's first week.
4. **What the trader can do to it.** The thumbs were built; nothing decided what a thumb *does*.
5. **What it costs at 100 traders**, which `ai-economics.md` §6 explicitly reopens.

Until that session, `/today` ships without it and `build-plan.md` §S8's amendment stands.

## A4 — §3.3 Budget: SHIPS IN BETA. The self-set loss line

Luke: *"most valuable card and not in beta? that doesn't make sense. time to update our docs. we
will be implementing this."* Correct, and §3.3's *"file it, do not fake it"* was reasoned from a
false premise — that nothing in Run stores a stated number. **Nothing stores one because it was
deliberately cut, and the reason it was cut has now expired.**

**The history, which matters because it is the argument.** `s6-plan.md` **D2** cut
`daily_line_cents` — *"the trader's own stop-loss line, set while calm"* — on one ground:
***"nothing reads it yet"*** (v2's own issue #66; the column existed there and was dead). Three
places in the code still carry the tombstone: `api/accounts/route.ts` (*"the only one of v2's
fields still missing"*), `account-rail.tsx`, and `label-account-form.tsx` (*"No 'Set the line'"*).

**This card is the reader.** The cut's stated reason is gone.

**And the psychology says this is the largest effect available to the product.** `psychology.md` §2:
naming a pattern buys d=0.36 on behaviour; an **implementation intention** buys **d=0.65** —
*"the largest well-replicated effect in the entire brief"* — and the effect comes from the subject
**forming** the conditional, not from being handed one. The resolution counsel and psychology both
signed:

> **Run supplies two real numbers. The trader draws the line.**
> If Run draws it, Run is the advisor. If the trader draws it, Run is a mirror.

A card that shows *the line the trader set* against *what the trader then did* is that sentence as a
UI. It is also the only card on this page where Run is not the one making the claim.

**⚠️ IT CONTRADICTS A LOCKED DOC, AND THAT NEEDS LUKE'S SIGNATURE, NOT MINE.** `spec.md` §6, under
*Rules, discipline, scoring*, reads: *"Rules engine, **stated-intent-vs-actual tracking**, streaks,
contribution heatmaps, daily checklists"* — NOT IN V1, *"Reason: TradeZella already collects
stated-intent-vs-actual."* This card is stated-intent-vs-actual tracking, and A2's card is a daily
checklist's cousin. **`psychology.md` already asked for the fix**: *"Add an explicit carve-out: a
single generated descriptive conditional is not a rules engine… one sentence was excluded by
category rather than by argument, and it is the only large-effect intervention in the literature.
P11 already licenses 'pace against a stated intent'."*

So the carve-out is already drafted and already justified — but `spec.md` is LOCKED, and the
project's own rule is that **the doc gets updated first, in the same change**. Nothing is built
against this until Luke amends §6.

**Shape, when it is built:**

| | |
|---|---|
| Where the number is stated | the account sheet's **Edit** layer, per account, beside `hidden` and `excluded` |
| Storage | `account.daily_line_cents` — `bigint`, nullable, integer cents like every other money column |
| Headline | the session's realised P&L against the line: *"−$420 of your −$750 line"* |
| Body | the last N sessions as a small bar each, the line as a rule across them |
| Period | a **label**, not a picker — like Monarch's Budget. One period is answerable |
| Empty state | *"You haven't set a line for this account"* + the field. The specific-empty-state rule |
| The rule it must not break | it **reports**, it never warns, scores, or congratulates. Past tense, no imperative (`psychology.md` §2's four conditions) |

**One open question this raises and A7 does not answer:** the line is per *account*, but a trader
with three accounts trades one book. Does the card sum the lines, or scope to the picked account?
Suggest: **scope to the account picker**, the same control as Last session, because a line is a
promise made about a specific account's rules.

## A5 — §3.6 Savings goals: SHIPS IN BETA. Profit-target progress

Luke: *"we can easily add this in beta."* Agreed, and it is easy for a reason worth stating:
**it is A4's table with the sign flipped.** One migration, one field group, two cards.

§3.6's objection was that the target lives in the firm's rulebook and `prop-firm-identity.md` §4
forbids asking the trader to transcribe one. **That objection dissolves the moment the number is
self-set rather than transcribed** — which is A4's whole mechanism. The trader is not being asked to
be the database for Apex's rulebook; they are stating *their own* target, in the same field group,
by the same ritual, on the same screen. If it happens to equal the firm's, that is the trader's
business and Run never claims to know.

**This preserves the rule exactly:** Run does not hold, parse, or guess a rulebook. It holds a
number the trader typed.

| | |
|---|---|
| Storage | `account.profit_target_cents` — `bigint`, nullable |
| Headline | *"$2,140 of $3,000"* and the remainder, off the account's own net |
| Body | a bar, and the count of sessions since the target was set |
| Scope | eval accounts by default; available on any account, because a funded trader can set one too |
| What it must not do | count down days, project a date, or say "on pace". A projection is advice |
| Reached | it says so once and **stops**. A completed target is not a trophy that lives on the page |

## A6 — §3.12 Advice: REOPENED, pending Luke's own design

Luke: *"this we will be planning and talking about my ideas later."* **§3.12's "Run: never" is
downgraded from a decision to an observation about Monarch's version.** What was actually argued
there is narrower than what it concluded: the objection is to a **questionnaire** — homework the
trader fills in so the app can nudge against it (`competitor-failures.md` P0 #3,
`psychology.md` §5's zero-logging-burden argument). That objection stands and is not reopened.

Whatever Run's version turns out to be, it arrives with two constraints already fixed, so the
session should start from them rather than rediscover them:

- **The advice line.** Conditional and descriptive, never prescriptive — `psychology.md` §2's four
  conditions and Priya's CFTC read. Run states what happened; the trader draws the conclusion.
- **It may not ask.** Anything it needs, it reads from the tape or from a number already stated
  under A4/A5.

## A7 — The revised list, and the build order

Superseding §4's table. Six rows are unchanged; the six that moved are marked.

| # | Monarch | Run on `/today` | Beta | Reads |
|---|---|---|---|---|
| 5 | Net worth | **Net P&L** — picker: 1m · 3m · 6m · YTD · 1y · All | **ships — 1st** | `getDailySeries` |
| 9 | Transactions | **Last session** — newest session, read-only, account picker | **ships — 2nd** | `getTape` + `getDigest` |
| 11 | Investments | **Accounts** — count by type, net, freshness | **ships — 3rd** | `getRoster` + `getFreshness` |
| 3 | Budget | **The daily loss line** vs. actual | **ships — 4th** ⬆ *was: no* | new column + `getDigest` |
| 6 | Savings goals | **Profit-target progress** | **ships — 5th** ⬆ *was: no* | same column group |
| 1 | Getting Started | **`Set up Run`** — 5 steps, self-emptying, self-unmounting | **ships — 6th** ⬆ *was: never* | existing state, no new data |
| 2 | Weekly Recap | **RESET — designed from scratch** ⬆ *was: built, unmounted* | held: no job, no design | — |
| 8 | Spending trend | Month vs. month, day by day | hold: second chart | `getDailySeries` ×2 |
| 10 | Recurring | Account renewals due | no: no billing data | needs new data |
| 4 | Credit score | — | never (§3.4) | — |
| 7 | Business tracking | — | never | — |
| 12 | Advice | **REOPENED** ⬆ *was: never* | Luke's design session | — |

**Six cards ship, not three.** Which changes §4's *"No Customize, no dragging"* note: three cards
cannot be rearranged into anything better, **six can**. Reorder is still not in this slice, but it
stops being obviously pointless — file it, revisit after dogfooding.

**Order on the page** (a separate question from build order): Net P&L · Last session · The line ·
Profit target · Accounts, with **`Set up Run` above all of them while it is incomplete**, because a
setup card that sorts below the cards it is trying to fill is a setup card nobody finishes.

### Build order, and why

1. **Net P&L.** Zero new data (`getDailySeries` exists), and it is the card that builds **the grid
   itself and the picker vocabulary** the other five inherit. It also cannot be blocked: it is the
   only one of the six that touches no locked doc.
2. **Last session.** Existing reads, and it introduces the **account picker** that the line card
   then reuses.
3. **Accounts.** Existing reads, and the smallest of the three.
4. **The line + the target, as ONE slice.** One migration (`daily_line_cents`,
   `profit_target_cents`), one field group in the Edit layer, two cards. Splitting them would mean
   two migrations and two passes over the same form. **Blocked on `spec.md` §6's carve-out.**
5. **`Set up Run`.** Last of the six on purpose: four of its five steps point at flows that must
   already exist, and step 4 points at the field that slice 4 creates.

Then the two design sessions, in either order: **the recap reset** (A3) and **advice** (A6).

## A8 — The account scope is PAGE-LEVEL, and it lives in the header band *(decided AND BUILT 2026-09-03)*

> **BUILT THE SAME DAY** (Luke: *"go ahead and implement the plan for the picker"*). The picker is
> `views/today/today-header.tsx`, portalling `AccountSelect` into `HeaderSlot slot="controls"`, and
> the page narrows its fold by `?accounts=<uuid>` before any card sees it. `Customize` stayed off
> (*"we can leave the customize button off for now"*) and the phone is still open
> (*"ill decide the mobile later"*). Everything below is the reasoning as it was written; the two
> deferrals at the end are the parts that are still deferred.

**Decided now, built later.** Luke: *"my answer would be that we will need a page-level scope
control. we dont have to implement that now. but that is a great idea that should be documented. the
only reason im deferring is because i dont know where the picker would go."* This section is that
answer, so the decision does not have to be made again from scratch when card 2 needs it.

### The question that forced it

`Net P&L` shipped with a period picker and no account picker, and the reason was not the control, it
was the scope. If a trader picks `Apex 50K` on one card, either **every** card follows or **none**
does. If none does, three cards on one page each describe a different set of accounts, which is a
dashboard disagreeing with itself in public - the same class of defect as v2's rail reading
`+$954.99` under a chart reading `-$26,995.06`, which is the fault this build keeps deleting. So it
cannot be a per-card control, and Monarch is no help here because **its dashboard has no account
scope at all**: its widgets scope by their own subject (Transactions by reviewer, Budget by
summary-or-expenses) and never by account.

### Where it goes, and Run already has the position

Monarch's dashboard header is one grid row, measured 2026-09-03 at a 1440 viewport:

| | Measured |
|---|---|
| Row | `Header__Root`, 1388 x 64, `display: grid`, two cells |
| Left cell | `Good morning, Luke!` at x=76 |
| Right cell | **`Customize`** at x=1311, **113 x 36** |
| The button | `14px / 500`, ink on a **white ground**, **0px border**, radius 8px, padding 7.5/12, no icon |

Luke's instinct - *"add that customize button up in the top right header like monarch does it. then
we could add the picker drop down to the left of that customize button"* - is the right position,
and **Run does not need to build the row to get it.** `HeaderSlot slot="controls"` is that exact
cell, and two pages already portal into it: `/accounts` puts `RosterClear`, `RosterFilters`,
`RefreshRoster` and its CTA there, `/trades` puts its columns and filter controls there. It even
already has the house ORDER for that cell, written in `accounts-header.tsx`: **the undo, then the
chrome, then the one thing wearing the accent.** An account picker is chrome. So:

```
Today                          [ All accounts ▾ ]  [ Customize ]
```

### Three things that follow from it being page-level

1. **IT WRITES THE URL, unlike the period picker.** This is the same split the reference makes and
   the same one Luke already chose for the card: its accounts page keeps the chart in the query
   string (`?chartType=performance&dateRange=1M&timeframe=month`) and its widget keeps the period in
   the component. A page's SUBJECT belongs in the address - it survives a refresh, it can be shared,
   and every card can read it on the server without a client context. A widget's period is a glance
   and stays local (Luke: *"keep it local"*).
2. **`accounts` IS ALREADY THE PARAM NAME**, written by `/trades`'s `AccountSelect` and its filter
   panel. Reusing it means a trader who narrows on `/trades` and walks to `/today` is not silently
   re-widened, and `safeNext`-style scoping rules already apply to it.
3. **IT RENDERS AT EVERY ACCOUNT COUNT AND WRITES NOTHING AT ONE.** `AccountSelect` already settled
   this and the reasoning is not obvious enough to re-derive: at one account the control is a LABEL
   wearing a menu's clothes, because picking the only account would write the param, select exactly
   the same trades, AND light every "something is narrowed" affordance - a control claiming the
   record was narrowed without narrowing it.

### `Customize` is a separate feature, and it is not a blocker

The picker does not depend on it. Monarch's Customize is a dialog of **twelve switches** and it
exists because they ship twelve widgets a user may never want; Run will ship six, each argued for.
§A7 already says reorder stops being pointless at six cards without becoming necessary. So:
**build the picker into the controls cell alone, and let `Customize` join it at the far right the
day there is something worth hiding.** Building the button first would be building the container
before the thing it contains.

### What is still open

*Two of the three closed the same day. Struck rather than deleted, so the answer is readable beside
the question.*

- ~~**The phone.**~~ **ANSWERED 2026-09-03.** It takes `/trades`' shape, not `/accounts`': a
  `filter` mark below `md` opening a full-screen sheet (`views/today/scope-sheet.tsx`), because
  `design-system.md` §6a makes that the rule rather than a choice. The desktop dropdown is
  `max-md:hidden` and the mark is `md:hidden`, so exactly one is ever in the document.
- ~~**Whether `hidden` accounts appear in it.**~~ **ANSWERED, AND IT WAS THE WRONG SWITCH TO ASK
  ABOUT.** `hidden` takes a row off the roster and keeps it in the arithmetic, so it has no bearing
  on a control over a figure. `excluded_from_totals` does: an account excluded from totals cannot be
  in a figure made of totals, so the picker does not offer one. The rule, which covers the
  no-trade filter that was already there: **a control over a figure may not offer an option that
  cannot be in it.** Found by Luke probing the other half - *"why does the /today page not show the
  1 personal account with no activity?"* - which was the no-trade filter working and exposed that
  the identical argument had not been applied to exclusion.
- **Whether the scope survives to `/trades`.** Still open. Sharing the `accounts` param means it
  does, which is either the feature or the surprise. Worth one deliberate decision before card 2
  ships. *(One consequence is now known: `/trades`' facets are inner-joined on the trade table, so
  that param cannot arrive here carrying an account Run holds nothing for.)*

### What the coverage line does, settled 2026-09-03

`Across N accounts` appears at the `all` range and nowhere else, and the reason is not a coverage
decision: **at `all` the change IS the figure, so a delta there would be the same money twice, and
the slot would otherwise be empty.** It is a fallback for an empty slot. That one sentence explains
the whole matrix, and it is why `/accounts` showing it at `All time` and not at `1 month` is
correct rather than inconsistent.

**On `/today` it is phone-only** (Luke: *"the account picker is right there in the header... and all
the other cards will have the same effect and i dont want to have to label all the other cards this
way as well"*). The scope here is PAGE-level, so one control in the band governs every card and a
card labelling its own coverage repeats it - six times, once the page is full. The phone keeps the
line because there the picker is a bare mark that names nothing, and that line is the only place a
scoped account is ever named.

## A9 — The greeting is back, and §1's "not reopened" is void *(2026-09-03)*

**§1's line — *"Run already has the greeting decision, adopted 2026-08-31, cut 2026-09-01"* — and
§6's *"already decided; not reopened"* are both withdrawn.** Luke: *"i also noticed that we reverted
back to having Today in the header. we did have the greeting in the header like monarch does it.
that was a fully coded implementation. what happened to it? we need it back and it needs to be the
code we had before because i did research to find out exactly how to code the greeting to make it
work properly."*

**So the reference's own header shape is now Run's, in full:** the greeting where the page title
would be, at `18px/500` full ink in a `<span>` (measured on their dashboard, which has no `h1`,
`h2` or `h3` at all), and the controls cell to its right.

**RESTORED WITH `git show`, NOT RETYPED**, and that is the instruction rather than a shortcut. Two
of the three pieces are ordinary - the `Greeting` portal and the shell's `SELF_TITLED` set - and the
third is not: `hourIn` carries three `Intl` failure modes, each measured on this runtime rather than
recalled.

| The obvious spelling | What it does | Why the fix |
|---|---|---|
| `format()` | returns `"00 Uhr"` in de-DE, `"0時"` in ja-JP | `Number()` gives `NaN`, `NaN < 12` is false, so the greeting reads **evening permanently**. `formatToParts` returns the hour as DATA |
| `hour12: false` | lets the engine resolve a cycle | SpiderMonkey resolved `h23` while V8 resolved `h24`, under which midnight formats as `"24"` and 00:30 says "good evening". `hourCycle: 'h23'` STATES it |
| an unknown IANA zone | `Intl` throws `RangeError` | on a render path that is a 500 on the front door, months after a runtime update renames a zone. Falls back to the market zone, then to noon |

The one thing the old file got right and the deletion note got wrong: it argued the helpers were
*"dead code with a story attached"*. True about the code, false about the value - the story IS the
asset, and `git log` holding it is only useful if somebody remembers to look. This section is that
reminder.

**Two things stay Run's rather than the reference's**, and neither is reopened: **no exclamation
mark** (their register is bright, this product's is calm, and a journal that greets a trader
cheerfully the morning after a bad session is cheerful at exactly the wrong moment - `psychology.md`
§6), and **first name only** (the OAuth provider hands over whatever the trader typed into Google,
so *"Good afternoon, Luke Hanner"* is a form letter). The name is also **nullable** - the
emailed-code path supplies none - and *"Good morning"* alone is a complete sentence.
