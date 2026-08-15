# Design system — Run

> Phase 3 artifact. **Adopted, not derived.**
> Every visual and interaction rule, decided once.
> Rule: if a screen needs a value that isn't in this system, **add it to the system first, then
> use it.** Never inline a one-off. One-offs are how a design system dies.

**Status:** LOCKED at the phase 3 gate, 2026-08-11 · adopted from `run-trading@v3`, gaps closed from `v2` + a live measurement of Monarch
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
| ~~`design/design-check.SKILL.md`~~ | Retired 2026-08-11. The review gate is the global `/postcheck`; its token scan and squint test live there |

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
| `--color-border` | `#e4e1de` | the **edge** that bounds an object, and a **labelled** control's rest edge |
| `--color-rule` | `#f6f5f3` | a **divider** between siblings inside a container |
| `--color-border-strong` | `#bebbb8` | the subtle **hover** firm-up under the pointer |
| `--color-field` | `#848280` | a **field's** edge, where the outline *is* the control |
| `--color-text` | `#22201d` | primary ink — warm near-black, never `#000` |
| `--color-muted` | `#696765` | secondary, darkened 2026-08-13 to clear 4.5 on **every** ground |
| `--color-accent` | `#1f6b57` | deep pine — **the one accent** |
| `--color-pos` / `--color-neg` | `#2b754e` / `#a84a3c` | terracotta is the earned gravity hue |
| `--color-warn` | `#85612a` | a status hue, **not** a second accent |

Dark mode is fully specified (`.dark` block) and is **not** the light values inverted — scrims,
shadows and the pressed ground each have their own per-mode literals, with the reasoning
recorded for each.

**Directly relevant to our spec:** `--color-band` exists specifically for a day header in the
tape. That is the session header in our Trades wireframe, already solved.

#### Which of the two inks: a question about the string's job

Settled 2026-08-14. Luke: *"Metadata attached to an object — a date on a task row, a count, a
timestamp. Nobody reads these as prose; they're properties of the thing next to them. Muted is
right. Prose meant to be read — explanations, guidance, documentation. This should be full-strength
ink."*

| Job | What it is | Token |
|---|---|---|
| **metadata** | a *property* of the object beside it, scanned not read: a date, a count, a timestamp, a column header, a unit, an eyebrow, a resting control's ink | `--color-muted` |
| **prose** | anything meant to be *read* as sentences: an explanation, guidance, an empty state, a description, a page's own copy | `--color-text` |

**A usage rule, not a token** — both values already exist, and nothing was added.

It was systemic and worst in the rack, where **thirty** explanatory passages — the entire argument a
reviewer is there to read — were painted in the ink reserved for properties. The tell was already in
the markup: both prose helpers carried `max-w-prose` and then set themselves `muted`, so the code
named the job correctly and coloured it wrong. `Note` compounded it at `--text-caption`, an **11px**
label step carrying `letter-spacing: 0.02em`; those are the longest passages on the page.

Outside the rack the highest-stakes instance was the product's own tagline on `/login`, plus
`/status`'s four explanatory lines and `/admin`'s five.

**This costs nothing in hierarchy** because hierarchy below body is already carried by size and
weight (see Type). A 24px `h2` and a 12px note are separated by the ramp, not by the ink — muted was
never doing that work, it was only making sentences harder to read.

**`--color-faint` is retired.** It was an alias of `muted` kept on the reasoning that "~40 call sites
use it"; that count was the old build's, and a census of this one found **four** — two placeholders,
a menu chevron, a tooltip shortcut, every one of them `muted`'s job. A token whose value equals
another's and whose name describes an *intensity* rather than a *job* is a second name for one
thing, which is the same failure as one name doing three jobs approached from the other side. If a
placeholder ever earns its own value it gets `--color-placeholder`, named for what it is.

**One stated exception:** the consent line on `/login` stays muted. It is prose nobody chose to
read, and at full strength it competes with the CTA above it. The exception is that string, not the
category.

Proved in the rack's **Ink roles** specimen — a metadata line and a prose line in one card, so the
rule is reviewable rather than remembered.

#### The border vocabulary: four jobs, four tokens, and the floor comes from the job

Settled 2026-08-14, after a census found **438 painted borders and every one of them
`--color-border`** — 39 structural edges, 399 row dividers, and every control in the product.
`--color-rule` had zero call sites; `--color-border-strong` had one, a button's hover. Both
weights had been argued out in `globals.css` and neither was ever deployed.

