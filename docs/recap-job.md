# The daily recap job — what triggers it, and everything that can go wrong

> Started 2026-09-01, before any of it was built, at Luke's direction: *"let's take it really slow
> and step by step... now i want you to search and reason through all the edge cases that may come
> up."* **Read this before writing the job**, and before wiring the Tradovate API when it lands.
>
> Every market-hours figure here comes from `market-hours.md`, which read them off CME's own
> contract-spec service. Every platform limit was checked against Vercel's published limits on
> 2026-09-01 and is dated, because those move.

---

## 1. The trigger, and why it is not a clock

**Luke's model, and it is the right one for the product Run is becoming:**

> *"say it is monday. technically monday's session starts at 5p central time on sunday and ends
> monday at 4p. so monday's recap is created at 4p on monday and reads just those trades made from
> sunday at 5p to monday at 4p."*

**It is the wrong trigger for the product Run is today, for one reason: there is no live feed.**
`spec.md`:387 — *"Deferred to v2, not v1: OAuth connection, live sync, real-time fills."* Trades
arrive when the trader uploads four CSVs. At 16:15 CT on Monday, Monday's export is still sitting in
Tradovate. A clock job would wake up, find nothing, and go back to sleep, every day.

### The rule that survives both products

> **A session date is readable when it is OVER and its data has LANDED.**
>
> - **Over** is a fact about the clock, and it is knowable without the trader: the session date has
>   rolled past 17:00 CT.
> - **Landed** is a fact about the corpus, and today it is an upload.

That rule does not change when the API arrives. Only which of the two conditions is the *last* one
to become true, and therefore which one fires the job.

| | Today (CSV) | With the API |
|---|---|---|
| Fires on | **import commit** | the clock, in the maintenance break |
| Guard | is this session date over? | has the data landed? |

**So the job is written once, against the rule, and the trigger is a thin caller.** Two callers,
one entry point, one guard, one freeze.

### What this answers, without assuming anything

Luke: *"we can probably assume that when they upload their csv files, that means they are done
trading. but i dont want to assume."*

He is right not to, and **nothing has to be assumed.** Whether the trader is finished is unknowable
and irrelevant; whether the SESSION is finished is a clock fact. So the job reads every session date
in the batch that has already ended, and leaves today's alone if 17:00 CT has not passed. If the
trader uploads mid-session, today's read simply happens on the next upload.

---

## 2. Options that were considered and rejected *(2026-09-01)*

**"Run at 16:15, look for new files, and skip if there are none."** The clock adds nothing it can
learn. If the files landed at 10:00 the read waits six hours for no reason; if they land at 18:00 it
waits until tomorrow. Strictly worse than reading on arrival, at every hour of the day.

**"Offer a `Run daily recap now?` button after upload."** This is generate-on-click wearing a
different hat, and §"WHY THE READ IS NOT GENERATED ON CLICK" in `build-plan.md` §S8 already rejected
it: `spec.md` §4.2 keeps exactly one thing from Monarch and calls it the important half, *the read
arrives generated*. It also creates a state nobody wants — a trader who answers "no" now owns a
session with no read and a decision the product has to remember.

**"Yesterday's runs on upload, today's runs at 16:15."** Two triggers with two rules is two things
to get wrong, and the 16:15 leg still has nothing to read.

---

## 3. SCOPE: one card, one day. Corrected 2026-09-01

**The first version of this section said an upload of five sessions produces five reads. That is
the wrong scope and Luke caught it:**

> *"that card only shows 1 day's recap. not monday's and tuesday's... im trying to implement this
> step by step, piece by piece, slowly, based on what we have implemented so far. all we have is
> the recap card. we need it to work for one day, correct?"*

Correct. **All that exists is a card that shows one read.** Five reads was a design for `/read`'s
archive, which is deferred and unplanned. Designing the job around it now means building a thing
nothing can display, and choosing its rules with no surface to check them against.

### The rule for what exists

> **An upload produces AT MOST ONE READ: the newest session date that is over and has no read yet.**

Older sessions in the same upload get no read, and never will. That is not a gap - it is
`build-plan.md` §S8's **no backfill** rule arriving one level down. A read written for Monday on
Friday cannot say what yesterday did to anything, and the card cannot show it either.

**Worked through:**

