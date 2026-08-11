# Design system — Run

> Phase 3 artifact. Every visual and interaction rule, decided once.
> **If a screen needs a value that isn't in this file, add it here first, then use it.**
> Never inline a one-off. One-offs are how a design system dies.

**Status:** draft — values proposed, two decisions need Luke
**Last amended:** 2026-08-11

<!-- CLEAN-SLATE DOOR OPENED 2026-08-11 · Luke: "for phase 3 design system, i want to use what
     we have in v3 branch" → modryn-hq@v3:playbooks/design-system.md and ui-ux-standards.md. -->

---

## 0. What this file is, and what it inherits

**The rules come from `modryn-hq@v3:playbooks/design-system.md` and are not re-litigated here.**
That doc is the studio's positive spec: token block first, primitives second, shell third, data
last; 8-based spacing with one 4 half-step; eight type roles and no hand-picked sizes; all
states on every primitive; both modes always; the `/design-check` ship gate. It fixes the
**rules**; each project picks the **values**.

**This file picks Run's values and adds the layer the studio doc can't know about** — a trading
instrument has requirements a generic app doesn't (§4).

**On `ui-ux-standards.md`:** demoted 2026-08-07 to observations, not gates. Its failure modes
are still worth recognising; it does not block a decision, and where it disagrees with a live
reference, the reference usually wins.

**Craft recon (the phase 3 step) is already done** — `ia-teardown.md` §1.7 measured Monarch's
app live rather than describing it. Those measurements are the standard below.

---

## 1. The named standard

Decisions get measured against this instead of argued about taste.

> **`app.monarch.com` — a calm, dense, 16px instrument in a single grotesque.**
> Measured 2026-08-10: warm paper `#f6f5f3`, cards pure white, ink `rgb(34,32,29)` — a warm
> near-black, **never `#000`**. One type family, no serif in-app. Base 16px/400, buttons
> 14px/500. Cards `12px` radius with an **ink-tinted** elevation `rgba(34,32,29,.1) 0 2px 4px`,
> not a grey shadow. Buttons and nav rows `8px`.

**The trap, flagged in the teardown and repeated here because it is the most likely mistake:**
`monarchmoney.com`, the *marketing* site, is big-type editorial — 48px/350, Copernicus serif.
The app is none of those things. **Do not carry the marketing register into the product on
Monarch's authority.**

**The counter-example, also measured:** TradeZella ships the system font stack, pure `rgb(0,0,0)`
ink, Highcharts defaults, and `BETA`/`NEW` badges in primary nav. The teardown's verdict —
*"restraint by absence of decisions rather than by decision"* — names the thing Run must not be.
Restraint that comes from not choosing looks identical to laziness, because it is.

---

## 2. Run's values

### 2.1 Color

Warm-neutral base following the standard. **Never pure white on pure black in either mode.**

| Token | Light | Dark | Role |
|---|---|---|---|
| `bg` | `#f7f6f4` | `#111110` | page background |
| `surface` | `#ffffff` | `#1a1a18` | cards, panels, rows |
| `elevated` | `#ffffff` | `#232320` | modals, popovers, drawers |
| `border` | `#e6e3de` | `#2e2e2a` | dividers, input borders |
| `border-strong` | `#d3cfc8` | `#403f3a` | emphasis, table rules |
| `text` | `#22201d` | `#eceae6` | primary ink — warm near-black |
| `muted` | `#6b6862` | `#9b978f` | secondary |
| `subtle` | `#918d86` | `#6f6c66` | tertiary, placeholders |
| `accent` | `#1f5f8b` | `#4f9ecb` | the one primary action |
| `accent-foreground` | `#ffffff` | `#0d1b24` | on-accent text |
| `focus-ring` | `#1f5f8b` | `#4f9ecb` | keyboard focus |

**Why this accent, and why not the obvious ones.** In a trading product **green and red are
reserved for data** (§4.1) — an accent in either would collide with the single most important
signal on screen. Violet is a hard studio ban and the LLM default. That leaves a considered
blue: `#1f5f8b`, a deep instrument blue, desaturated enough to sit under warm neutrals without
fighting them, and clearly separable from the gain green for red-green colour deficiency.

**⬜ Needs Luke:** the accent is a proposal, not a decision. It's the one value that carries the
brand.

