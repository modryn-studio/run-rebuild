<!-- Live IA teardown. Author: orchestrator (Claude), 2026-08-10, at Luke's direction.
     Trigger: Luke, 2026-08-10 - "Run can be a Monarch for traders... run thru all the surfaces and
     document their IA" for Monarch and TradeZella.
     Method: chrome-devtools-mcp standalone CLI against Luke's own signed-in sessions (see
     modryn-hq/playbooks/read-live-competitor.md). Accessibility tree + evaluate_script, NOT screenshots -
     every structure claim below was read out of the markup. Screenshots are corroboration only.
     The conclusions drawn from this evidence live in monarch-for-traders.md. This file is the record. -->

# IA teardown — Monarch and TradeZella, read live (2026-08-10)

**What this is:** a surface-by-surface read of both apps from inside Luke's authenticated accounts, so
Run's information architecture is designed against what these products *actually* ship today rather
than against memory or a marketing page. **The argument built on it is [`monarch-for-traders.md`](monarch-for-traders.md).**

**Caveats on the read, stated up front:**
- **Luke's TradeZella subscription is inactive.** A banner sits on every page and many controls render
  `disabled` ("Add Trade", "Start my day", "New note", "Edit rules"). **Structure and labels are fully
  readable; live interaction is not.** Mentor Mode is hard-paywalled and returned a raw `402`.
- Luke's Monarch account is young (first transaction Feb 2026, 410 transactions, no budgets set, no
  investment holdings), so several Monarch surfaces were read in their **empty state**. That turned out
  to be useful — empty states are a Run design problem too — and is flagged where it applies.
- Both accounts are one person's. Nothing here measures scale, retention, or performance.

---

## 1. Monarch — the shell

`app.monarch.com`. Fixed **224px** left sidebar, collapsible (a panel-left control at the top). One flat
level of navigation, eleven rows, no sub-nav anywhere in the sidebar:

```
Dashboard · Accounts · Transactions · Cash Flow · Reports · Budget (/plan) ·
Recurring [24] · Goals (/goals/savings) · Investments · Forecasting · Advice
```

Below the rows, visually separated: **AI Assistant · Help & Support · Get 45% discount · Luke** (profile).

Three things about that list are worth naming because they are decisions, not defaults:

1. **The rows are ordered by the time horizon of the question.** State now (Dashboard) → what I have
   (Accounts) → what happened (Transactions) → what it means (Cash Flow, Reports) → what I planned
   (Budget) → what is coming (Recurring) → what I am working toward (Goals) → how I am doing against a
   baseline (Investments) → what if (Forecasting) → what to do (Advice). Reading top to bottom is
   reading the user's day widening into their year.
2. **`Recurring` carries a numeric badge (24)** and it is the only one. It is not a growth badge — it is
   a **work queue count**, and clicking through lands on a banner offering to clear exactly those 24
   items. Nothing in the nav says NEW, BETA, or AI.
3. **AI Assistant is deliberately not one of the eleven.** It sits below the divider with Help and
   billing, because it is not a destination. More on that in §1.6.

**Sub-navigation, where it exists, lives in the page header, never the sidebar.** Transactions has
`All · Receipts [New] · Retail Sync`; Reports has `Cash Flow · Spending · Income`; Goals has
`Save up · Pay down`; Investments has `Holdings · Advanced [Plus]`. So the sidebar is a stable eleven
rows and depth is a property of the page you are on.

### 1.1 Dashboard — a widget grid, not a report

Header: **"Good afternoon, Luke!"** (time-of-day greeting) and one control, **Customize**. Every widget
carries a drag handle (`Press space bar to start a drag…`), so the grid is user-ordered.

Widgets observed, in Luke's order: Getting Started (a 5/5 checklist with "I'll explore on my own"),
**Your Weekly Recap**, Budget, Credit score (upsell), Net worth, Goals, Business tracking (upsell),
Spending, Transactions, Recurring, Investments, Advice.

The widget contract is consistent and worth copying wholesale:

| Part | Behaviour |
|---|---|
| Title | Links to the full page for that concept (`Spending` → `/cash-flow`) |
| Headline value | The one number, with its delta: `-$336,129 net worth` · `$1,292.56 (0.4%)` |
| Scope control | A small combobox *inside the widget*: `1 month`, `This month vs. last month`, `All transactions`, `Most recent` |
| **Ask AI Assistant** | A button **per widget**, on Budget, Net worth, Goals, Spending, Transactions, Recurring |
| Body | A chart, a list, or an empty state with a specific CTA |

