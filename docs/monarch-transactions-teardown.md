# Monarch's transactions page, torn down for Run's `/trades`

*2026-09-04. Read out of the running app's DOM on Luke's authenticated tab via the standalone
chrome-devtools CLI (v1.8.0, `--pageId 2`), at 1280×900 and 1440×900. Every control, menu, filter
axis and panel field below was pulled with `evaluate_script` or `take_snapshot`; screenshots were
taken and looked at, but nothing here is inferred from pixels.*

> **DESKTOP ONLY, AND THAT IS A RULE NOW.** Nothing in this document was read below `md`.
> `app.monarch.com` narrowed is a desktop table squeezed — it scrolls horizontally and clips its own
> rows — not a designed phone screen. Monarch's considered phone product is a native app the browser
> cannot reach, and Luke supplies it as screenshots. See CLAUDE.md → Tooling, and
> `scar-tissue.md` → *"Monarch's phone reference is the NATIVE APP"*, which is the incident that
> produced the rule. **Any phone claim about the reference comes from Luke's screenshots or it does
> not go in.**

**The question this answers:** Monarch's transactions page is the closest thing in the reference to
Run's `/trades`. What does it carry that Run does not, and which of those are worth having?

**The short answer:** six gaps, one of which shipped the day this was written. Most of the rest of
Monarch's surface is an *edit* path, and Run refuses every edit path by doctrine — the record is the
broker's. The two findings worth the most are not features at all: they are places where Monarch
makes its own provenance visible, which is the exact claim Run is built on and currently states more
quietly than Monarch does.

---

## 1. What is on the page

Read off the DOM at 1280×900.

**Page band:** `Transactions` · tabs `All` / `Receipts` / `Retail Sync` · `Search` · `Date` ·
`Filters` · `+ Add` · a summary-panel toggle.

**List toolbar:** a household-member selector (`All transactions` / `Anyone` / `Luke`) ·
`Edit multiple` · `Sort` · `Columns`.

