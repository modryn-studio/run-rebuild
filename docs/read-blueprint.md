# The Read Blueprint — how Run builds a generative feature

> **Scope:** the LLM layer only — the daily read, and anything else that asks a model to write about a
> trader's own record. `web-app-blueprint.md` (modryn-hq) covers building the app; its eight phases
> have no equivalent for cost, non-determinism, or evaluation, which are the three hard parts here.
>
> **Opened 2026-08-31**, before `S7` was specified, because a generative feature is the one part of
> this product that gets sloppy without a structure and expensive without a budget.

## The one idea, borrowed unchanged

**Every phase produces an artifact, and every artifact is a decision made once.** Each phase ends at
a **gate** — a yes/no question that must be able to return *no*. A gate that cannot return no is a
ritual.

## The second idea, which is this blueprint's own

**A generative feature has no compile error.** Wrong code fails loudly; a wrong read is fluent,
confident and plausible, and the only thing standing between it and a trader is a person who looked
at it. That is why phase 2 exists and why it comes before a prompt is written.

---

## The eight phases

| # | Phase | Artifact | Gate — must be able to return *no* |
|---|---|---|---|
| 1 | **Claim** | the claim brief | Can you name the output that would be worthless? |
| 2 | **Error analysis** | a failure taxonomy | Can you tell a good read from a bad one **without asking a model**? |
| 3 | **Contract** | the schema + the verifier | Can every number be traced to SQL? |
| 4 | **Budget** | the cost model | Does it fit the price at 1,000 traders? |
| 5 | **Prompt** | versioned prompts + the arms | Did the cheaper arm actually lose? |
| 6 | **Harness** | the job spec | What does the page show when the model is down or refuses? |
| 7 | **Surface** | states, trust note, empty case | Does it degrade honestly when there is nothing to say? |
| 8 | **Measurement** | the measurement plan | Could this ever prove itself wrong? |

**Phases 1-4 are decisions. 5-6 are engineering. 7 is product. 8 is the only one that can tell you
the whole thing was decoration** — which is why it is last and why it must not be dropped.

---

## Phase 1 — Claim

**Goal:** state what the read asserts, in the trader's words, before anyone reasons about how to
produce it.

**Do:**
- Write the sentence the product is claiming it can say. Not the feature; the sentence.
- Name what makes it worthless. Not "bad output" — the specific shape of the failure.
- Write down what the surface already promises, and treat that as binding.

**For Run this is already written**, and phases 2-8 are held to it. `spec.md` §4.2 and §5-S5:

> The read **arrives generated**. It is never a blank page you fill in. One named pattern, in prose,
> in the recon register: the behaviour, how often, what it costs in dollars, compared to the prior
> period. The trades it was drawn from, openable inline. The trust note. **If nothing clears the
> threshold it says so, and says what would let it find one. It never fills the space with a metric
> definition.**
>
> Three states and no fourth: **Finding · Watching · Quiet.**
>
> Not on the page: a chart rack, a metric dump, a score, **a chat box**.

**Artifact — the claim brief:**
```
Claim:        the sentence the product says it can produce
Worthless:    the output shape that means it failed, even if fluent
Binding:      what the surface already promises and cannot walk back
Register:     whose voice, and what it never does
```

**Gate: can you name the output that would be worthless?** If the only answer is "an inaccurate
one", the claim is not specific enough to test. Run's answer is written into its own acceptance
criteria and has a worked example in the wild:

- `THE SYSTEM SHALL NOT present a definition of a metric as an insight`
- `THE SYSTEM SHALL NOT present a statement that would be true of any losing trader`

TradeZella's flagship artefact, on Luke's own 187 trades, fails both: *"Focus on reducing losses and
improving trade quality rather than increasing trade frequency"*, over an explainer opening
*"Profit factor compares gross profits to gross losses; a value >1.5 is strong…"* **That is what
worthless looks like when it is fluent.**

**Common failure:** specifying the surface and not the sentence. `spec.md` §4.2 describes a page in
detail and never says how a pattern is produced — which is exactly why `S7` blocked.

---

## Phase 2 — Error analysis

**Goal:** learn to tell a good read from a bad one, yourself, before automating the judgement.

**This is dogfooding, done in a way that compounds.** Luke, 2026-08-31: *"we build and I dogfood.
Then we iterate. Then we dogfood with test users. Then we iterate."* That is right, and it is the
industry's own first phase — it has a name, **error analysis**, and one discipline attached that
turns it from an activity into an artifact: **write the failures down and group them.**

**Do:**
- Generate reads on real sessions and **read them yourself**. Open-ended notes on anything wrong.
- **Group the notes into a failure taxonomy.** Practitioners call this the most important step; it
  is the difference between "that one was bad" and a category you can test for forever.
