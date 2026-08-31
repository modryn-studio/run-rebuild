# User guide — every screen, and how you get to it

> **A build reference, not a help page.** It answers "what screens exist, what does each one lead
> to, and what does Back do here" — for whoever is building the next slice, agents included. The
> trader-facing version is a different document and does not exist yet.
>
> **It covers the whole intended product, not just what ships today.** Screens that are not built
> carry a dashed border and their slice number. `build-plan.md` owns *when*; this owns *where*.

**Companions:** `spec.md` (what v1 is) · `architecture.md` (where state lives) · `build-plan.md`
(slice order) · `wireframes.md` (structure) · `design-system.md` §6 (how a phone screen behaves).

---

## Legend

```mermaid
flowchart LR
  A["A screen that ships"]
  B["Not built (S8)"]
  C["Overlay: sheet, modal, popover"]
  A -->|"a tap"| C
  A -.->|"planned"| B

  style B stroke-dasharray: 5 5
  style C stroke-dasharray: 2 3
```

- **Solid box** — built and deployed.
- **Dashed box** — planned, with the slice that owns it.
- **Dotted box** — an overlay rather than a route: it has no address of its own unless the label
  says otherwise.
- **Solid arrow** — a real navigation. **Dotted arrow** — planned.

---

## 1. The map

Everything reachable from a signed-in session. Below `md` (768px) the four roots live in the bottom
bar; above it they are sidebar rows.

```mermaid
flowchart TD
  Login["/login<br/>emailed code · Google"] --> Shell

  subgraph Shell["The shell — sidebar (desktop) / bottom bar (phone)"]
    Today["/today (S8)"]
    Accounts["/accounts"]
    Trades["/trades"]
    Read["/read (S7, blocked)"]
  end

  Accounts --> Detail["/accounts/details/[id]"]
  Detail --> AcctTape["/accounts/details/[id]/trades<br/>phone only"]
  Accounts --> AddAcct(["Add account"])
  Detail --> EditAcct(["Edit account"])

  Trades --> TradeDetail["/trades/[id]"]
  Trades --> Filters(["Filters"])
  AcctTape --> Filters

  Trades -.-> Product["/products/[root] (S10)"]
  Detail -.-> Product
  Trades -.-> Session["/sessions/[date] (S10)"]

  Shell --> Menu(["Account menu"])
  Menu -.-> Settings["/settings (S8b)"]
  Menu -.-> WhatsNew["/whats-new (S8b)"]
  Shell -.-> Notifs(["Notifications (S9c)"])

  style Today stroke-dasharray: 5 5
  style Read stroke-dasharray: 5 5
  style Settings stroke-dasharray: 5 5
  style WhatsNew stroke-dasharray: 5 5
  style Notifs stroke-dasharray: 5 5
  style Product stroke-dasharray: 5 5
  style Session stroke-dasharray: 5 5
  style AddAcct stroke-dasharray: 2 3
  style EditAcct stroke-dasharray: 2 3
  style Filters stroke-dasharray: 2 3
  style Menu stroke-dasharray: 2 3
```

**`/today` and `/read` are live rows that 404 today, on purpose** — `S8` and `S7` are coming for
them. `/settings` and `/whats-new` were *unplanned* rather than unbuilt until 2026-08-20; `S8b`
claims them, and until it lands the sidebar's gear ships `disabled` rather than pointing at nothing.

---

## 2. What Back does, and it is the same rule everywhere

Stated first because it is the rule most often broken, and because a phone has a Back button
whether or not a screen was designed for one.

> **Every screen has a visible way out, and the device Back button does exactly what that control
> does. The only place Back leaves the app is one of the four roots.**

```mermaid
flowchart TD
  Deep["A drill-in inside an overlay<br/>(Filters → Product)"] -->|Back| Overlay["The overlay's own root<br/>(Filters)"]
  Overlay -->|Back| Screen["The screen underneath<br/>(/trades)"]
  Screen -->|Back| Exit(["Leaves the app"])

  Child["A child route<br/>(/accounts/details/[id]/trades)"] -->|Back| Parent["Its parent<br/>(/accounts/details/[id])"]
  Parent -->|Back| Root["Its root<br/>(/accounts)"]
  Root -->|Back| Exit

  style Exit stroke-dasharray: 2 3
```

