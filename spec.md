# Spec — <product name>

> Phase 2 artifact. This file is the single source of truth for what v1 is.
> If the code and this file disagree, one of them is a bug. Update this file *first*, always.
> Point agents at this file, not at your memory of it.

**Status:** draft | locked | amended
**Last amended:** <date> — <what changed and why>

---

## 1. Problem brief (carried from phase 1)

| | |
|---|---|
| **Problem** | <one sentence, in the user's words> |
| **Who** | <one specific person or segment — "everyone" means nobody> |
| **Today** | <how they cope now, and what it costs them> |
| **Spin** | <what we do that a competitor can't clone in a week> |
| **Kill signal** | <what we'd have to see to stop building this> |

---

## 2. The critical path

The single sequence of screens that delivers the core value. 3–5 screens. Everything
else in this document is supporting cast.

1. <screen> → <what the user does here>
2. <screen> → <what the user does here>
3. <screen> → <what the user does here>

**The one-sentence value claim:** <"A user can ___ in under ___ without ___.">

---

## 3. User stories

Format: **As a** `<who>`, **I want** `<what>`, **so that** `<why>`.
Mark critical-path stories with ⭐. Aim for 10–30 total.

### ⭐ Critical path

**S1 — <short title>**
> As a `<who>`, I want `<what>`, so that `<why>`.

Acceptance criteria (EARS):
- `WHEN <trigger>, THE SYSTEM SHALL <observable response>`
- `IF <condition>, THEN THE SYSTEM SHALL <observable response>`
- `THE SYSTEM SHALL <always-true response>`

Edge cases:
- Empty: <what shows when there's no data>
- Error: <what shows when it fails, and what the user can do about it>
- Loading: <what shows while waiting>

---

**S2 — <short title>**
> As a `<who>`, I want `<what>`, so that `<why>`.

Acceptance criteria (EARS):
- `WHEN ..., THE SYSTEM SHALL ...`

Edge cases:
- Empty:
- Error:
- Loading:

---

### Supporting

**S10 — <short title>**
> As a ..., I want ..., so that ...

- `WHEN ..., THE SYSTEM SHALL ...`

---

### EARS quick reference

| Pattern | Use when |
|---|---|
| `WHEN <trigger>, THE SYSTEM SHALL <response>` | An event happens |
| `IF <condition>, THEN THE SYSTEM SHALL <response>` | An unwanted/exceptional condition |
| `WHILE <state>, THE SYSTEM SHALL <response>` | Continuous behavior during a state |
| `WHERE <feature included>, THE SYSTEM SHALL <response>` | Optional/configured features |
| `THE SYSTEM SHALL <response>` | Always true, no trigger |

Test: could two people disagree about whether the criterion is met? If yes, rewrite it.
"The system shall show an error" fails. "WHEN the symbol is unrecognized, THE SYSTEM SHALL
display the symbol field in the error state with the message 'Unknown symbol'" passes.

---

## 4. NOT IN V1

This list should be **longer** than the story list. Every line here is an argument you
don't have to have with yourself later.

- <thing> — <one-line reason, or "later">
- <thing> —
- <thing> —

**Explicitly deferred, revisit when:** <the condition that would put these back on the table>

---

## 5. Wireframes

Boxes and labels. No color, no fonts, no polish — you're validating structure, and pretty
wireframes make people critique the styling instead.

- `<screen name>` → <link or embedded sketch>
- `<screen name>` →

---

## 6. Open decisions

Things genuinely undecided. Move them out of here before the phase 2 gate, or explicitly
mark them as deferred with a date.

| Question | Options | Decide by | Decided |
|---|---|---|---|
| <question> | <a / b> | <when> | <answer + why> |

---

## Phase 2 gate

- [ ] Can describe v1 in 60 seconds with no "and also"
- [ ] Every critical-path story has testable acceptance criteria
- [ ] Every story has empty / error / loading defined
- [ ] NOT IN V1 is longer than the story list
- [ ] No open decisions block the first slice
