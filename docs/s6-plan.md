# S6 — Accounts: the port plan

**Status: LARGELY BUILT. Written as a draft 2026-08-25; the arguing is over.** Amended 2026-08-27,
because a plan that still says "nothing here is agreed" after five of its seven slices have merged is
worse than no plan - it sends the next session to re-decide questions the code already answers.

| | |
|---|---|
| **Shipped** | `S6a` read layer · `S6b` roster · `S6c` hero chart · `S6f` filters + reorder · `S6g` mobile pass |
| **Not built** | *(none)* |
| **Status** | ✅ **`S6` CLOSED 2026-08-31**, and `S4` with it — see `build-plan.md` |
| **Decisions** | `D1`-`D5` settled in code, recorded in §1 below. §7 is now empty by design |

⚠ **`S6d` IS NOT MERELY PENDING - IT IS A HOLE IN THE SHIPPED PAGE.** Every roster row is a
`<Link href={`/accounts/details/${id}`}>` (`roster-card.tsx:172`), and that route does not exist:
measured 2026-08-27, it returns **404**. The primary interaction of `/accounts` currently does
nothing but leave. The same shape appears on the sub-line, where an unlabelled account reads
*"Name this account"* - an invitation to an editing surface `S6e` has not built.

Written after reading v2's `/accounts` roster, its detail page, and its whole accounts data layer,
against `spec.md`, `architecture.md`, `wireframes.md`, `design-system.md` and the shipped
`run-rebuild` code.

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

*These were the things I could not derive from the docs. **All five are now settled, and the answer
is in the schema and the shipped page rather than here.** The reasoning below is kept because it is
the argument each answer won, not because anything is still open. Verified against the code
2026-08-27.*

| | Question | Settled as |
|---|---|---|
| **D1** | the state vocabulary | **Both axes kept, and they are orthogonal.** `account_type` is `evaluation · sim_funded · personal` and **nullable** - null is "nobody has labelled it yet", a normal state, and the roster draws it as `Unlabelled`. `status` is `active · passed · failed · closed`, so v2's `passed` survives. A CHECK constraint pairs them: an evaluation may pass or fail, a sim-funded account may fail or close, a personal one may only close, and an unlabelled one may only be active (`schema.ts:359`) |
| **D2** | which v2 columns are v1 | **`hidden` ✓ · `excluded_from_totals` ✓ · `closed_on` ✓ as a DATE · `daily_line_cents` ✗ CUT.** The cut is the one this plan argued for: dead in v2 too, and `psychology.md` puts the armed-line ritual in a later slice |
| **D3** | drag-to-reorder | **Yes, v1, and it shipped in `S6f`** - cards and rows both. `localStorage`, not a column, and `lib/accounts/order.ts` states the two costs rather than hiding them: the order does not follow to another browser, and the natural order paints for one frame first. Row order is ONE flat list of every id, which is what makes a saved arrangement survive an account changing type |
| **D4** | Cumulative only, or Breakdown | **Both.** `chart-view.tsx` carries `Kind = 'cumulative' \| 'breakdown'`. Which means `session-window.ts` WAS needed and exists, with `scripts/s6-session-window-gate.mts` over it |
| **D5** | "Add manually", and S9b | **Still S6's, and it is the LAST thing in the slice rather than part of the modal.** It is blocked on `S6d`, not on modal work: v2's adoption path is trustworthy only because the import launches from a specific account's own page, and there is no per-account page until `S6d` builds one (`build-plan.md`). S9b's home is still open |
| **D6** | the rail's shape | **v2's ledger, no `[Totals \| Percent]` toggle** - the wireframe draws one and loses the argument, for the reason v2 gives: a bar cannot show a losing account as a share of a positive total. The disagreement is recorded at the point of use (`accounts-rail.tsx:10`) rather than silently resolved |

### D1 — The account state vocabulary ✅ SETTLED — both axes, and `passed` survives

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