**The list:** date group bands (date left, that day's net right, on a grey band), then rows.

**The row** — inert (`cursor: auto`, no hover rule anywhere on it), with four independent targets:

| Cell | What it is |
|---|---|
| Merchant | a `combobox` (edit in place) plus a hover-revealed link to `/merchants/<id>` |
| Category | a `combobox` plus a hover-revealed link to `/categories/<id>` |
| Account | `<a href="/accounts/details/<id>">`, bordered pill on hover, `arrow-right` fades in |
| Amount | static text, not a target |
| Chevron | `<button aria-label="Open transaction details">`, 32×32, always visible |

Right-click anywhere on the row opens a context menu: `Reviewed` · `Needs review by` · `Tags`.

**The summary rail** (320px, toggled from the band): Total transactions · Largest transaction ·
Largest expense · Average transaction · Total income · Total spending · First transaction · Last
transaction · Download CSV.

**The detail panel** — URL-addressable at `/transactions/<id>`:

`Previous transaction` (disabled at the top of the list) · `Next transaction` · `Mark as reviewed` ·
merchant (editable, links to `/merchants/<id>`) · amount · **account name as a link** ·
`View 2 transactions` (the merchant's others) · **`ORIGINAL STATEMENT`** with the raw provider string
and a `Copy` button · `Explain transaction` (AI) · Date (editable) · Category · `Split` ·
`Spend from save up goal` · Notes · Tags · `Needs review by` · Attachments · **`Activity · 4 events`**
(expandable) · `Delete transaction`.

**`Sort`:** Date (new→old) · Date (old→new) · Amount (high→low) · Amount (low→high).

**`Columns`:** `2 of 2 visible` — Category, Account.

**`Filters`** — a tabbed panel with a `N filters selected` / `Clear` / `Cancel` / `Apply` footer:

- **Categories · Merchants · Accounts · Tags · Goals**
- **Amount:** Greater than… / Less than… / Equal to… / Between… · Type: Debits only / Credits only
- **Other:** Needs Review by · Recurring · Has Attachments · Split · Notes ·
  **Syncing (Synced from institution / Not synced)** · Investments · Pending ·
  **Hidden (Hidden only / Hidden and not hidden)**

No global keyboard-shortcut overlay — the `?` hint in the panel is scoped to its date picker.

---

## 2. The gaps, and what Run's version is

### 2.1 The account is a link in the detail panel — **SHIPPED 2026-09-04**

Monarch's panel renders the account as `<a href="/accounts/details/<id>">`, and the breadcrumb on
the page it lands on then reads `Transactions › Account`.

Run's drawer and `/trades/[id]` rendered it as a plain string, and both files carried a comment
promising *"it becomes a link when that page lands"*. It landed in `S6d`. Shipped the same day as
the tape's own account cell, sharing one mechanic and one origin map (`nav-origin.ts`).

**The trap, recorded because it is not obvious:** the phone's `TradeSheet` owns a history entry via
`useOverlayBack`, so a navigation committed from inside it needs the hook's returned marker or the
cleanup's `history.back()` unwrites it — the trader taps the account, the account page appears, and
the phone bounces straight back to the tape. The desktop drawer does not touch history at all and
`/trades/[id]` is a route, so neither needs it. Same race `overlay-back.ts` documents for the filter
sheet's Apply.

**And the phone's back mark needed the prefix, not an exact match.** On a desktop the drawer never
changes the URL, so the origin is `/trades`. On a phone the sheet owns `/trades/<id>`, so an exact
match sent every phone trader to the roster. Monarch settles the shape: its detail panel lives at
`/transactions/<id>` and its account crumb still reads `Transactions`. **The trail names the list the
trader was working in, not the row they had open on the way past.**

### 2.2 `Activity` — an append-only provenance log

Their panel ends with `Activity · 4 events`, expanding to:

> Added to Monarch — Sep 3, 2026, 11:39 PM **by Finicity**
> Merchant changed from Google Workspace to Google — Sep 4, 8:02 AM by Luke
> …

**This is the strongest find in the teardown**, and it is not a feature Run would be copying so much
as one it already has the machinery for and has not surfaced. `event` is append-only, corrections
append with `corrects_event_id`, and nothing may mutate. A trade's Activity reads: *"Imported from
Tradovate Position History — `<file>`, 3 Sep"* · *"Excluded — `<reason>`, 4 Sep"* · *"Re-synced —
4 Sep"*.

Run's whole claim is **"our numbers are the broker's numbers"**, and this is the one screen where a
trader doubts a number. Monarch naming its own data provider in that log is the same move, made by a
product with a weaker claim to make.

**Open:** which event kinds are trader-facing, and how an import run names itself in one line.

### 2.3 `Sort`

Date new→old / old→new, Amount high→low / low→high. Run has no sort at all: the tape is sessions
descending, entry descending inside one, and that ordering is load-bearing — `trades-tape.tsx`
records why sorting rows by the exit was visibly wrong.

*"Biggest loss first"* is the useful one for a journal. **Open, and it is the blocking question:**
sorting by amount across sessions either breaks the session bands or sorts only within them, and
those are different products.

### 2.4 An amount axis in `Filters`

Greater than / Less than / Equal to / Between, plus Debits only / Credits only.

Run has products, results (win/loss), accounts, dates and search — no magnitude. *"Every trade that
lost more than $500"* is a question a journal should answer and currently cannot. Run's win/loss
tokens already cover the sign, so only the magnitude half ports.

### 2.5 A state axis in `Filters`

Their `Other` tab carries **Hidden** (Hidden only / Hidden and not hidden) and **Syncing** (Synced
from institution / Not synced). Run's analogue is **excluded / quarantined**, which today can only be
found by scanning the rows for the warning mark.

**Half of this is a trap.** Monarch's default *hides* hidden rows. Run's doctrine is that an excluded
or quarantined trade stays visible and countable, and that an exclusion may never silently shrink the
record. Port the axis; never port the default.

### 2.6 The source line, copyable

`ORIGINAL STATEMENT` shows the raw provider string with a `Copy` button.

**Mostly already built:** Run's detail carries copyable `Pair` / `Buy fill` / `Sell fill` ids — the
only strings it holds that also appear in a Tradovate export. What is missing is *which import run
and which file* produced the row, which is the same thing §2.2 wants and should ship with it.

---

## 3. Where Run is already ahead

| | |
|---|---|
| Prev/Next in the detail | Run has it **plus** a `N of M` position and arrow-key stepping. Monarch has neither. |
| Summary rail | Monarch: 8 generic figures. Run: sessions, win rate, best/worst session, average win/loss — figures about *trading*, not about rows. |
| Filter feedback | Monarch shows `0 filters selected`. Run shows the selected values as chips. |
| Row hit area | Monarch's row is inert; only a 32×32 chevron opens the detail. Run's whole row is the target. See §4. |
| The breadcrumb | Monarch's crumb is a `role="link"` div with no `href` — no middle-click, no open-in-new-tab, nothing in the status bar — and it *pushes* a new history entry rather than returning (measured: `idx 1→2`). Run's is a real anchor. |
| Detail is URL-addressable | Both. `/transactions/<id>` ↔ `/trades/<id>`. |
| Columns · Search · Date · Filters · CSV | All present in Run. |

---

## 4. Refused by doctrine, not missing

**Every edit path.** `Edit multiple`, the row context menu (Reviewed / Needs review by / Tags), the
inline merchant and category comboboxes, the editable date, `Split`, Notes, Tags, Attachments,
`Delete transaction`, goal assignment, `+ Add`. Trades are not editable and the option is not
offered; a hand-typed trade is unreconcilable by construction.

**The household-member selector.** Monarch is a shared-finances product. Run is one trader.

**`Explain transaction`.** A per-row LLM call. Run's read is daily and budgeted (`ai-economics.md`),
and the LLM never computes a number.

**Chevron-only row activation.** Considered and rejected the same day — see `trades-tape.tsx`, which
carries the three reasons at the point of use. Briefly: their row has four peer targets and no
primary, so none of them can own it; opening the detail is Run's loop and theirs is inline
re-categorisation; and `S5d` already recorded, from the native app, that the reference's own phone
row is a whole-row tap with no chevron.

---

## 5. What this teardown is not

It is a list of options, not a plan. §2.2–§2.6 are filed as GitHub issues #50–#54 to be reasoned about
rather than scheduled, at Luke's instruction (2026-09-04): *"not necessarily things we must do, but
options that we could do."*