Two details that are easy to miss and are the actually-hard parts:

- **The Transactions widget is editable in place.** Each row's merchant and category are live
  comboboxes, the same components as the full Transactions page. You can re-categorise from the
  dashboard without navigating.
- **Empty states are specific and local.** Budget: *"You haven't added any expense budgets. When you
  start budgeting your expenses, a summary will appear here."* Investments: *"No investment holdings
  with known securities / Please sync another investment account to see top movers."* Neither is a
  generic "no data" plate; each names the next action in the user's own vocabulary.

### 1.2 Accounts — the ledger of sources

Header `Accounts` with `Filters · Refresh all · Add account`.

Top of page is a hero block with a **metric selector** rather than a fixed title: a `NET WORTH`
dropdown, a `Performance` toggle, and a `1 month` range — then `-$336,129.24`, the delta
`$1,292.56 (0.4%)`, the label `1 month change`, and a chart.

Accounts are grouped **by type** (Loans, Credit Cards, Cash). Each group header is itself a row with the
group's own change and total. Each account row carries: name with masked digits `Reserve Line Of Credit
(...5601)`, subtype, balance, **a sparkline**, and — the detail that matters most for Run —
**a freshness stamp: `22 hours ago`.** Every account, every row, always visible.

Right rail: a `Summary` panel with `Ask AI Assistant`, a `Totals / Percent` toggle, the Assets and
Liabilities breakdown, and `Download CSV`.

Inline affordances appear where data is missing rather than as a separate settings trip: a Visa card
with no limit set renders a `Set credit limit` link straight to `/accounts/details/{id}/edit?autoFocusField=limit`.

### 1.3 Transactions — the atomic record

Sub-tabs `All · Receipts [New] · Retail Sync`. Toolbar: `Search` (dialog), `Date`, `Filters`, `Add`,
`Toggle summary`. Table controls: a saved-scope combobox (`All transactions`), `Edit multiple`, `Sort`,
`Columns`.

Rows are grouped under a **date header that carries that day's net** (`August 5, 2026  +$1,337.35`).
Each row: merchant combobox, category combobox, account link, split/reimburse control, notes icon,
amount, and `Open transaction details` (a drawer).

Right rail `Summary`, and this is a pattern Run should steal outright — **a stat digest of the currently
filtered set**, not of everything: Total transactions 410 · Largest transaction · Largest expense ·
Average transaction · Total income · Total spending · First transaction · Last transaction ·
`Download CSV`. Change the filter and the digest changes with it.

### 1.4 Reports — one dataset, many lenses, savable

Sub-tabs `Cash Flow · Spending · Income`. Toolbar: `Date`, `Filters`, `Reports`, and `Save`, which is
disabled with the description *"Select filters and/or a date range to save a report."* **A report is a
saved filter+range+chart configuration.** That is the whole idea.

The page is: KPI row → chart-type combobox → grouping combobox → chart → the same transaction table and
Summary rail from §1.3.

Chart types and groupings, read from the option lists (each option ships a one-line description, which
is why nobody has to guess what a Sankey is):

| Tab | Chart types | Grouping |
|---|---|---|
| Cash Flow | `Sankey` *(Visualize your cash flow streams)* · `Trend bars` *(Track your behavior over time)* | `By category & group` |
| Spending | `Pie` *(Your expense breakdown at a glance)* · `Breakdown` *(Expenses, biggest to smallest)* · `Treemap` *(Proportional category breakdown)* · `Trend bars` *(Your spending behavior over time)* | `By category` · `By group` · `By merchant` · `By fixed / flexible` |

**Cash Flow, the old sidebar row, is being absorbed into Reports.** Its page now carries a banner:
*"One home for all your cash flow views… Every view from this page has moved to Reports. This page will
be removed soon."* A company with Monarch's resources is **removing a nav row**, which is the single
most useful strategic signal in this entire teardown.

### 1.5 The rest, briefly

- **Budget (`/plan`)** — a spreadsheet: `Planned | Actual | Remaining` columns over sections Income,
  Expenses (split Fixed / Flexible), Contributions (Save up / Pay down). Planned is an inline textbox,
  Actual is a link into the filtered transactions, Remaining is a control. Period toggle
  `Month · Year · Decade`, a `Left to Budget $10,390` footer, a `Show 1 unbudgeted` reveal.
- **Recurring** — review-queue banner (*"There are 24 new recurring merchants and accounts for you to
  review" · Review now*), sub-tabs `Monthly · All recurring`, view toggle `List · Calendar`, three
  summary cards (Income / Expenses / Credit cards) where the empty ones carry their own CTA
  (`Add recurring expenses`, `Set up bill sync`), and a table with relative dates (`Aug 5 (5 days ago)`).
- **Goals** — `Save up · Pay down`; cards with image, current, target date, `0% of $10,000.00`; a rail
  with `Available for goals · Allocate funds · Edit goal accounts`; and a plain-language estimates
  disclaimer under the list.
- **Investments** — `Holdings · Advanced [Plus]` (the paid tier is named in the sub-nav). Portfolio
  performance charted **against toggleable benchmarks**, each a row with its own numbers:
  `S&P 500 3 Months 4.59% Today -0.06%`, `US Stocks…`, `US Bonds…`. `Backtested performance` is
  labelled as such with a `More information` control. `Download chart`.
- **Forecasting** — read in its unactivated state: a scenario chart with life-event markers (Buy a home,
  Have a kid, Retire), `Try Forecasting`, and three explainer cards phrased as questions
  ("When can I retire?", "Can I afford this house?", "How does my future look?").
- **Advice** — cards tagged by verb (`SPEND`, `SAVE`, `PAY DOWN`, `INVEST`), each with a title, a
  paragraph, and progress (`NOT STARTED ・ 7 TASKS TO COMPLETE`). Sorted by a `Prioritized by you`
  control. Carries its own deprecation notice.
- **Settings** — profile, display, notifications, security, integrations, household, businesses, members,
  preferences, institutions, **categories, merchants, rules, tags**, data, billing, gifts, referrals.
  The taxonomy the whole product runs on (categories / merchants / rules / tags) is editable and lives
  here, out of the product surface.

### 1.6 The two AI surfaces, and why they are not a nav row

**(a) The Weekly Recap** — a five-step modal walkthrough at `/dashboard/weekly-recap`, entered from a
dashboard widget. Read in full:

| Step | Header | Content |
|---|---|---|
| 1 | `Overview │ August 2nd–8th` | *"Your weekly recap is ready to review"* + *"We've analyzed your finances over the last week, and we've pulled together the top insights…"* + three teaser sentences with the numbers already in them |
| 2 | `Net worth │ August 2nd–8th` | Headline sentence, chart, three prose paragraphs |
| 3 | `Spending │ August 2nd–8th` | Headline sentence, four prose paragraphs |
| 4 | `Recurring │ August 2nd–8th` | Headline sentence, a table, prose, a nudge into the review queue |
| 5 | `That's a wrap │ August 2nd–8th` | *"Another week reviewed—nice work!"* + habit copy + 👍/👎 + `See more` + **`Ask follow up questions`** |

