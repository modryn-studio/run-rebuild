---
name: design-check
description: >
  Enforce the Modryn design system on the UI — the anti-slop gate. Two modes. LOCK (run first,
  before building components): establish the token system in globals.css — color roles for both
  modes, the type scale, spacing rule, radius, motion — so structure isn't improvised per component.
  REVIEW (default; run before any UI is called done, or whenever it looks generated): run the ship
  gate — squint test + token scan + content/shell checks — produce a findings table, then fix the
  violations. Trigger on "design check", "deslop", "lock the design system", "fix the UI", "does this
  look designed", or before handing off any screen. Full spec: modryn-hq/playbooks/design-system.md.
argument-hint: "[lock | review (default) | path/to/component]"
---

<!-- Sync: master copy in modryn-boilerplate/.claude/skills/design-check/. Mirror any edit there (and
     vice versa) until the boilerplate is rebuilt off your-project. -->


# /design-check — the anti-slop gate

The studio's UI fails review when it looks *generated, not designed*. This skill enforces the
positive spec in [`modryn-hq/playbooks/design-system.md`](../../../../modryn-hq/playbooks/design-system.md)
and the bans in `ui-ux-standards.md`. **Read the design-system doc first** — it's the source of truth;
this skill operationalizes it. Don't restate the values from memory; open the doc.

Two modes. If the arg is `lock`, run LOCK. Otherwise run REVIEW (optionally scoped to a path).

---

## LOCK — before building components

The single biggest anti-slop lever is that the token system exists *before* the first component.
Run this at the start of a build (or when `globals.css` is still colors-only):

1. Open `src/app/globals.css`. Confirm the `@theme` block carries **all** of: color roles for **both
   modes**, the 8-role type scale (`text-display … text-caption`), the radius scale, motion easing.
   If any are missing, paste the canonical block from the design-system doc and recolor per brand.
2. Confirm the brand isn't a default: not Geist/Inter/system-ui as the display face, not a violet
   accent, not gradient/glow decoration. If it is, that's the first fix.
3. Confirm `src/components/ui/` has the primitives the screen needs (button, input, select, card,
   modal, badge), each with all five states (default/hover/active/focus-visible/disabled + loading
   where async). Build the missing ones now, not later.
4. Report what's locked and what you set. Only then build screens.

---

## REVIEW — the ship gate (default)

Inspect the actual rendered output and the code. Prefer reading the source; if a preview is running
and the change is visual, look at it. Run all three passes, then report, then fix.

### Pass 1 — Squint test (composition)
- Is there **one** clear focal point / primary action? (Von Restorff, Hick's Law)
- Real hierarchy, or flat and monotone? Fix with weight + size + color, not more boxes.
- Does the **one** accent draw the eye to the right thing, or is color sprayed everywhere?
- Do groups read by **spacing/proximity**, or by borders-in-borders? Replace dividers with whitespace.

### Pass 2 — Token scan (code diff)
- Every font size is a `text-*` **role** — flag any hand-picked `text-3xl/text-sm/[15px]`.
- Every spacing is an **allowed step** (`4 8 12 16 24 32 48 64…`) — flag arbitrary `[13px]` and odd steps (`5 7 9 11 3.5`).
- **One** radius scale — flag mixed/random radii and pill-everything.
- Colors are **role tokens** (`bg-surface`, `text-muted`, `text-accent`) — flag raw hexes in components.
- Every interactive element has all **five states** + `focus-visible` ring + **≥44px** hit target.
- No banned tells: default-font brand, gradient CTA/text, glow blobs, glassmorphism, emoji-as-UI, badge clutter.

### Pass 3 — Content + shell
- No lorem; real button verbs ("Save changes" not "Submit"); real error copy.
- Tested with **long / empty / many** data — layout survives a 30-char email and an overflowing name.
- **Both modes** pass every check.
- Nothing unreachable at a **short viewport** — locked shells give every inner pane `overflow-y-auto` + `min-h-0`.
- Every control does what its label says — no dead buttons.

### Report, then fix
Output a findings table — `File · Line · Category · Fix` — **composition issues first, then token/line
fixes**. Then apply the fixes (smallest edits that resolve each; don't redesign what's already
intentional and distinctive). Re-run Pass 2 on the diff to confirm zero violations remain. State the
verdict: **ship** or **still failing on N**.

Never grade your own homework silently — if you *wrote* the UI this session, say so and be adversarial.
