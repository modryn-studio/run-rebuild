# Wireframes — Run v1

> Phase 2 artifact. **Boxes and labels only. No color, no type, no polish.**
> Low fidelity is deliberate: this validates *structure*. Pretty wireframes make people
> critique the styling instead.
>
> Structure below is derived from the **actual accessibility markup** of Monarch's Accounts and
> Transactions pages, read live 2026-08-11 via the chrome-devtools CLI — not inferred from
> screenshots. Where a Monarch element is carried over, it's cited.

---

## The shell (every page)

```
┌────────────────┬──────────────────────────────────────────────────────────┐
│  RUN           │  [Page title]              [Filters] [Add account]       │
│                │  ┌────────────────────────────────────────────────────┐  │
│  Today         │  │ date range ▾   ·   account ▾                       │  │
│  Accounts      │  └────────────────────────────────────────────────────┘  │
│  Trades        │                                                          │
│  Read          │   PAGE BODY                          ┌────────────────┐  │
│                │                                      │  Summary rail  │  │
│  ──────────    │                                      │  (digests the  │  │
│  Settings      │                                      │   FILTERED set)│  │
│  Luke          │                                      └────────────────┘  │
└────────────────┴──────────────────────────────────────────────────────────┘
```

- Sidebar: fixed ~224px, collapsible. **One level. Four rows.** (P1, P2)
- Divider, then Settings and profile. No AI row — not in v1.
- Filter bar carried in the URL so state is shareable (TradeZella does this better than
  Monarch; a trader's questions are always scoped to a period and an account).
- **Sub-navigation lives in the page header, never the sidebar.**

---

## 1. Accounts — *"what I have"*

Structural source: Monarch `/accounts`, read live. Hero with metric selector → grouped rows
with per-group totals → summary rail.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Accounts                          [Filters]  [Refresh]  [+ Add account] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌ NET P&L ▾ ┐  [Performance]  [1 month ▾]                              │
│                                                                          │
│      -$4,008.96                                                          │
│      +$1,292.56 (0.4%)   1 month change                                  │
│      ┌────────────────────────────────────────────────────────────┐      │
│      │                  equity curve                              │      │
│      └────────────────────────────────────────────────────────────┘      │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│  ▸ FUNDED                        -$2,140.00 (-1.2%)   1 month   $150,000 │
│    ┌────────────────────────────────────────────────────────────────┐    │
│    │ Apex (...3685)      Funded 50K    ▁▂▃▅▃   -$1,204.00   2h ago  │    │
│    │ FTDFY (...4873)     Funded 100K   ▃▄▂▁▂    -$936.00    2h ago  │    │
│    └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ▸ EVALUATION                       -$278.00 (-100%)  1 month     $50,000│
│    │ Topstep (...1140)  Eval 50K      ▂▁▁▁▁     -$278.00   2h ago  │     │
│                                                                          │
│  ▸ CLOSED                                        3 accounts · held       │
│    │ Apex (...9921)     Breached 06-14  ▃▂▁     -$2,510.00  archived │   │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                            ┌───────────────────────────┐ │
│                                            │ Summary                   │ │
│                                            │ [Totals | Percent]        │ │
│                                            │ Net P&L        -$4,008.96 │ │
│                                            │ Funded         -$2,140.00 │ │
│                                            │ Evaluation       -$278.00 │ │
│                                            │ Closed         -$1,590.96 │ │
│                                            │ ───────────────────────── │ │
│                                            │ Fees paid         $412.30 │ │
│                                            │ [Download CSV]            │ │
│                                            └───────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

**Carried from Monarch, deliberately:**
- **Hero is a metric selector, not a fixed title** — `NET WORTH ▾` becomes `NET P&L ▾`.
- **Group headers are rows that carry their own change and total** (`Loans $1,350.00 (-0.4%)`).
- **A freshness stamp on every row, always** (`17 hours ago`). This is S4 and it is the direct
  answer to "sync dies quietly" (P5).
- **Sparkline per row.**
- **Right rail with Totals/Percent toggle and Download CSV.**
- **Inline affordance where data is missing** — Monarch renders `Set credit limit` straight
  into the row rather than sending you to settings. Run's equivalent: `Add account type`.

**Changed for Run:**
- Grouped by **account state** (Funded / Evaluation / Closed), not by product type.
- **`CLOSED` is a permanent group, not an archive you dig for.** A breached account keeps its
  history and stays visible — this is the corpus made concrete on the first screen (S7).
- `+ Add account` opens the CSV upload flow (S1), which is where the critical path starts.

---

## 2. Add account (CSV) — *the critical path, step 1*

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Add account                                                    [Cancel] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   1 ─ Which account is this?                                             │
│       ( ) Funded     ( ) Evaluation     ( ) Personal                     │
│       ⓘ This is recorded per connection. It changes nothing you see —    │
│         Run needs it to keep firm accounts and personal accounts honest. │
│                                                                          │
│   2 ─ Upload your export                                                 │
│       ┌────────────────────────────────────────────────────────────┐     │
│       │        Drop your Tradovate export here, or browse          │     │
│       └────────────────────────────────────────────────────────────┘     │
│       ▸ How to export from Tradovate      (inline steps, not a link out) │
│       ▸ Coming from TradeZella?           (inline steps)                 │
│                                                                          │
│   3 ─ Confirm before anything is saved                                   │
│       ┌────────────────────────────────────────────────────────────┐     │
│       │  187 trades found · Jun 3 – Aug 8, 2026                    │     │
│       │  0 rejected · 0 duplicates of data you already have        │     │
│       │                                          [Import 187]      │     │
│       └────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────────┘
```

**Nothing commits until step 3.** The count, range and rejects are shown *before* the write
(S1). This is the first trust moment in the product and it happens before a single figure is
displayed.

**Empty state:** *"Upload your Tradovate export to get started."* with the export steps inline
— not in a help article (P9).

---

## 3. Trades — *"what happened"* — critical path step 2

Structural source: Monarch `/transactions`, read live. Date-header grouping carrying that day's
net, row-level detail, right rail digesting the **filtered** set.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Trades          All · By session          [Search] [Date] [Filters] [⇱] │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Aug 8, 2026 · session          -$563.50    12 trades    41% win    │  │
│  ├────────────────────────────────────────────────────────────────────┤  │
│  │ 09:31  MNQ  Long  2   19,204.25 → 19,198.00   -$62.50   ⓘ  [›]     │  │
│  │ 09:47  MNQ  Long  2   19,199.50 → 19,191.25   -$82.50   ⓘ  [›]     │  │
│  │ 10:02  MNQ  Long  4   19,190.00 → 19,183.75   -$125.00  ⚑  [›]     │  │
│  │        └ sized up after 2 losses                                   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Aug 7, 2026 · session          +$318.75     8 trades    62% win    │  │
│  │ ...                                                                │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ ⚠ 2 trades quarantined — excluded from every figure on this page   │  │
│  │   Fees missing from the export.               [See the 2 trades]   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────┤
│                                            ┌───────────────────────────┐ │
│                                            │ Summary                   │ │
│                                            │ Trades              187   │ │
│                                            │ Sessions             23   │ │
│                                            │ Net P&L      -$4,008.96   │ │
│                                            │ Fees            $412.30   │ │
│                                            │ Largest win       $486.25 │ │
│                                            │ Largest loss     -$512.50 │ │
│                                            │ Win rate           43.7%  │ │
│                                            │ First trade      Jun 3    │ │
│                                            │ Last trade       Aug 8    │ │
│                                            │ [Download CSV]            │ │
│                                            └───────────────────────────┘ │
│  ⓘ From your Tradovate export of Aug 11, covering Jun 3 – Aug 8.         │
└──────────────────────────────────────────────────────────────────────────┘
```

**Carried from Monarch:**
- **Date header carries that period's net** (`August 5, 2026  +$1,337.35`). Run's header is the
  **session** — CME trade date — carrying net, count and win rate.
- **Right-rail digest of the filtered set**, not of everything (P6). Monarch's is
  `Total transactions / Largest / Average / First / Last`; Run's is the trading equivalent.
- **Row detail opens a drawer** (`Open transaction details`).
- Toolbar: Search, Date, Filters, toggle summary.

**Changed for Run:**
- **No editable comboboxes.** Monarch's merchant and category cells are live comboboxes because
  categorisation is the user's job. **Run has no equivalent — S9 is cut.** The record is the
  broker's, so rows are read-only and the trust note names provenance instead (P8).
- **Quarantine is visible, not silent** — excluded trades are shown as excluded (S2, P12).
- **The `⚑` flag marks a trade a pattern was drawn from** — the link between Trades and Read.

---

## 4. Read — *"what it means about me"* — critical path step 3

**Daily**, not weekly. **A page**, not a modal. **Generated on arrival**, never a blank page.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Read                    Patterns · History              [Aug 8, 2026 ▾] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Friday's session                                                       │
│                                                                          │
│   ┌────────────────────────────────────────────────────────────────┐     │
│   │  YOUR PATTERN                                                  │     │
│   │  You size up 40–60% after three losses.                        │     │
│   │                                                                │     │
│   │  YESTERDAY   It happened once, at 10:02. It lost $340.         │     │
│   │  THIS WEEK   9 of 12 times.  −$4,200.                          │     │
│   │  ALL TIME    31 times since Jun 3.  −$7,410.                   │     │
│   │                                                                │     │
│   │  ── the working ───────────────────────────────────────────    │     │
│   │  This happened 12 times. 9 lost.                               │     │
│   │  Your usual loss rate is 54%.                                  │     │
│   │                                                                │     │
│   │  [The 9 sessions]   [The 31 trades]                            │     │
│   └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│   ⓘ This read covers your Apex (...3685) and FTDFY (...4873) accounts,   │
│     from your Tradovate export of Aug 11, Jun 3 – Aug 8.                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**The daily read paces one pattern — it does not discover a new one each day.** Patterns are
longitudinal; a daily promise of fresh revelation invents them by day four. The three rows
(yesterday / this week / all time) are the corpus compounding in view.

**Always show the working.** The user judges the confidence themselves — P8 applied to the
wedge. The baseline comparison is against *the trader's own* rate, never a general standard.

**Writing standard (P11):** names the specific instance, compares to the prior period, paces
against something. Never a metric definition, never a sentence true of any losing trader.

### The other two daily states

**`Quiet` — the pattern didn't occur yesterday. This is good news and is said out loud:**

```
   ┌────────────────────────────────────────────────────────────────┐
   │  YOUR PATTERN                                                  │
   │  You size up 40–60% after three losses.                        │
   │                                                                │
   │  YESTERDAY   It didn't happen. You had two losses in a row     │
   │              at 10:14 and kept your size.                      │
   │  THIS WEEK   3 of 9 times.  −$890.                             │
   └────────────────────────────────────────────────────────────────┘
```

**`Watching` — a candidate below the floor. Named as a candidate, never costed as a finding:**

```
   ┌────────────────────────────────────────────────────────────────┐
   │  WATCHING                                                      │
   │  You may be trading the first five minutes at a loss.          │
   │                                                                │
   │  5 times so far. Run needs 8 before it will call this real,    │
   │  and it wants to see it separate from your usual rate first.   │
   └────────────────────────────────────────────────────────────────┘
```

`Watching` turns the thin-data early days into something interesting rather than a dead screen,
and makes the corpus legible from session one instead of session fifteen.

### Read → History

The tab neither competitor has.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Read                    Patterns · History                              │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Sizing up after losses          named Jul 14   $4,215  ↑ 41%   ⚠  │  │
│  │ Trading the first 5 minutes     named Jun 28   $1,090  ↓ 62%   ✓  │  │
│  │ Holding losers past your stop   named Jun 12     $340  ↓ 88%   ✓  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Run named 3 patterns. 2 have improved since.                            │
└──────────────────────────────────────────────────────────────────────────┘
```

**Why this is the spin.** Monarch's recaps are disposable — read once, gone. TradeZella keeps a
library of documents. Neither answers the only question that matters about a behavioral read:
**"you told me about this last month — did it get better?"** A competitor cannot clone this in
a week because they have no history of ever having told you anything.

---

## 5. Today — *"where do I stand"* — the front door

Structural source: Monarch's dashboard widget contract, applied unchanged.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Good afternoon, Luke                                       [Customize]  │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────┐  ┌──────────────────────────────────┐  │
│  │ Today's read            [›]  │  │ Net P&L            [1 month ▾]   │  │
│  │                              │  │                                  │  │
│  │ You size up after losses,    │  │   -$4,008.96                     │  │
│  │ and it costs you.            │  │   +$1,292.56 (0.4%)              │  │
│  │                              │  │   ▁▂▃▅▃▂▁▃▅                      │  │
│  │ [Read it]                    │  │                                  │  │
│  └──────────────────────────────┘  └──────────────────────────────────┘  │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────┐  │
│  │ Accounts                [›]  │  │ Last session          Aug 8  [›] │  │
│  │ 2 funded · 1 eval · 3 closed │  │   -$563.50 · 12 trades · 41% win │  │
│  │ all read 2h ago              │  │                                  │  │
│  └──────────────────────────────┘  └──────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

**The widget contract, copied wholesale from the teardown:**

| Part | Behavior |
|---|---|
| Title | links to the full page for that concept |
| Headline value | one number, with its delta |
| Scope control | a small combobox *inside* the widget |
| Body | a chart, a list, or an empty state with a specific CTA |

**Time-of-day greeting** — both Monarch and TradeZella do it; it's a convention, adopt it.

**The front door is your state, not a chat box** (P4). This is the single clearest thing
TradeZella got wrong.

**Empty state, per widget, specific (P9):** *"No accounts yet. Add your Tradovate export and
Run will read it."* — never a generic "no data" plate.

---

## Open questions these wireframes raise

1. **Does Add-account collapse into Accounts?** Drawn as a separate flow off `+ Add account`.
   It may be one continuous motion — decide when it's built, not now.
2. **Does `Read` show one pattern or several?** Drawn as **one**, which matches the value claim
   and is the bolder choice. Still Luke's call.
3. **Does `Today` need a fourth widget?** Four is drawn; three may be enough.
4. **Sparklines on account rows** — carried from Monarch, but an equity curve per account may
   be more useful to a trader than a shape. Cheap to test later.
