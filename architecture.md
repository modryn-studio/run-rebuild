# Architecture — Run

> Phase 4 artifact. Where every piece of state lives, and why.
> The reasoning matters more than the choice — future-you needs to know whether a constraint
> still applies before overturning a decision.

**Status:** draft — derived from `spec.md` @ `p2-gate`, before opening any prior architecture doc
**Last amended:** 2026-08-11

<!-- DERIVATION NOTE: written from the locked spec only. run-trading/docs/data-model.md exists
     and has NOT been read — deliberately, so this is an honest derivation rather than a
     reconstruction. Compare against it afterward; differences are findings either way. -->

---

> **⚠️ REVISED 2026-08-11 after reading `run-trading@dev:docs/data-model.md` and the `v2` plans.**
> The derivation below was materially wrong in four places and right in two that are worth
> knowing. **§8 records the full reconciliation** — read it before trusting any table here.
> The three most important corrections are folded in inline and marked `[REVISED]`.

---

## 0. The three things that shape everything below

**1. Identity is primary, the account is a child of it.** The spin is a model of *the trader*
that compounds across every firm. An account-centric schema — which is what every competitor has
— cannot express that, and no amount of joins fixes it later. This is the single decision most
expensive to reverse.

**2. Accounts are never deleted, only closed.** S7. A breached account keeps its history and
stays visible. This is the corpus, and it means **no deletion cascade may ever reach a fill.**

**3. Money is never a float.** P12 says never show a number you cannot reconcile, and floats
cannot reconcile. `MAX DRAWDOWN 1644.2%` is what the alternative looks like in production.

**4. `[REVISED]` State vs. log.** One immutable append-only table (`event`) is the corpus.
Everything else — `trader`, `account`, `session`, `fact` — is **mutable current state,
rebuildable by replaying the log.** This is the framing my derivation missed entirely, and it
matters because it is what makes caching derived values safe: a projection you can regenerate is
not a source of truth you can corrupt.

---

## 1. Data model

### `trader` — the identity

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | |
| `email` | citext | no | unique |
| `display_timezone` | text | no | IANA. **Display layer only** — never used for session bucketing |
| `created_at` | timestamptz | no | |

The timezone field is worth its own note: it exists so a trade renders at *their* 9:31am. It
must never reach the session-bucketing code. See §4.

---

### `account` — a broker account, owned by a trader

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | |
| `trader_id` | uuid | no | → `trader` |
| `platform` | text | no | `tradovate`. **The platform, not the firm** |
| `prop_firm` | text | yes | Apex, Topstep, … `null` for personal accounts |
| `external_account_id` | text | no | the broker's id, e.g. `ELTDENF260623134425853685` |
| `display_name` | text | no | |
| `account_type` | enum | no | `evaluation` · `funded` · `personal` |
| `state` | enum | no | `active` · `closed` · `breached` |
| `closed_at` | timestamptz | yes | |
| `created_at` | timestamptz | no | |

Unique: `(trader_id, platform, external_account_id)`
Indexes: `trader_id`, `(trader_id, state)`

**`platform` and `prop_firm` are two columns on purpose.** The obvious single `firm` column is a
trap: it ends up holding the platform (`tradovate`, later `ninjatrader`) and the actual prop firm
gets recorded nowhere — which is awkward for a product whose thesis is a corpus compounding
*across every firm*. Splitting them costs nothing now and is a data-archaeology job later.
Carried from `widening-plan.md` §5.5.

**`account_type` is required at creation** (spec §3, personal-accounts note). Without it Run
cannot tell a personal signup from a prop one, and admitting the segment was pointless.

**Deletion policy: there isn't one.** An account is never `DELETE`d. `closed` and `breached` are
states, not absences. Any `ON DELETE CASCADE` reaching this table or below it is a bug.

---