- **Review at least 50-100 traces. Stop when ~20 in a row produce no new category.**
- Only then consider an automated judge, built from the labels you produced.

**Artifact — a failure taxonomy.** In this repo it has an obvious shape, because the repo already
keeps one for code: **`scar-tissue.md` is a failure taxonomy.** The read's version is the same
object — each entry a failure that actually occurred, what produced it, and the rule it created.

**Gate: can you tell a good read from a bad one without asking a model?** If the honest answer is
"I would ask Claude to score it", the gate is not passed. **An LLM judge built before the taxonomy
inherits the taxonomy's absence** — and judges have documented biases: a persuasive nonsense answer
scores well, and models favour outputs that resemble their own phrasing and length.

**State the sample honestly.** Run's dogfooding corpus is **one trader**. That is enough to find
failure modes and not enough to establish rates. Every entry in the taxonomy carries how many
traders it was seen on, and the number is 1 until it is not.

> ⚠️ **The trap this phase exists to prevent** (Luke, 2026-08-31): reading one trader's output and
> treating it as ground truth for every trader. **This repo already made that mistake and fixed it.**
> `lenses.ts` records that the original prompt *"carried a live-coaching section encoding one
> trader's own methodology as ground truth"*, and it was rewritten. A failure taxonomy generalises;
> a rulebook does not.

**Common failure:** shipping to test users before the taxonomy exists, so their reactions arrive as
anecdotes with nothing to file them against.

---

## Phase 3 — Contract

**Goal:** decide what the model returns and what is checked without it.

**Do:**
- Define the structured output. Prose alone cannot be verified, tracked, or counted.
- Define the deterministic verifier that runs on every generation, before a trader sees it.
- Decide what happens to an output that fails verification — never "show it anyway".

**Run has half of this already.** `checkNumbers()` in `src/lib/desk/read.ts` compares every numeric
token in the final text against the figures the tape asserts and reports the unverified ones. That
is the mechanism that lets an LLM-authored sentence live inside the doctrine **"the LLM never
computes a number... every number in a read comes from SQL."**

**Gate: can every number be traced to SQL?** If a figure appears in prose that no table asserts, the
read is a confident wrong sentence, which is the failure class this whole product is positioned
against.

**Common failure:** letting the structured output be a summary of the prose rather than its source.
The claim is the object; the prose is written **around** it.

---

## Phase 4 — Budget

**Goal:** know what one artefact costs before deciding how often it runs.

**Do:**
- Measure a real generation, billed rather than estimated.
- Restate it per trader per month, **at the corpus size a successful trader will have**, not the
  one you tested on.
- Derive the ceiling from price and margin rather than picking a number.
- List the levers and what each buys.

**Run's numbers, as of 2026-08-31** — full working in `s7-decision.md` §4-§7:

| | |
|---|---|
| Measured | **$1.58** per read, billed, Opus 5 at `effort: high`, **on a ten-day tape** |
| Unbounded | `renderTape()` has no window cap; a year of sessions is ~25× the input |
| Ceiling | **≈$0.30/read** at a $39/mo price and inference at 23% of revenue |
| Levers | batch −50% · Sonnet 5 lenses · `effort: medium` · a windowed tape |

**Gate: does it fit the price at 1,000 traders?** Not at ten, and not on the tape you developed
against.

**Common failure — and Run has committed it:** measuring one run on a small corpus and calling it
*the* cost. $1.58 is what a ten-day tape costs. Nobody has measured a two-year one.

**The doctrine this phase produces** (proposed, `s7-decision.md` §8):
1. A read's price is decided before its prompt is written.
2. Inference is COGS and is capped as a share of revenue.
3. The tape a read sees is windowed, always.
4. Nightly work is batch work.
5. A number the LLM could have got from SQL is money spent to be less reliable.

---

## Phase 5 — Prompt

**Goal:** write the prompts, and keep the record of what each constraint bought.

**Do:**
- Version them as code, in the repo, with the reasoning at the point of use.
- Run arms. Record cost **and** what each arm found.
- Delete constraints that carried nothing. State the sample size.

**Run already works this way** and the record is in `lenses.ts`: two arms on one tape, **full
$2.1176** versus **trimmed $1.5783**, both found the finding, the trimmed arm made no numeric error
and reached a deeper mechanism — and the header says plainly *"n=1 per arm, so this is enough to
justify REMOVING tokens and not enough to claim the trim makes reads better."*

**Gate: did the cheaper arm actually lose?** If it did not, the expensive one is not the default.

**Common failure:** a constraint that entered on taste and never left. The house rule already
written: *a constraint earns entry by an observed failure, and leaves when a run shows it was
carrying nothing.*

---

## Phase 6 — Harness

