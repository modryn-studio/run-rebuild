# S6 — Accounts: the port plan

**Status: DRAFT, for argument. Nothing here is agreed.** Written 2026-08-25 after reading v2's
`/accounts` roster, its detail page, and its whole accounts data layer, against `spec.md`,
`architecture.md`, `wireframes.md`, `design-system.md` and the shipped `run-rebuild` code.

Luke's brief: *"the /accounts page on run-trading@v2 is perfectly the way i want it... im almost 100%
sure i want /accounts page to port exactly how it is."* This plan takes that as the default and
argues only where a straight port would break something `run-rebuild` has already decided.

---

## 0. The short version

**The screens port. The plumbing under them does not.**

v2's `/accounts` is ~41 components over 3 routes. Its layout, its interaction model, its copy and
above all its *reasoning* are the asset, and this plan carries them across close to verbatim.

But v2 computes every number on that page by scanning the raw `event` log, unwindowed, twice per
render. `run-rebuild` has a `trade` projection v2 never had. Porting the data layer would import a
performance shape CLAUDE.md forbids in as many words — *"Scope every read by account and window from
the first query. Free now, unretrofittable once four surfaces depend on it."*

So: **port the surface, rewrite the reads.** Roughly 70% copy, 30% net-new.

---

## 1. Decisions needed before any code

These are the things I cannot derive from the docs. Each blocks a specific slice.

### D1 — The account state vocabulary ⛔ blocks everything

The two builds model this differently, and it is not a rename.

| | v2 | run-rebuild |
|---|---|---|
| type | `phase`: `evaluation \| sim_funded \| personal` | `accountType`: **same three values** ✅ |
| state | `status`: `active \| passed \| failed` | `state`: `active \| closed \| breached` |

`phase` → `accountType` is a clean 1:1. `status` → `state` is not:

- v2 has **`passed`** — an evaluation you cleared. `run-rebuild` has no equivalent, and for this
  audience passing an eval is arguably *the* event worth recording.
- `run-rebuild` has **`closed`**; v2 expresses that with a `closedOn` date plus a phase-dependent
  label (`personal` + `failed` renders as "Closed").
- `breached` and `failed` are the same fact under two names.

v2's phase-dependent labelling produces a live bug it never caught: `statusToken(a) === 'active'` is
used to pick the chart window, so **a personal account with `status: 'passed'` is treated as active**
and gets today's empty session instead of its last real one.

`spec.md:522` says `group accounts by state (funded, evaluation, closed)` — which mixes a type value
(`funded`), a type value (`evaluation`) and a state value (`closed`), so the locked spec does not
settle it either. `architecture.md:104` is separately stale here (it still says `account_type` is
NOT NULL and calls the value `funded`, both fixed in code at S4e).

**This needs your answer, not my inference.** It decides the roster's groups, the summary rail's
rows, the status chip, the close flow and the CSV export.

### D2 — Which behaviours are v1

v2's roster reads four columns `run-rebuild` has no equivalent of. Each is a migration plus a
surface, and each is independently droppable.

| v2 column | What it buys | Cost if kept |
|---|---|---|
| `hidden` | take a row off the roster, keep it in the arithmetic | column + Edit switch + disclosure flap with its divot |
| `excluded_from_totals` | keep the row, drop it from chart and totals | column + Edit switch + the crossed-eye row marker + every aggregate learns to skip it |
| `daily_line_cents` | the trader's own stop-loss line, set while calm | column + a field. **v2 admits nothing reads it yet** (#66) |
| `closed_on` (date) | the day an account ended | rebuild has `closedAt` **timestamptz**; v2's own comment says *"a DATE, not a timestamp: nobody closes an account at a time of day"* |

`daily_line_cents` is the one I'd cut: it is dead in v2 too, and `psychology.md` puts the armed-line
ritual in a later slice. The other three earn their place on the roster.

### D3 — Is drag-to-reorder v1?

v2 has two levels of it (cards, and rows within a card), ~260 lines of hand-written pointer physics
copied off `react-beautiful-dnd`, and it is **mouse-only by design** — *"Reordering is a desk task;
a phone reads the roster."*