### `import` — the provenance object

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | |
| `trader_id` / `account_id` | uuid | no | |
| `filename` | text | no | |
| `file_hash` | text | no | sha256 of the bytes — the dedupe key |
| `source` | enum | no | `tradovate_csv` · `tradezella_csv` · later `tradovate_oauth` |
| `uploaded_at` | timestamptz | no | |
| `rows_parsed` / `rows_rejected` | int | no | |
| `range_start` / `range_end` | date | yes | trade dates covered |
| `status` | enum | no | `pending` · `committed` · `rejected` |

Unique: `(account_id, file_hash)` — re-uploading the same file is a no-op, satisfying S1's
no-double-count criterion.

**This table is why P8 is possible.** Every figure in the product traces to a row here, which is
what lets the trust note say *"from your Tradovate export of Aug 11, covering Jun 3 – Aug 8."*
Without it, provenance is a claim rather than a lookup.

**Nothing commits until `status = committed`** — S1's step 3 shows counts *before* the write.

---

### `event` — `[REVISED]` the log. The only immutable table, and the corpus.

Replaces the `fill` table my derivation had. **Everything else in this document is a projection
over this.**

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | **bigint identity** | no | **Not a uuid.** Monotonic total order — replay order is behavioral signal, and timestamps can't provide it (ms ties; CSV stamps are coarse) |
| `trader_id` | uuid | no | Events point at the **person**, not the account. The cross-firm identity rule |
| `account_id` | uuid | yes | null for events not tied to one account |
| `type` | text CHECK | no | `fill` · `round_trip` · `fee` · `csv_import` · … TS union is source of truth; CHECK stops typo-fragmentation of the corpus |
| `payload` | jsonb | no | full-fidelity raw detail. Never lose detail |
| `payload_version` | int | no | so a v0 row replays correctly through v2 extraction code |
| `source` | text CHECK | no | `csv` · `api` · `app`. **On the event, not the account** — the same account ingests via CSV now and API later |
| `pnl_cents` | bigint | yes | **null on raw fills.** A single leg has no realised P&L |
| `symbol` / `qty` / `side` | — | yes | promoted from payload, fills only |
| `corrects_event_id` | bigint | yes | self-FK. **Busts and adjustments append**; the original never mutates |
| `occurred_at` / `recorded_at` | timestamptz | no | real-world instant / when captured. Both UTC |
| `dedupe_key` | text | yes | namespaced by type: `f:` fills · `p:` round trips · `x:` cash |

Partial unique index: `(account_id, dedupe_key) WHERE dedupe_key IS NOT NULL`, with
`onConflictDoNothing` — **a re-uploaded file becomes a no-op at the database level**, not in
application logic.

**Promoted columns are a projection of `payload`, written atomically in the same INSERT.** Safe
here *only* because the table is immutable — projection and payload can never diverge after
write. It would not be safe on a mutable table. They exist for **integrity, not speed**: P&L is
the number everything rests on, so it gets a typed, constrained column that rejects garbage at
write time rather than hiding a bad value inside a blob.

**No per-type tables.** One log, many types.

**Write in 1,000-row chunks.** Postgres caps a statement at 65,535 bind parameters; ~10 columns
per row means a single INSERT throws somewhere past 6,500.

---

### `fill` / `round_trip` / `fee` — `[REVISED]` projections, not tables

Derived from `event` by type. A `round_trip` comes from **Tradovate's own Position History
pairing** — Run does not build a matching engine, because under P12 a matcher is a machine for
producing numbers you cannot reconcile.

**Net P&L is derived on every extraction, never stored.** It has to be: the batch ingests fills →
position history → cash history, so **at the moment a `round_trip` is written its fees do not
exist yet**, and an append-only log cannot revise the row afterwards.

#### The fee allocation rules — every one of these is a fixed bug

1. **The split is exact, not pro-rata.** Tradovate charges a flat rate per contract per side, so
   a trade's cost is `pairedQty × (entry rate + exit rate)`. Across 360 real round trips this
   reproduced the file's totals **to the cent, zero remainder**. Pro-rata would be close,
   plausible, and unreconcilable.