Four things it does that are all transferable:

- **The forward control is labelled with the next topic, not "Next":** `Next up: spending`,
  `Next up: upcoming transactions`, `Finish reviewing your recap`.
- **The prose is specific, not a metric restatement.** Verbatim from step 3: *"Your largest expense was
  $29 at Massive.com on August 3… Compared to last week—when spending was dominated by Uncategorized
  ($100 at Anthropic) and Gas ($53 at ExxonMobil)—this week's activity focused more on Electronics.
  You've used $39 of your $1,150 flex budget (3%), with $1,111 remaining for the rest of the month."*
  It names merchants, compares to the prior period, and paces against a plan.
- **A trust note repeats on every single step:** *"Note: Your recap reflects your connected accounts,
  transaction categorization, and recurring items. If anything looks off, you can review and adjust
  ahead of next week's recap."* The product tells you what its own output depends on, every time.
- **The close reinforces the ritual rather than the metric:** *"Weekly check-ins help you spot trends
  and stay proactive with your money… keep checking in and see real progress over time!"*

**(b) The AI Assistant panel** — `New chat`, title *"AI Assistant / Ask anything about your money"*, an
input reading *"Ask anything about your money…"*, and a footer: *"AI Assistant can make mistakes and
isn't for financial advice."* linked to a help article.

Its suggested prompts are **built from the user's own data**: *"How can I increase my current net
worth?"*, *"Is my Shopping budget on track?"*, *"Compare my 🏢 Parking & Tolls spend to last month"*,
*"Show my UW Credit Union spend last month"*. Luke's actual category and his actual credit union.

