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

| # | What went wrong on run-trading | Prevented? (fill at retro) |
|---|---|---|
| M1 | _pending — to be filled from Luke's own recollection, no repo access_ | |

**Deferred decision — the "different Run" criterion.** Q6 originally asked whether starting
fresh produces a *different* product. Luke can't set a falsifiable bar for that today, and
guessing at one now would be worthless. So it's deferred to a hard checkpoint rather than
left open:

> **At the phase 2 gate** — once `spec.md` exists — compare the fresh spec against old Run
> and record what differs (core screen / data model / primary user action). This requires
> Luke's explicit okay to open the old repo. Still before any build code, so it is not
> retrofitting.

If the phase 2 gate passes without this comparison being made, that is itself a finding:
record it in the friction log.

---

## Part 2 — Friction log (append in the moment)

One line, every time you think *"I don't know what to do here"* or *"the blueprint didn't
cover this"* or *"I'm doing this out of order."* Ten seconds each.

**Do not batch this.** In-the-moment friction is the only real data here; everything
written later is memory, and memory is exactly what this file exists to replace.

Format: `<date> · <phase> · <what happened> · <what I did instead>`

```
2026-08-11 · P2 · example: couldn't tell if X was a story or an edge case · filed as edge case, felt arbitrary
```

<!-- append below -->

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