| The trader uploads | Sessions in the file | Reads written |
|---|---|---|
| Monday 18:00, with Monday's session | Mon (over at 17:00) | **Monday** |
| Wednesday, with Mon + Tue + Wed | Mon, Tue, Wed | **Wednesday only** |
| Monday 11:00, mid-session | Mon (NOT over) | **none** - it is read on the next upload |
| Friday, with the whole week | Mon-Fri | **Friday only** |
| Saturday, nothing new since Friday | Fri, already read | **none** |

**What this buys, beyond correctness:** no sweeper, no batch loop, no archive, no ordering, and one
API call per upload at most. Every one of those was a thing §5 had to reason about, and none of them
is a thing the card can show.

**When `/read` is planned**, the question reopens as *"does the archive get entries for sessions that
were never the newest?"* - and the answer is probably still no, for the same no-backfill reason.
Recorded so the reasoning is not redone from scratch.

---

## 3a. The reference's own blueprint, read out of its running app *(2026-09-01)*

Read from Monarch's Apollo cache on `app.monarch.com/dashboard/weekly-recap` via the standalone
chrome-devtools CLI, on Luke's authenticated tab. **This is measured, not inferred.**

### The stored object

```
recap(startDate: "2026-08-23", endDate: "2026-08-29")   ->  Recap:253648150574584074

Recap {
  id, dateRangeStart, dateRangeEnd,
  summary:    "This week: net worth decline, higher spending, no scheduled transactions."
  sentiment:  SLIGHTLY_NEGATIVE
  createdAt:  2026-08-31T17:48:46.605296+00:00
  updatedAt:  2026-08-31T17:48:46.605313+00:00
  cards: [ RecapCard x5 ]
}

RecapCard {
  module:     INTRO | NET_WORTH | SPENDING | RECURRING | OUTRO
  title       the long specific sentence   "You spent $207 this week, up 74.5% vs. last week"
  headline    the short one                "Your spending increased by 74.5% from last week"
  message     the paragraph
  titleMarkdown / headlineMarkdown / messageMarkdown   - the same three, with **bold** on figures
  sentiment:  VERY_NEGATIVE | SLIGHTLY_NEGATIVE | SLIGHTLY_POSITIVE | ...
  metrics:    a JSON STRING of label -> PRE-FORMATTED value
              {"Change": "-$1,288", "Change %": "-0.4%", "Net Worth": "-$336,070"}
  richBlocks: [ a fenced block: ```chart:line / ```chart:pie + `Label;Value` rows ]
}
```

### Seven things worth taking

1. **IT IS A STORED ROW, FETCHED BY DATE RANGE.** One query, `recap(startDate, endDate)`. Nothing is
   generated when the modal opens. This is the same answer `build-plan.md` §S8 reached independently.
2. **IT IS FROZEN, AND THEY PROVE IT.** `createdAt` and `updatedAt` differ by **17 microseconds** -
   written once by the job, never touched again. Luke's frozen decision has the reference behind it.
3. **IT IS NOT WRITTEN AT THE BOUNDARY.** The week ended Saturday 2026-08-29; the row was created
   **Monday 2026-08-31 at 17:48 UTC** (12:48 CT). Two days late, mid-morning, on a business day.
   **Even the reference does not publish at the close** - it batches when it suits them.