| Job | What it does | WCAG | Token |
|---|---|---|---|
| **divider** | separates siblings *inside* one container | decoration, **exempt** — no floor | `--color-rule` |
| **edge** | *bounds* an object (card, popover, menu, tooltip, page-level rule), or rests under a **labelled** control | not required information, **exempt** — no floor | `--color-border` |
| **hover** | firms an edge up under the pointer | no floor — see below | `--color-border-strong` |
| **field** | *is* the control: the only thing saying one is there | **SC 1.4.11, 3:1** | `--color-field` |

The floor is set by the job, never by the token. A divider at 1.09:1 is *correct*, a labelled
button's edge at 1.30:1 is *correct*, and an input at 1.30:1 is a defect. One number, three
verdicts.

**The line inside "control" is whether the edge carries the identification.** SC 1.4.11 asks 3:1
of the visual information *required* to identify a component. A button with a visible text label
is identified by its label, so its edge is chrome. A field has no label inside it and a fill that
is its own card's colour, so the outline is the whole statement — which is the case the standard
actually names. **A hover can never carry a floor**, because a hover state is only reachable once
you have already found the control.

The first pass got this wrong in the direction that looks safe: it read "interactive" as the
category, moved `Button secondary` onto the 3:1 edge, and took its rest-to-hover step from 1.47×
to 2.94× — loud, against the "hover is the border and nothing else, and it is subtle" that
`.lift-rest` argues for in the same file. Reverted. A rule over-applied is still a rule broken.

Where it landed, all measured, all live in the rack's **Edges** proof:

- **`CodeInput`** takes `--color-field` at rest — `#848280` / `#888680`, 3.14 / 3.12 worst case.
  3:1 against a white card caps luminance at 0.30, which **is** a mid grey; a hairline on white
  cannot be both faint and compliant. The two modes land on nearly one value because a line clearing
  3:1 against near-white *and* near-black has nowhere else to go.
- **`Input` and `Textarea`** keep `border` → `focus:accent`, unchanged from v2. They took the field
  edge for half a day and came back: *"the border should be subtle and more pronounced on click,
  active state."* The gesture is the point — 1.30:1 → 6.37:1 is a **4.9×** jump that reads as an
  arrival, and a 3.83 resting edge flattens it to 1.7×, a colour change rather than an event.
  **The split is by whether anything inside the control identifies it, not by component type:**
  these always carry a placeholder or label, a code box is six empty squares. That is a real trade
  against 1.4.11's canonical example and it is recorded as one in `input.tsx`.
  **No hover on either** — v2 has none, and a hover is unreachable by keyboard and by touch, so the
  two states worth having are resting and active.
- **`Button secondary` and `.lift-rest`** keep `border` → `border-strong`, unchanged from v2.
- **`Button outline` keeps `accent/40` → `accent`**, unchanged from v2. A pass on 2026-08-14 removed
  the alpha on the claim that it composited to 2.85:1 in light and **1.09:1** in dark. Both numbers
  were wrong, from one cause: Tailwind emits an alpha as `color-mix`, `getComputedStyle` returns
  `oklab(0.476125 -0.079402 0.0116068 / 0.4)`, and the audit script read the first three numbers in
  that string as RGB channels — an oklab *lightness* of 0.476 became a red channel of 0.476/255.
  Re-measured by compositing on a canvas: **1.83 / 1.87 / 1.78** light and **2.20 / 2.15 / 1.91**
  dark. The modes agree and the rest edge is quiet in both, which is this variant's whole design.
  No floor reaches it either way. The rack's `Edges` proof now composites rather than parses.
- **`--switch-off`** `#b5b1a9 → #85827c` light, `#4a4f57 → #888680` dark. The track carries no edge,
  so its **fill** is the control's boundary, and a switch has no label inside it to identify it
  instead — so it keeps the floor where the button gives its back. The old dark value was a cool
  slate in a warm-neutral palette, left over from the pre-Monarch ink and the only uncommented
  token in that block.

The rack proved ink on ground (SC 1.4.3) and nothing proved lines (SC 1.4.11), which is how one
value came to do three jobs without anything complaining. It proves both now.

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
doing real work — at the divider weight, `--color-rule`, per the border vocabulary above.

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