**The four roots are `/today`, `/accounts`, `/trades`, `/read`.** Back there minimises the browser,
which is what a native app does and what a trader expects. Anywhere else, Back is an in-app step.

**How it is implemented:** `useOverlayBack` (`src/lib/overlay-back.ts`). One history entry per
overlay LEVEL, pushed by the tap that opened that level, ordered by a module-level token array —
never by `history.state`, which Next copies forward onto neighbouring entries.

**Two rules that are load-bearing and were each learned the hard way:**

1. **An entry is pushed by a tap, never inside a `popstate` handler.** Chromium's history
   manipulation intervention discards an entry added with no user gesture behind it, *without firing
   `popstate`* — so a re-armed entry is silently skipped and the next Back walks out of the app.
   That is exactly what "the back button minimizes the entire chrome app" was.
   ([Chromium docs](https://chromium.googlesource.com/chromium/src/+/main/docs/history_manipulation_intervention.md))
2. **An overlay that COMMITS a navigation calls `markReplacing()`**, or its cleanup's
   `history.back()` reverts the write — inside one React commit every effect cleanup runs before
   anything else.

Both are in `scar-tissue.md` with the bug each one produced.

---

## 3. Signing in

```mermaid
flowchart TD
  Door["/login"] --> Email["Enter email"]
  Email --> Code["Enter the 6-digit code<br/>emailed, throttled"]
  Door --> Google["Continue with Google"]
  Code --> App["/trades"]
  Google --> App
  Code -->|"Send a new code"| Code
```

**An emailed code, not a magic link**, and the send throttle lives in Better Auth's `before` hook
rather than in `sendVerificationOTP`. `?next=` is attacker-supplied and always read through
`safeNext`.

---

## 4. Accounts

### 4a. The roster

```mermaid
flowchart TD
  Roster["/accounts<br/>chart · roster · summary rail"]
  Roster --> Filters(["Filters: accounts, status, type"])
  Roster --> Scope(["Scope chips — phone only"])
  Roster --> Add(["Add account"])
  Roster --> Row["A roster row"]
  Row --> Detail["/accounts/details/[id]"]
  Roster --> Hidden(["Hidden accounts flap"])

  style Filters stroke-dasharray: 2 3
  style Scope stroke-dasharray: 2 3
  style Add stroke-dasharray: 2 3
  style Hidden stroke-dasharray: 2 3
```

The roster never filters hidden accounts out in SQL — they sit in a disclosure flap, so a hidden
account is one tap from being un-hidden. An empty roster says *"No accounts yet"*; a roster a filter
emptied says *"No accounts match"*, which is a different sentence.

### 4b. Adding an account

Two doors, one level down, and a third that is deliberately dark.

```mermaid
flowchart TD
  Doors["Add account — the doors"]
  Doors --> Brokers["Brokers — 'Soon'"]
  Doors --> CSV["Import from CSV"]
  Doors --> Manual["Add manually"]

  CSV --> Pick["Pick the files"]
  Pick --> Run["Building your record<br/>no exit while it writes"]
  Run --> Label["Which account is this?"]
  Label --> Type["Which kind of account?"]
  Type --> Firm["Which firm?"]
  Firm --> Done["Imported"]

  Manual --> MType["Which kind?"]
  MType --> MFirm["Which firm?"]
  MFirm --> MSize["Size and quantity"]
  MSize --> Done

  style Brokers stroke-dasharray: 5 5
```

**Brokers leads even though it is dark**, because it is the answer most traders want and the row
says "Soon" rather than pretending. **Cash History is required on import, not optional** — the Fills
export's `commission` column measures 42% of true cost.

On a phone every one of these is a full-screen sheet, and the header renaming is what makes a screen
slide up as its own layer. **While a write is in flight the header shows no exit and the device Back
button is spent rather than obeyed.**

### 4c. One account

```mermaid
flowchart TD
  Detail["/accounts/details/[id]"]
  Detail --> Chart["Chart · range chips"]
  Detail --> Recent["Recent trades — 4 rows, phone"]
  Recent --> AcctTape["/accounts/details/[id]/trades"]
  Detail --> Tape["The whole tape — desktop, in place"]
  Detail --> Rail["Summary · Data"]
  Detail --> Edit(["Edit account"])
  Detail --> Import(["Import into this account"])
  AcctTape --> Filters(["Filters — account pinned"])

  style Edit stroke-dasharray: 2 3
  style Import stroke-dasharray: 2 3
  style Filters stroke-dasharray: 2 3
```

**`/accounts/details/[id]/trades` is phone-only and redirects to the parent above `md`** — nobody
navigates there on a desktop, since the button that leads to it is `md:hidden`, so what the redirect
covers is a pasted link. It is a route rather than a client-state layer because **search and the
filter write to the URL**: as a layer they would narrow the details page's own address with no
control left to clear it.

The account is **pinned** in that screen's filter sheet — shown as a chip with the firm's mark and
no `x`, so the Accounts axis states which account the tape is about rather than offering to change
it.

### 4d. Editing an account

```mermaid
flowchart TD
  Edit["Edit account"]
  Edit --> TypeScreen["Which kind of account?"]
  Edit --> FirmScreen["Which firm?"]
  TypeScreen --> Edit
  FirmScreen --> Edit
  Edit --> Close(["Close this account?"])
  Edit --> Delete(["Delete — only with 0 trades"])
  Edit --> Ending(["How did it end?<br/>on Save, after a type change"])
  Close --> Outcome["Ended / Failed / Passed<br/>by type"]

  style Close stroke-dasharray: 2 3
  style Delete stroke-dasharray: 2 3
  style Ending stroke-dasharray: 2 3
```

**Type and Firm are rows you can change, not screens you must pass through** — position is its own
state, so `type` only ever holds an answer and Back never has to erase one.

**The type and the status travel together.** `account_type_status_check` pairs them, so changing the
type of an account that has already ended asks for the ending again, in a modal of its own, on Save.
Relabelling as Personal has one possible ending, so it is taken rather than asked for.

| type | may be | asked as |
|---|---|---|
| unlabelled | `active` only | — |
| evaluation | active · passed · failed | Passed / Failed |
| sim_funded | active · failed · closed | Ended / Failed |
| personal | active · closed | not asked |

**A trade is never editable and the option is not offered.** A quarantined trade gets re-sync or
exclude-with-a-reason; neither writes to the trade, and an excluded trade stays visible and
countable.

---

## 5. Trades

### 5a. The tape

```mermaid
flowchart TD
  Trades["/trades<br/>tape · session bands · rail"]
  Trades --> Row["A row"]
  Row --> Drawer(["Trade drawer — desktop"])
  Row --> Sheet["/trades/[id] — phone"]
  Trades --> Search(["Search"])
  Trades --> Date(["Date range"])
  Trades --> Filters(["Filters"])
  Trades --> Columns(["Columns — desktop"])
  Trades --> Export(["Export CSV"])
  Trades --> RailToggle(["Summary — phone drawer"])

  style Drawer stroke-dasharray: 2 3
  style Search stroke-dasharray: 2 3
  style Date stroke-dasharray: 2 3
  style Filters stroke-dasharray: 2 3
  style Columns stroke-dasharray: 2 3
  style Export stroke-dasharray: 2 3
  style RailToggle stroke-dasharray: 2 3
```

**`/trades/[id]` is a real route and an overlay at the same time.** Tapping a row pushes the address
without unmounting the tape — the row's data is already in hand, so there is no fetch and no loading
state. Opened cold, the same address renders server-side.

### 5b. The filters, and where the two surfaces diverge

```mermaid
flowchart LR
  subgraph Desktop["Desktop — three popovers in the band"]
    D1["Search"]
    D2["Date"]
    D3["Filters<br/>axis list + option list, side by side"]
  end

  subgraph Phone["Phone — one full-screen sheet"]
    P1["Search pill in the band"]
    P2["Filters sheet"]
    P2 --> P3["Accounts"]
    P2 --> P4["Result"]
    P2 --> P5["Product"]
    P2 --> P6["Type"]
    P2 --> P7["Status"]
    P2 --> P8["Date range"]
  end
```

**Five axes, and every one is counted against the other four.** An axis is never narrowed against
itself, so a second product stays addable after the first is picked, and `MNQ` reads its real count
while `MNQ` is ticked. An option with nothing to reach is **shown, greyed, and unpressable, with its
`0` beside it** — on both surfaces. It is not hidden: a row that vanishes as you tick makes the list
jump under your thumb and leaves a product you know you traded simply missing.

`facetCounts()` in `src/lib/trades/facets.ts` is the one implementation. Status and Type are
properties of the *account*, so they are counted in accounts — "Failed 1" is one account.

**Result is a choice of one.** Wins and losses together is every trade, so both ticked narrows
nothing while claiming a `2` on the badge. Every other axis is multi-select.

---

## 5c. Subject pages — `S10`, held behind `S7`

**Not a new kind of page. The page Run already has, with a subject pinned.** `/accounts` is chart +
breakdown + rail; `/accounts/details/[id]` is that page with one account pinned. `S10` adds two more
things that can be pinned, and one idea that makes pinning worth having.

```mermaid
flowchart TD
  Accounts["/accounts<br/>chart · breakdown · rail"]
  Accounts -->|"pin an account"| Detail["/accounts/details/[id]"]
  Accounts -.->|"pin a product (S10)"| Product["/products/[root]"]
  Accounts -.->|"pin a session (S10)"| Session["/sessions/[date]"]

  Detail -->|"up: removes the pin,<br/>keeps the period"| Accounts
  Product -.-> Accounts
  Session -.-> Accounts

  style Product stroke-dasharray: 5 5
  style Session stroke-dasharray: 5 5
```

**The chart is the navigation.** `S10`'s phase A makes each bar a button: the range chip says which
bars exist, and clicking one says which you are reading. The selected bucket goes in the URL, and
everything under the chart is scoped to it. That is what `PeriodHeading` has been waiting for - a
window has no "August" to name, and a selection does.

**Going up removes the pin rather than going back**, and it keeps the period you had selected. So
Back from a pinned page is an in-app step like any other (§2), and the address it lands on is the
same screen minus one filter.

**Three doors in**, and the third is the one to get right:

1. the breakdown row, once it can group by product;
2. the instrument name in the trade detail;
3. **the trade drawer's own link**, which states its count: **"View 47 MNQ trades"** rather than the
   name made clickable. Monarch's version reads "View 16 transactions" and sits on its own line under
   the merchant - it says how much is on the other side before the tap.

Keyed on the product ROOT, never the contract month: `MNQ`, not `MNQU6`. Full reasoning, the
research it came from and what deliberately is not copied: `build-plan.md` §S10.

---

## 6. Read — `S7`, and blocked on a decision rather than on engineering

```mermaid
flowchart TD
  Read["/read (S7)"] -.-> Pattern["Today's pattern<br/>Finding / Watching / Quiet"]
  Read -.-> Working["The working — occurrences, cost, baseline"]
  Read -.-> History["History — the tab neither competitor has"]
  Pattern -.-> Cited["The trades it cites"]
  Cited -.-> TradeDetail["/trades/[id]"]

  style Read stroke-dasharray: 5 5
  style Pattern stroke-dasharray: 5 5
  style Working stroke-dasharray: 5 5
  style History stroke-dasharray: 5 5
  style Cited stroke-dasharray: 5 5
```

**The engine exists and its output does not fit the spec.** The proven pipeline produces a *reading*
— one subject, this tape, now. The spec is built on a *pattern* — named, counted, priced, tracked
across months. Both are defensible; v1 specifies one and has an engine for the other, and that is a
phase 2 decision. Nothing downstream should assume either shape won.
See `build-plan.md` §S7 and [#2](https://github.com/modryn-studio/run-rebuild/issues/2).

**The LLM never computes a number.** It receives finished figures and writes the sentence around
them; every number in a read comes from SQL.

---

## 7. Today — `S8`

```mermaid
flowchart TD
  Today["/today (S8)"] -.-> W1["Widget → /accounts"]
  Today -.-> W2["Widget → /trades"]
  Today -.-> W3["Widget → /read"]

  style Today stroke-dasharray: 5 5
  style W1 stroke-dasharray: 5 5
  style W2 stroke-dasharray: 5 5
  style W3 stroke-dasharray: 5 5
```

**Last on purpose**, because every widget links to a page that must already exist. **No state may
represent absence** — no "you haven't imported in 9 days", no backlog, no streak. Today is the
surface most likely to break that rule, and it reopens where the trader left it.

---

## 8. Settings, What's new, Notifications — `S8b` and `S9c`

```mermaid
flowchart TD
  Menu["Account menu"] --> Theme["Dark mode toggle"]
  Menu -.-> Settings["/settings (S8b)"]
  Menu -.-> WhatsNew["/whats-new (S8b)"]
  Menu --> Out["Log out"]
  Settings -.-> Tax["Setups, symbols, tags"]
  Settings -.-> Tz["Display timezone"]
  Settings -.-> Th["Theme"]

  style Settings stroke-dasharray: 5 5
  style WhatsNew stroke-dasharray: 5 5
  style Tax stroke-dasharray: 5 5
  style Tz stroke-dasharray: 5 5
  style Th stroke-dasharray: 5 5
```

> ⚠️ `trader.display_timezone` is **display only** and must never reach the bucketing code. A
> settings screen is exactly where that rule gets broken, because a timezone control looks like it
> should change what a session date means. It must not.

**What Run could ever notify about** is narrow, because the doctrine rules out most of what a
finance app uses notifications for: an import that finished while the trader was away, a trade that
quarantined, the daily read being ready. All three are *events that happened*, never *reminders that
something did not*. If the list cannot be filled without reaching for absence, the honest outcome is
that Run has no notification centre.

---

## 9. Internal surfaces

| Route | What it is | Who reaches it |
|---|---|---|
| `/kitchen-sink` | Every primitive in every state, with the token proofs | Anyone building |
| `/kitchen-sink/demo` | Scenes for capture — the upload flow, the sheets | Media only |
| `/status` | One query at request time, plus the deployed SHA | The release gate |
| `/admin` | Analytics events and signups | Admins only; 404s otherwise |

`layout.tsx` sets `robots: { index: false }` across the app. Remove it when the project genuinely
goes public.

---

## 10. Route inventory

| Route | Slice | State |
|---|---|---|
| `/` | S0 | ships — the door |
| `/login` | S3a | ships |
| `/today` | **S8** | **not built** — live nav row, 404s on purpose |
| `/accounts` | S6 | ships |
| `/accounts/details/[id]` | S6 | ships |
| `/accounts/details/[id]/trades` | S6 | ships — phone only, redirects above `md` |
| `/trades` | S5 · S5d | ships |
| `/trades/[id]` | S5d | ships — route and overlay |
| `/read` | **S7** | **blocked** — see §6 |
| `/products/[root]` | **S10** | **not built** — held behind S7, see §5c |
| `/sessions/[date]` | **S10** | **not built** — held behind S7, see §5c |
| `/settings` | **S8b** | **not built** |
| `/whats-new` | **S8b** | **not built** |
| `/status` · `/admin` · `/kitchen-sink` | S0 · S3c | ship — internal |

**API routes:** `/api/accounts` (label · create · close · delete) · `/api/csv-import` ·
`/api/trades/page` · `/api/trades/export` · `/api/trader/timezone` · `/api/track` ·
`/api/auth/[...all]`.

---

## Keeping this current

**It is owned like code.** A slice that adds a route, an overlay level or a Back path changes this
file in the same commit — the same rule `CLAUDE.md` states for itself. A diagram that disagrees with
the app is worse than no diagram, because the next reader believes it.

When a dashed node ships, it loses its dash and its slice tag in the same change that closes the
slice.