Its persistence is `localStorage` only, which v2 records as a known cost (**#84**): the order does
not follow to another browser, and the server's natural order paints for a frame first. It also
shipped **write-only for the entire life of the feature** — nothing ever read the key back until
2026-08-04.

It is the single largest piece of interaction in the port and the easiest to defer.

### D4 — Cumulative only, or Breakdown too?

The hero chart has two modes. **Cumulative** (the equity curve in the wireframe) is one SVG path.
**Breakdown** is stacked bars with its own grain menu, paging arrows, a stacking axis that picks
phase → firm → top-6 + Other, a 7-colour ramp, and per-bucket tooltips that double as the legend.

Breakdown is roughly two-thirds of `total-pnl-card.tsx`'s 1,417 lines. The wireframe draws only the
curve. Shipping Cumulative first is a real cut with a clean seam.

### D5 — "Add manually", and S9b

`build-plan.md` puts **Add manually** in S6, and gives the reason: v2's adoption path (`pending:%`)
is only trustworthy because the import launches *from a specific account's own page*. That makes the
detail route a prerequisite, not an extra.

You also said **S9b** (re-sync / exclude-with-a-reason on a quarantined trade) *"will most likely
live on /accounts."* If so it wants a slice here rather than the correction I left open on S5.

---

## 2. What I'd push back on

The user asked for pushback. Four things, in order of how much they cost to get wrong.

### P1 — Do not port the data layer

`getAccounts` runs `count(*) filter (type='fill')`, `sum(pnl_cents) filter (type in ('round_trip','fee'))`
and `max(recorded_at)` grouped over **every event the trader has ever had**, on a `(trader_id)`-only
index. `getDailyPnl` does the same again for the chart. Neither is windowed.

`run-rebuild` does not need any of it. `trade` carries `accountId`, `sessionDate`, `grossPnlCents`,
`feeCents` and `state`, and already has **`trade_account_session_idx` on `(accountId, sessionDate)`** —
the exact index this shape wants. One grouped read gives the roster's per-account net, the group
totals and the daily series at once.

It also inherits `/trades`' own `NET` expression and its `state = 'ok'` exclusion, so the two pages
become arithmetically incapable of disagreeing. v2 has no such guarantee — and its `netPnlCents`
ignores `corrects_event_id` entirely, so a corrected round trip double-counts.

### P2 — Do not port `trade-date.ts`

v2's `tradeDateKey` / `tradeDateSql` implement the 5pm CT roll. `run-rebuild` already has that in
`src/lib/time/session.ts` as `sessionDateFor`, and CLAUDE.md is explicit: **one module owns every
time bucket.** Better still, `trade.sessionDate` is a *stored column*, so daily grains need no
runtime bucketing at all.

What genuinely is missing is v2's **`session-window.ts`** — session open/close/end/live, the weekend
rule, and the two-pass DST correction. That is 169 lines of real work with no equivalent here, and
it is needed only by the intraday "1 day" chart range. Another argument for D4.

### P3 — The roster leans on a type tier `run-rebuild` deleted

v2's roster uses **`text-faint`** for the freshness stamp, the drag grip, the axis labels, the
gridline labels and the excluded marker. `run-rebuild` deleted `--color-faint` on 2026-08-14 —
*two content tiers, not three* (#67). `text-micro` (the status chip) went the same way on 2026-08-24.

A missing token **emits nothing, silently**, and `verify-css.mjs` will not catch it: it verifies that
declared tokens survive into the build, not that a component names one that exists.

So the roster's hierarchy has to be re-derived against `design-system.md` §2a rather than copied.
That section is the measured contract for exactly this job: three sizes, hierarchy from weight and
ink, a row is one size, chrome never smaller than the content it controls, `text-small` appears
nowhere.

Concretely: v2's row is `text-body-lg` name / `text-body` sub-line / `text-body-lg` money /
`text-small text-faint` freshness — **four sizes across three tiers in one row.** §2a says a row is
one size. This needs a pass, not a paste.

### P4 — Every overlay owes the back button

v2 has **no history handling at all** — no `popstate`, no `pushState`, anywhere in its `src/`.
`run-rebuild` requires `useOverlayBack` on anything with an `x` or a back arrow.

`LabelAccountForm` is the hard case: a three-level screen stack (`type` → `firm` → `edit`) with two
further confirmations stacked *over* it at a higher z-index. That is up to five levels the device
back button has to unwind one at a time.

---

## 3. Proposed slice order

Each slice is independently demoable and ends at the seven-point bar.

### S6a — The read layer
`src/lib/accounts/read.ts`. One grouped query off `trade` for per-account net + fills + last
session; one for the daily series keyed `(accountId, sessionDate)`; one `max(import.uploaded_at)`
per account for the freshness stamp — **the same query `/today` will use, per `architecture.md`'s
"not two that can disagree."** Migration for whichever of D2 survives.
*Gate: a script asserting the roster's numbers reconcile against `/trades` for the same window.*

### S6b — The roster, static
Header cluster (`Add account` as the single primary, portalled into the shell band), groups with
their own totals, rows, the summary rail via the **existing** `WithSummaryRail`, both empty states.
No chart, no drag, no filters.
*This is the slice that unblocks S4: `Add account` gets its door back.*

### S6c — The hero chart, cumulative
The curve, the two figures (all-time headline + windowed change), the period menu, gridlines as
divs, hover snapping to real points. Per-row sparklines.
*Deferred unless D4 says otherwise: Breakdown, its grain menu, paging, the stacking axis.*

### S6d — The detail route
`/accounts/details/<id>` — breadcrumb header, the account rail's two cards, the account's own tape.
Makes live the two links `/trades` already renders as plain strings.
*Includes the P8 provenance card, which needs a fourth fact v2 does not have — see §4.*

### S6e — Editing
`LabelAccountForm` (confirm-not-interrogate, firm pre-filled from prefix, apply-to-siblings),
`FirmPicker`, Close, Delete-or-refuse. All wired through `useOverlayBack`.
*The most stateful slice, and the one carrying the most of v2's shipped bugs to avoid.*

### S6f — Filters, and reorder if D3 says yes
The three-column roster panel, `ScopeTabs` on a phone.

### S6g — Mobile pass
Per Luke: *"mobile view of accounts will be done at the end."*

---

## 4. Where the port has a gap, not a source

**"Range covered" does not exist in v2.** `spec.md`'s amended P8 requires four facts on
`/accounts/details` — source, account, range covered, last import. v2's Data card carries three.
Cheap to add (a min/max on `sessionDate`, no new query) but it is design work, not porting.

**The Account row is in the wrong card for that spec.** v2 puts it in Summary, not Data. Moving it
breaks the rail's stated divider grammar — *identity, then terms, then the record* — so the groups
need re-cutting rather than the row just relocating.

**`ScopeTabs` orders its tabs from the schema constant** (`evaluation, sim_funded, personal`) while
the roster orders groups `sim_funded, evaluation, personal`. The comment claims they match. They do
not. Build the tabs from the roster's order.

---

## 5. Reuse map

| Ports nearly clean | Needs rework | Rebuild from spec |
|---|---|---|
| `edit-account-link.tsx` (33 lines) | `accounts-header.tsx` (icons, and Refresh is inert — #57) | `roster-card.tsx` (43KB, dead tokens, absent data layer) |
| `account-logo.tsx` (one hex → `--color-logo-tile`) | `firm-picker.tsx` (icons; use rebuild's `Input`) | `total-pnl-card.tsx` (84KB, no charting exists here) |
| `scope-tabs.tsx` (fix the ordering bug) | `summary-card.tsx` (rebuild's rail is *more* evolved) | `roster-filters.tsx` (29KB) |
| `account-modals.tsx` **shape** — the three-opener split | `label-account-form.tsx` (v2 enums, dead tokens, + `useOverlayBack`) | the whole data layer |
| `prop-firms.ts` — **already ported wholesale** | `account-rail.tsx` (+ the fourth provenance fact) | `session-window.ts`, if D4 keeps intraday |

**Do not port at all:** `import-method-modal.tsx` — v2's own comment calls using it inside
`/accounts` the mistake (*"onboarding is NOT the app"*).

**Already better here, use ours:** `WithSummaryRail` + `StickyRail` (collapses rather than
unmounts, measures before pinning, answers the back button), `empty-state.tsx`, `skeleton.tsx`,
`filter-rows.tsx`, `text-field.tsx`, `date-input.tsx`, `menu.tsx`, `switch.tsx`.

---

## 6. The bug list is the real inheritance

v2's comments admit **~55 shipped defects** across these files. They are the most valuable thing in
the port, because each one is a test the rebuild can pass on day one. The ones that would silently
recur if the code is copied without its reasoning:

- **The chart and the rail disagreed** — `counted.length === accounts.length` was trivially true
  once the page passed a *narrowed* roster, so filtering to one account showed the rail at +$954.99
  and the chart at -$26,995.06.
- **`Math.max()` of an empty list rendered a literal `-$∞`** once every account was excluded.
- **A phase breakdown that did not sum to its own total** — two of three phases hardcoded.
- **The group header's total still counted excluded accounts**, so a card's first and second lines
  disagreed about which accounts they were about.
- **Hover is an index; a filter rebuilt the series shorter underneath it** and took the page down.
- **Every reorder navigated**, because a drag ending on a `<Link>` still fires a click.
- **Hide was a one-way door** — filtered out in SQL, and the row was the only route to the modal
  that could un-hide it.
- **A hand-added account leaked `pending:66ca1f7f-…`** to the trader.
- **Delete fired on first click, then 404'd the page it was standing on.**
- **The Close modal's copy claimed two things it did not do** — it does not take the row off the
  roster, and it does not stop taking fills.

---

## 7. Open questions, collected

1. **D1** — the state vocabulary, and therefore the roster's groups.
2. **D2** — `hidden` / `excluded_from_totals` / `daily_line` / `closed_on`: which are v1?
3. **D3** — is drag-to-reorder v1?
4. **D4** — Cumulative only, or Breakdown too? (Decides whether `session-window.ts` is needed.)
5. **D5** — does "Add manually" land in S6, and does S9b move here?
6. Does the summary rail keep v2's shape (a ledger, no Totals/Percent toggle) or the **wireframe's**
   shape, which draws a `[Totals | Percent]` toggle v2 deliberately does not have and argues
   against — *"a bar cannot show a losing account as a share of a positive total"*?
