# Design system — Run

> Phase 3 artifact. **Adopted, not derived.**
> Every visual and interaction rule, decided once.
> Rule: if a screen needs a value that isn't in this system, **add it to the system first, then
> use it.** Never inline a one-off. One-offs are how a design system dies.

**Status:** adopted 2026-08-11 from `run-trading@v3` · gaps below block the phase 3 gate
**Source of truth:** [`design/globals.css`](design/globals.css) — 692 lines, ported verbatim

---

## Why this phase is a port, not a derivation

Luke's call, 2026-08-11: phase 3 uses the design system already built on `run-trading@v3`.

That is the right call and worth stating plainly, because it looks like a shortcut and isn't.
The blueprint's phase 3 exists to force a set of decisions *before* screens get built, so that
building is assembly rather than invention. **Those decisions have already been made here, at a
level of rigour a fresh pass would not reach** — every token in that file carries its measured
reasoning, including the reasoning for values that were tried and rejected. Examples:

- The card shadow was raised after *measuring* that the reference's card-to-page contrast is
  1.089 against Run's 1.071 — under 2%, invisible — so the perceived difference was the **shadow
  and border**, not the fill. The fill was left alone and only the ambient layer changed.
- The third content tier (`faint`) was **deleted as a colour** after it measured 3.43:1, under
  the 4.5 AA floor, on timestamps and axis labels. The finding — that the palette has no stop
  which is both legible and quieter than `muted` — means hierarchy below body is carried by
  **size and weight** instead. `faint` survives as a name aliased to `muted` so ~40 call sites
  don't churn.
- The motion curve is set as a **Tailwind default override**, after an audit found 31
  `transition` utilities silently inheriting Tailwind's stock curve while four hand-written
  keyframes used the considered one. The lesson is recorded in the file: *a system that is not
  the DEFAULT is a suggestion.*

A from-scratch phase 3 would have produced a worse system and thrown away those findings.

**The re-derivation this build DOES owe** is the audit below: does the ported system cover
everything the blueprint's phase 3 requires, and does it still hold against the spec we locked
in phase 2? That is where the remaining work is.

---

## What was ported

| File | What it is |
|---|---|
| [`design/globals.css`](design/globals.css) | The tokens. Tailwind v4 `@theme` + `.dark` block. **The source of truth.** |
| [`design/design-system.instructions.md`](design/design-system.instructions.md) | The build rules — low cognitive load, shared primitives, responsive, touch targets, mobile keyboard |
| [`design/design-check.SKILL.md`](design/design-check.SKILL.md) | The gate that runs before a screen is called done |

**Not ported:** the React primitives (`button.tsx`, `card.tsx`, `input.tsx`, `icon-button.tsx`,
`menu.tsx`, `switch.tsx`, `textarea.tsx`, `tooltip.tsx`, `wordmark.tsx`, `icons.tsx`,
`spinner.tsx`, `loading-mark.tsx`, `code-input.tsx`). They come across in phase 5 with the build,
not now — phase 3 is decisions, not code.

---

## The system, against the blueprint's phase 3 checklist

### ✅ Color — covered, and unusually well

Three-tier ground vocabulary, grounds and ink lifted wholesale from Monarch (measured out of
their live theme object, both modes, not eyedropped), with Run's own hues carved out:

| Token | Light | Role |
|---|---|---|
| `--color-bg` | `#f6f5f3` | page and sidebar (one colour, as theirs) |
| `--color-surface` | `#ffffff` | the card |
| `--color-surface-2` | `#ebe8e5` | a recessed slot inside a card, never raised |
| `--color-hover` | `#fbfaf8` | a row lighting up *on* a card |
| `--color-band` | `#f6f5f3` | the ground for a band inside a card — a day header in the tape |
| `--color-border` | `#e4e1de` | default |
| `--color-border-strong` | `#bebbb8` | an input, a control that must be found |
| `--color-text` | `#22201d` | primary ink — warm near-black, never `#000` |
| `--color-muted` | `#777573` | secondary, 4.60:1 on the page |
| `--color-accent` | `#1f6b57` | deep pine — **the one accent** |
| `--color-pos` / `--color-neg` | `#2f7d54` / `#a84a3c` | terracotta is the earned gravity hue |
| `--color-warn` | `#b8863b` | a status hue, **not** a second accent |

Dark mode is fully specified (`.dark` block, line 309) and is **not** the light values inverted
— scrims, shadows and the pressed ground each have their own per-mode literals, with the
reasoning recorded for each.

**Directly relevant to our spec:** `--color-band` exists specifically for a day header in the
tape. That is the session header in our Trades wireframe, already solved.

### ✅ Type — covered, and it's a system rather than a set of numbers

`micro · caption · small · body · body-lg · nav · title · h2 · figure · display · hero`.

Weight is **baked into the token** wherever a role is always heavier, which is the fix for the
exact failure the file records: a written rule that "nav links are text-body-lg" which no token
enforced, so the sidebar drifted to 400 by accident.

