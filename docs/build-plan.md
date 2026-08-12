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

#### What actually happened, recorded 2026-08-12 because it amends the reasoning above

**The manoeuvre worked and the artefact was not what it predicted.** Pulling the kill signal
forward was right — it fired, in the affirmative, before a screen existed. But `S1` did not
produce a throwaway probe. It produced the data layer, written to the locked doctrine, that four
later slices sit on. Almost none of it gets deleted.

The reason is worth keeping, because it will recur: **the riskiest assumption was not reachable
by a cheap probe.** Answering "can this name something Luke doesn't know" required a correct
tape, and a correct tape is a parser set, a fee allocation that reconciles to the cent, and a
session boundary that agrees with the exchange. There is no throwaway version of those. The probe
was cheap only in the sense that it skipped the database and the UI.

**So the rule generalises with a caveat:** pull the kill signal forward, and then check what the
probe actually built before calling it disposable. A spike that had to be *correct* to answer its
question is production code that has not been labelled yet. `S1` was labelled a spike for a day
longer than it was one.

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
- The phase 3 stylesheet in place as `src/app/globals.css` before any screen exists
- One route, one query, one rendered value, live on a real URL
- **A rollback performed once, on purpose**

*Proves the pipeline works before there is anything to blame.*

**✅ CLOSED 2026-08-11.** `/status` reads `contract_spec` from Neon at request time and renders the
deployed commit SHA, live at `run.trading`. Type, grounds and tokens measured on the deployed page
rather than locally — including `--mark-4`, the token a build step silently tree-shook once before.

**The rollback, performed: ~20 seconds**, well inside the blueprint's five-minute bar. The steps,
so they exist before they are needed at 3am:

1. Vercel → **Deployments** → pick the last known-good build → `⋯` → **Promote to Production**
2. Confirm on `/status`: the **Build** SHA is what makes this verifiable rather than assumed. Roll
   back and it changes in front of you
3. Roll forward the same way. Promotion is not destructive — every prior deployment stays

*Recorded because an untested rollback is a belief, not a rollback, and because "about 20 seconds"
is only knowable by having done it once on purpose.*

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

### S1 — The data layer, and the read engine *(merged, not deleted)*

**RECLASSIFIED 2026-08-12 (Luke). This was written as a throwaway spike and it is not one.**

A spike is a probe you delete once it has answered its question. The question was the kill signal,
it fired in the affirmative, and the probing is over. What the slice actually produced is
**production code written to the locked doctrine** — the time module exactly as `architecture.md`
§4 specifies it, point value derived per the amendment that section now carries, micro-unit prices,
one module owning every time bucket. Roughly 80% of it is the data layer that `S2`, `S4`, `S5` and
`S7` all sit on.

Calling it a spike after the fact invites the one failure that costs the most: **the next reader
assumes this is scratch and rewrites it.**

**What merges, and what is genuinely disposable:**

| | |
|---|---|
| **Production** | `lib/time/session.ts` · `lib/csv/*` · `lib/fees/allocate.ts` · `lib/desk/tape.ts` |
| **Proven engine, output shape UNRESOLVED** | `lib/desk/{render,lenses,read}.ts` — see the note at `S7` |
| **Disposable** | `scripts/s1-render.mts` · `scripts/s1-boundary-check.mts` |
| **Disposable, but has a home** | `scripts/s1-gate.mts` → becomes `S2`'s verification script |

**The done bar is production, and the seven-point definition does not apply** — "works on mobile,
matches the design system" is meaningless for a parser library. Its bar instead:

- `tsc` and `eslint` clean
- **the gate passes against the real export**, reconciling to the broker at $0.00
- every defect found during the port has an assertion behind it, not a comment
- **nothing in `lib/` reads the database.** This is the load-bearing one: it is what lets the same
  code serve a disk script today and a server route in `S4`, and it is why the port was possible
  at all

#### ✅ GATE CLEARED 2026-08-12, before the slice was written

