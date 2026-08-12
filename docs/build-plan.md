# Build plan — Run v1

> Phase 5 artifact. **Vertical slices, never horizontal layers.**
>
> Horizontal means all the database, then all the API, then all the UI — nothing works until
> the end, and every wrong assumption compounds silently for weeks. Vertical means one user
> story built all the way through, working today, then the next one.

**Opened:** 2026-08-11 · gates `p1`–`p4` all passed · spec and architecture LOCKED

---

## The one structural problem with the obvious order, and the fix

The critical path is **add account → the record → the read**, so the obvious build order ends
with the read. But **the kill signal lives on the read** (`problem-brief.md`):

> If the wedge can't name a pattern Luke didn't already know about himself — stop.

Building it last means the project's stop condition can't fire until nearly everything else is
built. That is exactly backwards: **the cheapest exit is the one you take first.**

**The fix: spike the detector offline, before the product exists.**

`S1` below is a script, not a screen. It reads Luke's real Tradovate exports from disk, runs
candidate detectors, and prints what it finds. No auth, no UI, no database. It fires the kill
signal in days instead of weeks, and it can't be faked — the data is real and Luke already knows
what's in it.

**This does not violate vertical-slice discipline.** A spike is not a layer; it is a
throwaway probe at the single riskiest assumption, and it gets deleted once the real slice
lands. The product still gets built in slices.

<!-- FRICTION 2026-08-11 · P5 · The blueprint says "walking skeleton, then critical path in
     order" and says nothing about what to do when the kill signal sits at the END of that
     order. Amendment candidate for the retro: when a phase 1 kill signal depends on the last
     slice of the critical path, pull a throwaway spike forward to fire it early. -->

---

## Slice order

Each slice is **done** when: it works, handles its error case, handles its empty case, works on
mobile, matches the design system, is merged, and is deployed.

### S0 — Walking skeleton *(day one)*

The thinnest possible end-to-end path, **deployed to real hosting immediately**, while the app
is small enough to debug.

- Next.js + Neon + Drizzle + better-auth from `modryn-base`
- `design/globals.css` in place before any screen exists
- One route, one query, one rendered value, live on a real URL
- **A rollback performed once, on purpose**

*Proves the pipeline works before there is anything to blame.*

**No CI, and the reasoning is recorded so it isn't re-litigated (Luke, 2026-08-11).** S0 originally
carried "CI green on push", lifted from the blueprint's phase 7 bar. It was written and then
deleted the same day, because the bar assumes CI is the only clean-room build and here it is not:

- **Vercel already checks out fresh and builds on every push**, and `next build` runs TypeScript.
  Two of the three CI steps were duplicates of something that already happens.
- **ESLint is the only real gap** — Next 16 no longer runs it during build — and that is
  `npm run lint`, which takes two seconds.
- **"Merging is blocked on green" needs merges.** One person pushing to `main` has no gate for CI
  to be.

The honest conclusion goes further than the deletion: *if Run ships with no automated checks at
all, then CI at phase 7 is ceremony too, and the blueprint's line is inherited convention rather
than a decision.* Filed as an amendment candidate — see `blueprint-instrumentation.md`.

**Revisit when** parallel worktree slices start merging through pull requests (wave 1 onward). A
gate with something to gate is a different proposition.

### S1 — The detector spike *(throwaway, runs in parallel with S0)*

A script over Luke's real exports. **Fires the kill signal.**

- Parse the three CSVs from disk — no DB, no auth
- Pair round trips from Position History; allocate fees by the exact split
- Reconcile the total against Account Balance History **to the cent**
- Run candidate detectors; print each with its working: occurrences, outcomes, baseline

**Gate — this is a real stop:** does it name a pattern Luke didn't already know? If no, the
build stops here and the phase 1 kill signal has done its job for the price of one script.

### S2 — The two primitives everything else is wrong without

Not a screen. The pieces that corrupt everything downstream if they're wrong.

- **The time module** — one function producing every time bucket, session date included. Plus a
  **verification script** in the style of `verify-trade-date.mts`: the highest-risk derived value
  gets a script that checks it, not a test asserting one case.
- **`contract_spec`** — seeded narrow, each row's value carrying its exchange-spec source URL and
  read date. Unknown root → quarantine, never a default.

### S3 — Auth and identity

`trader`, better-auth wiring, `display_timezone` user-settable and outranking detection, and
the nullable `key_id` column — free now, a migration later, with the encryption itself
explicitly deferred (architecture §1).

### S3b — The shell

Every screen sits inside it and no slice owned it, so it would have been built ad hoc inside
whichever page landed first. The constants are already decided (`design-system.md`): 64px shell
header, 224px sidebar collapsing to `w-0` with no icon rail, uncapped page column, 304px rail
that collapses without unmounting.

