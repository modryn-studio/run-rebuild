# Design system — Run

> Phase 3 artifact. Every visual and interaction rule, decided once.
> Rule: if a screen needs a value that isn't in this system, **add it to the system first, then
> use it.** Never inline a one-off. One-offs are how a design system dies.
>
> **That rule is enforced by lint** (§10), and the checker has been proven to fire. Unenforced it
> fails silently: a class naming a token that does not exist compiles to nothing and falls back to
> an inherited value, which no review and no typecheck catches.

**Status:** LIVE — amended through S5c
**Last amended:** 2026-08-20 — rebuilt against the studio template. Real-phone pass done. Elevation indirection, the
three motion curves, the border-or-shadow rule, the universal scrollbar, skeleton shimmer, the
held-open trigger state, the menu-versus-modal row rule, and the instrument-mark hue invariant.
**Source of truth:** [`src/app/globals.css`](../src/app/globals.css). This file explains it; that
file *is* it. Where they disagree, the stylesheet is right and this file is the bug.

---

## How to read this

Two things are true at once and both matter.

**The values were adopted, not derived.** Phase 3 took the system already built on
`run-trading@v3` rather than deriving a fresh one, and that was the right call: every token in
that file carries the measurement that set it, *including the values tried and rejected*. A
from-scratch pass would have produced a worse system and thrown those findings away.

**The rules were derived, and mostly the hard way.** Almost every "never do X" below is a bug that
shipped. They are recorded with their cause, because a rule without its cause gets re-litigated by
the next person who finds it inconvenient.

Three properties of this system are worth knowing before changing anything in it:

1. **A utility with no token behind it emits nothing.** No error, no warning, no type complaint,
   just an unstyled element. Confirm a token exists before writing a class. Tokens read only from
   inline styles or hand-written CSS need `@theme static` or they are tree-shaken away.
2. **Both modes, always.** The `.dark` block is per-mode *literals*, not inversions. Scrims,
   shadows and pressed grounds each have their own value, and each can be wrong in exactly one
   mode.
3. **Tailwind v4 has no config file.** `@theme` in `globals.css`. Never `:root`, never
   `tailwind.config.*`.

---

## 1. Spacing

**Base: 4px. Tailwind's stock numeric scale, chosen rather than inherited** — and that sentence is
the whole point, because this system's own recorded lesson is that a default nobody chose is where
stock values leak in.

