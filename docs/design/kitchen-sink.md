# The kitchen sink — spec

> Phase 3 artifact. One route that renders every component in every state, both modes — plus a
> timing harness for the states you can only judge in motion.
>
> **One door marked "look at the pieces."** Not two unrelated dev routes that get forgotten.

---

## Why it earns its place

It is the fastest bug-finder available, and dark mode doubles that — Run ships a fully
specified dark theme whose scrims, shadows and pressed grounds are **per-mode literals, not
inversions**. Every one of those is a thing that can be wrong in exactly one mode, which is the
kind of bug nobody finds by using the app normally.

It is also the enforcement mechanism for this system's central rule: *if a screen needs a value
that isn't in the system, add it to the system first.* A rack of every component makes a new
one-off visible immediately, because it won't have a home.

---

## Two routes, one door

| Route | Question it answers |
|---|---|
| `/kitchen-sink` | **Does it look right?** — every component, every static state, both modes |
| `/kitchen-sink/timing/[ms]` | **Does it feel right?** — any timed sequence, replayed at a chosen duration |

**They are genuinely different questions and neither subsumes the other.** A static rack cannot
tell you whether a four-step import panel flashes past or drags; a timing harness cannot tell you
whether a disabled button is legible in dark mode. Luke's call, 2026-08-11 — keep the harness,
put it under the same door.

Ported from `run-trading@v2`'s `preview-loading/[ms]`, which is proven and cheap. Two changes:
it moves under `/kitchen-sink`, and it is generalised (below).

---

## `/kitchen-sink` — the rack

### Controls, pinned to the top

- **Theme:** light · dark · **side-by-side** (the third is the one that finds bugs)
- **Width:** mobile 375 · tablet 768 · desktop 1280 · ultrawide 1920 — the last because
  `PAGE_COLUMN` is deliberately uncapped and that decision needs somewhere to be looked at
- **Density:** normal · long-text (every string replaced with ~3× the length)

### Every component, in every state

For each: **default · hover · focus · active · disabled · loading · empty · error.** The last
three are what separate a real app from a demo, and they are exactly the ones a normal page
visit never shows you.

**Primitives** (ported from `v3` at build time)
`Button` (primary / secondary / ghost, sm / md / lg) · `Input` · `Textarea` · `Switch` ·
`Menu` · `Card` · `IconButton` · `Spinner` · `LoadingMark` · `Tooltip` · `Wordmark` ·
`CodeInput` · the full `Icons` set at one stroke weight

**Run compositions** (from the phase 2 wireframes — these don't exist yet and this is where they
get built once)
- **Session header row** — a `--color-band` strip carrying net, count, win rate
- **Account row** — name, type, sparkline, value, **freshness stamp** (fresh / stale / never synced)
- **Summary rail** — labelled digest, Totals/Percent toggle, and **its collapsed state**
- **Widget** — title-links-to-page, headline value with delta, scope control, body
- **Quarantine notice** — visible exclusion with re-sync and exclude-with-reason (S9b)
- **Read card** — all three daily states: **Finding · Watching · Quiet**
- **Instrument mark** — all seven hues, light and dark, at `--mark-tint`

### Token proofs

Not decoration — each is a claim in the system that can silently drift:

- **Type ramp** — every step, its name, px, line-height and baked weight, in one column
- **Spacing ramp** — 1 / 2 / 3 / 4 / 6 / 8 / 12 / 16 rendered as bars, labelled
- **Ground stack** — `bg` → `surface` → `surface-2` → `hover` → `band` as adjacent swatches.
  **This is the one that catches the invisible-difference bug** — the reason `--color-band`
  exists is that `hover` on a card was a difference you could prove and could not see.
- **Elevation** — `shadow-sm` / `shadow-card` / `shadow-press`, both modes, since dark needs ~4×
  the alpha
- **Contrast** — every ink-on-ground pair with its measured ratio and a pass/fail against 4.5.
  `faint` is aliased to `muted` precisely because this check failed once at 3.43:1.

---

## `/kitchen-sink/timing/[ms]` — the harness

### What it does today

`v2`'s version replays the import progress panel at an arbitrary total duration, so a sequence
that finishes in 16ms on real data can be watched at 4000ms and judged.

That exists because of a real finding: **Luke's whole corpus is 80 events, so all four import
steps resolve inside one frame** — the panel appears and vanishes and the modal blinks shut.
`MIN_STEP_VISIBLE_MS` is the fix, and this harness is how you tune it.

### The generalisation

It is currently import-specific. **The same harness works for any timed sequence, and Run will
have more of them.** So it takes a named sequence:

```
/kitchen-sink/timing/[ms]?seq=import
/kitchen-sink/timing/[ms]?seq=read-generate
/kitchen-sink/timing/[ms]?seq=account-refresh
```

A sequence is a list of `{ key, label, weight }`. The harness distributes `ms` across the steps
by weight and plays it. Registering a new one is adding an entry to a map — not touching the
harness.

**Standing caution, carried from the v2 finding:** the original step timings were real
measurements of a **3,420-row batch — ~40× heavier than a daily session.** Measured, but
calibrated to the wrong load. Any sequence registered here states **what load its timings were
measured against**, so the next person can tell whether the rhythm is one a user will ever
experience.

### Controls

- **Total duration** from the route param; presets for 0 / 250 / 1000 / 4000ms
- **Replay** without a reload
- **Step through** manually, for judging one beat at a time
- **Reduced-motion toggle**, to check the sequence still reads with animation suppressed

---

## Build rules

- **Not shipped to production.** Dev-only route, excluded from the production build and from any
  sitemap.
- **No fixtures that imply real data.** Placeholder values are obviously synthetic — never a
  plausible P&L figure that could be screenshotted and mistaken for a real read.
- **A component is not done until it appears here in every state.** This is the concrete meaning
  of the phase 5 definition of done.
- **Ordered by the system, not by the app** — primitives, then compositions, then token proofs.
  It is a rack, not a tour.