> **Built in S3c** as `/kitchen-sink`, and the phase-3 guess above was low. What it has found, each
> invisible to types, lint and review:
>
> - **`text-figure` in `rem` inside a px ramp**, `Textarea` on Tailwind's default `text-sm`, and a
>   dark band/hover collision — its first run.
> - **`--color-muted` failing AA on the ground it renders on most**, the day the contrast table
>   started computing its ratios instead of printing `Aa 0.00`. A proof that asserts a number it has
>   never measured is worse than no proof.
> - **438 painted borders, all one token** (2026-08-14), found by the `Edges` proof added for
>   SC 1.4.11 — see the border vocabulary above. The ink table had existed for months; nothing
>   measured a *line* until then.
> - **`ThemeToggle`, the one primitive never racked** (2026-08-14) — a hand-rolled 44px bordered
>   circle with its own focus ring and a `scale` press, i.e. three decisions the system had since
>   made differently, preserved intact because nothing had ever rendered it beside its neighbour.
>   It is an `IconButton` now, so it agrees by construction. Two separate dead references were what
>   hid it: the rack imported and re-exported it without rendering it (the re-export made the import
>   count as used, so no lint rule fired), and `/login` imported it without rendering it under a
>   comment claiming `layout.tsx` rendered one globally — which stopped being true in S3b, leaving
>   the cold-landing screen with no way to change mode.
>
> - **Two scrollbars, one of them unthemed** (2026-08-14). `LoadingMark`'s `sr-only` label is
>   `position: absolute` and had no positioned ancestor, so its containing block was the *initial*
>   containing block — the document. An absolutely positioned box anchored to the document is not
>   clipped by any ancestor's `overflow`, so a 1px invisible screen-reader label escaped the rack's
>   `h-dvh overflow-hidden` shell and came to rest 4181px down, giving the page a full-height native
>   scrollbar beside the pane's own. `.scroll-thin` themes the bars we own and always did (it is
>   byte-identical to v2's); it cannot reach one the browser draws, which is why the stray bar was
>   also the one that ignored dark mode. Fixed with `relative` on the wrapper — **any `sr-only`
>   needs a positioned ancestor.** `color-scheme` is now set on `<html>`/`.dark` as the backstop.
> - **A proof reporting a wrong number** (2026-08-14). The `Edges` table parsed colour strings with
>   `match(/[\d.]+/g)`, which is correct for `rgb()` and silently catastrophic for the `oklab()` that
>   `getComputedStyle` returns for any Tailwind alpha. It reported `border-accent/40` at 1.09:1 in
>   dark; the real figure is 2.20, and that bad number was the stated reason for a change to
>   `Button outline` that has since been reverted. It composites on a canvas now. Second time this
>   file has learned that a proof asserting an unmeasured number is worse than no proof.
>
> **The lesson the entry above did not anticipate:** the rack is a gate, not a gallery. A component
> that is not in it has not been looked at, and "has not been looked at" is where divergence lives —
> not in the components people review every day.

---

## The one thing to re-examine, not adopt

**`--text-nav` assumes the sidebar carries rank through size and weight**, with colour left to
the component because the ground is spent on hover. That was tuned against a sidebar with
`v3`'s row count.

**Our spec has four rows.** Four rows in a 224px sidebar is a much emptier column than the
system was tuned against, and "inactive rows are `muted`, the active row alone is full ink" may
read differently when there are only four of them. Not a defect — a thing to look at once it's
on screen, and exactly the kind of check the review gate exists for.

**It is on screen now (S3b, 2026-08-13)** — built as specified so the check has the real thing to
look at. Measured in place: inactive `#777573` light / `#989691` dark, active row full ink on
`surface-2`. Still open for the review gate.

**The gate ran and closed it (S3c, 2026-08-13), and the answer was not the one this section was
watching for.** Four rows in an empty column read fine. What the rack caught instead was that both
of those measured values were **below the contrast floor** — `#989691` sat at 3.85 on `surface-2`,
and dark's worst case is the one nobody checks because dark "looks softer" by design. They are now
`#696765` light / `#a6a4a0` dark, solved with headroom rather than to exactly 4.50, because a
value solved to the floor rounds *under* it in the browser. `pos` and `neg` failed the same way and
were lifted with them. **The measurement above is kept as written**: it is the record of what the
rows actually were when the question was asked, and the point of this section is that putting it on
screen is what produced the finding — just not the finding it expected.

---

## ⚠️ Mobile — DEFERRED, not solved (Luke, 2026-08-13)

The breakpoint gap above stays open on purpose. Desktop is being built first and **mobile gets its
own pass at the end**, because mobile is a different layout rather than a narrower one:

> *"build the desktop version first and then go back to iterate mobile design last… I do realize
> that mobile view will have a design based on desktop for the time being. And that is fine for
> now. Just don't worry about viewport issues while we build out the project for desktop first."*