### 2.2 Type

**⬜ Needs Luke — this is the highest-stakes open value.** The studio doc is explicit that
shipping `system-ui`/Geist/Inter as the identity is a reject, and Monarch's ABC Oracle is
commercially licensed.

**Proposal: IBM Plex Sans (UI) + IBM Plex Mono (numerals).** Reasoning rather than taste:
open-licensed so there's no procurement step; a real point of view (drawn for technical
products, slightly mechanical, unlike the neutral grotesques everything defaults to); and the
mono companion is designed alongside it, which matters because **this product is mostly
numbers**. One family for UI, one for figures, no third.

Scale — the eight studio roles, values held from the standard's 16px base:

| Role | Size | Line-height | Weight | Use |
|---|---|---|---|---|
| `display` | 40px | 44px | 600 | one per page, at most |
| `h1` | 30px | 36px | 600 | page title |
| `h2` | 22px | 28px | 600 | section |
| `h3` | 18px | 24px | 600 | card / group title |
| `body-lg` | 18px | 28px | 400 | the read's prose |
| `body` | 16px | 24px | 400 | default |
| `small` | 14px | 20px | 400 | secondary, controls |
| `caption` | 12px | 16px | 500 | labels, stamps |

Hierarchy comes from **weight + size + colour**, never from six invented sizes.

### 2.3 Spacing, shape, motion

- **Spacing:** studio scale unchanged — `4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 128`. Base
  rhythm 8; 4 only for tight internals. No arbitrary values, no odd steps.
- **Radius:** `sm 6px` (inputs, chips) · `md 10px` (buttons, rows) · `lg 14px` (cards, modals).
  Full radius only for avatars and toggles.
- **Elevation:** borders and a surface step do the work. Where a shadow is needed it is
  **ink-tinted, not grey** — `rgba(34,32,29,.10) 0 2px 4px` — following the standard.
- **Motion:** `fast 120ms` (hover, focus) · `base 200ms` (enter/exit). `ease-out
  cubic-bezier(0.2,0,0,1)`. No spring, no bounce. Respect `prefers-reduced-motion`.

### 2.4 Layout

- Sidebar **224px** fixed, collapsible — matching the measured standard, inside the studio's
  240–280px guidance at the low end because four rows don't need width.
- App content max-width **1280px**. The read's prose column max-width **680px** — prose is
  reading, not dashboard, and full-bleed body text is a studio ban.
- Breakpoints: mobile `<640`, tablet `768`, desktop `1024 / 1280`.
- **The locked-shell overflow rule applies**: every inner scroll pane needs `overflow-y-auto`
  + `min-h-0`. Test every page at a short window height.

---

## 3. States

The studio's six, plus the two the blueprint requires. **The last three are what separate a
real app from a demo.**

| State | Rule |
|---|---|
| Default | resting, token colours |
| Hover | subtle bg/border shift, 120ms ease-out. Not a colour explosion |
| Active | slight darken or `scale-[0.98]` |
| Focus-visible | visible ring. Accessibility, not optional |
| Disabled | `opacity-50`, no hover |
| **Loading** | skeleton or in-place spinner, **no layout shift** |
| **Empty** | names what's missing and offers exactly one action, in the user's vocabulary |
| **Error** | says what happened and what to do next. Never a raw exception or status code |

Hit targets ≥ 44×44px.

---

## 4. The trading layer

Rules the studio doc cannot know, derived from the spec's principles. **This section is where
Run is won or lost visually**, because it governs how a number carries meaning.

### 4.1 Gain and loss — the most important colour decision in the product

- **Green = gain, red = loss.** Jakob's Law: this convention is decades old in every trading
  platform. Do not invent.
- **`success` / `danger` are reserved for P&L.** They never mean "button" or "status" anywhere
  in the product. This is why the accent is blue (§2.1).
- **A sign is always present.** `-$563.50`, `+$318.75`. **Colour is never the only carrier of
  meaning** — roughly 1 in 12 men has red-green colour deficiency and this audience skews
  heavily male. A user who sees no colour at all must read the figure correctly.
- **Colour the figure, not the row.** Full-row tinting turns a losing week into a wall of red
  and makes the screen unreadable. The number carries the colour; the surface stays neutral.
- **Zero is neutral**, never green.

