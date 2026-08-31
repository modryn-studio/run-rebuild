# S7 — pattern or reading, and what a read may cost

> ⚠️ **PRELIMINARY AND OPEN.** This is a working document for a decision that has not been made.
> Nothing here amends `spec.md`, which is LOCKED at `p2-gate` — when the decision lands, the spec is
> amended first and in the same change ([#2](https://github.com/modryn-studio/run-rebuild/issues/2)).
>
> **Opened 2026-08-31**, to hold the research from one session rather than lose it. Two of the four
> inputs are settled (§1); two are still open (§8).

**The blocking question**, in one line: *does a claim earn its place by recurring, or by being true
once and verifiable?* — and, added this session, *what may it cost to find out?*

---

## 1. What Luke has already settled

| Question | Answer | Consequence |
|---|---|---|
| Is `History` a launch requirement? | **Yes — it is the differentiator** | A persistent claim must exist from day one. Claim matching across days becomes a v1 engineering problem. |
| The within-subject control (`psychology.md` §8)? | **Yes, from day one** | Every read must emit SEVERAL candidates, name one, and store the rest unshown. The evidence cannot be reconstructed later. |

**Together these kill option 2 ("reading wins").** A `read` table holding prose plus provenance
cannot carry a tracked claim or an unnamed candidate. Whatever ships must persist claims.

**Still open:** what a read may cost, and what cadence it runs on. §7 proposes an answer to both;
§8 lists what is still unanswered.

---

## 2. The gap, restated from the code rather than the spec

`src/lib/desk/read.ts` returns:

```ts
export interface DeskRead {
  text: string;                 // 150-450 words of prose
  lenses: LensRead[];
  synthesis: Usage & { ms: number };
  numberCheck: NumberCheck;     // numeric tokens NOT asserted by the tape
  totalMs: number;
  costUsd: number;
}
```

It is a letter. `spec.md` §4.2 specifies an object:

| `spec.md` / `architecture.md` expects | The desk call produces |
|---|---|
| `pattern` — key, `watching`/`named`/`improving`/`resolved` | nothing persistent |
| `pattern_occurrence` — session date, trade, cost, outcome | nothing |
| `read.pattern_id` | no pattern to point at |
| `read.working` — occurrence count, outcome count, baseline | prose only |
| `read.state` — finding / watching / quiet | no state; it always has something to say |
| `History` — *"named Jul 14 · $4,215 · ↑41%"* | no named claim to track |
| The floor — 8 occurrences + baseline separation | no occurrences to count |

**One thing the engine already has that the spec does not name:** `checkNumbers()` compares every
numeric token in the final prose against the figures the tape asserts, and reports the unverified
ones. That is the mechanism that lets an LLM-authored claim stay inside the doctrine *"every number
in a read comes from SQL."*

---

## 3. The floor would have suppressed the finding that saved the project

`problem-brief.md`, the finding that cleared phase 1's kill signal:

> On 07-16 he moved from MNQ to NQ and kept his stop distances. One MNQ point is $2, one NQ point is
> $20. Down in lots, up tenfold in risk. **12 trades, −$2,331.40, 61.8% of the ten-day loss** — and
> Luke did not know.

It happened **once**. `spec.md` §8's floor is **8 occurrences + separation from the trader's own
baseline**. Applied literally it waits for that to happen seven more times at roughly $2,300 each.

§8 already half-names the resolution, and this document adopts it:

| Kind of claim | What earns it |
|---|---|
| **Rate** — *"you size up 40-60% after three losses"* | the floor: 8 occurrences + separation from the trader's own baseline |
| **Structural** — *"your risk per point changed tenfold and your stops did not"* | not frequency. Arithmetic on the tape, verifiable from one instance, true or false |

**The open risk, recorded so it is not forgotten:** what stops "structural" becoming the loophole
every thin claim escapes through. Proposed test — *a structural claim is one whose evidence is an
identity, not a correlation.* Risk per point is a multiplication. "You trade worse on Fridays" is
not, however few Fridays it took.

---

## 4. What a read costs today, measured

`DESK_MODEL = 'claude-opus-5'`, `effort: high`, two lenses plus a synthesizer. Billed, not
estimated (`lenses.ts` header, two arms on the same ten-day tape):

| Arm | Cost | Result |
|---|---|---|
| full prompts | **$2.1176** | found the finding; one real number error |
| trimmed prompts | **$1.5783** | found the finding; no errors, deeper mechanism |

**At $1.58 nightly that is ≈$47 per trader per month** — on ten days of history. `renderTape()` has
**no window cap**, so a trader with a year of sessions renders roughly 25× the tape, and thinking
tokens are never discounted by caching.

Rates (2026-06 cached table, first-party API): **Opus 5 $5 / $25 per MTok · Sonnet 5 $2 / $10 ·
Haiku 4.5 $1 / $5.** Batch API is ~50% off. Cache reads are ~0.1×, cache writes ~1.25×.

**Caching barely helps this workload.** The cacheable prefix is the lens prompts, which are small;
the tape changes every day, and thinking tokens are never discounted.

---

## 5. What the market pays, and how the category handles AI cost

| Product | Price | AI |
|---|---|---|
| Edgewonk | $197 / 16 months ≈ **$12/mo** | none |
| Tradervue | **$29.95/mo** (free under 30 trades/mo) | none |
| TradeZella | **$29 start**, $35-$99 across three tiers | included |
| TraderSync | **$29.95 start** | **AI coaching gated to Elite at $79.95** |

**The band is $29-$99, and the category's own answer to inference cost is to gate AI behind the top
tier.** That is a live option for Run and it is worth naming before anyone assumes the read must be
in the base price.

**The audience is not price-sensitive in the ordinary way.** What a futures prop trader already
pays, per account:

| Firm | Evaluation | After funding | Activation |
|---|---|---|---|
| Apex | from **$147/mo** | **$85/mo** per PA account | $160 |
| MyFundedFutures | **$97/mo** (Starter 50K) | $0 | $0 |
| Topstep | **$49/mo** | $0 | $149 |

**$200-800 total before a first payout on one 50K account**, and a copy-trader runs several at once.
A $39 journal is not the line item that hurts.

---

## 6. What an AI-native product can spend

2026 benchmarks:

- **AI-native gross margin runs 50-60%**, against traditional SaaS's 60-80%, because inference is
  COGS rather than fixed R&D. ICONIQ's surveyed average is **52% for 2026**, up from 41% in 2024.
- **Inference alone consumes ≈23% of revenue** at scaling-stage AI B2B companies. Reported ranges go
  from 4-9% as a discrete line item up to 40-50%+ for AI-first startups, which compresses margin to
  25-60%.

Applied to the band, at 23% of revenue and 30 reads a month:

| Price/mo | Inference budget | Per read |
|---|---|---|
| $29 | $6.67 | $0.22 |
| **$39** | **$8.97** | **$0.30** |
| $49 | $11.27 | $0.38 |
| $79 | $18.17 | $0.61 |

**Today's read is 5× over budget at $39 and 2.6× over even at $79** — and it grows with the corpus.

---

## 7. The proposal: two speeds, and the spec already asked for it

`spec.md` §5-S5 settles this and nobody noticed it was also the cost architecture:

> **"The daily read is NOT 'a new pattern every day'... patterns are longitudinal. A daily read that
> owes the user a fresh revelation every morning will start inventing them by day four."**
>
> **"The daily read is: here's your pattern, and here's what yesterday did to it."**

A daily read does not need to discover anything. It needs SQL against a claim that already exists,
plus one sentence.

| | What runs | Model | Cost | Cadence |
|---|---|---|---|---|
| **Discovery** | the desk read over a **windowed** tape, emitting structured claims | Opus 5 (lenses possibly Sonnet 5) | ~$1.58, less with levers | weekly, or every N new sessions |
| **Daily** | SQL against open claims; the LLM writes one sentence around finished figures | Haiku 4.5 or Sonnet 5 | ~$0.02 | nightly, every trader, always |

**≈$7.45 per trader per month unoptimised.** With batch (−50% on a job nobody waits for), Sonnet 5
lenses, and `effort: medium` on discovery, nearer **$4**.

**That is inside budget across the entire market band, $29 to $99** — which means this architecture
does not wait on the pricing decision `spec.md` §6 deliberately defers.

### The shape it implies

> **The reading is the engine. The pattern is its precipitate. The daily read is SQL.**

- **No hand-coded detectors.** That is the engine the previous build killed, for two recorded
  reasons: it could not notice what it was not told to look for, and it shipped a false read that
  would have cost the trader $960 in bad advice.
- **Discovery emits claims** — a key, the trades cited, the arithmetic — all tape-verified by
  `checkNumbers()`. `pattern` rows are written by the reading rather than by a detector.
- **One claim is named. The rest are stored and never shown** — the §8 control group, free.
- **The floor becomes shown working rather than a gate**, which §8 already resolved: *"the user
  judges the confidence themselves."* Structural claims publish at n=1; rate claims wait for 8.

### Unsolved

**Claim identity across runs.** Does Monday's *"you size up after losses"* match Thursday's? Keying
on the cited trades plus a match against open claims is the obvious approach and it is not proven.
This is the one real engineering risk in the proposal.

---

## 8. Cost doctrine — five principles, proposed

Written in the register of `CLAUDE.md`'s other doctrine, because that is where they would go.

1. **A read's price is decided before its prompt is written.** `costUsd` already exists on
   `DeskRead`; it becomes a monitored figure rather than a curiosity.
2. **Inference is COGS and it is capped as a share of revenue.** 23% is the industry benchmark;
   Run's target is lower, because the read is one part of a product whose other claim is the record.
3. **The tape a read sees is windowed, always.** An unbounded prompt is an unbounded bill.
   `renderTape()` has no cap today.
4. **Nightly work is batch work.** Half price on a job nobody is waiting for is the default, not an
   optimisation.
5. **A number the LLM could have got from SQL is money spent to be less reliable.** Already doctrine
   for correctness. Cost is the second reason, and it points the same way.

---

## 9. Still open

| # | Question | Why it blocks |
|---|---|---|
| **O1** | **Discovery cadence** — weekly, every N new sessions, or on demand? | The difference between a $4 and a $12 trader. |
| **O2** | **Is the read in the base price, or gated to a top tier?** | The category gates it (TraderSync Elite, $79.95). Changes the budget by 2-3×. |
| **O3** | **Claim identity** — how does a claim from Monday match one from Thursday? | The one unproven mechanism in §7. |
| **O4** | **What stops "structural" being a loophole** for every thin claim? | §3's proposed identity-not-correlation test is untested. |
| **O5** | **Analogous-product pricing** — how do non-journal products that generate a recurring per-user artefact price it? | Luke, 2026-08-31: still to research. |
| **O6** | Other AI uses Luke has in mind, not yet stated | May change the budget entirely. |

---

## Sources

**Pricing and market** — [TradeZella](https://www.tradezella.com/best-trading-journal) ·
[Tradervue](https://www.tradervue.com/blog/best-trading-journal) ·
[TraderSync / Edgewonk comparison](https://lunefi.com/blog/best-edgewonk-alternatives-2026-tradersync-tradezella-tradervue)

**Prop firm costs** — [Futures prop firm hidden costs 2026](https://traderssecondbrain.com/guides/futures-prop-firm-hidden-costs) ·
[Apex vs MyFundedFutures](https://traderssecondbrain.com/guides/apex-vs-myfundedfutures) ·
[Best futures prop firms 2026](https://www.quantvps.com/blog/best-futures-prop-firms)

**AI unit economics** — [AI startup gross margins 50-60%](https://avanteventures.com/en/library/ai-startup-gross-margin-benchmark-2026) ·
[The AI COGS problem](https://www.saasmag.com/ai-cogs-saas-gross-margin-compression/) ·
[SaaS gross margin 2026 benchmarks](https://www.getaleph.com/answers/saas-gross-margin-2026) ·
[True cost of running an AI product in 2026](https://valueaddvc.com/blog/the-true-cost-of-running-an-ai-product-in-2026-gpu-api-and-inference-bills)

**Cost levers** — [Caching, batching and routing](https://www.gmicloud.ai/en/blog/llm-inference-cost-optimization-caching-batching-routing) ·
[LLM cost reduction strategies](https://neuraltrust.ai/blog/llm-cost-reduction-guide)

**In-repo** — `spec.md` §4.2 · §5-S5 · §8 · §6 (billing deferred) · `psychology.md` §6 §7 §8 §9 ·
`problem-brief.md` · `architecture.md` §6 · `build-plan.md` §S7 · `src/lib/desk/*`