`--text-figure` (1.6rem, 500, tabular) is the money/stat numeral — which is what our Accounts
hero and the Read page's dollar figures set in.

### ✅ Shape — covered, with a rule better than "pick a radius"

`--radius: 12px` (a **slot**: card, row, modal, selectable choice) · `--radius-sm: 8px` (a
**control**: button, input, chip) · `--radius-xs: 6px` (a badge).

Plus the 2026-08-01 rule: **shape follows the control's content, not its rank** — an icon-only
control is a circle, a labelled one is a `--radius-sm` rectangle. Measured off the reference.

And the 2026-07-31 correction: **raised surfaces are a fill and a shadow, not a hairline.** The
hairline survives *inside* those objects as row dividers, which is where "flat + hairline" was
doing real work.

### ✅ Motion — covered

One curve, `cubic-bezier(0.22, 0.61, 0.36, 1)` at 200ms, set as the Tailwind **default** so
every bare `transition` inherits it. Per-element overrides still win.

### ✅ Depth — covered

`--shadow-card` (`0 2px 4px rgba(34,32,29,0.10)`, matched to the reference), `--shadow-sm` for a
control at rest, `--shadow-press` for the inverse. Per-mode literals; dark needs ~4× the alpha
because a 10% ink shadow doesn't register on a near-value dark surface.

### ⚠️ Spacing — NOT in the token file

No `--spacing-*` tokens. The system relies on **Tailwind's stock 4px-based scale**, which is a
legitimate answer — it is a real scale on a real base unit — but it is an *inherited* default
rather than a decision, and this file's own recorded lesson is that **a system that is not the
default is a suggestion**, with the corollary that a default nobody chose is where stock values
leak in.

**Gap to close:** state explicitly that Tailwind's scale is the spacing system and name the
steps Run actually uses, or define tokens. My recommendation is the former — adopting the stock
scale deliberately costs nothing and inventing a parallel one costs a lot.

### ⚠️ Grid and breakpoints — NOT specified

The instructions file covers **page padding** (`px-4 sm:px-6`, never `px-6` alone) and
**section rhythm** (`py-12 sm:py-16`), which is real and useful. But there is no stated column
count, max content width, or breakpoint set.

**Gap to close, and it's now blocking:** the phase 2 wireframes assume a fixed ~224px sidebar,
a main column, and a right summary rail on both Accounts and Trades. **That three-zone layout
needs a stated max width and a defined behaviour when the rail doesn't fit.** Monarch's rail
collapses; ours has no rule yet.

### ⚠️ States — partially covered

Default / hover / active / disabled / focus are handled by the primitives and the token set
(`--color-hover`, `--pressed-bg`, `--shadow-press`).

**Loading, empty and error are governed as writing rules, not as visual specs.** The
instructions say *empty states get one minimal hint, error messages get one sentence* — good
rules, and they align with P9. But there is no spec for the *shapes*: skeleton vs spinner, and
where each applies.

**Gap to close:** our spec commits to determinate, count-based progress on import (S1, S2) and
skeleton rows preserving layout on Trades (S3). Those need to be system decisions, not
per-screen ones.

### ⚠️ Component inventory — deferred to phase 5, correctly

Twelve primitives exist on `v3` and come across with the build. **But the wireframes need
components that don't exist there yet:**

- **the session header row** — a band carrying net, count, win rate
- **the account row** — name, type, sparkline, value, freshness stamp
- **the summary rail** — a labelled digest with a Totals/Percent toggle
- **the widget** — title-links-to-page, headline value with delta, scope control, body
- **the quarantine notice** — visible exclusion with a resolve action (S9b)
- **the read card** — pattern / yesterday / this week / all time, plus the working

**Not a gap in the ported system** — these are Run-specific compositions and belong to phase 5.
Listed here so phase 5 doesn't invent them ad hoc.

### ⚠️ Kitchen sink — does not exist

No single route rendering every component in every state, both modes. Worth building; it is the
fastest bug-finder available and dark mode makes it twice as valuable.

---

## The one thing to re-examine, not adopt

**`--text-nav` assumes the sidebar carries rank through size and weight**, with colour left to
the component because the ground is spent on hover. That was tuned against a sidebar with
`v3`'s row count.

**Our spec has four rows.** Four rows in a 224px sidebar is a much emptier column than the
system was tuned against, and "inactive rows are `muted`, the active row alone is full ink" may
read differently when there are only four of them. Not a defect — a thing to look at once it's
on screen, and exactly the kind of check the design-check gate exists for.

---

---

## Gaps closed from `run-trading@v2` (2026-08-11)

Three of the four gaps were already solved on `v2`, with the measurements recorded. Adopted.

### ✅ Grid — ANSWERED