So what ships until that pass is **"not broken", not "designed"**: below 768px the sidebar
overlays with a scrim instead of pushing, because at 375px a 224px inline panel leaves 151px of
content, which is a squeeze rather than a layout. **Do not read any of it as a settled decision**,
and do not spend review time on mobile spacing until the pass happens. Reference for that pass:
`run-trading@v2`'s `/accounts`, where the desktop/mobile split was already started.

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

### ✅ Spacing — RESOLVED 2026-08-11, measured off Monarch

Read live from `app.monarch.com` via the chrome-devtools CLI — both the declared custom
properties and the actual computed usage across ~4,000 elements.

**What they declare** (they are on Tailwind v4 as well — `--spacing: 4px`, `--tw-space-*`):

| Token | Value | | Token | Value |
|---|---|---|---|---|
| `--space-px` | 1px | | `--space-lg` | 20px |
| `--space-3xs` | 2px | | `--space-xl` | 24px |
| `--space-2xs` | 4px | | `--space-2xl` | 32px |
| `--space-xs` | **8px** | | `--space-3xl` | 48px |
| `--space-sm` | 12px | | `--space-4xl` | 64px |
| `--space-md` | **14px** | | `--space-gutter` | **16px** |
| `--space-default` | 16px | | | |

Plus a **named container scale**: 256 · 288 · 320 · 384 · 448 · 512 · 576 · 672 · 768 · 896 ·
1024. And a radius ramp of `0 / 4 / 6 / 8 / 12 / 16 / 500 / 9999`.

**What they actually use**, by frequency across every element on the Transactions page:

```
8px  ×420      4px ×170      12px ×77      16px ×60      2px ×33      24px ×8
```

**Three findings worth acting on:**

1. **8px is the workhorse, on a 4px base.** 8 outnumbers everything else more than 2:1, and
   8/4/12/16 account for nearly all real spacing. The long tail (21, 11, 7.5, 59.53) is chart
   and layout computation, not design decisions.
2. **`--space-md` is 14px — deliberately off the 4px grid.** The only break in the ramp, and it
   is almost certainly there to match a 14px text size. Evidence that a considered scale can
   carry a deliberate exception. **Run should not copy it without its own reason.**
3. **Run's radius already matches theirs exactly** — 12 / 8 / 6 against their `md` / `sm` / `xs`.
   Independent corroboration that the shape ramp is right.

#### The decision for Run: adopt Tailwind's numeric scale explicitly

**Not** Monarch's semantic naming, and the reason is worth recording because it looks
inconsistent with what this system does elsewhere.

Run names *radius* semantically — slot / control / badge — and that works because there are only
three and **each maps to a real kind of object**. Spacing has no such mapping. A `2xl` is not a
kind of thing; it's a size, and semantic size names produce a question with no correct answer
("is this gap `md` or `lg`?") every time they're used. Monarch pays that tax — `md` at 14px sits
*between* `sm` 12 and `default` 16, which nobody will predict.

So: **Tailwind's stock 4px scale is Run's spacing system, chosen rather than inherited.** The
sentence is the whole point — this system's own recorded lesson is that a default nobody chose
is where stock values leak in.

**The steps Run uses**, matching the measured reference:

| Utility | px | Role |
|---|---|---|
| `1` | 4 | icon-to-label, tight inline |
| `2` | 8 | **the default gap** — inside controls, between related items |
| `3` | 12 | row padding, between grouped rows |
| `4` | 16 | **the gutter** (`PAGE_COLUMN`'s `px-4`), card padding, between blocks |
| `6` | 24 | between sections within a page |
| `8` | 32 | between major sections |
| `12` / `16` | 48 / 64 | page-level rhythm (`py-12 sm:py-16`) |

**Anything not on this list needs a reason written down.** Odd values are how a grid dies.

**One named role token, because it genuinely repeats:** the page gutter is 16px and is already
expressed once in `PAGE_COLUMN`. That constant *is* the token — no second name for it.

### ~~⚠️ Spacing — genuinely unanswered on v2 either~~ *(superseded above)*

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
- [x] **Spacing** — Tailwind 4px scale adopted explicitly, steps named, measured against Monarch
- [x] **Grid** — answered from v2: 64px header, 224px sidebar, uncapped page column, 304px collapsing rail
- [x] **Loading shapes** — answered from v2: LoadingMark at route level, determinate stepped panel with a minimum-visible floor
- [x] Kitchen sink **specced** — [design/kitchen-sink.md](design/kitchen-sink.md); built in phase 5
- [x] Any wireframe screen can be built inventing nothing new