**Not semantic names**, and the reason looks inconsistent with what this system does elsewhere.
Run names *radius* semantically (slot / control / badge) and that works because there are three of
them and each maps to a real kind of object. Spacing has no such mapping: a `2xl` is not a kind of
thing, it is a size, and semantic size names produce a question with no correct answer ("is this
gap `md` or `lg`?") every time they are used. The measured reference pays that tax — its `md` is
14px and sits *between* its `sm` at 12 and its `default` at 16, which nobody will predict.

| Utility | px | Role |
|---|---|---|
| `1` | 4 | icon-to-label, tight inline |
| `2` | 8 | **the default gap** — inside controls, between related items |
| `3` | 12 | row padding, between grouped rows |
| `4` | 16 | **the gutter** (`PAGE_COLUMN`'s `px-4`), between blocks |
| `5` | 20 | **inside a card of rows** — the one off-4 step, and the reference's own. See below |
| `6` | 24 | inside a form card, between sections within a page |
| `8` | 32 | between major sections |
| `12` / `16` | 48 / 64 | page-level rhythm (`py-12 sm:py-16`) |

**Anything not on this list needs a reason written down.** Odd values are how a grid dies.

**`5` (20px) is the one step off the 4-point grid, and here is its reason.** It is the gutter
*inside* a card whose content is rows. Measured on `app.monarch.com/transactions` (2026-08-20): its
card header is `12px 20px`, its body `20px`, its footer `16px 20px`. Run's tape and summary rail
were already on it at ten call sites before it was ever written down, which is the honest reason to
record it rather than to "correct" them to 24 and diverge from the thing they were measured against.

**A form card takes `6` (24px) and a card of rows takes `5` (20px).** `/login` is the first;
`/trades`'s two cards are the second. Stacked full-width controls want the room; a list of figures
reads tighter. `Card` owns the chrome and never the padding, so this is a call-site decision — and
both specimens are on the rack so it is a comparison rather than a memory.

Measured live on the reference across every element on its transactions page, which is where the
weighting above comes from: `8px ×420`, `4px ×170`, `12px ×77`, `16px ×60`, `2px ×33`, `24px ×8`.
8px outnumbers everything else more than 2:1. The long tail (21, 11, 7.5, 59.53) is chart and
layout computation, not design decisions.

**One named role token, because it genuinely repeats:** the page gutter is 16px and is already
expressed once in `PAGE_COLUMN`. That constant *is* the token. No second name for it.

---

## 2. Type

**One grotesque throughout, mono for machine strings, serif for the wordmark only.** Every piece of
text in the product is one of these roles. If a piece of text is not, either the text is wrong or
this table is.

| Token | Size | Line-height | Weight | Tracking | Used for |
|---|---|---|---|---|---|
| `text-caption` | 11px | 15px | — | 0.02em | fine print, a count badge, disclosure |
| `.eyebrow` | 11px | 15px | 500 | 0.14em | a spaced-caps section label (**a role, not a step**) |
| `text-small` | 12px | 16px | — | — | secondary, a control's own label |
| `text-body` | 14px | 20px | — | — | **default** |
| `text-body-lg` | 16px | 24px | — | — | a setting's title, a lead paragraph |
| `text-nav` | 16px | 24px | 400 | -0.01em | a sidebar row |
| `text-title` | 18px | 24px | 500 | -0.01em | a card title |
| `text-h3` | 20px | 26px | 500 | -0.01em | a block title |
| `text-h2` | 24px | 30px | 500 | -0.01em | a section title |
| `text-figure` | 26px | 30px | 500 | -0.015em | **a money figure** |
| `text-h1` | 28px | 34px | 500 | -0.02em | a page title |
| `text-display` | 32px | 36px | 500 | -0.025em | the ceiling, one per page at most |

**Weight is baked into the role, not picked per call site.** A role that needed its weight chosen
at every use would be a size, not a role.

**Tabular figures on for every number.** Money, counts, timestamps, ids. A column of figures that
does not align is a column nobody can scan.

**`text-figure` is in px, in a px ramp.** It was in `rem` once, in the middle of a px scale, and
the rack's first run is what found it. A single unit across a scale or the scale is not one.

**Hierarchy below body is carried by size and weight, never by ink.** See §3 — the palette has no
stop that is both quieter than `muted` and legible, which is a finding rather than an omission.

**`.eyebrow` is a ROLE AT AN EXISTING STEP, not a ramp step, and that distinction is load-bearing.**
It reads its size from `--text-caption`, so there is exactly one size tier below `small`. It was
`--text-micro` at 10px until 2026-08-24, and the 1px gap to caption was a step nobody could see
while every call site still had to choose between them. What actually separated the two was
tracking, weight and case — so those became the role and the size step went away. If a future
surface wants "a smaller caption", the answer is no: it wants one of these two roles.

### 2a. The measured contract — read this before porting a page from `run-trading@v2`

Both scales below were read out of the live DOM on 2026-08-24 by walking every leaf text node and
grouping by computed size, weight and colour. Monarch's `/transactions` is the reference for
`/trades`; the numbers are theirs, not an impression of theirs.

**Monarch runs its entire transactions page on three sizes.** 14, 16, 18, plus a single 12px badge
that appears once. Hierarchy comes from **weight and ink**, never from another size step: 14px
serves as full-ink toolbar buttons AND muted band text AND muted helper copy, and only weight and
colour tell them apart.

**Run's `/trades` now matches that pattern, in Run's own tokens:**

| Role | Run | Monarch, measured |
|---|---|---|
| Chrome: a toolbar chip, a menu trigger, a footer button | `text-body` (14) **/500**, full ink | 14/500, full ink |
| Secondary: a muted label, helper copy, the session band | `text-body` (14) muted | 14/400 and 14/500, muted |
| Primary: every cell of a tape row, a rail value | `text-body-lg` (16) | 16/400 |
| A result figure | `text-body-lg` (16) **/500**, pos/neg ink | 16/500, green — but see below |
| A page or panel heading | `text-title` (18) | 18/500 |
| A detail panel's amount and title | `text-h2` (24) | 24/500 |
| Fine print, a count badge | `text-caption` (11) | — *(no equivalent; see below)* |

**The rules that fall out of it, and the ones a ported page must obey:**

1. **A row is ONE size.** Every cell of a tape row is `text-body-lg`. Account and time were 14
   against the instrument's 16, which read them as annotations on it rather than as fields of equal
   standing. What separates the net figure is what separates it in the reference: it is the only
   coloured cell and the only one at weight 500.
2. **Chrome is never smaller than the content it controls.** A toolbar chip, a `Menu` trigger and a
   `Button size="sm"` are all `text-body`. `text-small` (12px) appears nowhere on `/trades`, and a
   ported page should not reintroduce it — that step is what made the header's `Clear` sit a size
   above the chips beside it, and the popover's `Clear` a size above `Cancel` and `Apply`.
3. **A label/value pair is 14 muted over 16 ink.** The summary rail does this; so does the
   reference's summary panel and its detail drawer.
3a. **But a label over a CONTROL is 14 full ink.** Both were measured on the reference and they
   genuinely differ: its summary panel's `Total transactions` is 14/400 **muted** above a value,
   while its search popover's `Search` is 14/500 **full ink** above the field you type in. So the
   rule is about what the label sits over, not about where it sits: a readout mutes its labels, a
   panel you operate does not. `Head`, `Group` and the filter panel's axis labels are the second
   kind; the rail's `dt` is the first.
4. **Peers in a button row are one component at one size.** Clear / Cancel / Apply are all
   `Button size="sm"`; only `variant` changes. `Clear` is `variant="ghost"` — no border, no resting
   ground, ink only — which is what "it must not read as a third equal button" always meant.

**Two places Run deliberately does NOT follow Monarch:**

- **`text-caption` has no equivalent there and stays anyway.** Monarch is a budgeting app with no
  audit obligation, so it never needs a tier below "muted body". Run's doctrine is *never show a
  number you cannot reconcile*: the rail's provenance line and the inline quarantine reason are
  **disclosure**, not merely quiet text, and they are read by a different kind of attention.
- **Both signs of a result are coloured.** Monarch colours only the positive, leaving expenses plain
  ink at weight 400 — which works because an expense is the default direction of a spending ledger
  rather than a bad outcome. A loss is not the default direction of a trading tape; it is half the
  subject, and a column of results has to be readable by sign at a glance.

---

## 3. Color

Semantic tokens only. **No raw hex in a component, ever.** Both modes are per-mode literals.

### Ground and ink

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `bg` | `#f6f5f3` | `#191918` | the page |
| `surface` | `#ffffff` | `#222221` | a card, a panel, a popover |
| `surface-2` | `#ebe8e5` | `#3b3a37` | a **recessed** slot, never a raised one |
| `hover` | `#fbfaf8` | `#2a2a28` | a row on a card, under the pointer |
| `band` | `#f6f5f3` | `#2a2a28` | a session band: a label for the rows beneath it |
| `elevated` | → `surface` | → `surface` | **an alias.** See the warning below |
| `pressed-bg` | `#f6f5f3` | `#191918` | a filled control, pushed in |
| `selected` | `mix(bg 95%, text)` | `mix(bg 78%, text)` | a chosen row |
| `text` | `#22201d` | `#ffffff` | prose, and any string meant to be read |
| `muted` | `#696765` | `#a6a4a0` | metadata: a property of the thing beside it |
| `accent` | `#1f6b57` | `#56b79b` | deep pine, the one accent |
| `accent-fg` | `#ffffff` | `#0b1512` | ink on the accent |
| `pos` | `#2b754e` | `#6ab391` | a result that made money |
| `neg` | `#a84a3c` | `#d89388` | a result that lost money |
| `warn` | `#85612a` | `#cf9f4e` | a status hue, **not a second accent** |
| `scrim` | `rgba(34,32,29,.5)` | `rgba(0,0,0,.62)` | a modal dim: the page is unreachable |
| `scrim-nav` | `rgba(28,36,48,.08)` | `rgba(0,0,0,.32)` | the mobile sidebar's underlay. **No blur** |
| `switch-off` | `#85827c` | `#888680` | a switch track, off |
| `skeleton-sheen` | `#f7f6f4` | `#4a4845` | the shimmer's bright band |

> **`--color-elevated` is an alias of `--color-surface`, and that has caused three separate
> invisible-demo bugs.** Run has a two-tier ground ramp where the boilerplate has three. Anything
> demonstrating a *difference* between `elevated` and `surface` shows nothing here, and shows
> nothing silently: a Skeleton on a Card, a shadow-press swatch, and a border-and-rule divider each
> rendered blank for exactly this reason before being found on the rack. When porting a demo from
> `modryn-base`, check whether it depends on that third tier existing.

**Contrast:** body text ≥ 4.5:1 against its own ground, large text ≥ 3:1, in **both** modes. Every
pair is measured on the rendered element in the rack, not computed from the hex.

### Which of the two inks: a question about the string's job

Settled 2026-08-14. A **usage rule, not a token** — both values already existed and nothing was
added.

| Job | What it is | Token |
|---|---|---|
| **metadata** | a *property* of the object beside it, scanned not read: a date, a count, a timestamp, a column header, a unit, an eyebrow, a resting control's ink | `muted` |
| **prose** | anything meant to be *read* as sentences: an explanation, guidance, an empty state, a description, a page's own copy | `text` |

It was systemic and worst on the rack itself, where thirty explanatory passages — the entire
argument a reviewer is there to read — were painted in the ink reserved for properties. The tell
was already in the markup: both prose helpers carried `max-w-prose` and then set themselves
`muted`, so the code named the job correctly and coloured it wrong.

**This costs nothing in hierarchy**, because hierarchy below body is carried by size and weight.
Muted was never doing that work; it was only making sentences harder to read.

**`--color-faint` is retired.** A token whose value equals another's and whose name describes an
*intensity* rather than a *job* is a second name for one thing. If a placeholder ever earns its own
value it gets `--color-placeholder`, named for what it is.

**One stated exception:** the consent line on `/login` stays muted. It is prose nobody chose to
read, and at full strength it competes with the CTA above it. The exception is that string, not the
category.

### When money is coloured, and when it is not

`pos`/`neg` say **this is a RESULT**. Ink and muted say this is a state or a label. Getting it
wrong in one direction sprays colour across a page where every row is money; in the other it strips
the one signal a tape exists to carry.

| Where | Treatment | Why |
|---|---|---|
| A trade's net, on a tape row | **`pos` / `neg`, signed** | A tape is a sequence of **outcomes** |
| A figure in a summary rail | **`pos` / `neg`, signed** | Each answers the question the filter just asked |
| A **session band's** subtotal | **`muted`** | A band is a **label** for the rows beneath it. In full ink it competes with the results it only summarises |
| A roster row's balance | **ink** | A roster at rest is a **state**, not an outcome |

Two consequences, both learned rather than reasoned:

- **A band needs no rule above or below it.** A ground change is enough to separate a label from a
  list, and the muted subtotal is what lets the band recede far enough for that to be true.
- **A zero is not a dash and a dash is not a zero.** `-` means *nothing to report*; `$0.00` means
  *reported, and it came to nothing*. "Average loss $0.00" reads as a trader who never loses rather
  than one who has not lost yet, so a null figure prints `-` and never a zero.

### The border vocabulary: four jobs, four tokens, and the floor comes from the job

Settled 2026-08-14, after a census found **438 painted borders and every one of them
`--color-border`**. `--color-rule` had zero call sites; `--color-border-strong` had one.

| Job | What it does | WCAG | Token | Light / Dark |
|---|---|---|---|---|
| **divider** | separates siblings *inside* one container | decoration, **exempt** | `rule` | `#f6f5f3` / `#323130` |
| **edge** | *bounds* an object, or rests under a **labelled** control | exempt | `border` | `#e4e1de` / `#3b3a37` |
| **hover** | firms an edge up under the pointer | no floor | `border-strong` | `#bebbb8` / `#6f6d68` |
| **field** | *is* the control: the only thing saying one is there | **SC 1.4.11, 3:1** | `field` | `#848280` / `#888680` |

**The floor is set by the job, never by the token.** A divider at 1.09:1 is *correct*, a labelled
button's edge at 1.30:1 is *correct*, and an input at 1.30:1 is a defect. One number, three
verdicts.

**The line inside "control" is whether the edge carries the identification.** SC 1.4.11 asks 3:1 of
the visual information *required* to identify a component. A button with a visible text label is
identified by its label, so its edge is chrome. A field has no label inside it and a fill that is
its own card's colour, so the outline is the whole statement. **A hover can never carry a floor**,
because a hover is only reachable once you have already found the control.

The first pass got this wrong in the direction that looks safe: it read "interactive" as the
category, moved `Button secondary` onto the 3:1 edge, and took its rest-to-hover step from 1.47×
to 2.94×. Reverted. **A rule over-applied is still a rule broken.**

> **`--color-rule` is measured relative to `elevated`, and it survives INSIDE a raised object.**
> In light mode `rule` and `bg` are *the same value*, so a divider drawn on the page has literally
> zero contrast. That is not a bad token value, it is the token being used outside its job: a
> divider separates siblings inside a container, so it needs a container. The rack's demo sat on
> the page and showed nothing until it was given a `bg-elevated` ground.

### Instrument marks

Seven hues, one per product root, so a scan down a tape can tell one instrument from another
without reading. `--mark-1` through `--mark-7`, plus `--mark-tint` (20% light / 24% dark).

**The tint mixes into `surface`, never into transparency.** Mixing into transparency makes the mark
translucent, so a row's hover ground shows through it and the instrument changes colour under the
pointer. A mark whose colour depends on what is behind it has stopped being an identifier.

**A micro and its full-size sibling never share a hue.** This is the one assignment in the mark that
is about risk rather than looks: `MNQ` and `NQ` differ by 10× per point, and this corpus already
holds the session where that exact substitution cost $2,331 in twenty minutes.

> **That sentence was false for five pairs until 2026-08-20**, and false in the way a claim in a
> comment usually is: it described the six pairs somebody had pinned by hand and said nothing about
> the rest, which fell through to the hash and collided by chance. NG/MNG, HG/MHG, 6B/M6B, 6A/M6A
> and 6J/M6J each rendered one mark for two products. Nothing on any screen would have shown it —
> a collision looks exactly like a correct mark until you hold the pair side by side. Found by
> putting the mark on the rack and **rendering the invariant instead of restating it**.
> `MICRO_PAIRS` in `src/lib/instruments.ts` is now what makes the guarantee checkable, and the
> rack's Instrument mark section goes red if a pair ever collides again.

---

## 4. Shape & depth

| Token | Value | Used for |
|---|---|---|
| `--radius` | 12px | **a slot**: card, row, modal, selectable choice |
| `--radius-sm` | 8px | **a control**: button, input, chip, menu item |
| `--radius-xs` | 6px | **a badge** |

Three radii, each mapping to a real kind of object, which is why these are named semantically where
spacing is not. Independently corroborated: the reference's `md`/`sm`/`xs` are 12/8/6 exactly.

### The two full rounds, and why neither is "pill everything"

`--radius-full` is not a token and never will be. Two objects are round anyway, and both earn it by
the same rule: **shape follows the control's content.**

- **An icon-only control is a disc** (`IconButton`, the avatar, a logo tile). Nothing labelled is.
- **The SELECTED segment of a segmented row is a pill** (`ui/segmented.tsx` — the phone's scope chips
  and the chart's range row). This is the one place a label sits inside a full round, and it holds
  because a segment is not a button. A button is drawn whether or not you have pressed it; an
  unselected segment has no ground, no border and no visible radius at all. So the pill is not the
  control's outline, it is the **selection marker** moving along the row — and a marker may be any
  shape the system likes.

The line this draws: the moment a pill appears on something rendered at rest, it is a button wearing
a marker's shape, and `design-rules.md`'s hard ban #6 applies with nothing to answer it.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--shadow-card` | `0 2px 4px rgba(34,32,29,.10)` | `0 2px 4px rgba(0,0,0,.32)` | a sheet above the page |
| `--shadow-sm` | `0 1px 2px rgba(34,32,29,.05)` | `0 1px 2px rgba(0,0,0,.28)` | a whisper of raise |
| `--shadow-press` | `inset 0 2px 4px rgba(34,32,29,.10)` | `inset 0 2px 5px rgba(0,0,0,.45)` | pushed in |

### A control gets a border OR a drop shadow, never both

House rule, from `design-rules.md`, and **only `Card` ever gets the shadow.**

A drawn edge and a cast shadow are two different claims about one object: the border says "here is
a box on the page", the shadow says "here is a sheet above it". Running both makes the object read
as the first while paying for the second.

Applied 2026-08-20, and it removed three resting shadows: `Button secondary` and `.lift-rest` both
carried `--shadow-sm` *under* their own hairline, and the icon chip's hover was a full
`--shadow-card` — a chip that visibly lifted off the page, which is the one thing a control may not
claim. All three now say the same thing with an edge and a ground. **The press keeps its inset**,
which is the opposite claim and stays legal.

**Two stated exceptions**, and both are genuinely the Card case rather than the button case:

- **Discs that float over the page**: the trade drawer's two 48px steppers, and the breakdown
  chart's pan arrows. Each has nothing behind it to bound against, which is what makes it a sheet
  rather than a button. `surface` + `--shadow-card`, **no border** — a fill and a shadow is what a
  card is, and adding a hairline would make it claim to be both.
- **A popover panel.** A menu, the Columns panel, a filter panel: each is a small sheet over the
  page, and each takes `surface` + `--shadow-card` + a hairline edge for the same reason a card
  does not — a popover *is* bounded, by the trigger it hangs off.

> The pan arrows were briefly written up as a THIRD exception taking a border *and* a shadow, ported
> that way from `run-trading@v2`, whose own arrow carries both (2026-08-27). Luke pushed back and was
> right: this build had already settled the same shape in `Stepper` without a border, so the rule
> needed no amendment and the arrow needed one class removed. **Check whether an existing exception
> already covers the shape before writing a new one** — a rule with three exceptions is most of the
> way to no rule at all.

### The elevation tokens are indirect, and that is load-bearing

`--shadow-card: var(--elevation-card)`, never a shadow value written straight into `@theme`.

**Tailwind resolves a shadow declared directly in `@theme` at BUILD time** and inlines it into the
utility, leaving only the colour variable behind. A `.dark` override of `--shadow-*` then silently
does nothing, and every shadow renders at its light value in dark mode. That shipped in the
boilerplate once. Pointing the theme value at a plain custom property leaves Tailwind nothing to
resolve, so the `.dark` swap works at runtime the way it reads.

Run was not visibly broken only because every call site spells it `shadow-[var(--shadow-card)]` —
the arbitrary-value form, which defers to runtime *by accident*. That workaround is why this
stylesheet carries ~70 `no-arbitrary-value` warnings, and it fails the moment anyone writes the
obvious `shadow-card`.

**`:root` must stay above `.dark`.** Equal specificity, so source order decides.

### The scrollbar is universal, not opt-in

```css
* { scrollbar-width: thin; scrollbar-color: var(--color-muted) transparent; }
```

**A `*` rule, because `scrollbar-width` does not inherit.** An opt-in `.scroll-thin` class only
styles the elements somebody remembered to mark, so every scroll container added later gets the
stock bar and nobody notices until a screenshot. `.scroll-thin` survives as a no-op alias so call
sites do not churn. Standard properties only, never `::-webkit-scrollbar` — the two do not compose,
so carrying both means maintaining two descriptions of one bar.

`.no-scrollbar` is the one exception, for the nav rail: a scrollbar inside the one panel whose job
is to recede is chrome. It *does* need `::-webkit-scrollbar`, because hiding a bar is the one case
the standard property does not cover in every engine.

---

## 5. Grid & layout

**The layout constants live in `src/lib/shell.ts`, a module with no `'use client'` at its top, and
that absence is the point.** Every export of a `'use client'` module becomes a client reference when
a Server Component imports it — a plain string does not survive it, and `clsx` silently drops any
non-string argument. Measured on the previous build: `/sessions` (client) rendered the full column,
`/accounts` and `/dashboard` (server) rendered `class="pb-8"` and lost their gutter and max-width
entirely. **No error, no warning, no type complaint.** Re-exporting from a client file does not
launder them.

| Constant | Value | Note |
|---|---|---|
| `SHELL_HEADER_H` | `4rem` (64px) | **One number for three things**: the sidebar wordmark row, the pane header, the floating Open control. Any disagreement shows as a step in the top edge, and it was 12px out once |
| `SIDEBAR_W` | `w-56` (224px) | Measured, not chosen. Collapses to `w-0` and hides **completely, no icon rail** — a rail keeps taking horizontal space while giving nothing back |
| `PAGE_COLUMN` | `mx-auto w-full px-4` | **No max-width**, deliberately reversing a 1600px cap |
| `HEADER_INDENT` | `pl-6` | The title sits 8px *inside* the left edge of the card it names. **Do not "fix" a header that looks 8px off** |
| `RAIL_W` | `lg:w-76` (304px) | Collapsible, toggled with `]` — the bracket that pairs with the sidebar's `[` |

**Breakpoints are Tailwind's stock set**, with two that carry real decisions: `md` (768px) is where
the sidebar becomes an overlay (`SIDEBAR_OVERLAY_QUERY`), and `lg` (1024px) is where the summary
rail becomes a rail rather than a stacked block.

**Why no max-width, since it looks like an oversight:** an ultrawide ledger row does put its date
and its P&L far apart, but **that cost is paid by the row**, so capping belongs to whatever renders
rows rather than to every page. A chart wants the space a row does not. A surface that needs a
measure caps its own content and still sits in this column. `mx-auto` stays even though it does
nothing while uncapped, because it is the one line that has to be there rather than added later — a
centred cap against a flush-left header is a 48px drift that only appears on a wide monitor.

**The rail collapses; it does not unmount.** Conditionally rendering it made a one-way door.
`lg:grid-cols-[minmax(0,1fr)_auto]` lets the track follow the child's own width; the child animates
`lg:w-76 → lg:w-0`, with an inner `lg:w-76` pinning the contents so they do not reflow while the
track closes. Below `lg` it is a stacked block that never collapses: a panel the full width of the
screen is not a rail, and collapsing it would be hiding content with no visible way back.

**Use `cn()`, never a template string,** for the rail width. `lg:w-76` and `lg:w-0` are the same
utility group under the same modifier — a raw template leaves *both* in the attribute and
Tailwind's sheet order decides, which puts `w-76` last.

---

## 6. Motion

**Three curves, each with one job, and `ease-in` is banned.** From `design-rules.md`, sourced from
Emil Kowalski's Easing Blueprint. This is a **perceived-performance** rule, not a taste one: the
proof is two dropdowns at an identical 300ms where the `ease-in` one plainly feels slower.

| Curve | Value | Its one job |
|---|---|---|
| `ease` | CSS default | a state change **in place** — a colour, a ground, an opacity |
| `--ease-out` | `cubic-bezier(.22,.61,.36,1)` | something **entering or leaving** — a menu, a tooltip, a scrim, a panel |
| `--ease-in-out` | `cubic-bezier(.645,.045,.355,1)` | something **already on screen** that moves or resizes |
| `linear` | — | **constant motion only** — a spinner, and nothing else |
| `ease-in` | — | **never.** It starts slow, which reads as the app hesitating |

Real curves rather than the CSS keywords, because the built-in ones are too weak to register.

| Token | Value | Used for |
|---|---|---|
| `--default-transition-duration` | 200ms | every bare `transition` utility |
| `--default-transition-timing-function` | `ease` | ditto |
| `--animate-spin` | `spin 0.7s linear infinite` | the spinner |
| `.panel-transition` | `0.3s var(--ease-in-out)` on `width, translate` | the sidebar and summary rail: **resizing in place** |
| `.drawer-transition` | `0.3s var(--ease-out)` on `translate, opacity` | the trade drawer: **entering and leaving** |

**The default is set as a Tailwind override**, after an audit found the app running two motion
languages: four hand-written keyframes used the considered curve while ~31 `transition` utilities
silently inherited Tailwind's stock `cubic-bezier(.4,0,.2,1)` at 150ms. Nobody chose that; it was
the default nobody overrode. **A system that is not the DEFAULT is a suggestion.**

The default points at `ease`, not `--ease-out`, and that is the house rule rather than a
regression. Pointing it at `ease-out` gave every hover in the product an entrance curve, which is
the same class of miss as the stock 150ms it replaced: a curve nobody chose per element, just a
different one.

**The spinner's duration is the finding, not its curve.** Tailwind ships `spin 1s linear`, which is
a number nobody chose. A faster spinner makes an app feel faster to load at an identical real load
time.

**`.panel-transition` is shared by the sidebar and the summary rail, and the trade drawer has its
own sibling declaration**, `.drawer-transition`, split out on the same day it was added
(2026-08-20). They agree on the one thing that matters across all three - 0.3s, so panels framing
the work cannot arrive at different speeds - and correctly disagree on curve: the sidebar and rail
RESIZE while already on screen, which is `ease-in-out`'s job; the drawer ENTERS AND LEAVES, which
is `ease-out`'s. One class had briefly been asked to do both jobs, on the reasoning that duration
alone was what made panels feel like one family - true, but curve is a separate axis and the role
table already answers it.

**`.drawer-transition` states `opacity` in its own property list, and that is load-bearing, not
decorative.** Both panel classes are UNLAYERED (deliberately - see `.lift-rest`'s note on why an
unlayered rule is what lets a control's held-open state beat a Tailwind hover utility), and an
unlayered `transition-property` always wins over anything in Tailwind's layer for that element,
*in full*, not merged with it. The drawer's steppers used to pair `panel-transition` with a
Tailwind `transition-opacity` utility, on the assumption both would apply; measured live, the
element's computed `transitionProperty` read `"width, translate"` with no `opacity` in it, so the
fade had never been animating - it snapped while the slide beside it took 300ms. Any element that
needs a property transitioned alongside one of these two classes has to get it from the class
itself.

**Respect `prefers-reduced-motion`,** and respect it *correctly*: see the skeleton note in §7. A
reduced-motion block that freezes an animation mid-sweep is worse than one that never ran.

### 6a. On a phone: no modals, and one rule decides whether a screen slides

*(2026-08-28. Luke: "basically no modals on mobile is the rule.")*

**Below 768px (`PHONE_QUERY`) a dismissible surface is a full-screen sheet, not a centred card.**
`/trades` already worked this way with `FilterSheet` and `TradeSheet`; `/accounts` followed with add,
import, edit and both confirmations. The sheet's shape is fixed and shared: `fixed inset-0 z-[70]`,
always mounted, `.sheet-transition` for the timing and `translate-y-full` at the call site for the
position, a `--scrim-nav` underlay, an `h-16` `SheetHeader` bar, and `inert` + `aria-hidden` +
`pointer-events-none` on the root when closed. Three attributes, three audiences: only `inert`
touches the tab order.

**THE HEADER CHANGES, SO THE PAGE SLIDES. THE HEADER STAYS, SO THE BODY FADES.**

| The step | What moves | Why |
|---|---|---|
| "Add manually" → "Evaluation" | a new layer slides up on `.sheet-transition` | the bar renames, so this is a place you arrived at |
| "Evaluation" (firm) → (size) | the body only, `key` + `.value-fade` | the bar is unchanged, so it is one page answering its second half |

This supersedes `filter-sheet.tsx`'s "one drill-in level, and no more". That limit was defended on
the grounds that "the way back would be ambiguous" past one — and the way back is ambiguous *exactly
when two stacked screens are named the same thing*. A screen that renames the bar carries its own
answer to what Back means. Depth is bounded by the flows instead, at three positions
(`MAX_LAYERS`), and a flow that wants a fourth is a flow asking too many questions.

**The header never travels.** It is hosted above every layer and the active screen portals into it
(`surface.tsx`), so it swaps on the frame of the tap while only the body moves. A bar rendered
inside the sliding layer would slide with it, which is the thing Luke named on `/trades` first:
"the header should just change ... that header should not pop up with the trade details page".

**Do not add a third transition for a step change.** The fade is `.value-fade`, 0.14s opacity,
already in the system. The one finding worth carrying from the 2026 research on multi-step forms is
that a step transition which is *too fast* gets missed — people press Next and never register that
the content changed — so 0.14s is the floor rather than a target to beat. Emil Kowalski's
blur-masked crossfade (`ui-ux-sources.md`, tip 7) stays the thing to reach for **only if** a plain
opacity swap ever feels wrong after duration and easing have both been tried.

**A layer that has been popped stays mounted while it leaves.** `AccountSheet` holds the last node
seen at each depth, because the flow stops supplying it on the frame Back is pressed. Held in state
adjusted during render, never a ref — the React Compiler's lint refuses a ref read during render, and
an effect would blank the layer for the first frame of its own travel.

**Two containers, two clocks.** A modal fades out in 160ms (`MODAL_EXIT_MS`), a sheet travels the
height of the screen in 200 (`SHEET_EXIT_MS`). Each has its own hook, because the owner is what
unmounts and the owner cannot be what decides when.

### 6b. A drill-down PAGE on a phone, and why it is not `<ViewTransition>`

*(2026-08-28.)* `/accounts/details/<id>` and its `/trades` child are ROUTES that look like sheets:
`max-md:fixed max-md:inset-0 max-md:z-[60]`, their own `SheetHeader`, an ordinary page column above
`md`. That container is `/trades/[id]`'s, unchanged — one tree, two frames, so the page is never in
the document twice.

**React's `<ViewTransition>` was the plan and it does not build here.** This install is react
19.2.7 stable, which does not export it, and `next/dist/lib/needs-experimental-react.js` shows Next
16.3 swapping to its vendored *experimental* React only when `blockingSSR`, `taint`,
`transitionIndicator` or `gestureTransition` is set. Turning one on to get a route animation swaps
the whole React runtime for an experimental build. Not on this repo. **If that check ever passes on
stable React, revisit** — the mechanism below is a substitute, not a preference.

So the panel animates itself: `translate-y-full` → `0` on the first rAF, on `.sheet-transition`.
**It lives in the component the route renders, and there is no `loading.tsx` on those segments** —
a boundary and its page each mounting the panel is the "entrance runs twice" bug §7 names.

**There is no exit.** A route cannot animate away without holding the navigation. `TradeSheet` gets
one because it is client state over a page that never left; this is a page.

**`usePhone` starts at the server's answer, never at `matchMedia`.** Reading the query in the
initial state is the "server/client branch" React names in a hydration mismatch, and it produced one
the day `/accounts/details` started using the hook — the modals it was written for mount on a click,
so nothing had caught it. The real value arrives in a **layout** effect, flushed before paint, so
there is still no frame of the desktop container on a phone.

**`DesktopOnly`, not `max-md:hidden`, for a tape the phone replaces.** The class hides pixels: the
subject page's first 300 rows were still built and laid out under a four-row table drawn from the
same array. Measured at 390px on one real account: 30 rows in the document, 4 visible. It does not
save the payload, and it does not save the first parse: `usePhone` must start at the server's answer
or the tree hydrates against HTML that disagrees with it, so the rows are sent and parsed either way.
What it saves is their life after that first commit.

**Two summaries, two questions, and neither repeats.** `AccountRail` on the details page is what the
account **is** (broker, firm, type, size, status) plus where its record came from. `TradesRail` on
the `/trades` child is how the set on screen **did** (sessions, win rate, average and best and worst
session). Its `Accounts` line is dropped when the filter pins exactly one — there it restates which
page you are on. Filters and search live only on the child route, so the page underneath can never
be left silently narrowed with no control to clear it.

**A confirmation is a sheet too, and stacks by DOM order rather than by a second z-index.** Both
`Close this account?` and `Delete this account?` are `ConfirmShell`, which picks a centred
`alertdialog` above `md` and a sheet below it. The sheet underneath is put in `busy`, which stops it
listening for Escape — two panels listening on `document` would *both* answer one press, because
`stopPropagation` does not reach a sibling listener on the same node. The device Back button needs
no equivalent: `useOverlayBack` orders its registrations by token and only the innermost answers.

---

## 7. States

Every interactive component defines all of these. **The last three are what separate a real app
from a demo.**

default · hover · **focus** · active/pressed · **held open** · disabled · **loading** · **empty** ·
**error**

### Focus

**One global `:focus-visible` outline: 2px solid accent, with an offset.** Never a local ring.

`Button` carried its own `focus-visible:ring-accent/30 ring-2 outline-none`, which suppressed the
app-wide outline and replaced it with the accent at 30% alpha and no offset — roughly 2.05:1
against its own ground, on the most common control in the product. `IconButton` and `Menu` kept the
global treatment, so a labelled button and an icon button in one header showed two different focus
rings and the weaker one was on the control people actually tab to.

### Hover, press, and held-open

Three named mechanics, defined once in `globals.css` so a control cannot invent its own version of
"lifted":

- **`.lift-press`** — a bare glyph that grows a chip on hover and pushes in on press. The hit area
  is expanded invisibly to 44px (`::after { inset: -4px }`) around a 36px visible chip, so touch
  targets pass without the chip reading as a primary control.
- **`.lift-rest`** — a control that is *already* an object: it rests as a fill plus a hairline, and
  **hover is the border and nothing else.** A raised object that already has a ground cannot
  announce hover by changing that ground without looking like a different object.
- **`data-active='true'`** — **held down for as long as a panel is open.** A trigger that springs
  back the moment you release has stopped saying which control the panel belongs to.

> **The specificity trap, which has now bitten three times.** These rules rely on *equal
> specificity, source order decides*. Adding `:not(:disabled)` to one selector and not its sibling
> silently breaks that: `.lift-rest:hover` is (0,2,0) while `.lift-press:not(:disabled):hover` is
> (0,3,0), so a control carrying both classes got the wrong one. Found first on a disabled icon
> button that still lifted, then on a header control that hovered into the chip treatment, then on
> an open trigger that sprang back the instant the cursor rested on it after a click — the normal
> case, not an edge one. **When you add a pseudo-class guard to one rule in a pair, add it to
> both.**

> **`Button`'s variants are Tailwind pseudo-class utilities and have no data-attribute form.**
> Setting `data-active` on a `Button secondary` therefore did nothing, so a card-header popover
> trigger could not stay pushed in. The fix is a hand-written rule keyed off a style hook
> (`.btn-secondary[data-active='true']`), written as real CSS rather than a
> `data-[active=true]:` utility on purpose: a real rule beats a utility regardless of source
> order, so it cannot be re-broken by reordering classes in a component.

### Loading — three marks, and which one is decided by what you know

**One question settles it: do you know the SHAPE of what is arriving?** Everything else follows.

| Mark | Means | Use it for |
|---|---|---|
| `Skeleton` | the shape is known, content is filling in | the summary rail, the trade detail body, any list or card whose layout does not depend on the data |
| `Spinner` | a bounded action you triggered | **inside buttons only** — Apply, Download CSV, sign in, upload |
| `LoadingMark` (wordmark) | a whole surface is arriving and its shape is not known yet | a cold entry into the app (`(app)/loading.tsx`), and nothing else |

**The skeleton is the default, not the fallback.** Users perceive skeleton-loaded content as up to
**50% faster** than spinner-loaded at identical real load times, because it states the layout before
the content exists. NN/g finds the benefit lands specifically in the **400ms–3s** band.

**A skeleton must mirror its content row for row.** One that does not match reflows the moment the
content lands, which reads worse than the spinner it replaced. Copy the real component's spacing
classes; if they change, the skeleton moves with them. Bar widths should be **ragged**, roughly the
measure of the real labels — a column of identical bars reads as a placeholder graphic, an uneven
one reads as text that has not arrived.

**Below ~300ms, show nothing.** `.wait-reveal` holds any waiting mark invisible for 300ms and then
fades it in over 200ms. Most navigations in this app are prefetched and land inside that window,
where a mark that appears and vanishes **adds** a flicker to a load that already felt instant. It is
deliberately absent from the reduced-motion block: killing it would make the mark appear *instantly*,
which is the flicker it exists to prevent.

**The spinner does not belong on a navigation.** A tap that opens a screen is not "a request in
flight" — it is a surface arriving, and the wait belongs at the destination in the shape of what is
coming. A spinner beaded onto the control you just left answers the wrong question. *(Learned the
hard way: a `useLinkStatus` spinner sat in the tape row for a day before being removed.)*

**Where a route boundary lives decides how many times it animates.** `loading.tsx` and `page.tsx`
are different subtrees, so any chrome rendered by both mounts twice and any entrance animation runs
twice. Put persistent chrome in a **`layout.tsx`**, which does not re-render when a child segment
resolves, and let the boundary and the page be its children. *(The trade sheet slid up twice before
this was understood. It no longer lives in a route at all — see the rule below — but the rule stands
for any chrome a boundary and a page could both render.)*

**The fastest loading state is the one you do not need.** Before designing a wait, check whether the
client already holds the answer. The phone's trade sheet had a skeleton, a `loading.tsx` and a
portal feeding its title, and every one of them was scaffolding around a fetch for a `TapeRow` the
tape was **already rendering on the row that had just been tapped**. Deleting the fetch deleted the
wait: 305ms before anything moved became one frame, and the skeleton became nothing at all. A
skeleton for data you already have is a skeleton for nothing. *(2026-08-25; the numbers are in
`build-plan.md` S5d.)*

**A segment that needs a boundary declares its own.** A `loading.tsx` higher up is already mounted
once you are inside it, and React will not re-show an existing fallback during a transition — so an
app-level boundary never fires for navigation between sibling pages.

### Disabled

**An ink swap at opacity 1 wherever the control has an edge to keep crisp; a fade where it does
not.** `Button secondary` and `Switch` swap grounds, because `disabled:opacity-50` takes the whole
row with it and a `muted` note at half strength composites to roughly 1.9:1, which is not text any
more. `Button primary` fades, because it has no border for the fade to blur — there is only the
fill, and a faded pine still reads unmistakably as the primary action. A disabled primary that
turns warm grey stops looking like the same button and starts looking like a *secondary* one, which
is exactly what a disabled state must not do.

**Disabled rather than absent, for a stepper.** Unlike most controls here: a stepper that
disappears at the end of a list moves the other one, so the button under the pointer changes
meaning mid-walk.

### Loading

**Route level:** a `LoadingMark` in `loading.tsx`. Next's automatic Suspense boundary wraps the
*page*, not the layout, so the sidebar stays mounted and interactive while only the content pane
waits. A slow surface never traps you.

**Skeletons shimmer; they do not pulse.** A sweeping gradient is perceived as shorter than an
opacity pulse at an identical duration. `linear` is the correct curve and the one legitimate use of
it in the system: a sweep is constant motion. 1.6s cycle.

> **Reduced motion drops the gradient entirely** — `background-image: none` — rather than freezing
> the animation. A frozen sweep parks a bright band mid-element and reads as broken, which is a
> worse outcome than the motion it was avoiding.

**A skeleton sits on `surface-2`, not `surface`.** On a Card it was invisible, because
`elevated` and `surface` are the same value here (§3).

**Import:** a determinate stepped progress panel, never an indeterminate spinner — with a
`MIN_STEP_VISIBLE_MS` floor, and the floor is not padding for its own sake. The whole corpus is 80
events; ingest at that size is single-digit milliseconds per file, so with no floor all four steps
resolve inside one frame and the panel appears and vanishes in ~16ms. The sharper lesson: the
original step timings were real measurements *of a 3,420-row batch, roughly 40× heavier than a real
daily session*. **Measured, but calibrated to the wrong load.**

**A button that loads keeps its label's width.** Swapping children outright collapsed one from 81px
to 50px at the exact moment of the click, shifting every control beside it in a right-aligned
footer.

### Empty

**An empty state names what is missing and offers exactly one action. "No data" is not an empty
state.**

**Two empties are two different sentences.** Telling a trader with two years of tape that they have
never traded is the version that costs trust, so an unfiltered empty and a filtered-to-nothing
empty say different things.

**Nothing renders a zero-state for a condition that has never occurred.** `QuarantineNotice` with
both counts at zero renders *nothing* — a permanent "0 quarantined" row is a status light for
something that has never happened.

### Error

**Errors say what happened and what to do next.** Never surface a raw exception. "Error: request
failed with status 500" becomes "That did not send. Nothing was lost, so trying again is safe."

**Say whether anything was lost.** An error the user cannot act on is decoration.

### Two rules about where state lives

**URL state is for narrowings; `localStorage` is for display preferences.** A filtered tape is a
thing a trader reloads, bookmarks and sends to themselves, so every narrowing writes search params.
A column being shown or hidden narrows nothing — sending someone a link should send them your
question, not your column widths — so it persists the way the sidebar and rail collapse do.

**No state may represent absence.** No "you haven't imported in 9 days", no backlog, no catch-up, no
streak. Every surface reopens where it was left.

---

## 8. Component inventory

A component is not done until it appears in the rack **in every state above**, and that is a live
gate rather than a checklist item: the rack is where a component is reviewed, so one that is not in
it has not been looked at.

**Primitives** — `src/components/ui/`

- [x] Button (primary / secondary / outline / ghost, three sizes, loading, disabled)
- [x] Input · Textarea · CodeInput
- [x] Switch (and `Track`, the bare toggle) · Menu
- [x] Card (and `slotSurface`, the recessed slot inside one)
- [x] IconButton · HeaderControl
- [x] Icon — **one set, one wrapper**
- [x] Skeleton · Spinner · LoadingMark · Wordmark
- [x] Filter rows (Head / Row / Chip)
- [x] Sidebar nav row

**Product surfaces** — `src/components/views/`

- [x] Trades tape · summary rail · quarantine notice
- [x] Instrument mark
- [x] Trade drawer, and its parts (Section · Row · CopyButton · Stepper)
- [x] Columns menu
- [x] Intake: progress panel · refusals · checklist · staged file row

**Not built, and each is an absent surface rather than a design gap:** the per-product page (#15),
the account detail page, trade notes (#10), classification (#11). Each returns with its page.

### One icon set, one wrapper

`src/components/ui/icon.tsx`. Hand-drawn is the default, ported verbatim from `run-trading@v2`;
`lucide-react` is the stated fallback for the few names v2 never drew. **Both obey the same
wrapper:** `viewBox 0 0 24 24`, stroke 1.5, round cap and join.

**Never inline an `<svg>`, never generate a UI icon anywhere else.** Stroke weights drifted 50%
across a codebase before this rule, in two builds independently. Lucide's own defaults are 24px at
stroke 2, which is why an unwrapped icon looks almost right and is not.

### The conventions a new component inherits

- **A menu row is not a modal row.** A `Switch` row carries `slotSurface` — a recessed ground that
  steps up on hover — which is right when each row *is* its own slot in a settings sheet, and wrong
  when the rows are a short list inside a small popover. A popover row has **no hover ground at
  all**; measured on the reference, whose columns-menu row carries exactly one rule,
  `cursor: default`.
- **An "active" dot is a corner badge**, `size-2` at the corner of a `relative` control. Inline in
  the label it reads as punctuation and it *moves the label* every time the state changes.
- **A trigger reserves the width of its widest state**, so picking a different value does not shove
  the controls beside it sideways under the cursor.
- **The whole row is the target** for a setting, so the note is part of the hit area rather than
  text beside it. That matters most on a phone, where the note is the widest thing in the row.
- **Truncate on the inner span, never on the flex container.** `truncate` plus `justify-center`
  clips at both ends with the ellipsis nowhere, because a centred flex container overflows
  symmetrically.

---

## 9. Kitchen sink

**Route:** `/kitchen-sink` · **Inherited from `modryn-base`, extended — never rebuilt.**

A single route rendering every component in every state, light and dark. It is the fastest
bug-finder in the project, and the list of things it has caught is the argument for it:
`text-figure` in `rem` in a px ramp · `Textarea` on Tailwind's default `text-sm` · a dark
band/hover collision · a disabled icon button that still lifted · a divider with literally zero
contrast in light mode · a skeleton invisible on a card · a button label clipped at both ends ·
**five instrument-mark hue collisions that no screen would ever have shown.**

It is also where the *system* gets judged, because a design system cannot be evaluated one
component at a time.

**It contains no literal values.** No hex, no px, no font name, no arbitrary Tailwind. It renders
whatever is in `@theme`, so recolouring the system recolours the page, and it cannot impose a look
it does not hold. **The moment a value is hardcoded there, it stops being a mirror of the system
and starts being a second opinion about it.**

**Extend by appending:** one file in `sections/`, one entry in `sections.ts`, one line in
`page.tsx`, all in the same commit as the component. `sections.ts` is **plain data only** — it
carried component references once, two sections are Client Components, and the entire page's client
tree stopped hydrating with nothing logged.

**Where a demo needs state, drive it with `useState`, not the real hook.** The Columns menu's real
hook writes `localStorage`; a rack that rewrote the trader's own preference just by being scrolled
past would be a demo with a side effect.

**Prefer rendering an invariant to restating it.** The hue-collision row is the model: it computes
the check live and turns red on failure, so the guarantee cannot quietly stop being true. A rule
that only lives in a comment is one nobody can see break.

- [x] Every primitive this project added has a section
- [x] Both modes
- [x] **Checked on a real phone** (Luke, 2026-08-20)
- [ ] Deleted or put behind auth before the app goes public (the `/launch` gate asks)

> **"Works on mobile" means a deployed build on a real phone.** A 375px viewport in a desktop
> browser is a width check, not a device check: it has a mouse, so `:hover` fires and every touch
> target passes; it has no on-screen keyboard, no iOS Safari, and no real scroll momentum. The
> rack's 375 column and this rule do different jobs, and only the second one is the gate.

---

## 10. Enforcement

**Checker:** `tailwindcss/no-custom-classname` + `tailwindcss/no-arbitrary-value` ·
**reads tokens from:** `src/app/globals.css` (`cssConfigPath`) — generated from the system, not
maintained beside it.

| Case | Example | Level |
|---|---|---|
| A token that does not exist | `text-body-lg` before it existed | **error** |
| A plausible variant belonging to a *different* system | `bg-elevated`, `rounded-md`, `font-heading` | **error** |
| An arbitrary value, i.e. an inlined one-off | `text-[13px]` | warn |
| An em dash in user-facing copy | `—` in JSX text or a string literal | **error** |

**The second case is why the rule earns its place.** S0 ported primitives whose classes named
`text-accent-foreground`, `bg-elevated`, `rounded-md` and `font-heading`, none of which existed in
this stylesheet. Tailwind emitted nothing for them, silently, so the components rendered unstyled
and typechecked clean.

**Arbitrary values are a warning, deliberately.** Structural arbitraries are legitimate and common
(`content-['']`, `grid-rows-[0fr]`, `transition-[grid-template-rows]`), so as an error this would be
suppressed everywhere within a week and stop meaning anything.

**Allowlist** — hand-written utilities defined in `globals.css` outside `@theme`, and nowhere else.
Each is a CSS *rule* rather than a scale value, which is why `@theme` has nowhere to put it:
`cursor-blink` · `num` · `serif` · `soft-pulse` · `lift-rest` · `lift-press` · `btn-secondary` ·
`pop-in` · `menu-panel` · `panel-transition` · `drawer-transition` · `clip-allow-shadow` ·
`select-pop` · `text-link` · `check-draw` ·
`steps-track` · `scroll-thin` · `no-scrollbar` · `skeleton` · `sr-only` · `group`.

**If this list grows past a handful, that is a signal the system is missing a token, not that the
rule is wrong.**

> **The checker does not see everything.** `no-custom-classname` reads `className` props and
> `cn()`/`clsx()` calls. A class living in a plain object literal — the shape `Button`'s
> `variantClasses` uses — is invisible to it. `btn-secondary` is on the allowlist anyway, because a
> hand-written class that is absent from that list is one nobody can find.

**Verify the checker supports your Tailwind major before trusting it.** Tooling written for v3
reads a JS config that v4 does not have, so it finds nothing and passes everything — worse than no
checker at all.

---

## Known gaps

- **`--shell-header-h: 42px` has zero consumers.** A leftover from the ported system, from when the
  collapsed sidebar left an icon rail; it does not. It is either dead and should go, or it names a
  row that no longer exists and should be renamed. Left in place rather than deleted inside a
  documentation pass.
- **~70 `no-arbitrary-value` warnings are the shadow-indirection workaround**, not sloppiness (§4).
  They resolve if the shadow tokens are ever made directly addressable.
- **Outside-click and Escape handling is hand-rolled in three places** (`menu.tsx`,
  `trades-controls.tsx`, `columns-menu.tsx`) — nearly the same ten lines, none of them shared.
  Not a visual decision, but it is the kind of drift the rack exists to catch.

---

## Phase 3 gate

- [x] Any screen in the wireframes can be built inventing nothing new
- [x] Light and dark both defined and contrast-checked on the rendered element
- [x] Loading / empty / error exist for every interactive component
- [x] Kitchen sink renders everything — every *state*, not just every component, including the bad
      ones: the lapse, the long title, the list at scale
- [x] Keyboard focus is visible everywhere, and it is one treatment
- [x] The token rule is enforced by lint, and the checker has been proven to fire
