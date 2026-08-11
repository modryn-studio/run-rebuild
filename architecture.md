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

## 0. The three things that shape everything below

**1. Identity is primary, the account is a child of it.** The spin is a model of *the trader*
that compounds across every firm. An account-centric schema — which is what every competitor has
— cannot express that, and no amount of joins fixes it later. This is the single decision most
expensive to reverse.

**2. Accounts are never deleted, only closed.** S7. A breached account keeps its history and
stays visible. This is the corpus, and it means **no deletion cascade may ever reach a fill.**

**3. Money is never a float.** P12 says never show a number you cannot reconcile, and floats
cannot reconcile. `MAX DRAWDOWN 1644.2%` is what the alternative looks like in production.

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

### `fill` — the atomic broker record, immutable

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | |
| `account_id` / `import_id` | uuid | no | |
| `external_fill_id` | text | yes | when the export provides one |
| `symbol` | text | no | full contract, e.g. `MNQU6` |
| `symbol_root` | text | no | `MNQ` — → `contract_spec` |
| `side` | enum | no | `buy` · `sell` |
| `qty` | int | no | |
| `price` | numeric(19,6) | no | |
| `filled_at` | timestamptz | no | **stored UTC** |
| `fee_cents` / `commission_cents` | bigint | no | |

Indexes: `(account_id, filled_at)`, `import_id`, `external_fill_id`

**Immutable once written.** S9 is cut — nothing edits a fill, ever. Corrections happen by
re-import, not by update. This is what makes "our numbers are the broker's numbers" true rather
than aspirational.

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
| `gross_pnl_cents` / `fees_cents` / `net_pnl_cents` | bigint | no | |
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

## Phase 4 gate

- [ ] Every screen in the spec maps to specific tables *(drafted §6 — verify against wireframes)*
- [ ] Every field filtered/sorted/joined on is indexed
- [ ] Deletion policy decided for every relationship *(drafted §1)*
- [ ] Trust boundary drawn; every entry point validated server-side *(drafted §3)*
- [ ] Every external service has a named failure mode *(drafted §2)*
- [ ] `contract_spec` seeded from published exchange specs, not memory
- [ ] Compared against `run-trading/docs/data-model.md` — **needs Luke's door-open**
