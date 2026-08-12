<!-- Widening plan. Author: orchestrator (Claude), 2026-07-23, at Luke's direction.
     Trigger: Luke, 2026-07-23 - "we ARE NOT staying in the micro niche forever... we need a solid transition plan."
     Sources: a full read of the 14 top-level twin docs + a full code survey of modryn-builds/run-trading (2026-07-23),
     plus run-trading/docs/{tradovate-partner-api,data-model}.md. Line cites are to those files as of 2026-07-23. -->

# Widening plan - from the prop wedge to the market

**Status:** DRAFT for Luke's markup. Nothing here is canon until he signs it.
**The decision (Luke, 2026-07-23):** the prop-futures micro-niche is the **wedge, not the ceiling**. Run will
genuinely market to prop-firm traders, and will not stay there. Retail Tradovate traders (own live brokerage
account, own money, no firm) come next, then additional rails. *"Maybe not right now. But sooner than later."*

---

## 0. The two findings that shape everything

**Finding 1 - widening is nearly free to BUILD.** A full code survey found **~2% of the codebase is genuinely
prop-specific, and none of it is in the data plane.** CSV parsers, the event log, dedupe, net-P&L allocation,
the entire metrics engine, the ritual, auth, analytics and the worker are all account-type-agnostic, several
explicitly so by construction (`extract/aggregate.ts:325` *"relative, so the metric behaves identically at any
account size, currency, or trade count"*). Michelle said the same thing about the last widening:
*"positioning-agnostic infrastructure... **almost none of it is thrown away by the widen**"*
(`assessment-michelle.md:15`). A retail trader's exports flow through today and produce a correct read.

**Finding 2 - the moat does not EXTEND to retail. It is not weakened for prop.**

> **Corrected 2026-07-23 (Luke), after this section first shipped saying "the moat does not survive
> widening."** That was wrong, and worth being precise about why: **widening adds a segment, it does not
> replace one.** Every prop trader's blown-account session keeps getting captured exactly as before -
> nothing about adding retail touches that. The honest shape is **a moated core (prop) plus an unmoated
> growth ring (retail)**, not a moat that evaporates on contact with a new audience. Retail is for revenue
> and reach; it was never going to be the thing that carries the defensibility argument, and it doesn't need
> to be for widening to be worth doing. The finding below is scoped correctly now: it is about what protects
> the *retail segment specifically*, not about Run's moat in aggregate.

Run's own docs contain the reason retail doesn't inherit the deletion argument, in a single line:

> *"A **live** account is fully readable (history + forward) via the read-only API the instant a trader
> connects; it is only the **breached-then-deleted** account whose data is gone."* (`context.md:15-16`)

A retail trader's account **is** that live account, permanently. So a competitor onboarding the same retail
trader in 2029 backfills the history Run has been accumulating since 2026. Kay's uncopyability gate is explicit
about what that means: *"a competitor launching next week starts at **zero** and can **never retroactively
acquire** the already-deleted sessions"* (`frontier-kay.md:45`), and without it *"Run V1 is a
beautifully-crafted product a competent cloner reproduces in a week"* (`frontier-kay.md:17`).

**So: cheap to build, and the new segment carries no data-moat of its own.** §3 works that through. **The prop
moat is untouched by any of this** - it is the retail growth ring that has no equivalent protection, and the
right move is to widen anyway: prop keeps defending itself exactly as it does today, and retail is added for
distribution and market size on top of that, not instead of it. An earlier draft of §3 argued a replacement
moat had been found for retail specifically; an adversarial review took it apart and it is corrected there. The
protections in §5 are worth shipping either way.

---

## 1. The core reframe: two independent axes, not one

Luke's ask named two things in one breath ("retail traders... and more brokerage firms"). **Separating them is
the highest-value move in this plan**, because they cost wildly different amounts and one is nearly free.

| | **Axis A - Audience** | **Axis B - Rail** |
|---|---|---|
| The move | prop-firm trader -> retail trader | Tradovate -> NinjaTrader -> Rithmic/CQG -> ProjectX |
| Platform | **identical** (same Tradovate, same CSV headers, same OAuth) | new integration each |
| Data plane | **zero change** | new adapter each |
| Real cost | ~9 copy strings, 1 picker entry, 1 schema column | weeks per rail |
| Access story | **easier than prop** (see below) | unchanged |
| Blocked on | a decision | engineering + demand signal |

**If these stay fused, retail waits on NinjaTrader for no reason.**

Note the access inversion, which is genuinely counterintuitive: the retail path is the one that **already
works** for third parties. *"The standard OAuth path (TradingView, TradersPost, PickMyTrade) works on
**personal accounts only**"* (`recon.md:87-91`). And the single unresolved technical unknown in the entire
corpus - whether a vendor token may write risk parameters on a **firm-provisioned** account
(`live-architecture.md:105-108`) - **does not exist for retail**, because there is no firm envelope above the
trader (`live-architecture.md:96-97`). Posture-D auto-arm is materially *easier* on retail than on prop.

Corroboration on the live read: TradesViz's own Tradovate connect guide states the read-only OAuth flow *"works
for both live and demo accounts"* and that a user can connect *"all your Tradovate accounts - live, sim, and
funded."* The `fill/list` empty-array problem stays what `tradovate-partner-api.md:4-6` already said it was: a
**personal-API-key REST** artifact, not a property of retail accounts.

*(Latent third axis, noted and not planned: the metrics engine has no asset-class assumption either
(`aggregate.ts:367`), so it would compute correctly on equities or FX today. Optionality, not a commitment.)*

---

## 2. What survives the widening unchanged

**The identity was never prop-specific.** Checked line by line:

- **The identity sentence** (`spec-jobs.md:13`): *"a trading companion that keeps one compounding model of you,
  it knows your edge and the exact pattern that costs you accounts, and it stands beside you as you trade to
  keep the second from taking the first."* Not one word is prop-only. "Costs you accounts" is if anything
  **truer** for a retail trader, whose account cost real money.
- **Jobs already refused the prop lane** (`spec-jobs.md:84`): *"Not a compliance tracker that helps you pass an
  eval."* The one positioning that would have welded Run to prop was explicitly cut.
- **Ogilvy already detached the front page from the mechanism** (`hook-ogilvy.md:29`): *"A cold stranger reads
  continuity and being known... not 'for people who blow accounts.'"*
- **The ritual** (before / during / after) is about tilt, revenge trading, sizing up after two reds. Human, not
  prop.
- **The success condition** (`context.md:55-61`) contains not one prop-specific term.
- **The enforcement binding** is a **platform** feature, not a prop feature: retail Tradovate accounts have the
  same native Manual Lockout (`live-architecture.md:81-92`).
- **The analog canon** (`analogous-products.md`) is **entirely consumer/retail products** - Whoop, Oura,
  Monarch, Copilot, Strava, Chess.com. It needs zero edits; it already reads as a retail brief.
- **The design system** (`visual-rams.md`) has no prop content at all.
- **The name.** `Run` / `run.trading` carries no prop connotation, deliberately (`context.md:74`).

**One constraint may reverse, in Run's favour - CONDITIONAL, see §3.4.** `spec-jobs.md:34` makes thin-corpus
rendering *"the dominant constraint"* because *"most users now arrive thin, because their past graves are
already deleted."* **If** Tradovate's OAuth backfill is deep, a retail trader arrives **thick**, with full
readable history from day one, and the hardest V1 problem gets materially easier on the wider audience.
**If it is bounded, this is false and retail arrives as thin as prop.** Unverified either way. Note that the
branch which is good news here is the bad-news branch for the tape's copyability, and vice versa: §3.4 sets
out both so neither can be narrated as a win after the fact.

---

## 3. The moat - intact for prop, absent for the new retail segment

> **This section was rewritten twice, and both rewrites are worth knowing about.**
> **Rewrite 1 (2026-07-23, Charlie's adversarial review)** demolished the section's first version, which had
> argued that a second half of the corpus rescued the moat *for retail*, and escalated to claiming it was
> *better* than the argument it replaced. That was motivated reasoning: the decision to widen was already made
> (`:9-11`), and the section's real job had become making it survivable. One empirical claim it rested on was
> also false (below). **Rewrite 2 (2026-07-23, Luke)** corrected the rewrite's own framing: it had swung from
> "retail is protected too" to "therefore Run has no moat," which overshoots in the other direction. **The
> correct scope was always narrower: this section is about whether the NEW segment inherits the moat. It does
> not. The EXISTING prop segment is completely unaffected either way.** The technical findings below (what the
> ritual record actually is, and isn't) all still hold; only the conclusion drawn from them is corrected.

### 3.1 The corpus has two halves, and only one comes from the platform

| | **Half A - the tape** | **Half B - the ritual record** |
|---|---|---|
| Contents | fills, round-trips, fees | check-ins, the armed line, reckonings |
| Accumulates | **passively**, every trading day, whether or not the app is opened | **only on days the trader performs the ritual** |
| Source | Tradovate | Run |
| Competitor's ramp to parity | **prop: infinite** (deleted) · **retail: one backfill call** | **weeks** |

**Correction to the first draft, and it matters.** That draft said "both halves are already in the shipped
schema," which is true and misleading. Verified against the code (2026-07-23):

- **Writing today:** `checkin_turn`, `reckoning_turn` (`api/ritual/chat/route.ts:93`), `line_armed`,
  `line_adjusted` (`lib/ritual/session.ts:126`).
- **Zero write sites anywhere:** `override_attempt`, `circumvention`, `disconnect`. Enum members with a CHECK
  constraint and nothing behind them. The schema says so itself (`schema.ts:59-61`: *"'During' (live red-zone)
  is Sprint 2, not tracked here"*).

The first draft's load-bearing sentence was *"the only record of... whether he tried to break it, how many
times."* **That clause described data the product does not collect.** What ships today is a chat transcript and
an integer.

### 3.2 Why Half B is a real asset and a weak moat

The question that matters commercially is not *"can a competitor acquire my rows?"* It is **"how long is their
ramp to parity, and does that ramp lengthen over time?"**

- **Deletion moat: infinite ramp.** A session Tradovate erased in 2027 cannot be reconstructed by any amount of
  later usage. That is why Kay called it structural (`frontier-kay.md:45`).
- **Half B: a ramp of weeks, and it never lengthens.** A competitor adds a check-in flow in a sprint. A trader
  who switches in 2029 does 30 check-ins in 30 days and they have a usable ritual record. The ramp is the same
  length in 2029 as in 2027. **A moat that does not widen with time is not a moat, it is a head start.**

Two more things the first draft got wrong:

- **Volume.** Half A accrues dozens of rows daily, unconditionally. Half B accrues a handful, and only if the
  retention behaviour holds. The first draft multiplied the moat by the one variable Run has never measured.
- **Derivability.** Most of what it credited to Half B falls out of Half A anyway: *"he sizes up after two
  reds"* is computed from fills in `extract/aggregate.ts`. The genuinely non-derivable residue is the **stated
  intent** - the number he said out loud while calm, against what he then did. That is real and precious and
  **small**. It is one column of the product, not "the entire product" as the first draft claimed.

**Also worth saying once, plainly:** Run is currently long a Tradovate policy that hurts its own users. If
Tradovate stopped deleting breached accounts tomorrow that would be good for traders and good for Run's
product, and it would destroy the moat argument. Any moat that depends on a third party's retention setting is
a weather condition, in **both** audiences. The honest conclusion is that the data moat is thinner than these
docs have been treating it everywhere, not that a replacement was found.

### 3.3 So what is the actual reason to widen?

**The prop moat is not on the table here - it stands exactly as it does today, for prop traders, whether or
not retail is ever added.** The question this section actually answers is narrower: does the *new* retail
segment come with its own equivalent protection? No. So the shape of the business becomes **a moated core
(prop) plus an unmoated growth ring (retail)** - a completely normal shape for a company to have, not a
compromise or a downgrade. Retail is added for **distribution and market size**, on top of the existing moat,
not as a replacement for it:

- It costs about a day (§1), and §5's protections are worth doing regardless.
- The prop niche has **no TAM figure anywhere in these 14 docs.** The only population number in the corpus is
  NinjaTrader's *"2M+ trader community"* (`live-architecture.md:135-138`), which is retail-inclusive.
- What differentiates Run *on the retail ring* is named in §6 and none of it is prop-dependent: nobody
  intervenes *"at the click, on the specific order, matched to your own history"*; nobody pairs restraint with
  craft; the ambient surface is the least-built wedge. **That is execution, taste and speed carrying the
  segment that has no data moat** - which is fine, because it was never supposed to need one.

**The one real risk worth naming, and it is a proportion risk, not a moat risk:** if retail eventually becomes
most of the user base, the thing that actually protects Run covers a shrinking share of it. Worth watching as
the mix shifts. Not a reason to avoid widening today.

### 3.4 The backfill question - write down BOTH branches before asking it

> **How far back does Tradovate's OAuth read actually backfill?**

`context.md:15-16` asserts *"fully readable (history + forward)"* with no record of that being checked against
a real limit. Hint that it is bounded: competitors keep CSV for *"deeper/older history the API doesn't
backfill"* and TradeZella exposes a custom historical start date (`context.md:19-20`, `:166-168`).

**The trap: whichever answer comes back, one of this plan's other arguments dies.** They are in direct tension
and the first draft never noticed:

| | **Backfill is deep** | **Backfill is bounded** |
|---|---|---|
| §2's *"retail arrives thick"* | ✅ true, thin-corpus problem eased | ❌ **false**, retail arrives thin like prop |
| Half A for retail | ❌ fully copyable, no advantage | ✅ uncopyable after ~year one |

Both branches are written down **now**, before the answer arrives, precisely so that whichever one lands cannot
be narrated as a win. On the 07-24 list as of this commit.

### 3.5 The hook per segment, already written

- **Prop (`hook-ogilvy.md:22`):** *"Your account can end tonight. Your run doesn't have to."* Carries the clock.
- **Universal (`hook-ogilvy.md:69`):** *"Every tool tracks your account. Run remembers you."* Zero prop
  dependency. Works verbatim for retail.

The second is filed as the "B" arm of Ogilvy's proposed one-variable A/B test (`:64-71`). It is in fact **the
retail hook, already drafted**, and running the test costs nothing extra.

**But do not over-read it, as the first draft did.** That test measures whether a *promise* is attractive to a
cold stranger. It says nothing about whether the accumulated record is valuable or retained. It is a claim
about clicks, not about the asset. It de-risks the **copy**, and only the copy.

---

## 4. The phases - trigger-based, never date-based

### Phase 0 - now, through beta. Prop only, marketed narrowly. **No positioning change.**
The wedge is correct and it is working. `context.md:36` still binds: *"Don't let 'for everyone' become
'generic.'"* **But pay the cheap protection costs now** (§5) - they are cheap only while nothing is welded, no
real broker connection exists, and Live is unbuilt.

### Phase 1 - "don't gate the door." Retail silently permitted, **not marketed.**
**Trigger:** the first retained prop cohort, **or** the first retail trader who asks.
**Change:** fix the three things that mislead or turn away a retail trader (§5.1). Rename the picker.
**Do not touch marketing.**
**Cost:** about a day.
**Why this ordering is the trick:** it converts "we turn retail away" into "we quietly learn what retail does,"
and it starts Half B compounding on a second segment **before** committing any positioning to it. Same
principle already adopted at `arch-reconciliation.md:27-29` (*"design the schema cross-firm-ready now... so V2
is an unlock, not a migration"*), one level up. **This can ship before the public beta.**

### Phase 2 - retail marketed deliberately.
**Trigger, and it should be harder than it looks: a real prop trader completes the before/after loop on more
than half his trading days, for a month, unprompted.** Not signups, not connects, not "we shipped the ritual."

**Name the recursion honestly:** Half B *is* the ritual record, so the thing §3 offers retail as an asset and
the biggest unproven risk in the product are **the same object**. If the ritual is not performed, Half B has
almost no rows and §3 is moot. That is exactly why this gate sits here, and why it is the one number worth
watching before a dollar of retail marketing.

The inverse is the better outcome and worth stating: if that bar clears, Run has something more valuable than a
moat, which is **a product people use daily** - and it will not need §3 to feel good about widening.
Secondary trigger: the prop channel saturates (connect-through decays at constant spend).
**Change:** headline B goes primary on a retail lane; pricing re-cut off funded-account language (§5.1); a
second search-intent lane. **Not a replacement** - prop keeps its own lane and hook. Two lanes, one product.

### Phase 3 - the second rail.
**Trigger:** rail-limited demand (asked for by name, or churn attributable to "my broker isn't supported").
Not a date, and not "because it's next."
**First rail: NinjaTrader** - same company, converging platforms, the near-free adapter rather than a separate
build (`spin.md:92-94`). Rithmic/CQG and ProjectX/TopstepX are the genuinely separate rails after it.
**Charlie's standing caveat holds:** do **not** build the pluggable-adapter framework before a second rail
actually exists.

---

## 5. The don't-weld list - what to protect, starting now

### 5.1 The three things that block or mislead a retail trader today

1. **`views/accounts/reveal.tsx:125`** tells every zero-data user *"I keep it, even after Tradovate wipes the
   account you blow."* **False for retail, and off-putting.** Highest-stakes string in the app. Phase 1.
2. **The connect picker offers one card labelled "Tradovate Prop"** (`views/accounts/connect-flow.tsx:32`). A
   retail trader concludes Run is not for them and hits "Skip for now." Renaming it "Tradovate" costs one
   string and loses nothing for prop traders, who are on Tradovate either way. Phase 1.
3. **Marketing copy hard-codes prop shape** in ~9 strings (`marketing/faq.tsx:27,30-31`,
   `pricing.tsx:37,45,61,67` - *"For one funded account"*, *"For traders running several firms"* -
   `site-footer.tsx:15,28`). **Phase 2, not Phase 1** - this is the deliberate narrow aim and should stay
   narrow until the trigger fires.

### 5.2 The biggest weld risk is a doc, not the code - and it is still unbuilt

**`live-rebuild-plan.md` is prop-rulebook-shaped throughout**: the gate table on an Apex 50K (`:40-44`),
trailing-DD regimes and the $47,600 floor (`:50-58`), the **consistency axis** (`:60-67`, *"best-day / total
profit <= 50%, checked at payout"*), the enforcement ladder tuned to a $2,500 max-DD (`:105-124`). **For a
retail trader, DD-left, consistency score and payout buffer do not exist.** Two of the three pre-trade risk
axes evaporate; only the self-set loss limit survives - and that one is universal.

**Live is Sprint 2. It is not built yet. This is the one place a genuine weld is still avoidable at zero
cost.** The build rule that follows:

> **Build the self-set loss line as the spine. Treat firm rulebooks (trailing DD, consistency, payout buffer)
> as an optional overlay on top of it, never as the engine.**

Get this wrong and Live becomes the one surface that must be rewritten to widen. Get it right and Live ships
retail-ready by construction. **Note the psychology half of that doc (`:69-159` - the voice rule, the Ulysses
pact, override-as-data, earned rarity) is entirely audience-neutral and needs zero edits.**

### 5.3 The one real architectural item - **before the first real broker connection**

**`tradovate_connection` has no per-connection host.** The API base is a module-level default to
`demo.tradovateapi.com` in four files (`tradovate/auth.ts:9`, `historical.ts:18`, `normalize.ts:9`,
`client.ts:13`), and per `tradovate-partner-api.md:19-20` `demo.` is **the eval engine**. A retail trader on a
live account is on `live.tradovateapi.com`.

**Consequence:** one deployment cannot serve a prop trader and a retail trader at the same time. The only
genuine architectural blocker anywhere in the widening.

**Why now:** an additive nullable column on a mutable table with **zero backfill cost while no connections
exist**; afterwards it is a migration where every row must be guessed. It belongs in the **same change as
broker-token encryption** (issue #15), already on the must-not-slip list for the identical reason.

### 5.4 The gap that would make Phase 1 unmeasurable

**Nothing records which source a connection came from.** The analytics vocabulary (`lib/analytics.ts:70-78`),
the funnel (`scripts/funnel.sql:22-31`) and the admin page have no firm or account-type dimension. After Phase
1, **Run could not tell a retail signup from a prop one** - and Phase 1's entire value is learning what retail
does. One property on the existing connect event. Ship it **with** Phase 1, not after.

### 5.5 Vocabulary debt - decide knowingly, or inherit it

**`account.firm` does not mean what it says.** It is `notNull`, hardcoded `'tradovate'` at every write path
(`current-trader.ts:74`), and **nothing branches on it**. In practice it holds the **platform**. When
NinjaTrader arrives it will hold `'ninjatrader'`, and the actual prop firm is recorded **nowhere** - awkward
for a thesis about a corpus that compounds *"across every firm"*.

**The safety net, verified on Luke's own exports (2026-07-23):** the firm is already encoded in the account
name prefix, which Run already stores in `account.externalAccountId`. Luke's two accounts are
`ELTDENF260623134425853685` and `FTDFYL100183704873` - **two different firms, both in all five export types,
already sitting in one corpus.** The cross-firm claim is literally demonstrable on his own data today. Since
`account` is mutable (only `event` is append-only), classification stays retroactively possible with no schema
change.

- **Option A:** rename `firm` -> `platform`, add nullable `prop_firm`. Honest; a pure rename today.
- **Option B:** leave it, document the ambiguity, classify from the prefix when a reason appears.

**Recommendation: A, but only riding along with §5.3's migration.** Not worth its own change.

### 5.6 Standing rules (restated)
Never weld the core to the Tradovate API; CSV is the floor (`arch-reconciliation.md:48-50`). No per-firm logic.
Enforcement is a commodity feature, not the moat.

---

## 6. The honest risk in widening

Owed, because §0-§5 are mostly encouraging.

**Widening moves Run into a materially more crowded field.** Today's prop niche leader is small: Tanto has
*"no public scale/trust numbers, young... no AI/behavioral layer"* (`recon.md:37`). The retail journal field
has TradeZella (100K+ traders, 500+ brokers, 967 Trustpilot reviews at 4.8), TradesViz (150K+ claimed),
TraderSync (100K+, 700+ brokers) (`recon.md:35-41`).

Worse, widening walks Run toward the **psychology** incumbents rather than the compliance trackers. Edgewonk
owns *"Trading Psychology Lab"* and a **Tiltmeter** (`recon.md:384-391`). It is dismissed there as *"wrong axis
(not cross-firm prop, not real-time, not identity-compounding)"* - and **two of those three dismissals stop
applying if you widen.**

**What still holds, and none of it is prop-dependent:** nobody intervenes *"at the click, on the specific
order, matched to your own history"* (`recon.md:430-432`); the true ambient surface is *"the least-built of the
three wedges"* (`:453-456`); *"nobody pairs restraint with real craft"* (`:407-409`); calm light mode is
uncontested (`:285-287`). Plus Half B, which none of them collect.

**Also worth saying plainly: there is no TAM figure anywhere in these 14 docs.** No count of prop-futures
traders, no revenue model. The nearest population number is NinjaTrader's *"2M+ trader community"*
(`live-architecture.md:135-138`) - which is **retail-inclusive and already points wide**. If the widening needs
a number to justify it, that number does not exist yet in any document.

---

## 7. Doc changes this implies

**None have been made.** `spin.md`, `spec-jobs.md`, `frontier-kay.md` and `hook-ogilvy.md` are canon and are
not edited without Luke's sign-off.

| Doc | Change | Size |
|---|---|---|
| `widening-plan.md` | this file | new |
| `context.md:32` | the one-line "Expansion" bullet becomes a pointer here | 1 line |
| **`frontier-kay.md:15-17,39-47`** | **the big one, and it is now a subtraction not a substitution.** Gate 2's uncopyability answer is invalid for retail and no replacement moat was found (§3). Record that Gate 2 holds for **prop only**, that it is borrowed from a Tradovate policy that could change, and that the retail answer is "no data moat, differentiate on execution" | 1 section |
| `spin.md:35-49` | 2035-durability + reverse-clone both lean on "can't retroactively collect deleted sessions". Scope both to prop explicitly. §Switch reason (`:46`) becomes the lead *retention* argument, and must **not** be promoted to a moat claim - that was the error §3 corrects | 2 paras |
| `context.md:14-26` | the wager sentence rests on the deletion parenthetical; re-derive | 1 para |
| `spec-jobs.md:7,34` | "prop-futures" is the wedge not the ceiling; note thin-first **reverses** for retail | 2 lines |
| `hook-ogilvy.md:64-71` | promote headline B from "A/B variant" to the universal-segment hook; note the test now answers two questions | 1 para |
| **`live-rebuild-plan.md`** | **do not rewrite - build correctly instead** (§5.2). Add a note at the top of the prop-rulebook sections marking them as an overlay, not the spine | 1 note |
| `recon.md` | additive only: a Round 9 (retail futures journals + psychology tools) and a retail column on the field-mapped table (`:397-409`) | new section |
| `CLAUDE.md` | one line under "What Run is" | 1 line |
| `run-trading/docs/data-model.md:56` | **unrelated staleness spotted in passing:** says `UNIQUE (firm, external_account_id)`; shipped schema is `(trader_id, firm, external_account_id)` | 1 line |

Zero edits needed: `analogous-products.md` (already a retail brief), `visual-rams.md`, `assessment-michelle.md`
(self-certifies as positioning-agnostic at `:15`).

---

## 8. Open questions for Luke

1. ~~**Does the Half A / Half B reframe hold up?**~~ **ANSWERED, in two passes.** Charlie (2026-07-23):
   demolished it as a rescue-the-moat argument. Three of the seven event types it rested on have zero write
   sites; the competitor's ramp to parity is weeks and never lengthens; the claim escalated to "better than
   what it replaced," which was the tell that the analysis was defending a decision rather than testing it.
   **Luke (2026-07-23):** corrected the conclusion Charlie's review then produced. It is not "Run has no
   moat" - the prop moat is completely unaffected by any of this. It is "the *new retail segment* does not
   inherit it." **The consequential thing for downstream docs: never write "Run has no moat." Write "the moat
   protects prop; retail is added reach, not moated."**
2. ~~**Does the honest version still clear your bar?**~~ **ANSWERED.** Yes - "moated core, unmoated growth
   ring" is a normal shape for a business and does not need to feel like a downgrade. §7's rewrites should
   carry that framing into `frontier-kay.md` and `spin.md`, not the "no moat, distribution only" framing that
   briefly replaced it.
3. **Phase 1 - trigger, or just do it?** About a day of pure downside-protection. Against: it is a distraction
   from the beta.
4. **§5.5 vocabulary - Option A or B?**
5. **Pricing shape for retail.** Current tiers are cut for prop. A retail trader has one account and does not
   run firms. Phase 2, but unsolved. Consumer anchors already in the docs if useful: Whoop $30/mo, Oura
   $5.99/mo, Monarch $14.99/mo (`analogous-products.md:33-42`).

---

## 9. The one-paragraph version

Run's identity, ritual, data plane and design are **already audience-neutral**, so retail costs about a day of
work and is **independent of** adding rails, which is the genuinely expensive axis. **The prop moat is not
affected by any of this - it keeps working exactly as it does today.** The honest catch is narrower: the moat
**does not extend to the new retail segment.** A retail account is never deleted, so its tape is backfillable
by any competitor who onboards that trader later, and the ritual record Run generates itself is a
switching-cost asset with a ramp measured in weeks, not a moat. So the shape of the business becomes **a
moated core (prop) plus an unmoated growth ring (retail)** - normal, not a downgrade - and retail is added for
the honest reason: **the market is bigger and the cost is a day.** What differentiates Run on that ring is
execution, taste and speed - intervening at the click, restraint paired with craft, the least-built wedge -
and for a one-person studio that does not need to be a moat. Practically: keep marketing narrow, stop the
product turning retail away, ship the four cheap protections before they weld (especially Live, unbuilt and
currently specced around prop rulebooks), and gate retail marketing on **one real trader performing the ritual
on most of his trading days for a month** - which is the same thing as proving the product works at all.