2. **Fees bucket to fills on RAW STRINGS** — `(local timestamp, contract)`. Cash History names no
   fill id and its timestamps carry no timezone; parsing them resolves against the server's zone
   and shifts every fee. **String equality cannot drift.**
3. **`[#90.1]` A fee's `occurred_at` must be a real instant, not the naive local string.** A fill
   stores true UTC; a fee storing local wall-clock lands on a *different trade date* for evening
   sessions. Measured: a Chicago 18:30 fill files under 07-09 while its fee files under 07-08, so
   a windowed query finds the trade and not the fee — **and that trade prices at zero fees**,
   reading net on one page and gross on another. Carry the fill's instant onto its fee rows.
4. **`[#90.3]` The fee rate key must include `account_id`.** A copy-trader fires one strategy into
   many accounts at different firms, producing the same `(timestamp, contract)` bucket **at
   different rates**. Pooling across firms corrupts every metric that reads a per-trade net.
5. **`[#90.2]` A round trip whose entry fill is outside the window gets charged half its fees.**
   Only reachable on accounts that hold overnight — which, now that personal accounts are in
   scope from v1, is a live case rather than a theoretical one.
6. **`[#36]` Cash History is not the only fee source.** The API path exposes per-fill fees
   (`/fillFee/list`). Whatever consumes fees must not assume the CSV shape.

#### The two failure modes that must be loud

- **`[#74]` Partial date overlap.** The existing guard is `fillUtc.size === 0` — all-or-nothing.
  If even one round trip resolves, every unresolved one silently degrades to local wall-clock or
  ingest time, **corrupting session bucketing permanently.** The guard must be per-round-trip.
- **`[#75]` A non-overlapping Cash History makes net silently equal gross.** No fill lands in a
  fee bucket, `perContract` stays 0, the import succeeds, and every trade reports gross as net —
  failing in the direction that flatters the trader.

---

### `contract_spec` — the multiplier table

| Field | Type | Notes |
|---|---|---|
| `symbol_root` | text | PK — `MNQ`, `NQ`, `ES`, `MES` |
| `point_value_cents` | bigint | MNQ = 200, NQ = 2000 |
| `tick_size` | numeric | |
| `currency` | text | |
| `exchange` | text | drives the session calendar |

**This table is small, boring, and the highest-risk thing in the schema.** Round-trip P&L is
`(exit − entry) × point_value × qty`. A wrong multiplier produces a number that is confidently,
precisely wrong — which is the exact failure class as TradeZella's `1644.2%`. It is data, not
code, so it can be corrected without a deploy; and it must be **seeded from the exchange's own
published specs, never from memory.**

NQ and MNQ are the same instrument at a 10:1 ratio. Getting that backwards is a 10× error in
every figure.

---

### `trade` — a round trip, derived

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | |
| `account_id` | uuid | no | |
| `symbol_root` | text | no | |
| `entry_at` / `exit_at` | timestamptz | no | UTC |
| `session_date` | date | no | **derived from `exit_at`.** See §4 |
| `qty` | int | no | |
| `entry_price` / `exit_price` | numeric(19,6) | no | |
| `gross_pnl_cents` | bigint | no | from the round-trip event. **`net` is NOT stored** — see the projections section above |
| `state` | enum | no | `ok` · `quarantined` · `excluded` |
| `quarantine_reason` | text | yes | |
| `exclusion_reason` | text | yes | user's words, S9b |

Indexes: `(account_id, session_date)`, `(account_id, exit_at)`, `state`

**`session_date` is stored, not computed on read.** It is derived once at ingest from `exit_at`
and the exchange calendar, then persisted — because every grouping in the product keys off it and
recomputing a timezone-and-calendar-dependent value on every query is both slow and a place for
two code paths to disagree.

**`state` carries quarantine and exclusion, and both are visible.** S3 and S9b: excluded trades
stay countable. `ok` is the only state that feeds a computed figure.

---

### `session` — the trading day, materialised