`spec.md:522` said `group accounts by state (funded, evaluation, closed)` — which mixes two TYPE
values (`funded`, `evaluation`) with one STATE value (`closed`), so the locked spec did not settle it
either. **That line was amended 2026-08-27** to name the two axes separately; see the amendment note
in `spec.md` itself. `architecture.md` was stale here too and **is no longer** — checked 2026-08-27,
its account table reads `account_type` nullable with the three type values and `status` as
`active · passed · failed · closed`, which is what shipped.

**This needs your answer, not my inference.** It decides the roster's groups, the summary rail's
rows, the status chip, the close flow and the CSV export.

### D2 — Which behaviours are v1 ✅ SETTLED — three kept, `daily_line` cut

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

### D3 — Is drag-to-reorder v1? ✅ SETTLED — yes, and it shipped

v2 has two levels of it (cards, and rows within a card), ~260 lines of hand-written pointer physics
copied off `react-beautiful-dnd`, and it is **mouse-only by design** — *"Reordering is a desk task;
a phone reads the roster."*

Its persistence is `localStorage` only, which v2 records as a known cost (**#84**): the order does
not follow to another browser, and the server's natural order paints for a frame first. It also
shipped **write-only for the entire life of the feature** — nothing ever read the key back until
2026-08-04.

It is the single largest piece of interaction in the port and the easiest to defer.

### D4 — Cumulative only, or Breakdown too? ✅ SETTLED — both shipped

The hero chart has two modes. **Cumulative** (the equity curve in the wireframe) is one SVG path.
**Breakdown** is stacked bars with its own grain menu, paging arrows, a stacking axis that picks
phase → firm → top-6 + Other, a 7-colour ramp, and per-bucket tooltips that double as the legend.

Breakdown is roughly two-thirds of `total-pnl-card.tsx`'s 1,417 lines. The wireframe draws only the
curve. Shipping Cumulative first is a real cut with a clean seam.

### D5 — "Add manually", and S9b ✅ SETTLED — S6's, after `S6d`

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

### S6a — The read layer ✅ SHIPPED
`src/lib/accounts/read.ts`. One grouped query off `trade` for per-account net + fills + last
session; one for the daily series keyed `(accountId, sessionDate)`; one `max(import.uploaded_at)`
per account for the freshness stamp — **the same query `/today` will use, per `architecture.md`'s
"not two that can disagree."** Migration for whichever of D2 survives.
*Gate: a script asserting the roster's numbers reconcile against `/trades` for the same window.*

### S6b — The roster, static ✅ SHIPPED
Header cluster (`Add account` as the single primary, portalled into the shell band), groups with
their own totals, rows, the summary rail via the **existing** `WithSummaryRail`, both empty states.
No chart, no drag, no filters.
*This is the slice that unblocks S4: `Add account` gets its door back.*

### S6c — The hero chart, cumulative ✅ SHIPPED (with Breakdown — see D4)
The curve, the two figures (all-time headline + windowed change), the period menu, gridlines as
divs, hover snapping to real points. Per-row sparklines.
*Deferred unless D4 says otherwise: Breakdown, its grain menu, paging, the stacking axis.*

### S6d — The detail route ✅ SHIPPED 2026-08-28
`/accounts/details/<id>` — breadcrumb header, the account rail's two cards, the account's own tape.
Makes live the two links `/trades` already renders as plain strings.
*Includes the P8 provenance card, which needs a fourth fact v2 does not have — see §4.*

**THIS IS NOW A BUG, NOT A GAP** (measured 2026-08-27). `S6b` shipped the roster with every row
wrapped in `<Link href={`/accounts/details/${a.id}`}>` (`roster-card.tsx:172`), and the route was
never built: `GET /accounts/details/<anything>` returns **404**. So the page's primary interaction —
tapping the account you want to look at — leaves the app for a not-found. Two consequences for how
this slice gets built:

- **It ships with the phone, not after it.** `S6g` deferred "details on a phone" to later; there is
  no later, because the row that opens it is a phone row today.
- **The empty and error ends are not hypothetical.** The link is generated from a real id, so the
  reachable failures are an id belonging to ANOTHER trader (must 404, not leak) and an account with
  zero trades (must render, not divide by nothing).

### S6e — Editing ✅ SHIPPED 2026-08-29
`LabelAccountForm` (confirm-not-interrogate, firm pre-filled from prefix, apply-to-siblings),
`FirmPicker`, Close, Delete-or-refuse. All wired through `useOverlayBack`.
*The most stateful slice, and the one carrying the most of v2's shipped bugs to avoid.*

### S6f — Filters, and reorder ✅ SHIPPED
The three-column roster panel, `ScopeTabs` on a phone. **Both shipped** (2026-08-26/27), along with
drag-to-reorder for cards and rows.

### S6g — Mobile pass ✅ SHIPPED (first pass; `S6d`/`S6e` still owe theirs)
Per Luke: *"mobile view of accounts will be done at the end."* **First pass shipped 2026-08-27**:
the band drops Filters and takes Refresh and Add as icons at the shell's own 22px scale; the chart
drops its gridlines, its axis labels and its two axis dates below `sm` and gains a press-and-drag
crosshair; `ScopeTabs` landed above the chart and scopes the chart, the roster AND the summary rail.
**Nothing still open in this slice.** `/accounts/details` on a phone shipped with `S6d` rather
than after it - the sliding panel, the `Recent trades` hand-off and the account's own tape - and
editing shipped with `S6e`, confirmations included.

---

## 4. Where the port has a gap, not a source

**"Range covered" does not exist in v2.** `spec.md`'s amended P8 requires four facts on
`/accounts/details` — source, account, range covered, last import. v2's Data card carries three.
Cheap to add (a min/max on `sessionDate`, no new query) but it is design work, not porting.

**The Account row is in the wrong card for that spec.** v2 puts it in Summary, not Data. Moving it
breaks the rail's stated divider grammar — *identity, then terms, then the record* — so the groups
need re-cutting rather than the row just relocating.

~~**`ScopeTabs` orders its tabs from the schema constant**~~ — CLOSED 2026-08-27. The order now has
one declaration, `ACCOUNT_TYPE_ORDER` in `lib/prop-firms.ts`, read by the chips, the roster's group
cards and the summary rail's breakdown. It had been three private copies of the same three strings,
which is how v2's comment came to claim a match that was not there.

**The unlabelled group is called `Unlabelled`, not "Not yet labelled"** (2026-08-27, Luke: *"sounds
unprofessional"*). "Not yet" is a progress report on the trader, which the no-absence-state rule
forbids, and the filter panel's firm axis had always used the shorter word for the same absence.

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

~~D1–D6~~ — **all closed. The answers are in the table at the top of §1**, each against the code that
settled it. This section is deliberately left as a stub rather than deleted: the next port plan
should copy its shape, which is *the questions the docs cannot answer, listed before any code*, and
that is easier to copy from a section that visibly emptied than from one that never existed.

**What IS still open, and neither is a D-question:**

1. **Where S9b lives** — re-sync / exclude-with-a-reason on a quarantined trade. Luke: *"will most
   likely live on /accounts."* If so it wants its own slice here, and `S6d`'s detail route is the
   surface it would stand on. Still unanswered.
2. **The Account row's card on `/accounts/details`** — `spec.md`'s amended P8 wants four facts in the
   Data card and v2 puts the Account row in Summary. Moving it breaks the rail's stated divider
   grammar (*identity, then terms, then the record*), so the groups need re-cutting rather than the
   row relocating. This is `S6d`'s to answer, not a blocker on starting it. See §4.
3. **Is `CLOSED` a group of its own?** `wireframes.md` draws one; v2 refuses, because a CLOSED card
   groups on a value that CHANGES and *"a fact must not be editable by dropping"*. Built v2's way per
   *"port exactly how it is"* and flagged live at `roster-card.tsx:11`. `spec.md`'s amended criterion
   is deliberately written to hold either way, so this is a real choice rather than a blocker. **A
   closed account is visible and countable on both readings** — only its card differs.