| Constant | Value | Note |
|---|---|---|
| Shell header | `4rem` (64px) | **One number for three things** — the sidebar wordmark row, the pane header, and the floating Open control. Any disagreement shows as a step in the top edge, and two files hard-coding their own number is how that arrives (it was already 12px out once). |
| Sidebar | `w-56` (224px) | Measured, not chosen. Was `w-64`. Collapses to `w-0` and hides **completely — no icon rail**, because a rail keeps taking horizontal space while giving nothing back. |
| Page column | `mx-auto w-full px-4` | **No max-width**, and this deliberately reverses a `1600px` cap. |
| Header left | `+pl-6` | The title sits 8px *inside* the left edge of the card it names — measured (header padded 24, title x=248, card x=240). **Do not "fix" a header that looks 8px off.** |
| Summary rail | `lg:w-76` (304px) | Collapsible, toggled with `]` — the bracket that pairs with the sidebar's `[`. |

**Why no max-width, since it looks like an oversight:** an ultrawide ledger row does put its date
and its P&L far apart — but **that cost is paid by the row, so capping belongs to whatever renders
rows, not to every page.** A surface that wants a measure caps its own content and still sits in
this column. `mx-auto` stays even though it does nothing while uncapped, because it's the one line
that has to be there rather than added later if a cap returns — a centred cap against a flush-left
header is a 48px drift that only appears on a wide monitor.

**The rail's behaviour — this is the answer to the blocking gap:**

- It **collapses; it does not unmount.** Conditionally rendering it made a one-way door.
- `lg:grid-cols-[minmax(0,1fr)_auto]` lets the track follow the child's own width; the child
  animates `lg:w-76 → lg:w-0`, with an inner `lg:w-76` pinning the contents so they don't reflow
  while the track closes.
- **Below `lg` the rail is a stacked block that never collapses.** *"A panel the full width of the
  screen is not a rail, and collapsing it would just be hiding content with no visible way back."*
- Hiding it returns 304px plus the gutter — measured, the tape goes to 1236px.

**Two gotchas recorded because they already bit:**

1. **Use `cn()`, never a template string** for the rail width. `lg:w-76` and `lg:w-0` are the same
   utility group under the same modifier — a raw template leaves *both* in the attribute and
   Tailwind's sheet order decides, which puts `w-76` last.
2. **The layout constants live in a module with no `'use client'`, and that absence is the point.**
   Every export of a `'use client'` module becomes a client reference when a Server Component
   imports it — a plain string does not survive it, and `clsx` silently drops any non-string.
   Measured: `/sessions` (client) rendered the full column; `/accounts` and `/dashboard` (server)
   rendered `class="pb-8"` and lost their gutter and max-width entirely. **No error, no warning.**

### ✅ Loading — ANSWERED, and it corrects an assumption in our spec

**Route-level:** a `LoadingMark` in `loading.tsx`. Next's automatic Suspense boundary wraps the
*page*, not the layout — so **the sidebar stays mounted and interactive while only the content pane
waits.** A slow surface never traps you; you can just pick another one.

**Import:** a determinate stepped progress panel — which matches S1/S2's criteria. But there's a
measured correction our spec would have missed:

> With no floor, all four steps resolve inside one frame. The panel would appear and vanish in
> ~16ms and the modal would blink shut.

Luke's entire corpus is 80 events; ingest at that size is single-digit milliseconds per file. So
`MIN_STEP_VISIBLE_MS` exists, and **the floor is not padding for its own sake.**

The sharper lesson underneath it: the original step timings were real measurements — of a
**3,420-row batch, roughly 40× heavier than a real daily session.** The panel had been tuned
against a rhythm no user experiences. *Measured, but calibrated to the wrong load.*

**Consequence for our spec:** S1/S2's "determinate, count-based, never an indeterminate spinner"
stands, and gains a clause — `THE SYSTEM SHALL hold each import step visible for a minimum
duration, so a fast import does not flash and vanish` — plus the standing caution that import
timings must be calibrated against a daily session, not a bulk backfill.

### ⚠️ Spacing — genuinely unanswered on v2 either

Searched `v2`'s tokens, `brand.md` and all docs: **no spacing scale is documented anywhere.** The
system rides Tailwind's stock 4px scale by inheritance, not by decision.

So this is a real open gap, not something to be found. **Recommendation stands:** adopt Tailwind's
scale explicitly and name the steps Run uses. It is already a real scale on a real base unit;
inventing a parallel one costs a lot and buys nothing. The only thing missing is the sentence that
makes it chosen rather than inherited — which is this system's own recorded lesson about defaults.

### ⚠️ Kitchen sink — still doesn't exist

`v2` has `preview-loading/[ms]` routes — a harness for rehearsing *one* state, which is the right
instinct at one-tenth the scope. No route renders every component in every state in both modes.

---

## Phase 3 gate

- [x] Color decided, light and dark, contrast-checked
- [x] Type scale decided, with weight baked into roles
- [x] Shape, depth, motion decided
- [ ] **Spacing system stated explicitly** (adopt Tailwind's scale deliberately)
- [x] **Grid** — answered from v2: 64px header, 224px sidebar, uncapped page column, 304px collapsing rail
- [x] **Loading shapes** — answered from v2: LoadingMark at route level, determinate stepped panel with a minimum-visible floor
- [ ] Kitchen-sink route exists
- [ ] Any wireframe screen can be built inventing nothing new