| Token | Light | Dark |
|---|---|---|
| `gain` | `#1a7f4b` | `#4ec27f` |
| `loss` | `#b3261e` | `#f2837c` |
| `flat` | = `muted` | = `muted` |

Both pass 4.5:1 on their own surface in both modes. **Verify before shipping, don't assume.**

### 4.2 Numerals

- **`tabular-nums` everywhere a figure appears.** Non-tabular numerals in a column are a
  correctness bug, not a style choice — misaligned digits are misread.
- **Money right-aligned in tables**, so magnitudes line up.
- **Two decimal places for currency, always.** `-$563.50`, never `-$563.5`.
- **Precision follows the instrument** for prices — MNQ quotes in quarter-points (`19,204.25`)
  and must not be rounded to two decimals by a generic formatter.
- **Thousands separators always.** `$4,008.96`.
- Negative uses a **minus sign, not parentheses** — accounting parens read as unfamiliar to
  traders and collide visually with the sign convention above.

### 4.3 Freshness and staleness (P5)

Every account row carries a relative stamp, always visible, never hidden behind a hover.

| Condition | Treatment |
|---|---|
| Fresh | `caption` in `muted` — *"2h ago"* |
| Stale | `caption` in `warning`, with an icon — *"3 days ago"* |
| Never read | `caption` in `muted` — *"never synced"*, never blank |
| Failed | `warning` treatment plus the one action that resolves it |

**A blank freshness stamp is a bug.** The absence of the signal is exactly the failure the
product exists to prevent.

### 4.4 Quarantine and exclusion

- A quarantined trade is **visibly present and visibly excluded** — struck or dimmed, with a
  reason, never omitted.
- Any figure computed over a set containing quarantined trades states the exclusion count
  inline. Silence here is the field's cardinal sin.
- An excluded-by-user trade (S9b) reads as *acknowledged*, not as an error.

### 4.5 The read's three states (S5)

| State | Visual weight | Rule |
|---|---|---|
| **Finding** | full card, `body-lg` prose, the working shown beneath a rule | a real, costed pattern |
| **Watching** | same card, `muted` label, **no dollar figure** | a candidate below the floor. Never costed as though established |
| **Quiet** | same card, unchanged structure | *"it didn't happen yesterday."* Good news, said plainly |

**The structure does not change between states.** A user must never learn to dread the layout —
the shape is constant, only the content moves. Quiet is not a degraded Finding.

### 4.6 Provenance (P8)

The trust note is `caption` in `muted`, at the foot of every surface presenting computed
figures. It names the source, the accounts, the range, and when it was read. It is not a
tooltip, not behind an icon, and not dismissible.

---

## 5. Component inventory

Built in isolation, before any screen. Each ships with all eight states.

**Primitives:** Button (primary / secondary / ghost / danger) · Input · Select · Checkbox ·
Toggle · Card · Modal · Drawer · Toast · Tabs · Skeleton · EmptyState

**Run-specific:** `Figure` (the money/number primitive — sign, colour, tabular, precision, all
in one place so §4.1 and §4.2 are enforced by construction, not by discipline) ·
`FreshnessStamp` · `SessionHeader` · `AccountRow` · `TradeRow` · `SummaryRail` ·
`ProvenanceNote` · `ReadCard` (three states) · `WidgetCard` (Monarch's contract: title-links,
headline value with delta, scope control, body)

> **`Figure` is the highest-value component in this system.** Every §4.1/§4.2 rule lives inside
> it. If money is ever rendered without it, those rules become things people remember to do,
> and they will stop being done.

---

## 6. Kitchen sink

One route rendering every component in every state, both modes, mobile and desktop.
**Route:** `/kitchen-sink`

Must include: a losing session and a winning one; a stale account; a quarantined trade; all
three read states; a 20-character symbol; a `-$1,644,200.00` figure; zero; and an empty
account list.

---

## Phase 3 gate

- [ ] **Font decided** (§2.2)
- [ ] **Accent decided** (§2.1)
- [ ] Token block written to `globals.css`, both modes
- [ ] Every wireframe screen buildable with no new values invented
- [ ] `gain` / `loss` verified at 4.5:1 in both modes
- [ ] All eight states exist on every primitive
- [ ] Kitchen sink renders everything
- [ ] `/design-check` passes