| Field | Type | Null | Notes |
|---|---|---|---|
| `trader_id` | uuid | no | |
| `session_date` | date | no | |
| `net_pnl_cents` / `fees_cents` | bigint | no | |
| `trade_count` / `win_count` | int | no | |
| `first_trade_at` / `last_trade_at` | timestamptz | yes | |

PK: `(trader_id, session_date)`

**Keyed on the trader, not the account.** A trader may work several accounts in one session, and
the wedge is about *their* day. Per-account rollups are a filter over `trade`, not a second table.

**A session with no trades still exists** (spec §8). Streaks, gaps, and "you don't trade Mondays"
all need the absence to be a row rather than a missing key.

---

### `pattern` — a named behavior

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | |
| `trader_id` | uuid | no | |
| `key` | text | no | `size_up_after_losses` — the detector that found it |
| `first_seen_at` / `named_at` | timestamptz | yes | `named_at` null while `watching` |
| `status` | enum | no | `watching` · `named` · `improving` · `resolved` |
| `params` | jsonb | no | the thresholds this instance was matched at |

Unique: `(trader_id, key)`

### `pattern_occurrence` — one instance

| Field | Type | Notes |
|---|---|---|
| `pattern_id` | uuid | |
| `session_date` | date | |
| `trade_id` | uuid | the trade it fired on |
| `cost_cents` | bigint | signed |
| `outcome` | enum | `win` · `loss` · `breakeven` |

Indexes: `(pattern_id, session_date)`