The `run-trading@desk-call` worktree already ran this against the real ten-day tape, and it named
the MNQ→NQ multiplier finding that Luke confirms he did not know (`problem-brief.md`). **The build
continues.** S1 is therefore a **port and a re-verification**, not an investigation.

**REWRITTEN 2026-08-12: "run candidate detectors" was the architecture that already failed.** The
previous build had a hand-coded metric engine and killed it for two reasons: it could not notice
anything it had not been told to look for, and it shipped a false read that would have cost the
trader $960 in bad advice. The replacement, proven across five test phases and 30+ runs with zero
fabricated figures, is:

```
4 CSVs -> parsers -> resolved tape -> render -> 2 lenses -> synthesizer -> number check
```

**Code resolves every ambiguity before a model sees anything; the model reasons and never
resolves.** Every one of the 15 constraints in that build's record was earned by an observed
failure, and every fix moved a derivation *into* code rather than into a prompt.

- Parse the four CSVs from disk — no DB, no auth. `Orders` is required (`spec.md` §S1)
- Round trips from Position History; fees by the exact per-contract-per-side split
- Reconcile against Account Balance History **to the cent** — the ported tape already does this at
  $0.00 across two independent sets
- Derive point value per `symbol_root`; **agreement at n≥2, never a median** (`architecture.md`)
- Resolve direction, outcome, exit mechanism and cancel cause in code
- Assert fee plausibility in code, not in the read
- Then the read itself, and check every figure against the tape's whitelist

**Do not port these three as written:** the median point value, the UTC-calendar trading day, and
the two-decimal price formatter. Each is a defect this project has already documented a rule
against.

### S2 — The two primitives everything else is wrong without

Not a screen. The pieces that corrupt everything downstream if they're wrong.

**MOSTLY DELIVERED BY `S1` — read this before starting it.**

- ✅ **The time module** — `lib/time/session.ts`, done. One function producing the session date
  from `exit_at`, `SESSION_BOUNDARY_ZONE` and `_HOUR` travelling together, a named IANA zone, and
  a display formatter that can never be mistaken for a bucketer. **Its verification script is
  `scripts/s1-gate.mts` §4**, which asserts the roll in both DST directions — this is the
  "verification script in the style of `verify-trade-date.mts`" the plan asks for.
  - **Still to do:** the other buckets. Week, month and year-to-date are named in
    `architecture.md` §4 as belonging to this module and only the session date exists.
  - **Known limit, measured:** Luke's corpus contains **zero fills after the 17:00 CT roll**
    (`scripts/s1-boundary-check.mts`), so the boundary is proven only synthetically. Real evening
    data would exercise it; nothing available does.
- ⚠️ **`contract_spec`** — **changed shape.** `point_value_cents` is gone; the multiplier is
  derived from the trader's own round trips (`architecture.md`), and that derivation already
  works — MNQ $2.00, NQ $20.00, solved from the broker's realised P&L with no table.
  - **Still to do:** the table for what cannot be derived — `tick_size`, `currency`, `exchange`
    (which drives the session calendar) — and its seeding.

### S3 — Auth and identity

`trader`, better-auth wiring, `display_timezone` user-settable and outranking detection, and
the nullable `key_id` column — free now, a migration later, with the encryption itself
explicitly deferred (architecture §1).

### S3b — The shell

Every screen sits inside it and no slice owned it, so it would have been built ad hoc inside
whichever page landed first. The constants are already decided (`design-system.md`): 64px shell
header, 224px sidebar collapsing to `w-0` with no icon rail, uncapped page column, 304px rail
that collapses without unmounting.

**Built in wave 2, before S4, deliberately.** The review gate is cheap to act on against
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

**`S1` delivered the pure, disk-side half of this slice. Everything touching the database is
untouched, and that is exactly the seam:**

- **S4a** — `event` log, dedupe key, 1,000-row chunked writes, `import` provenance rows.
  **Nothing delivered.** All of it is persistence
- **S4b** — ✅ **delivered.** Four parsers, detected by header signature rather than filename, with
  dedupe, in `lib/csv/`. `Orders` included. What remains here is only *"nothing commits until
  counts are shown"*, which is UI and a write path