### 1.7 Visual signature (five lines, character only)

Warm paper `#f6f5f3`, cards pure white, ink `rgb(34,32,29)` — a warm near-black, never `#000`.
**ABC Oracle** throughout, one family, no serif in-app. Base **16px / 400**; buttons 14px / 500; the
greeting only 18px / 500. Cards `12px` radius with an **ink-tinted** elevation
`rgba(34,32,29,.1) 0 2px 4px`, not a grey shadow; buttons and nav rows `8px`.
**Note against Run's own docs:** monarchmoney.com the *marketing site* is big-type editorial (48px / 350,
Copernicus serif). `app.monarch.com` is none of those things. It is a calm, dense, 16px instrument in a
single grotesque. Do not carry the marketing register into the app on Monarch's authority.

---

## 2. TradeZella — the shell

`app.tradezella.com`. **Two levels of navigation, both permanent.** A horizontal product bar:

```
Home · Journal (/tracking) · Backtesting · Agents · Mentor Mode · PropFirm Sync [BETA]
         + Contact us · Zella University · Referral Program
```

and then, inside Journal, a **second nine-row bar**:

```
Dashboard · Day View · Trade View · Notebook · Reports · Strategies · Trade Replay ·
Progress Tracker · Resources        (+ an Add Trade button)
```

Fifteen destinations across two persistent bars. Top-right of the shell: `Zella AI`, Notifications.

**The rows are their product lines, not the trader's questions.** Home, Backtesting, Agents, Mentor
Mode and PropFirm Sync are five separately-marketed things; the actual product a journaling user lives
in is one row of six, and it needs nine of its own. That is an org chart rendered as an IA.

**A persistent filter bar** sits under the header on nearly every page: a date-range button
(`Jul 11, 2026-Aug 10, 2026`), an account combobox (`All accounts`), and a `$` control that toggles the
display unit. The range is carried in the URL (`?startDate=…&endDate=…`), so state is shareable.

`Journal → Dashboard` also carries **`Last import: Jul 21, 2026 08:33 PM` with a `Resync` button**, and
a `Start my day` button. Same freshness instinct as Monarch's `22 hours ago`, made explicit.

### 2.1 Home — an AI launcher, not a dashboard

Read 2026-08-10 and **materially different from the `recon.md` reads of 2026-07-07/09.** Home is no
longer a dashboard at all:

- `Good afternoon, Luke` (same time-of-day greeting convention as Monarch).
- A large **Ask Zella AI** input with a character illustration and four seeded prompts: *"Rule breach
  risk today?"*, *"Review last week's P&L"*, *"What sessions worked best?"*, *"What should I focus on
  today?"*, plus *"Ask Zella anything"*.
- `Explore Products` — PropSync / Journal / Backtesting / Agents, each a one-liner.
- `Recommended focus` — Today's rule status · Drawdown cushion check · Latest trades review · Payout
  progress check.
- `Resources` — PropSync dashboard guide · Join the Discord (25,000+ traders) · What's new.

So the front door is a chat box plus a link farm. Nothing on it is *your* state. Compare Monarch's
dashboard, which answers "where do I stand" in one screen and attaches the AI to each answer.

### 2.2 Journal → Dashboard

KPI strip: `Net P&L` (183 trades, `-$4,008.96`) · `Trade win %` 43.72% with a 80/0/103 W/BE/L split ·
`Profit factor` 0.76 · `Day win %` 57.14% (4/0/3) · `Avg win/loss trade` 0.98 ($161 / -$164). Each stat
carries an info control.

Then: **`Zella score`**, a 0–100 gauge reading 43.45. Then **Progress tracker**, a GitHub-style
contribution heatmap (Sun–Sat × May–Aug, `Less`→`More`) with `Today's score 0/5` and a
`Daily checklist` control. Then `Daily net cumulative P&L` and `Net daily P&L` charts. Then tabs
`Recent trades | Open positions`. Then a **P&L calendar**: a month grid where each day cell shows net $,
trade count and win %, with icons for a note and for `N economic events`, and a right-hand column of
weekly rollups (`Week 3  -$3.5K  5 days`). Then `Account balance`, `Drawdown`, `Trade time performance`,
`Trade duration performance`.

The calendar and the weekly rollup column are genuinely good and are a convention traders already expect.