**These two tables are the corpus made queryable, and they're what History renders.** "You told
me about this last month — did it get better?" is
`SELECT sum(cost) ... GROUP BY month` over occurrences. The confidence floor (8 occurrences +
separation from the trader's own baseline) is a query over this table, not a stored verdict —
so the threshold can change without a migration.

### `read` — the daily artifact

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `trader_id` | uuid | |
| `session_date` | date | one per trader per session |
| `state` | enum | `finding` · `watching` · `quiet` |
| `pattern_id` | uuid, null | null when `quiet` and nothing is being tracked |
| `body` | text | the generated prose |
| `working` | jsonb | occurrence count, outcome count, baseline — what §S5 shows |
| `provenance` | jsonb | snapshot of the imports it drew on |
| `generated_at` | timestamptz | |

Unique: `(trader_id, session_date)`

**`body` and `working` are stored, not regenerated.** A read is a thing the product *said* on a
given day. Regenerating it later against more data would silently rewrite history — and History's
whole premise is that Run's past claims are on the record.

---

### Relationships

```
trader ─1:many─> account ─1:many─> import ─1:many─> fill
                    └────1:many─> trade ──many:1──> contract_spec (by symbol_root)
trader ─1:many─> session
trader ─1:many─> pattern ─1:many─> pattern_occurrence ──many:1──> trade
trader ─1:many─> read ──many:1──> pattern
```

### Deletion policy

| Relationship | On delete |
|---|---|
| `trader` → everything | account deletion only, full export first. Nothing else deletes |
| `account` → `fill` / `trade` | **RESTRICT.** Accounts close, they don't disappear |
| `import` → `fill` | **RESTRICT.** An import is a receipt; deleting it orphans provenance |
| `pattern` → `pattern_occurrence` | CASCADE — a retired detector's occurrences are meaningless |
| `trade` → `pattern_occurrence` | RESTRICT — an occurrence citing a missing trade is a broken claim |

---

## 2. System map

```
[browser] ──upload CSV──> [server: parse + reconcile] ──> [Postgres]
                                    │
                                    ├──> [object storage]  raw file, kept for re-parse
                                    ├──> [job runner]      nightly read generation
                                    ├──> [LLM]             prose for `read.body` ONLY
                                    ├──> [auth]            better-auth, self-hosted
                                    └──> [error tracking + structured logs]
```

| Service | What it does | Failure mode |
|---|---|---|
| Postgres (Neon) | everything | **critical** — app is down |
| Object storage | keeps the raw upload | degraded — re-parse unavailable, figures unaffected |
| Job runner | generates the daily read | degraded — yesterday's read is late, record intact |
| LLM | writes prose *around* computed numbers | degraded — show the working, skip the sentence |
| Auth | sessions | critical |

**The LLM never computes a number.** It receives the finished figures and writes the sentence
around them. Every number in a read comes from SQL over `pattern_occurrence`. This is the
structural answer to P12 — a model cannot hallucinate a figure it was handed, and it is the
difference between Run's read and the field's "AI" that restates the chart.

---

## 3. Trust boundary

```
        ┌──────── TRUST BOUNDARY ────────┐
 CSV ───┤  parse, validate, reconcile    ├──> fills
 auth ──┤  server-side, always           │
 params ┤                                │
        └────────────────────────────────┘
```

| Entry point | Validated by | Authorised by |
|---|---|---|
| CSV upload | server parser: size cap, row cap, schema match, per-row typing | session → `trader_id` |
| Any `account_id` in a URL | must resolve to a row owned by the caller | re-checked per request |
| Filter/date params | parsed and clamped server-side | — |

**Every query is scoped by `trader_id` from the session, never from the request.** The most
common real-world web vuln is changing an id in a URL and reading someone else's record — and
here that record is somebody's trading history.

**A CSV is untrusted input, including its numbers.** Formula injection on export, absurd
quantities, prices that fail a sanity band — all rejected at the boundary, not stored and
displayed. A parse failure quarantines; it never guesses.

---

## 4. The session boundary — one constant, one function

The spec's highest-risk implementation detail, so it gets its own module:

```
SESSION_BOUNDARY_ZONE  = 'America/Chicago'
SESSION_BOUNDARY_HOUR  = 17            // pairs with the zone above — see spec §8
sessionDateFor(exitAtUtc) -> date      // the ONLY way a session_date is produced
```

- **Nothing else may compute a session date.** Two code paths for this is how a product disagrees
  with itself about "your worst day."
- The zone/hour pair travels together. `America/New_York` + `17` is an hour wrong on every
  evening session, silently.
- Named IANA zone, never a fixed offset. An offset breaks twice a year.
- `trader.display_timezone` must not be importable from this module.

---

## 5. Decisions

| Decision | Choice | Why | Rejected |
|---|---|---|---|
| Money | integer cents (`bigint`) | exact; P12 is unsatisfiable otherwise | float — the `1644.2%` failure class |
| Prices | `numeric(19,6)` | exact decimal, sub-tick headroom | float |
| Auth | better-auth, self-hosted | standing studio default | Clerk (banned) |
| DB | Neon + Drizzle | standing studio default | |
| Session date | stored at ingest | every grouping keys off it; recompute invites drift | compute-on-read |
| Fills | immutable | S9 cut; corrections are re-imports | mutable rows |
| Reads | stored prose + working | regenerating rewrites history | regenerate on view |
| Confidence floor | a query, not a stored flag | threshold changes without a migration | materialised verdict |
| Raw files | kept in object storage | re-parse without asking the user to re-upload | discard after parse |
| Timezone | 3 layers, §4 | a market fact doesn't move when the trader does | one zone everywhere |

---

## 6. Screen → data map

| Screen | Reads | Writes |
|---|---|---|
| Today | `session` (latest), `read` (latest), `account` (counts + freshness), `trade` (rollup) | — |
| Accounts | `account`, `import` (freshness), `trade` (per-account rollup) | — |
| Add account | `contract_spec` (validation) | `account`, `import`, `fill`, `trade`, `session` |
| Trades | `trade` + `session` headers, filtered; `import` for provenance | — |
| Trades → resolve (S9b) | `trade`, `import` | `trade.state`, `trade.exclusion_reason` |
| Read → Patterns | `read` (today), `pattern`, `pattern_occurrence` | — |
| Read → History | `pattern`, `pattern_occurrence` aggregated by period | — |
| *(nightly job)* | `trade`, `session`, `pattern_occurrence` | `pattern`, `pattern_occurrence`, `read` |

---

## 7. Known debt, recorded at the moment it's taken

| Shortcut | Why acceptable | What forces a fix |
|---|---|---|
| `session` is materialised, not a view | every screen reads it; a view over `trade` would recompute constantly | if rollups drift from `trade`, add a reconciliation check |
| `contract_spec` seeded by hand | four instruments today | any ag/FX contract arriving in a real import |
| No `fill` → `trade` audit trail | the pairing algorithm is deterministic and re-runnable from `fill` | a pairing bug reaching production |
| Reads generated nightly, not on demand | one trader; the job is cheap | more traders than the window allows |

---

## 8. Reconciliation against the shipped model

Read `run-trading@dev:docs/data-model.md` plus the `v2` plan set after drafting §1–§7 blind.
**The derivation was wrong in four ways that matter and right in two worth recording.** Both
directions are useful; the wrongness is more useful.

### ❌ Wrong 1 — no event log. The biggest miss.

I modelled `fill` as immutable and everything else as ordinary tables. The shipped model is
**one append-only `event` log as the moat, with every other table a rebuildable projection.**

Two details inside it that are not obvious and that I would not have arrived at:

- **`event.id` is a `bigint identity`, not a uuid.** Monotonic total order is required because
  **replay order is itself behavioral signal**, and timestamps cannot provide it — millisecond
  ties are real and CSV `occurred_at` is coarse.
- **Corrections append.** A bust or adjustment writes a new event with `corrects_event_id`
  pointing at the original; the original never mutates. My answer was "re-import," which loses
  the fact that a correction *happened* — and for a behavioral corpus, that's signal too.

**Adopt.** `fill` and `trade` in §1 become projections over `event`, not base tables.

### ❌ Wrong 2 — I had Run pairing fills into round trips

`trade` in §1 implies a matching engine. **Tradovate's Position History export already contains
Tradovate's own entry→exit pairing, including many-to-many splits.** The shipped intake ingests
that as `round_trip` events and never builds a matcher.

This is the difference between reconciling to the broker and *reimplementing* the broker. Under
P12, a matching engine is a machine for producing numbers you cannot reconcile.

**Adopt, without qualification.**

### ❌ Wrong 3 — the fee model. This one is a shipped-bug-level error.

My `fill` carried `fee_cents` and `commission_cents` from the fills export, and `trade` stored
`net_pnl_cents`. Both are wrong, and the first is dangerous:

> Tradovate charges four separate lines — Commission, Exchange, Clearing, NFA. **The Fills
> export's `commission` column is only the first: measured, 42% of true cost.**
> On a real 10-day export: gross −$1,840.50, fees −$1,934.36, net −$3,774.86.
> **The fees exceeded the gross loss.** Gross-only reporting understated the real loss by half.

So the Cash History export is **required on upload, not optional** — and my spec's single-file
flow would have shipped a product that was wrong by ~50% on the headline number while displaying
a confident provenance note. That is precisely the failure Run exists to attack.

Two more corrections riding along:

- **Net P&L is derived on every extraction, never stored.** It has to be: the batch ingests
  fills → position history → cash history, so at the moment a `round_trip` is written **its fees
  do not exist yet**, and an append-only log cannot revise the row later. My stored
  `trade.net_pnl_cents` is structurally impossible in this design.
- **The fee split is exact, not pro-rata.** Tradovate charges a flat rate per contract per side,
  so a trade's cost is `pairedQty × (entry rate + exit rate)`. Across 360 round trips this
  reproduced the file's totals **to the cent, zero remainder**. Pro-rata would have been close,
  plausible, and unreconcilable.

**Adopt all three. This is the single most valuable thing the comparison surfaced.**

### ❌ Wrong 4 — no erasure doctrine

I wrote "accounts are never deleted" with no answer for GDPR/CCPA. The shipped doctrine is
honest about the contradiction:

> *"Never deleted in normal operation" ≠ "physically undeletable."* `event` is immutable **to
> the application role**; erasure is a privileged, audited path that is never the app's.

And the part I would not have thought of: **crypto-shred exists for the backup-window problem.**
A `DELETE` today does not scrub yesterday's PITR snapshot; dropping the trader's key makes the
encrypted payload unreadable across every snapshot at once. Hard-deleting the rows is *also*
required, because the plaintext promoted columns are pseudonymous — a timestamp+P&L+symbol
series is a re-identifiable fingerprint.

**Adopt as doctrine now, build before the first real user.**

### ✅ Right 1 — the account unique key

I derived `(trader_id, platform, external_account_id)`. Shipped is the same, and the reason is a
**bug they actually caught (2026-07-22)**: external ids collide across traders, so a key without
`trader_id` resolves the second person's import onto the *first* person's account row — where
dedupe then silently drops their events as already-seen.

Independent arrival at the same key from first principles is a good signal for both.

### ✅ Right 2 — platform vs prop_firm

I split them; shipped has a single `firm` column holding the platform, with the ambiguity
recorded as known debt and the real firm recoverable from the account-name prefix. **The new
build should take the split**, since it costs nothing before any rows exist.

### 🔧 Implementation details worth carrying

- **Chunk writes at 1,000 rows.** Postgres caps a statement at 65,535 bind parameters; ~10
  columns per event row means a single INSERT throws somewhere past 6,500.
- **`dedupe_key` is namespaced by type** (`f:` fills, `p:` round trips, `x:` cash) with a
  **partial unique index** `(account_id, dedupe_key) WHERE dedupe_key IS NOT NULL` +
  `onConflictDoNothing`. Re-uploading a file becomes a no-op at the database level rather than in
  application logic.
- **Fees key to fills on RAW STRINGS**, not parsed timestamps. Cash History names no fill id and
  its timestamps carry no timezone — parsing them resolves against whatever zone the server runs
  in and shifts every fee by the CT offset. **String equality cannot drift.** This is the
  subtlest thing in the whole document and it would have been a real bug.
- **`payload_version` on every event**, so a v0 row replays correctly through v2 extraction code.
- **A verification script for the session boundary** exists (`scripts/verify-trade-date.mts`).
  Carry the pattern: the highest-risk derived value gets a script that checks it, not a test that
  asserts one case.
- **Layer 2 `fact`** — disposable, re-derivable behavioral facts with `source_event_ids bigint[]`
  for containment provenance, and an `embedding` column present but unused (V1 recall loads all
  of a trader's facts into the prompt; similarity search waits until the corpus outgrows the
  context window). This is where our `pattern` / `pattern_occurrence` should live.

---

## 9. What the `v2` plans and the issue tracker add

Read `v2`'s plan set and all 100 issues on `modryn-studio/run-trading`. Beyond the fee and
timestamp bugs already folded into §1, these change phase 4 decisions.

### The classification axis — a real gap, and our design answers it differently

`v2:docs/plans/the-classification-axis.md` (approved, unbuilt) makes an argument worth taking
seriously:

> Monarch labels a transaction even though the trader can see what it is. **The label's job is
> not to reveal — it is aggregation.** A trader can see one trade where size went up after a
> loss. They cannot see *what that habit cost across 20,000 round trips*, because there is
> nothing to group by. Every Run surface groups by symbol or account, and both are **inventory** —
> what you traded and where, never *how*.

Their surface map lands on one missing page: Monarch's `/categories` has no Run equivalent.

**Run's answer here is `pattern_occurrence`, and it is computed rather than labelled.** The
group-by exists; the trader just never types it. That is arguably better — it's the wedge — and
it costs nothing in user labour.

**The honest limitation, recorded now:** a computed axis can only aggregate behaviours Run has a
detector for. The trader cannot ask *"how did my breakout trades do?"* unless Run named
"breakout". Correctly out of v1 (tagging is in the scope cut), but it is the reason a
classification axis will eventually be wanted, and `[#72]` already tracks it.

### Synthetic data cannot validate the wedge — now proven in code

`v2:docs/plans/the-dogfooding-corpus.md` found the seed generator **draws the outcome first**:
the day's P&L comes from the account's fate, the trade's from the day's, then everything is
rescaled to land on the story exactly. **So size cannot correlate with anything** — the pattern
detector's correct silence looks like a passing test.

This independently confirms the phase 1 call that fabricated trades can validate scale but never
the wedge. Worth carrying as a rule: **a fixture that cannot express the thing being tested is
worse than no fixture, because its silence reads as a pass.**

### Correctness rules from the tracker

| # | Finding | Rule for the new build |
|---|---|---|
| `#79` | An import writing zero rows looks identical to one writing everything. Luke's own corpus has three `csv_import` events with identical reconciliation — he uploaded the same files three times and two told him they succeeded | "Already saved" is a distinct outcome and must be said |
| `#76` | P&L reconciliation is computed on every import and **discarded on all but the first** | Keep every reconciliation; it is the whole-file check |
| `#97` | **Two things called "grain"** — a TS bucketer and a SQL `date_trunc`, with different vocabularies | One vocabulary for time buckets, named once |
| `#89` | Four surfaces read the whole corpus on every render; the allocator is unscoped | Scope every read by account and window from the first query |
| `#91` | The tape has no row ceiling, the export no cap, and rates can drift mid-scroll | Paginate and cap before there is data to hurt |
| `#83` | Reads ship whole JSONB payloads the consumer never touches | Select promoted columns; reach into `payload` deliberately |
| `#100` | **Erasure cannot complete at launch scale** — the privileged DELETE times out | Batch the erasure path; do not discover this at the first request |
| `#35` | Timezone needs a manual override that outranks browser and CSV detection | `trader.display_timezone` is user-settable, not inferred-only |
| `#59` `#80` | A manual account can receive fills only if they're Tradovate; an import naming several unknown accounts can't ask which is which | Account resolution is part of import, not a precondition |

### Two product findings worth keeping

- **`[#44]` An open-source export extension + native importer**, explicitly to kill the switching
  cost from TradeZella/TradesViz. That is our S2 migration path with a sharper edge — the
  audience is switchers, and making the exit from a competitor *easy and public* is a growth
  mechanism, not just an import feature.
- **`[#43]` `[#41]` The three-file daily upload is real friction**, acknowledged as such, and the
  thing live capture removes. v1 ships the friction knowingly; it should not pretend otherwise in
  the copy.

### Consequences for the locked spec

Two, and they need Luke's sign-off since `spec.md` is locked at `p2-gate`:

1. **S1/S2 assume a single file. The real intake is three** — Fills, Position History, Cash
   History — and Cash History is required, not optional. The wireframe's upload step needs to
   express "three files, and here's which ones," or it ships a 50%-wrong P&L.
2. **§S3's "fees and commissions per fill"** is the wrong shape. Fees resolve per round trip via
   an exact split; per-fill fee display would be a fabrication.

---

## Phase 4 gate

- [ ] Every screen in the spec maps to specific tables *(drafted §6 — verify against wireframes)*
- [ ] Every field filtered/sorted/joined on is indexed
- [ ] Deletion policy decided for every relationship *(drafted §1)*
- [ ] Trust boundary drawn; every entry point validated server-side *(drafted §3)*
- [ ] Every external service has a named failure mode *(drafted §2)*
- [ ] `contract_spec` seeded from published exchange specs, not memory
- [x] Compared against `run-trading@dev:docs/data-model.md` + v2 plans — see §8
- [x] §1 tables rewritten as projections over an `event` log
- [x] Fee model corrected: Cash History required, net P&L derived not stored, six allocation rules recorded
- [x] Spec amended: three-file intake, per-round-trip fees, three loud failure modes
- [ ] Erasure batching designed (#100) before first real user
- [ ] One time-bucket vocabulary named (#97)