4. **`richBlocks` IS THE GENERATIVE-UI VOCABULARY, AS A FENCED STRING.** ` ```chart:line ` with
   `Label;Value` CSV inside it. That is exactly what `RecapEvidence` in `lib/desk/recap.ts` does with
   a discriminated union. Theirs is LLM-native - the model emits it inline in markdown; ours is
   type-safe. **Ours is the better fit for a product whose doctrine is that the LLM never computes a
   number**, but theirs is worth knowing: a chart is a BLOCK IN THE PROSE, not a separate field.
5. **`metrics` CARRIES PRE-FORMATTED STRINGS, NEVER RAW NUMBERS.** `"-$1,288"`, not `-1288`. Same
   instinct as Run's: formatting is decided before the model sees it.
6. **THREE LENGTHS OF THE SAME SENTENCE, GENERATED TOGETHER.** `title` (long, specific), `headline`
   (short), `message` (the paragraph) - plus a markdown twin of each with the figures bolded. That is
   how one generation serves the card, the modal and the email without re-asking.
7. **`sentiment` IS AN ENUM, PER CARD AND PER RECAP.** It is almost certainly what selects the OUTRO's
   register and the celebration. **Run should not copy this half** - `psychology.md` is explicit that
   grading a trader's week is the failure, and `build-plan.md` §S8 already refused the outro.

**And INTRO and OUTRO are modules in the same array**, not chrome. Their five "steps" are five data
rows; the walkthrough is a renderer over a list. Ours is one card because a read has one subject -
that difference is the product decision, not an implementation one.

---

## 4. The clock, stated correctly

`market-hours.md` §1, read off CME's own service:

| | span | what it is |
|---|---|---|
| **the trade date** | **17:00 CT → 17:00 CT** | the 24 hours a fill is DATED to. **The boundary.** |
| the tradeable session | 17:00 CT → 16:00 CT | when the book is open |
| the maintenance break | 16:00 CT → 17:00 CT | Globex down, Mon-Thu |

**Luke's model described the tradeable session; the boundary is the trade date.** The difference is
the maintenance hour, and it matters for one reason: a fill exited between 16:00 and 17:00 CT belongs
to that session date. Select by a 17:00→16:00 wall-clock window and it belongs to no read, ever.

> **THE JOB NEVER USES A WALL-CLOCK WINDOW. It queries `session_date`.** That column already derives
> from `exit_at` through `sessionDateFor`, and `sessionWindow()` in `src/lib/time/session.ts` already
> returns the `[17:00 prev, 17:00 today)` instants, DST-safe.

**UTC is a scheduling detail, not a modelling one.** Cron expressions are UTC everywhere, so any
future clock trigger will be written in UTC. The session boundary is 17:00 **America/Chicago** and
always will be — it is a market fact. `SESSION_BOUNDARY_ZONE` and `SESSION_BOUNDARY_HOUR` travel
together for exactly this reason (`CLAUDE.md`).

---

## 5. Edge cases

### 5.1 Accepted and lived with

**A read cannot see the last 45 minutes of a crypto session** *(Luke, 2026-09-01: "this issue is what
it is... nothing can be done. we live with it")*. CME's bitcoin and ether futures are 24/7
(`market-hours.md` §4), so an MBT exit at 16:30 CT belongs to a session date that a 16:15 run has
already frozen. Every other CME product is inside the maintenance break at that hour and cannot
produce a fill. **Recorded so it is a known gap rather than a bug report.**

*This gap does not exist on the CSV trigger*, which reads a session date only after it is fully over.
It arrives with the clock trigger, and only for crypto.

### 5.2 Scheduling — and why the clock trigger is not buildable today

Checked 2026-09-01 against Vercel's published limits. **Run is on Hobby.**

| | Hobby | Pro |
|---|---|---|
| cron jobs per project | **2** | 100 |
| frequency | **once per day**; more fails at DEPLOY | per minute |
| timing | **anywhere inside the hour** | within the minute |
| function duration | **10s default** | 60s default, to 300s |
| retry on failure | **none** | none |

**Three of those independently rule out a clock trigger on this plan:**

1. **Once per day means the DST trick is impossible.** 16:15 CT is 21:15 UTC in summer and 22:15 in
   winter. Holding a fixed Chicago hour needs two expressions and a guard; Hobby allows one useful
   one.
2. **Hour-level jitter means "16:15" is not a thing you can ask for.** `15 21 * * *` fires somewhere
   in the 21:00 hour.
3. **A desk read takes 60-90 seconds.** It does not fit in a 10-second function, and one invocation
   cannot serve N traders serially at any duration.

**⚠️ (3) THREATENS THE UPLOAD TRIGGER TOO**, because an import commit runs in the same serverless
function. **This is the next thing to solve and it is deliberately not solved here** (Luke: *"maybe
we can find a way to make the api call happen faster. we havent gotten to that part of the plan yet.
remember, step by step"*).

### 5.3 Why a night can be missed

Three different failures, and only the first is about cron:

1. **The invocation fails and nothing retries it.** Vercel does not retry a cron. A deploy in flight,
   a database blip, or a 529 from the model and that session date has no read and nothing says so.
2. **The upload lands but one session in the batch fails.** Four sessions read, the fifth throws.
3. **The trader never uploads.** Not a failure at all: no data, no session, no read.

**(1) and (2) need a SWEEPER** — a pass that finds session dates with trades and no read inside a
bounded lookback, and reads them.

> **A SWEEPER IS NOT BACKFILL, and conflating them would undo a decision.** `build-plan.md` §S8:
> **no backfill** - the engine never writes reads for sessions that finished before it existed,
> because a read written months late cannot say what yesterday did. A sweeper finishes a job that was
> supposed to have run *and whose session the engine was already alive for*. The lookback bound is
> what keeps them apart, and it should be short - days, not months.

### 5.4 Holidays, and why no calendar is needed

**An early close shortens a session; it does not move the roll** (`market-hours.md` §5). Verified
against CME's 2026 schedule: most Monday holidays halt around 12:00 CT, Thanksgiving halts equities
at 12:15 and energy/metals at 12:30, Christmas Eve at 12:00. In every case the trade date still ends
at 17:00 CT, so a job that reads a *complete session date* sees a complete session. It is simply
smaller.

**A holiday produces a session with no trades**, which `spec.md` already requires to exist. No read
is written, and the card falls to its existing states.

**CME publishes final holiday hours ~2 weeks ahead**, so any calendar Run encoded would be stale by
construction. Another reason not to encode one.

### 5.5 DST

- **Spring forward** (2nd Sunday, March): the session is 23 hours.
- **Fall back** (1st Sunday, November): 25 hours.
- Neither moves the boundary in WALL CLOCK, which is what `sessionDateFor` and `sessionWindow`
  operate on. Both resolve the zone offset per instant; `scripts/s1-gate.mts` §4 exercises both
  directions synthetically.

### 5.6 Idempotency and freezing

**A unique key on `(trader_id, session_date)`.** It is what makes "frozen" TRUE rather than intended,
and it is also the double-fire guard: two triggers racing on the same session write one row.

### 5.7 Data

**A re-import after a read is frozen.** The trader re-syncs and that session's trades change. The
read does not rewrite (`build-plan.md` §S8, frozen). The read should record the import high-water
mark it saw, so the fact is knowable. **OPEN: whether the card says anything about it.**

**Quarantined trades.** P12 forbids showing a figure that cannot be reconciled, and `CLAUDE.md`
requires that an excluded or quarantined trade stay visible and countable. So: out of every figure,
in as a COUNT, so the read can say *"3 trades could not be reconciled"* rather than silently
shrinking the day. **OPEN: confirm.**

**Copy-trading.** One decision across five accounts is five round trips in the tape
(`prop-firm-identity.md` §1). The read NARRATES, so it will say "five times" where the trader did one
thing. **This must be solved in the tape builder, not in the prompt** - the same problem the
comparison baseline has, one level worse.

**One read per TRADER, across all accounts.** The card lives on `/today`, which has no account scope.

### 5.8 The read itself

- **`checkNumbers` fails → nothing publishes.** A read carrying an unverified figure is the
  `MAX DRAWDOWN 1644.2%` failure with Run's name on it. The card falls back to `pending`.
- **An empty lens.** `read.ts` documents it: at `effort: high` a lens spent its whole budget on
  thinking and returned an empty string, the synthesizer wrote from one lens, and the result looked
  exactly like a two-lens read. **Detected, never assumed.**
- **One trader's failure must not abort the run.**
- **A cost ceiling per trader**, internal, with a stated fallback. Never a counter on screen -
  `CLAUDE.md` bans a state that represents absence, and "2 reads left" is one.

---

## 6. When the Tradovate API lands

Written now, while the reasoning is fresh, because this is the half that is easy to get wrong later.

**What changes:** the trigger, and nothing else. The clock becomes the last condition to become true
instead of the upload.

**What must be true before flipping it on:**

1. **A plan that can hold a Chicago hour.** Two cron expressions (21:15 and 22:15 UTC) plus a
   handler that no-ops unless the Chicago wall clock reads 16 - or an external scheduler. Hobby
   cannot do this; it is a Pro-or-elsewhere decision.
2. **Somewhere for a 60-90 second call to run**, per trader, in parallel. Not a serverless request
   handler.
3. **The crypto gap becomes real** (§5.1) and is accepted.
4. **The sweeper exists** (§5.3), because a cron that is not retried needs one.
5. **`renderTape()` has a window cap.** `ai-economics.md` §7 principle 3; it has none today, and a
   live feed means the corpus only grows.

**What must NOT change:**

- The session boundary stays 17:00 `America/Chicago`.
- A published read stays frozen.
- No backfill.
- The job still queries `session_date`, never a wall-clock window.

---

## 7. Still open

| | |
|---|---|
| Where a 60-90s read runs, on Hobby | §5.2 - the immediate blocker |
| Does the card say anything when a re-import touches a frozen read's session | §5.7 |
| Quarantined trades: count-only, confirmed? | §5.7 |
| Copy-trade de-duplication in the tape builder | §5.7 |
| Nightly leg: full `deskRead()` or the cheap second path | `ai-economics.md` §6 |
| Tape window: how many sessions | `ai-economics.md` §7 principle 3 |