**Goal:** decide what runs the thing, when, and what happens when it does not work.

**Do:**
- Choose the cadence, and price it (phase 4).
- Choose batch or live. Nightly work is batch work.
- Decide the failure behaviour: model down, rate limited, **refused**, or verification failed.
- Decide what is stored — the output, the cost, the usage, the unverified tokens.

**Two constraints specific to Run:**

- **`stop_reason: "refusal"` is a real outcome** on current models and must be handled as a state,
  not an exception. A refusal that renders as an error page is `402 / Payment is needed` shown as
  UI, which is a thing the leader actually ships.
- **No state may represent absence.** The failure copy cannot say "no read today" in a way that
  reads as a backlog. `psychology.md` §6, and it is already `CLAUDE.md` doctrine.

**Gate: what does the page show when the model is down or refuses?** If the answer is a spinner or a
stack trace, phase 6 is not done.

**Common failure:** treating generation as a request/response when it is a job. The trader is not
waiting; the page is reading something already written.

---

## Phase 7 — Surface

**Goal:** the screen, its states, and the copy that is true in each.

**Do:**
- Build the three states as real states, not as one state with empty variants.
- Write the trust note — what this read depends on, and how to correct it.
- Write the empty case: what it says, and what would let it say more.

**Run's three states are specified and are not negotiable** (`spec.md` §5-S5): **Finding** when a
pattern clears the floor · **Watching** when a candidate exists below it (*"I'm watching this — 5
times so far"*) · **Quiet** when it did not happen yesterday, *"which is a good day, not an empty
one."*

**The trust note is Monarch's pattern, and it is §1 solved as UI rather than as a promise:** the same
line on every step, telling the user what the output depends on and that they can correct it.

**Gate: does it degrade honestly when there is nothing to say?** The named failure is filling the
space with a metric definition, and the leader does exactly that.

**Common failure:** an empty state that reads as an error, or as a chore the trader is behind on.

---

## Phase 8 — Measurement

**Goal:** be able to find out that the feature does not work.

**Do:**
- Decide the measurement before the first read is generated. It cannot be added retroactively.
- Store what you do **not** show, if the design allows a control.
- Name the confound you are controlling for.

**Run's plan** (`psychology.md` §8, and Luke settled it on 2026-08-31): the engine surfaces several
candidates and names one. **Track the unnamed candidates and never show them** — same trader, same
period, same market: a within-subject control. If named patterns improve and matched unnamed ones do
not, that is causal evidence. If they improve identically, Run learns early that the read is
decoration.

**The confound it exists for:** History as specified cannot prove the read works. It is confounded
by regression to the mean and by survivorship — **traders who blow up stop uploading, so surviving
accounts improve mechanically.**

**Gate: could this ever prove itself wrong?** If no observation would change the answer, this is
marketing rather than measurement.

**Common failure:** measuring engagement. `psychology.md` §1 already rules it out — Run's insight
succeeding means the named behaviour **stops**, so more usage is not the goal and may be the alarm.

---

## What this blueprint refuses

- **An LLM judge before a human taxonomy.** Phase 2's gate, and the documented judge biases.
- **A cost measured on a development corpus.** Phase 4's common failure, already committed once.
- **One trader's output as ground truth.** Phase 2's warning box, and `lenses.ts`'s own scar.
- **Shipping a generative feature with no way to learn it is decoration.** Phase 8.

## How it relates to the other docs

`s7-decision.md` is the **working material for phases 1-4** of the first pass through this
blueprint. When `S7` is specified, the decisions move into `spec.md` (LOCKED, amended deliberately)
and `architecture.md`, and `s7-decision.md` becomes a record rather than an open question.

## Sources

**Evaluation practice** — [Hamel Husain, LLM Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) ·
[Why error analysis matters](https://hamel.dev/blog/posts/evals-faq/why-is-error-analysis-so-important-in-llm-evals-and-how-is-it-performed.html) ·
[A pragmatic guide to evals for devs](https://newsletter.pragmaticengineer.com/p/evals) ·
[Building an evals dataset from scratch](https://www.decodingai.com/p/build-an-ai-evals-dataset-with-error-analysis) ·
[Error analysis, step by step](https://www.aievals.co/techniques/error-analysis) ·
[Bias and uncertainty in LLM-as-a-judge](https://arxiv.org/pdf/2605.06939)

**In-repo** — `spec.md` §4.2 §5-S5 §8 · `psychology.md` §1 §6 §8 · `s7-decision.md` ·
`src/lib/desk/read.ts` (`checkNumbers`) · `src/lib/desk/lenses.ts` (the arms, and the ground-truth
scar) · `modryn-hq:playbooks/web-app-blueprint.md` (the shape this borrows)
