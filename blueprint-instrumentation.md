# Blueprint instrumentation — Run (clean rebuild)

> **The blueprint is the product. This build is the beta. The friction log is the analytics.**
>
> This file exists to stop the most common failure in process work: finishing a build,
> saying "that went fine," and learning nothing. You cannot evaluate a process
> retroactively — at the end you'll remember the last 10% and rationalize the rest.
> So instrument it the same way phase 8 instruments a product.

**Build:** Run — clean rebuild (`modryn-builds/run-rebuild`)
**Blueprint version:** `modryn-hq@v4:playbooks/web-app-blueprint.md`, as of 2026-08-11 (uncommitted at start)
**Started:** 2026-08-11
**Retro due:** at phase 7 gate — before the next build starts, not "sometime"

**Clean-slate rule:** this build uses no prior knowledge of `run-trading`, `modryn-hq@v2`, or
`modryn-hq@v3` unless Luke explicitly opens a door. Luke's *lived experience* of building
run-trading is not prior knowledge — it's discovery input, and Q6 depends on it.

---

## Part 1 — Open questions (write these BEFORE you start)

Questions written *after* a build are answers in disguise. Commit these first.

| # | Question | Why it matters | Answer (fill at retro) |
|---|---|---|---|
| Q1 | Is design system (phase 3) before architecture (phase 4) actually the right order? | The order is asserted, not proven | |
| Q2 | Did the NOT IN V1 list hold, or did scope creep back in? | If the scope cut doesn't hold, phase 2 is theater | |
| Q3 | Did the EARS acceptance criteria survive contact with real code? | They're the anti-drift mechanism; if they're ignored they're overhead | |
| Q4 | How long did each phase actually take vs. expectation? | Wrong weighting is why people skip phases | |
| Q5 | Which gate did I most want to skip, and what happened? | The gate you want to skip is the one carrying the most weight | |
| Q6 | Does the blueprint prevent the specific things that made run-trading a mess? | The only question grounded in evidence rather than theory — see the mess list below | |

**Rule:** do not add questions after phase 5. Late questions are conclusions looking for support.

---

### Q6 — the mess list

Q6 is checkable only against a named list. These are Luke's own words on what went wrong
building run-trading, recorded before this build starts. At retro, each line gets a yes/no:
**did the blueprint prevent this?**

Luke's words, 2026-08-11: *"I never knew when a feature was done. I could never actually
start a feature and know when it should be done. Felt like I had no structure. Felt like I
was lost all the time."*

One root cause stated three ways — **no definition of done, and no defined order.** Not a
discipline failure; a missing artifact. Split below because each is checked against a
different part of the blueprint.

| # | What went wrong on run-trading | Blueprint claims to prevent it via | Prevented? (fill at retro) |
|---|---|---|---|
| M1 | Never knew when a feature was **done** | P2 EARS acceptance criteria + P5 definition of done (works / error / empty / mobile / design system / merged / deployed) | |
| M2 | Never knew what to **start**, or when a feature should end | P2 critical path + P5 vertical slice ordering (skeleton → critical path → supporting → polish) | |
| M3 | No structure — **lost all the time** | The phase + gate system as a whole. Check: at any given moment, could I name which phase I was in and what the next gate was? | |

M3 is the emotional core and the vaguest, so it gets the sharpest test: at retro, if there
was any stretch where Luke could not name the current phase and the next gate, M3 is **not
prevented**, regardless of how the build turned out.

**WITHDRAWN 2026-08-11 — the "different Run" criterion.** Q6 originally also asked whether
starting fresh produces a *different* product, deferred to a phase 2 comparison. Luke
withdrew the premise:

> *"I'm not necessarily looking to replace old Run's answers here. I'm just looking for a
> better and new way to build the actual product. A blueprint. A structured way to go from
> start to finished."*

Novelty was never the goal — **structure** is. Old Run's thinking is an input to be carried
forward freely, not contamination to be avoided. Measuring "is it different" would have
scored the wrong thing entirely, and could have pushed the build away from good answers just
because they were pre-existing.

Q6 therefore reduces to the mess list above, which is what Luke actually cares about: did
the process fix *never knowing when a feature is done, never knowing what to start, and
feeling lost.*

The clean-slate rule still stands as a **default** — prior material comes in when Luke opens
the door, so that carrying something forward is a choice rather than a drift. Doors opened
so far are logged in `problem-brief.md`.