- **S4c** — the loud failures: per-round-trip range overlap (`#74`), non-empty fee resolution
  (`#75`), rows-actually-written returned by the write path (`#79`).
  ✅ **The fourth is delivered** — fee plausibility is asserted in the tape and the gate proves a
  47× corruption trips it. The other three are write-path work
- **S4d** — account resolution *inside* the flow (`#59`/`#80`)
- **S4e** — the UI: type step, drop zone, determinate progress with a minimum-visible floor

### S5 — Trades ⭐ *the record*

Session headers carrying net/count/win rate, read-only rows, filtered-set digest, visible
quarantine with S9b's two actions, provenance line.

### S6 — Accounts ⭐

Hero metric selector, groups by state with own totals, **freshness stamp on every row**,
`CLOSED` as a permanent group, summary rail.

### S7 — Read ⭐ *the wedge* — ⛔ **BLOCKED, and not on engineering** ([#2](https://github.com/modryn-studio/run-rebuild/issues/2))

The daily read: one pattern, three states (`Finding` / `Watching` / `Quiet`), the working shown,
plus the History tab. The nightly job that generates and stores `read.body` + `read.working`.

**The engine exists and its output does not fit the spec.** `S1` merged a proven read pipeline —
two lenses, a synthesizer, a number check — that produces **a letter**: free-form, one subject,
roughly 150–450 words. The Read page in `spec.md` §4.2 is built on **a pattern**: an object with a
name, a status, an occurrence count, a running dollar cost, and citable trades, tracked across
months. Those are not the same artefact, and the gap is not a layout problem:

| `spec.md` / `architecture.md` expects | The desk call produces |
|---|---|
| `pattern` row — key, `watching`/`named`/`improving`/`resolved` | nothing persistent; each read is independent |
| `pattern_occurrence` — session date, trade, cost, outcome | nothing |
| `read.pattern_id` | no pattern to point at |
| `read.working` — occurrence count, outcome count, baseline | prose only |
| `read.state` — finding / watching / quiet | no state; it always has something to say |
| History — *"named Jul 14 · $4,215 · ↑41%"* | no named claim to track |
| The confidence floor — 8 occurrences + baseline separation | no occurrences to count |

**Three specified things therefore have no source:** the Patterns tab's *working*, the three daily
states, and the entire **History** tab — which the spec calls *"the tab neither competitor has"*
and *"where the corpus becomes visible."*

**This is the same question as the reopened confidence floor** (`spec.md` §8), not a second one.
The spec models a **pattern**: repeated, counted, priced, tracked. The proven engine produces a
**reading**: one subject, this tape, now. The finding that cleared the kill signal is a reading —
it happened once and no floor would have passed it.

**Both are defensible products. v1 currently specifies one and has an engine for the other.** That
is a phase 2 decision and it is Luke's. Until it is made, `S7` cannot be specified, and nothing
downstream of it should be built on the assumption that either shape won.

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
| 1 | `S0` skeleton · `S1` data layer + read engine · `S2` primitives (mostly folded into `S1`) |
| 2 | `S3` auth · `S3b` shell · `S3c` kitchen sink + ported primitives |
| 3 | `S4` alone — everything downstream depends on its shape |
| 4 | `S5` · `S6` (different pages, same projections) |
| 5 | `S8` · `S7` **only once the pattern-vs-reading decision is made** |

---

## Standing rules for this phase

- **Scope every read by account and window from the first query.** Free now, unretrofittable once
  four surfaces depend on it.
- **Nothing reads `event.payload` on a render path.** Promoted columns or a projection.
- **One module owns every time bucket.** A shared name is not a shared definition.
- **A component isn't done until it appears in the kitchen sink in every state.**
- **"Matches the design system" means the token scan** — every font size is a `text-*` role,
  every gap is one of the named steps, one radius scale, no raw hex in a component, five states
  plus `focus-visible` and a 44px target, and no utility naming a token that does not exist. That
  checklist, and the composition squint test above it, live in the global `/postcheck` skill.
  Run it when a slice reaches its stopping point.
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