**Built in wave 2, before S4, deliberately.** The design-check gate is cheap to act on against
an empty shell and expensive against four finished pages — finding a shell defect in S9 means
re-checking every screen that inherited it.

**The gotcha that must be carried over, because it already cost a wrong render:** the layout
constants live in a module with **no `'use client'` at the top, and that absence is the point.**
Every export of a `'use client'` module becomes a client reference when a Server Component
imports it — a plain string does not survive it, and `clsx` silently drops any non-string.
Measured on the old build: the client page rendered the full column while two server-rendered
pages emitted `class="pb-8"` and lost their gutter and max-width entirely. **No error, no
warning, and nobody noticed for two pages.**

### S3c — The kitchen sink

Specced at phase 3 (`design/kitchen-sink.md`), named in a standing rule and in the phase 5
gate, and owned by no slice — so it would have been the thing that never quite got built.
Two routes, one door:

- `/kitchen-sink` — every primitive and every Run composition, in **default · hover · focus ·
  active · disabled · loading · empty · error**, light · dark · side-by-side. Plus the token
  proofs: type ramp, spacing ramp, ground stack, elevation, and the contrast table
- `/kitchen-sink/timing/[ms]` — the generalised timing harness, `?seq=` per sequence

**This is where the ported `v3` primitives and the six Run compositions get built once** —
session header row, account row, summary rail, widget, quarantine notice, read card. Building
them here rather than inside the first page that needs them is what stops a second version
appearing in the second page.

Dev-only, out of the production build and the sitemap, and **no fixture that could be mistaken
for a real read**. It is the enforcement mechanism for this phase's definition of done, so it
has to exist before the definition means anything.

### S4 — Add account + the three-file ingest ⭐ *the biggest slice*

Sub-sliced, because this is where correctness is won or lost:

- **S4a** — `event` log, dedupe key, 1,000-row chunked writes, `import` provenance rows
- **S4b** — the three parsers by header signature; **nothing commits until counts are shown**
- **S4c** — the loud failures: per-round-trip range overlap (`#74`), non-empty fee resolution
  (`#75`), rows-actually-written returned by the write path (`#79`)
- **S4d** — account resolution *inside* the flow (`#59`/`#80`)
- **S4e** — the UI: type step, drop zone, determinate progress with a minimum-visible floor

### S5 — Trades ⭐ *the record*

Session headers carrying net/count/win rate, read-only rows, filtered-set digest, visible
quarantine with S9b's two actions, provenance line.

### S6 — Accounts ⭐

Hero metric selector, groups by state with own totals, **freshness stamp on every row**,
`CLOSED` as a permanent group, summary rail.

### S7 — Read ⭐ *the wedge, now a UI over a proven detector*

The daily read: one pattern, three states (`Finding` / `Watching` / `Quiet`), the working shown,
plus the History tab. The nightly job that generates and stores `read.body` + `read.working`.

### S8 — Today

Monarch's widget contract applied unchanged. Last because every widget links to a page that
must already exist.

### S9 — Polish

Empty states, error copy, keyboard, mobile, dark mode across the kitchen sink.

---

## What runs in parallel

Per the two-plane model: this repo runs several worktree sessions; slices only parallelise where
they don't share a surface.

| Wave | Parallel |
|---|---|
| 1 | `S0` skeleton · `S1` spike · `S2` primitives |
| 2 | `S3` auth · `S3b` shell · `S3c` kitchen sink + ported primitives |
| 3 | `S4` alone — everything downstream depends on its shape |
| 4 | `S5` · `S6` (different pages, same projections) |
| 5 | `S7` · `S8` |

---

## Standing rules for this phase

- **Scope every read by account and window from the first query.** Free now, unretrofittable once
  four surfaces depend on it.
- **Nothing reads `event.payload` on a render path.** Promoted columns or a projection.
- **One module owns every time bucket.** A shared name is not a shared definition.
- **A component isn't done until it appears in the kitchen sink in every state.**
- **"Matches the design system" means the token scan** — every font size is a `text-*` role,
  every gap is one of the named steps, one radius scale, no raw hex in a component, five states
  plus `focus-visible` and a 44px target. The checklist is Pass 2 of
  [`docs/design/design-check.SKILL.md`](design/design-check.SKILL.md), kept as a document now
  that the global `/postcheck` owns the review pass. Its LOCK mode is already spent — the tokens
  were locked at the phase 3 gate.
- **Log friction in the moment** — `// FRICTION <date>: <what>`. Phase 5 is where the blueprint
  gets its real test, because this is where not knowing what to do costs hours rather than
  minutes.

---

## Phase 5 gate

- [ ] Every merged slice is independently demoable
- [ ] `S1` fired or cleared the kill signal, and the result is recorded
- [ ] Reconciliation matches the broker to the cent on Luke's real export
- [ ] Kitchen sink renders every component in every state, both modes
- [ ] The critical path works end to end for a switcher with no prior data