---

## Part 2 — Friction log (append in the moment)

One line, every time you think *"I don't know what to do here"* or *"the blueprint didn't
cover this"* or *"I'm doing this out of order."* Ten seconds each.

**Do not batch this.** In-the-moment friction is the only real data here; everything
written later is memory, and memory is exactly what this file exists to replace.

### Capture mechanism (amended 2026-08-11, Luke's call)

Friction is captured **where the work is**, not in a second document:

- **In code** — leave a dated comment inline: `// FRICTION 2026-08-14: <what happened>`
- **In docs** (phases 1–4) — same convention as an HTML comment:
  `<!-- FRICTION 2026-08-12: <what happened> -->`
- **At retro** — `grep -rn "FRICTION" .` assembles the log.

The fragile part of instrumentation is *recall*, not *assembly*. Notes written in the moment
and collected later are still in-the-moment data. Notes written from memory at the end are not.

### Phase timing (amended 2026-08-11 — replaces manual date-logging)

**Tag the repo at every gate**: `git tag p1-gate`, `git tag p2-gate`, etc.

Phase durations derive from tag dates. Zero recall, zero discipline cost, and it works for
the document phases too since those commits are dated. The manual "Started / Closed" columns
in Part 3 are filled from `git log` at retro, not by hand as you go.

Format: `<date> · <phase> · <what happened> · <what I did instead>`

```
2026-08-11 · P2 · example: couldn't tell if X was a story or an edge case · filed as edge case, felt arbitrary
```

<!-- append below -->

```
2026-08-11 · P1 · blueprint assumes discovery is a story-interview; Luke rejected the format
             outright and named the problem directly · switched to draft-and-react. Amendment
             candidate: phase 1 should branch on whether the builder is also the user.
             (Full note in problem-brief.md.)

2026-08-11 · P2 · "I don't want to just build what we think is best. I want to follow the
             great examples of the best. When does recon and analogous product research fit
             into the eight phases?" — it didn't. The blueprint had problem recon (P1) but no
             craft recon anywhere.
             → AMENDED IMMEDIATELY, modryn-hq@v4 4a891dd: craft recon added as P2 step 0
             (structural: IA, nav, first-run) and P3 step 0 (visual + writing standard), with
             the rule that analogous products outweigh direct competitors.
```

---

## Part 3 — Phase log

Fill in as each phase closes. Takes two minutes.

| Phase | Started | Closed | Felt like | Gate passed cleanly? |
|---|---|---|---|---|
| 1 Discovery | | | | |
| 2 Definition | | | | |
| 3 Design system | | | | |
| 4 Architecture | | | | |
| 5 Build | | | | |
| 6 Hardening | | | | |
| 7 Launch | | | | |

---

## Part 4 — Retro (required output)

**This is not a "lessons learned" essay.** Every friction line resolves to exactly one of
three verdicts. If the retro produces zero edits to the blueprint, the retro failed —
either you didn't log honestly or the blueprint is already perfect, and it isn't.

### Friction resolutions

| Friction line | Verdict | Action |
|---|---|---|
| | `AMEND` / `BUILD-SPECIFIC` / `STILL OPEN` | |

- **AMEND** — the blueprint is wrong or silent. Edit it. Name the section.
- **BUILD-SPECIFIC** — real friction, but a quirk of this product. Ignore, don't generalize.
- **STILL OPEN** — needs another build's evidence. Carries forward to the next
  instrumentation file's open questions.

### Blueprint edits made

| Section | Change | Driven by |
|---|---|---|
| | | |

### Carried forward to next build

- <question that's still open>

---

## Why this doesn't get forgotten

Three things hold it in place. Any one alone fails.

1. **It's a file in the repo, created at phase 1** — not a calendar reminder, not an
   intention. It sits next to `spec.md` and is visible every time you open the project.
2. **The retro is a gate, not a task.** It's attached to the phase 7 gate. The build isn't
   done until the retro is written — same status as "rollback tested."
3. **It has a required output.** "We reflected" is unfalsifiable. "Three sections of the
   blueprint were edited" is checkable. A retro that changes nothing is a failed retro.

The failure mode to watch for: logging friction *after* the fact because it felt too small
to write down at the time. Small friction repeated ten times is the most valuable signal in
this whole file — it's the difference between a process that works and one you tolerate.