### 2.3 Day View, Trade View, Notebook

- **Day View** — `Day | Week` toggle, then one collapsible card per session: date, `Net P&L -$563.5`,
  **`Review with Zella AI`**, `Add note`, **`Insights 1`** (a count of AI findings attached to that day),
  and a stats strip (Total Trades, Gross P&L, Winners/Losers, Commissions, Win Rate, Volume, Profit
  Factor). **This is the closest thing in the field to Run's "after" ritual surface.**
- **Trade View** — the atomic ledger. `select all` + `Bulk actions`; columns Open date / Symbol / Status
  (`LOSS`) / Close date / Entry price / Exit price / Net P&L / Net ROI / **Zella Insights** / **Zella
  Scale**.
- **Notebook** — a full notes app: folders `All notes (49) · Favorites · Trade Notes (40) ·
  Daily Journal (9) [Log day] · Sessions Recap (0) [Log session] · My notes · Tags · Trash`, search, and
  filters. **Note what this is: the daily journal and the session recap are things the trader types.**
  Monarch's recap is generated and arrives. TradeZella's is a blank page with a folder around it.

### 2.4 Reports

Tabs: `Performance [NEW] · Overview · Reports (menu) · Compare · Calendar · Recaps & Insights`.

- **Performance** — a metric combobox (`NET P&L`), `Export PDF`, **composable charts** (`Net P&L -
  cumulative` with a `+ Add metric` control), a `Summary | Days | Trades` toggle, and a grid of ~16
  metrics including Trade expectancy, Avg planned R-multiple, Avg realized R-multiple, Avg hold time,
  Logged days, Max/Avg daily net drawdown.
- **Overview** — a ~45-row dump of every stat the product computes, unranked.
- **Compare** — build two cohorts (`Group #1` / `Group #2`, each filtered by Symbol / Tags / Side /
  date range / Trade P&L) and `Generate Report`. A/B your own trades. Good idea, buried six tabs deep.
- **Recaps & Insights** — a **library of generated documents**: filter chips `All · First Import
  Analysis · Monthly Recap · Weekly Recap`, columns `TYPE · CREATED · ACCOUNT · DATE RANGE · TRADES ·
  STATUS`. **So a periodic generated recap is a first-class object here** — a correction to the older
  `recon.md` read that treated Zella AI as purely credit-metered on-demand tasks. *Precision on the
  evidence: the three types exist as filters and the library is real; the only rows present in Luke's
  inactive account were two `First Import` reports, so whether Weekly/Monthly actually fire on a live
  subscription was not observed.*

**The quality of one, read in full** (First Import, 187 trades over 9 days). Titled *"What your trade
data reveals"*. Four metric cards, each with a verdict word and a one-line gloss:
`WIN RATE / GOOD / 46.0%`, `PROFIT FACTOR / WATCH OUT / 0.83`, `AVG WIN/LOSS RATIO / WATCH OUT / 0.97`,
`MAX DRAWDOWN / WATCH OUT / 1644.2%`. Then a `Key Takeaway`, then a 9-card carousel of explainers.

Two observations, and they point in opposite directions:

- The **frame** is strong: verdict labels beat bare numbers, and "what your trade data reveals" is the
  right promise.
- The **content is the field's known failure**. The Key Takeaway's advice is *"Focus on reducing losses
  and improving trade quality (profit factor, win/loss ratio, Sortino) rather than increasing trade
  frequency to raise your Zella Score"* — true of any losing trader. Card 1 opens *"Profit factor
  compares gross profits to gross losses; a value >1.5 is strong…"*, which is a **textbook definition**,
  not a read of Luke. No pattern is named, no time of day, no setup, no dollar cost of a specific
  behaviour. This is `competitor-failures.md` §4 confirmed first-hand on real data, in the product's
  flagship AI artifact.
- And `MAX DRAWDOWN 1644.2%` is **a number that cannot be right**, displayed with a verdict attached.
  `competitor-failures.md` §1 confirmed first-hand, in the same artifact.

### 2.5 Progress Tracker — the rules engine, and the one thing worth taking whole

A four-step onboarding introduces it as *"Improve your trading discipline to become a better trader."*

The page: `Today's progress 0/5` · `Current streak 0 days 😐` · the contribution heatmap ·
`Daily checklist, Aug 10` showing each rule as actual-vs-target (`Start my day by: None / 09:30`,
`Net max loss /day: $0 / $100`) · `Current period score 2%` · and then the table that matters:

| RULE | CONDITION | RULE STREAK | AVERAGE PERFORMANCE | FOLLOW RATE |
|---|---|---|---|---|
| Start my day by 09:30 | 09:30 | 0 | **14:07** | 0% |
| Link trades to playbook | 100% | 0 | 0% | 0% |

**`AVERAGE PERFORMANCE` against a stated `CONDITION` is stated-intent-versus-actual, measured.** You said
09:30; you average 14:07. `widening-plan.md` §3.2 identifies exactly this — *"the number he said out loud
while calm, against what he then did"* — as the genuinely non-derivable part of Run's corpus. **TradeZella
already collects it.** That is worth knowing before Run builds it as though it were novel.

The `Rules` editor groups rules into three phases — **`PREPARE` / `TRADE` / `REFLECT`** — each with
`+ Add rule`. Also present: trading-day toggles (Mo–Su), *"Send an email reminder when I'm about to lose
my streak"* at 20:45, and *"Changes you make will only update your scoring for today and for future
days"* (honest: no retroactive rewrite). The rules themselves are self-set static thresholds
(`Net max loss /trade`, `Net max loss /day`, `Trading hours`, `Start my day by`), and two of them
(stop-loss present, max loss per trade) are filed under `REFLECT`, which is a taxonomy slip.

**PREPARE / TRADE / REFLECT is Run's before / during / after.** The skeleton is already in market. The
difference Run has to earn is not the three phases — it is that the content of each phase comes from a
model of the trader rather than from a checklist he wrote once.

### 2.6 PropFirm Sync — richer than the docs assume

Header *"Welcome back, Luke / Here's an overview of your prop firm activity"* `[Beta]`. Toolbar: Plaid
`Bank connections`, `Filters`, `Log payout`, `Track prop firm account`, and a view switcher
`dashboard | accounts | transactions`.

- KPIs: funded count and size (`$150,000`), eval count, `Total spent $278` (evaluation fees & resets),
  `Total earned $0` (payouts received), `Net total -$278`, `-100% ROI`.
- **ROI Progression** — cumulative net return on the *cost of trying*, over time.
- **Finance breakdown** — `By firm · By account type · By account size · Expenses`.
- **Passing insights** — *"Understand your passing rates across different dimensions"*, tabbed
  `By firm · By account type · By account size · By strategy`, with the definition stated inline
  (*"Passing rate = accounts passed / accounts attempted"*).
- **Breach insights** — *"Understand why your accounts get breached and spot patterns."* Tabs
  `Evaluation Breaches · Funded Breaches`.

**This qualifies a claim Run's docs lean on.** `recon.md`'s "the absent category" says nobody sells
studying your blown accounts. A surface literally titled **Breach insights** now exists. It analyses
breaches *from TradeZella's own synced record*, so the ephemeral-capture argument in `context.md` is
untouched — what has narrowed is the **positioning** gap, not the data one. Run should stop treating
"study your failures" as unclaimed language.

### 2.7 Agents, Backtesting, Strategies, Trade Replay, Mentor Mode

- **Agents** — `My Agents 1 of 3 active`, *"Agent runs count toward your monthly AI credit limit"*,
  `AI Settings`. Each agent shows trigger, mode and price: Market Sentiment Briefing (trigger
  `Start my day`, Manual, **~10.88 credits/run**), Trade Auto-Tagger (`On every imported trade`,
  Automatic, ~2.26), Session Review (`Journal — Day view`, Manual, ~7.78, *"Generates a narrative review
  of your trading session"*). **Credit metering is unchanged since the 2026-07-07 read** and remains the
  structural reason their AI cannot be ambient: a presence that costs 10.88 credits to speak is a
  presence you ration.
- **Backtesting** — two doors: `Backtest on your own` (bar by bar) and `AI Automated Backtesting [BETA]`
  (*"Describe your rules and let Zella AI run hundreds of trades"*).
- **Strategies (Playbooks)** — `My Strategies (0) · Shared with me · Templates · Backtest Scenarios`,
  `Active | Archived`. Empty state: *"Build your trading strategy / List your rules, track and optimize
  your strategy."* This is the tagging spine the rest of the app references (`Link trades to playbook`,
  `Check my last trades against my playbook`, `Passing insights → By strategy`).
- **Trade Replay** — *"Relive Your Trades… second-by-second by analyzing your real-time execution,
  emotions, and decisions."*
- **Mentor Mode** — hard-paywalled, and it failed loudly: the page rendered
  **`402 / Payment is needed / It seems like you need to create a subscription`**. A raw HTTP status
  code shown to a paying-tier user is a craft failure worth remembering as a counter-example.

### 2.8 Zella AI — the best-built thing they ship

A right-hand panel with `AI usage · Settings · Chat history · Maximize · More · Close`. Greeting:
*"Hey Luke. I'm Zella. I don't just analyze your trades — I can tag them, build playbooks, track your
rules, and take the work off your plate."*

- **It states its calling context: `Opened from: Dashboard`** — and on the Reports page it read
  `Opened from: Reports · compare`.
- **Its suggestions change with that context.** Dashboard offered *"What's hurting my performance?"* and
  *"Summarize my recent trades"*; Reports·compare offered *"Explain this report"* and *"What should I
  focus on?"*.
- **A separate `TAKE ACTION` group** — *"Tag my last 20 trades by setup"*, *"Find and flag my worst
  pattern"*, *"Check my last trades against my playbook"*, **"Add a rule to block my worst setup"**.
  These write, they do not answer. That is genuinely agentic and it is **ahead of Monarch's assistant**,
  which is read-only.
- Shortcuts surfaced inline (`↵` send, `⇧↵` new line, `Esc` close, `⌘K` new chat), file attach with a
  drop zone, a `Medium` control, and the footer *"AI can make mistakes. Not financial advice."*

### 2.9 Visual signature (five lines, character only)

Page `#f6f6f6`, ink **pure `rgb(0,0,0)`**, **the system font stack** (`-apple-system, …, Roboto, …`) —
no chosen typeface anywhere. Cards `10px` radius, **no shadow**, hairline borders. Charts are
**Highcharts 12.1.2** defaults. Growth badges live in the primary nav (`BETA`, `NEW`) and an inactive
subscription paints a red-bordered banner onto every page in the app.
**Unchanged from the 2026-07-07 read: "plain-strong, restrained but not crafted."** Restraint by absence
of decisions rather than by decision.

---

## 3. The structural comparison

| | **Monarch** | **TradeZella** |
|---|---|---|
| Nav levels | 1 (11 rows) | 2 (6 + 9 = 15) |
| Organising principle | the user's questions, ordered by time horizon | the company's product lines |
| Front door | your state, glanceable, AI attached per widget | a chat box and a link farm |
| Depth | in the page header | a second permanent bar |
| Cross-cutting filter | per widget / per page | one global bar (date + account + unit) |
| Freshness | `22 hours ago` on every account row | `Last import: …` + `Resync`, once |
| AI placement | per-widget button · global panel · generated recap | global panel (context-aware, can act) · credit-metered agents · recap library |
| AI cost model | unmetered in-product | **credits per run**, shown per agent |
| AI content quality | names merchants, compares periods, paces vs plan | verdict labels over metric definitions |
| Ritual | generated, staged, arrives weekly | a checklist you tick + a blank note you type |
| Nav badges | one work-queue count (24) | `BETA`, `NEW` |
| Typeface | ABC Oracle, one family | system stack |
| Ink | `rgb(34,32,29)` | `rgb(0,0,0)` |
| Trims its own IA | **yes** — Cash Flow is being removed into Reports | no |

**The one-line version.** Monarch is one flat nav ordered by the questions a person asks about their
money, with the AI everywhere and a nav row nowhere. TradeZella is a catalogue of six products, one of
which contains nine more, with the best conversational surface in the field bolted onto it and metered
by the run. **Run wants TradeZella's domain surfaces inside Monarch's architecture.** The argument is in
[`monarch-for-traders.md`](monarch-for-traders.md).

---

**Method note for whoever re-runs this.** `chrome-devtools take_snapshot --filePath` resolves relative to
the *daemon's* cwd, not yours — pass an absolute path. TradeZella renders almost nothing as `<a href>`;
`document.querySelectorAll('a[href]')` returns zero and the a11y snapshot is the only reliable read,
which is the MUI gotcha the playbook warns about. Monarch's chart internals are `application`/`group`
nodes with no accessible content, so chart *types* had to be read from the option lists rather than the
rendered SVG. Screenshots for both apps are in [`screenshots/`](screenshots/), dated `2026-08-10`.
