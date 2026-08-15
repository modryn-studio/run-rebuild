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
| **Kept, and it earned it** | `scripts/s1-gate.mts` — predicted to *become* `S2`'s verification script; instead `S2` wrote its own and this one stayed as the regression that proves a change did not move the money |

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
- Reconcile against Account Balance History **to the cent** — ✅ **BUILT 2026-08-15**, as the third
  receipt: `lib/csv/account-balance.ts` + `lib/intake/statement.ts`, surfaced as
  `statement_unreconciled`. **12 trading days, 360 round trips, $0.00.** Per day, never on the
  total — see below for why that is the whole design. ~~the ported tape already does this at
  $0.00 across two independent sets~~ was **NOT TRUE when written, corrected 2026-08-15.** The $0.00 is real, but it
  is a RECON MEASUREMENT (`spec.md` §S1), not a check that runs. `lib/desk/tape.ts` names
  reconciliation three times, every one of them a comment explaining why it matters. `v2` did not
  build it either, so there is nothing to port. Account Balance History is still detect-only in
  `lib/csv/shared.ts` — the type is recognised and no parser exists. **This is the open one.** It is
  also the more valuable of the two, because it is the only check that validates NET: the Trade
  Paired reconciliation below proves the pairing, and says nothing about whether the fees are right
- Derive point value per `symbol_root`; **agreement at n≥2, never a median** (`architecture.md`)
- Resolve direction, outcome, exit mechanism and cancel cause in code
- Assert fee plausibility in code, not in the read
- Then the read itself, and check every figure against the tape's whitelist

**Do not port these three as written:** the median point value, the UTC-calendar trading day, and
the two-decimal price formatter. Each is a defect this project has already documented a rule
against.

### S2 — The two primitives everything else is wrong without

Not a screen. The pieces that corrupt everything downstream if they're wrong.

**✅ CLOSED 2026-08-12.** `S1` delivered the larger half; this closed the two gaps it left. Same
non-UI done bar as `S1` (the seven-point definition is meaningless for a library and a data table):
`tsc` and `eslint` clean, **`scripts/s2-gate.mts` passes — 51 assertions**, `scripts/s1-gate.mts`
still passes unchanged, and nothing in `lib/time/` reads the database.

- ✅ **The time module** — `lib/time/session.ts`. `sessionDateFor` from `exit_at`,
  `SESSION_BOUNDARY_ZONE` and `_HOUR` travelling together, a named IANA zone, a display formatter
  that can never be mistaken for a bucketer, and now `bucketStartFor(sessionDate, grain)` plus
  `yearToDateWindow`. Definitions in `architecture.md` §4.
  - **The week starts Monday, and the reason is structural rather than stylistic:** it is what
    Postgres `date_trunc('week', …)` returns by definition, so the TypeScript path and any future
    SQL path cannot disagree. `#97` was a TS bucketer and a SQL `date_trunc` both called "grain"
    while meaning different things; **§2 of the gate runs both against the real database** over DST
    in both directions, a year boundary and a leap day. That is the difference between "these
    should agree" and "these do."
  - Every bucket takes a **session date, never an instant** — accepting a `Date` would reopen the
    zone question in a second place, and a second answer is the whole failure.
  - A malformed date **throws** rather than bucketing. `new Date('2026-02-30')` returns March 2nd.
  - **Known limit, measured:** Luke's corpus contains **zero fills after the 17:00 CT roll**
    (`scripts/s1-boundary-check.mts`), so the boundary is proven only synthetically. Real evening
    data would exercise it; nothing available does.
- ✅ **`contract_spec`** — **changed shape, migrated, seeded.** `drizzle/0001` drops
  `point_value_cents`; the multiplier is derived from the trader's own round trips
  (`architecture.md`) — MNQ $2.00 from 296 round trips, NQ $20.00 from 61, solved from the broker's
  realised P&L with no table. What remains is what cannot be derived: `tick_size` (quote units,
  never money), `currency` and `exchange` (drives the session calendar). **An unknown root still
  quarantines** — the row no longer carries the multiplier, but it carries the currency and the
  calendar, and guessing either is the same failure in a different field.
  - **Seeded by `scripts/seed-contract-spec.mts`, not by a migration.** It is data, so it corrects
    without a deploy; baked into a migration a typo would need a schema change to fix.
  - **41 roots**, read from CME's own contract-spec service rather than a summary of it, covering
    equity index, energy, metals, FX and crypto across **four exchanges** (CME, CBOT, NYMEX,
    COMEX). Roster scoped to what a Tradovate prop or personal account can reach, which is the
    same scoping the previous build arrived at (`run-trading@v2:src/lib/instruments.ts`).
  - **Grains, treasuries and livestock are deliberately absent, and the gate asserts their
    absence.** They are quoted in units that differ from CME's published figure — cents vs dollars
    per bushel, 32nds vs decimals — and `tick_size` must match the broker's price column or the
    plausibility check is confidently wrong. One real export settles it; until then a missing row
    quarantines loudly, which is the correct failure. SR3 is out for a different reason: its tick
    is not a constant.
  - **The published contract unit is a cross-check, never the source** (derivation rule 6), and it
    passed: CME publishes `$2 x Nasdaq-100` and `$20 x Nasdaq-100`, matching the derivation.

#### ↩ REOPENED AND RE-CLOSED 2026-08-12, same day, on one question from Luke

*"Will this work for any trader with a Tradovate account trading whatever they're allowed to
trade?"* It would not have, and the reason was inside `S1`, not `S2`:

- **The point-value plausibility bound was calibrated on a corpus of MNQ and NQ.** $0.10–$250 per
  point. Crude is $1,000, a treasury is ~$1,000, 6E is $125,000 — so a real trade would have been
  quarantined with *"not plausible for a listed future"*, **a false claim about a real trade shown
  to the trader.** Now bounded on **tick value** instead, which spans only $0.05–$50 across all 59
  reachable roots because exchanges size ticks to be economically comparable. `s2-gate.mts` §4.
- **`docs/market-hours.md` written**, and it closes the agricultural gap `run-trading@v2` left
  open: 17:00 CT needs no special case for ag, because grains close at 13:20 and reopen at 19:00,
  so the roll lands in a dead zone. Livestock is 08:30–13:05, entirely before it.
- **Crypto is 24/7** — the real exception, and one the previous build never found. A session date
  can be a Saturday, which contradicted `spec.md` §8. Amended in both places.
- **Crude is *not* an exception.** Checked because it is the one most often described as closing
  early; that is its 13:30 settlement, not its session.

### S3a — Auth and identity *(renamed from `S3` for symmetry with `S3b` / `S3c`)*

`trader`, better-auth wiring, `display_timezone` user-settable and outranking detection, and
the nullable `key_id` column — free now, a migration later, with the encryption itself
explicitly deferred (architecture §1).

**✅ CLOSED 2026-08-12, and exercised end to end by a real sign-in 2026-08-13.** Non-UI done bar,
as `S1` and `S2`: `tsc` and `eslint` clean, **`scripts/s3-gate.mts` passes — 28 assertions**, and
the earlier gates still pass unchanged.

**What the live run added that the gate could not.** The gate proves the logic against fixtures;
it cannot prove that a human signing in produces a record. Luke signed in on `:3001` with the
emailed code, and:

| | |
|---|---|
| `auth_user` | 1 row, `emailVerified: true`, empty `name` — the tell that it was the code path, not Google |
| `trader` | **created on the first `/admin` load, not at signup** — exactly the lazy-resolve design |
| zone | `America/Chicago`, `displayTimezoneSetByUser: false` |
| `key_id` | `null` |

The gap between those two rows is the design working: the trader row did not exist immediately
after signing in, because nothing had called `getTrader()` yet. That is the intended behaviour and
it is the reason a signup hook was rejected — but it is also the one thing a reader is most likely
to mistake for a bug, so it is recorded here rather than left to be rediscovered.

- ✅ **`trader`** — `drizzle/0002`. **Linked to `auth_user`, not carrying a copy of the email.**
  Better Auth owns and rewrites `auth_user.email`, so a second copy would be a column guaranteed
  to disagree eventually, and nothing looks a trader up by address anyway. `architecture.md` §1
  amended with the reasoning in the same change.
- ✅ **`lib/trader.ts` is the one accessor**, it takes no arguments, and **there is deliberately
  no `getTraderById`** — a helper that accepts an id is a helper that will eventually be handed
  one from a URL. This is the *"scoped by `trader_id` from the session, never from the request"*
  rule made structural rather than remembered.
  - **The row is created on read, not in a signup hook.** A hook fires once, and anything that
    stops it firing leaves an account that can sign in and has no record. Resolving on read makes
    that unreachable rather than unlikely, for one indexed lookup.
  - **The default zone is the market zone, never UTC.** If detection never runs, the least-wrong
    clock for a futures trader is the one their sessions are cut in.
- ✅ **`display_timezone_set_by_user`** — added to the schema and to `architecture.md`, because
  *"outranking detection"* needs somewhere to live. The airport case is the one that matters: a
  trader who chose Chicago and then opens the app in Frankfurt must not find every clock in their
  record relabelled. Gate §3 proves it.
- ✅ **Zone validation asks `Intl`, not a list.** The IANA database changes; a hand-kept list goes
  stale silently and a regex accepts `Foo/Bar`.
- ✅ **`key_id` ships null and nothing reads it.** Until `event.payload` is encrypted, dropping a
  key does nothing, and v1 erasure is hard-delete only. The trigger for the rest is the first user
  who is not Luke.
- ⚠️ **The zone has an API but no screen yet.** `POST /api/trader/timezone` accepts both a
  detected and a chosen zone; the settings UI lands with the shell rather than being built now
  and rebuilt in `S3b`. `DetectTimezone` is mounted on `/admin` because it is the only
  authenticated surface that exists, and it moves into the shell for the same reason. **So
  `displayTimezoneSetByUser` is still `false` for every trader** — the precedence rule is proven
  by the gate, not yet by use.

#### The port fix that came out of this slice

Signing in on `:3001` did not work at first, and the reason was inherited rather than new.
`BETTER_AUTH_URL` was pinned to `:3000` while Next had bound `:3001`, which is the failure this
repo already carried a scar-tissue note about — but the note's fix (widening `trustedOrigins`)
only ever addressed the origin check, **not the base URL Better Auth builds redirects and OAuth
callbacks from.** Replaced with Better Auth's own multi-host feature:

```ts
baseURL: isProd ? env.BETTER_AUTH_URL : { allowedHosts: ['localhost:*', '127.0.0.1:*'], protocol: 'http' }
```

Production stays a pinned string, deliberately — a wildcard host allowlist in production is an
open redirect. `CLAUDE.md`'s scar-tissue entry was rewritten in the same commit, per this repo's
own rule, and the fix was **ported to `modryn-base` and `cairn`** so no future clone inherits the
old one.

**A correction worth keeping, because it is the standing pattern in miniature.** The first version
of that code comment claimed `protocol: 'http'` was load-bearing — that without it the derived
origins would come out `https://` and every POST would 403. Checked against the installed library
rather than left asserted, and it is false: `isLoopbackHost` recognises the `localhost:*` wildcard,
so an `http://` origin is added either way. `protocol: 'http'` only narrows the allowlist by
dropping `https://` twins nothing local will use. **A confident wrong explanation in scar tissue is
worse than none, because the next reader trusts it** — the same failure class as the plausibility
bound in `S2`, one layer up.

**The guard worth knowing about:** gate §1 is a *source* check, not a behavioural one.
`display_timezone` reaching the bucketing code would not throw, would not fail a type check and
would not look wrong in a render — it would file evening sessions under a date that depends on
where the trader was sitting. So the assertion is on the shape of the code: the time module may
not import the trader module or the database, and `sessionDateFor` takes no zone argument at all.

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

**✅ CLOSED 2026-08-13.** `tsc` and `eslint` clean; every number below measured on the running
page rather than eyeballed, because the failures in this slice are all invisible ones.

| Measured on `/admin` at 1280 | |
|---|---|
| Sidebar | **224px**, collapses to **0** with no icon rail |
| Sidebar band and pane header | **64px and 64px** — no step in the top edge |
| Title vs the card it names | **x=248 against x=240 — the 8px indent, exactly as recorded** |
| `PAGE_COLUMN` into a Server Component | arrived as `mx-auto w-full px-4`, **not** dropped |
| Both modes | sidebar `#191918` dark, nav `#989691` / `#777573` — tokens, no raw hex |

- ✅ **`lib/shell.ts`** — the constants, in a plain module. The gotcha above did **not** recur:
  `/admin` is a Server Component and the string arrived intact.
- ✅ **`(app)` route group with the auth gate.** One null check from `getTrader()` covers both
  "never signed in" and "signed in with no trader row". **No dev bypass**, unlike the previous
  build, whose own comment had to admit the gate could then only be tested against a production
  build. Verified anonymous vs authenticated: anonymous gets no page content and no sidebar.
  - **The trap, confirmed live:** a layout `redirect()` comes back as **200 with `NEXT_REDIRECT`
    in the body**, not a 307, because Next has already begun streaming. *The status line alone
    says the gate is open when it is not.* Grep the body, never the status.
- ✅ **`AppShell` is a layout, not a per-page wrapper.** Next preserves layouts and remounts page
  subtrees, so a shell inside each page would rebuild the sidebar on every nav click — collapse
  state re-read, panel re-animating, a flicker per move.
- ✅ **Collapse, both controls, and `[`** — measured: 224 → 0, the floating Open control appears
  at the pane's top-left, state persists to `localStorage`.
- ✅ **`DetectTimezone` relocated** from `/admin` into the shell, which is what `S3a` promised.
- ⚠️ **`WithSummaryRail` is built and mounted nowhere.** No page has a filtered set to digest yet.
  It is specified as part of this slice and its reasoning is captured now while it is cheap, but
  **its first real exercise is `S3c`'s kitchen sink** — it has not been seen on screen.
- ⚠️ **The four nav rows 404 by design** (Luke, 2026-08-13). Today, Accounts, Trades and Read land
  with `S8`, `S6`, `S5`, `S7`. Stub pages were rejected: a stub is a screen somebody has to
  remember to delete.

**MOBILE IS DEFERRED, and this is a deliberate deviation from the seven-point definition of done**
(Luke, 2026-08-13): *"build the desktop version first and then go back to iterate mobile design
last… don't worry about viewport issues while we build out the project for desktop first."* What
shipped is *not broken* on a phone — the sidebar overlays with a scrim below 768px rather than
eating 60% of a 375px screen — but it is **not designed**, and it should not be read as a settled
decision. `design-system.md` still records breakpoints as *NOT specified*. The mobile pass is its
own later slice, with `run-trading@v2`'s `/accounts` as the reference Luke already started from.

**Two shapes that type-checked and were still wrong**, both caught only by measuring the rendered
page: a `max-w-5xl px-4` wrapper around header *and* body put `PAGE_COLUMN`'s gutter inside another
gutter and pushed the indent to 24px; applying `PAGE_COLUMN` to each `<section>` made the gutter
padding *inside* the card border, so the card bled to the pane edge. The header and the body must
be **siblings, each applying the column once.**

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

~~Dev-only, out of the production build and the sitemap~~, and **no fixture that could be mistaken
for a real read**. It is the enforcement mechanism for this phase's definition of done, so it
has to exist before the definition means anything.

**✅ CLOSED 2026-08-13.** Scoped to **the rack and the token proofs** (Luke's call): 12 primitives
in every state, three control axes, five token proofs, both modes side by side. `tsc` and `eslint`
clean, all three earlier gates still pass.

**IT SHIPS TO PRODUCTION, reversing the "dev-only" line above** (Luke, 2026-08-13). The rack's job
is review, and *"works on mobile"* means a deployed build on a real phone — a route that only
exists on localhost cannot be opened on the device it is meant to be judged on. Unlinked and
`noindex` like the rest of the app.

#### What it found in its first two days, which is the entire argument for it

None of these were reachable by looking at a component on its own:

| Found | Was |
|---|---|
| `text-ink` in the shell | **no such token.** Rendered the right colour BY COINCIDENCE, inheriting `body`. `bg-ink/20` emitted nothing, so the mobile scrim was fully transparent |
| `Button` `md` and `lg` | **both 48px** — two named sizes, one height, invisible to every call site |
| `Textarea` | drifted from `Input` three ways, including `text-sm` — Tailwind's default scale, which the token lint rule cannot catch because it is valid Tailwind |
| The contrast proof | printed the literal string `Aa 0.00`. **Eleven failing cells had been sitting in it unreadable** |
| `muted` | 4.21 on the page. Its own comment said "4.60:1 on the page" — that was the value on the *card*. The github #67 audit corrected `faint` and mislabelled this one |
| `warn` | failed **all five** light grounds, and at 2.64 on `surface-2` missed even the 3:1 floor its red-zone-gauge job needs |
| `--text-figure`, `--text-display` | the only `rem` steps in a px ramp, so they were the only ones that moved under a browser font-size setting |
| `--text-hero` | zero call sites, no source behind it. Deleted |
| A disabled `IconButton` | still lifted on hover and pushed in on press. `:hover` fires on disabled buttons |
| `Input` `aria-invalid` | **no rule existed.** The rack asserted an error state the component did not have |
| `Card` interactive hover | named `--shadow-md`, which does not exist, so it emitted Tailwind's stock shadow. In dark, hovering DROPPED the alpha 0.32 → 0.10: pointing at the card made it sink |
| `Button` focus | suppressed the global outline for accent at 30% alpha, ~2.05:1, on the most-tabbed control |
| `Button` loading | collapsed 81px → 50px at the moment of the click |
| The nav row | the previous build had diverged from the reference and this one inherited it, believing it was the reference's |

**Every ink now clears 4.5 on every ground in both modes**, verified on the rendered page.

**Deferred, and each has a named home rather than a "later":**

- The **seven Run compositions** — they depend on data shapes from `S5`–`S8`, and the read card is
  governed by the blocked `S7` decision. Each arrives with its slice, which the standing rule
  already requires.
- The **timing harness** — it exists to tune the import panel's rhythm, and that panel lands in
  `S4`. Building it now would give it nothing to replay.
- **Empty as a designed state**, and error states beyond `Input`.
- **Mobile** — desktop first, by Luke's call. `design-system.md` carries the deferral.

**One process note worth keeping.** `globals.css` changes did not reach the browser twice, through
a dev-server restart and a cache-busted fetch. The fix both times was `rm -rf .next` **and** a
restart. If a token edit appears to do nothing, that is the first thing to try — and verify against
the served stylesheet, not the rendered page.

### S4 — Add account + the three-file ingest ⭐ *the biggest slice*

> 📖 **Read [`psychology.md` §5](psychology.md#5-accuracy-is-the-retention-argument) before the
> intake UX.** Perceived measurement inaccuracy was the #4 reason people abandoned a tracker (36%),
> correlated −.44 with usefulness, and was tied to **permanent** rather than temporary abandonment —
> so the reconcile doctrine is the anti-churn argument, not only the correctness one. And the top two
> causes were loss of intrinsic motivation (52%) and **routine disruption** (43%), which is the case
> against every gram of manual logging this slice could introduce. The ostrich effect compounds it:
> the trader must upload the tape of their worst session to get the read about it.

Sub-sliced, because this is where correctness is won or lost:

**`S1` delivered the pure, disk-side half of this slice. Everything touching the database is
untouched, and that is exactly the seam:**

- **S4a** — ✅ **CLOSED 2026-08-14.** `account`, `import` and `event` (`drizzle/0003`), plus the
  append-only trigger (`drizzle/0004`, hand-written — `drizzle-kit` diffs the schema and knows
  nothing about triggers, so it would neither create this nor drop it)
- **S4b** — ✅ **delivered.** Four parsers, detected by header signature rather than filename, with
  dedupe, in `lib/csv/`. `Orders` included. What remains here is only *"nothing commits until
  counts are shown"*, which is UI
- **S4c** — ✅ **CLOSED 2026-08-14.** `lib/intake/preflight.ts`. Per-round-trip range overlap
  (`#74`), non-empty fee resolution (`#75`), rows-actually-written from the write path (`#79`),
  fee plausibility (`#78`), and — added 2026-08-15 — **the P&L reconciliation itself** (`#76`).
  That last one is the check the whole product rests on and it was missing: `tradePaired` was parsed
  back in `S1` under a comment reading *"used to reconcile"*, and then read by nothing in the repo.
  Cash History's Trade Paired rows and Position History's `P/L` are two independent Tradovate
  exports stating one quantity; comparing them is the only thing in the pipeline that looks at the
  P&L figure rather than the shape of the rows. **On the real export: 357 of 360 round trips agree
  to the cent.** The three it abstains on are scratch trades worth exactly $0.00 — Tradovate posts
  no cash row when no cash moved — and asserting full coverage would have asserted a falsehood
  about the broker's own file. **Fixed one bug in v2's version on the way past:** it scoped the
  round-trip side but summed every Trade Paired row against it, so a wider Cash History window
  reads as a mismatch. Both sides now scope through one intersection. It warns rather than blocks,
  because unlike the others it has no remedy a trader could act on.

  **`S4f` — the THIRD receipt, added 2026-08-15, and the one that checks the number that matters.**
  Receipts 1 and 2 check structure and *gross*. Account Balance History is the broker's own daily
  statement and its `Total Realized PNL` is **net**, which on the reference export is the larger
  quantity: fees (−$1,934.36) exceeded the gross loss (−$1,840.50). A build can pair every trade,
  reconcile gross to the cent, and still be wrong by more than the entire loss.

  **Per day, never on the total.** `Trade Date` is Tradovate's own session-date assignment, so a
  per-day comparison puts it beside Run's 17:00 `America/Chicago` derivation. Misfile an evening
  trade and the total stays exact while two days go wrong in equal and opposite directions — the
  gate provokes exactly that and reads `+$986.60` and `−$986.60` where a total reads `$0.00` and
  passes. **Blocking**, unlike the gross receipt, because a misfiled day *has* a remedy (re-export)
  and must never reach the corpus: the log is append-only and `session_date` is what every read
  groups by.

  **What it does not prove, and this is worth knowing before trusting it.** The reference export
  has **zero fills at or after 17:00 Chicago** — all 612 land between 08:00 and 14:59. So the
  $0.00 is real arithmetic and says nothing about the boundary: set the hour to 18, or the zone to
  New York, and all 12 days still reconcile. The boundary is exercised by a synthetic evening
  round trip in the gate, which makes that fixture load-bearing rather than decorative. The first
  real evening trader to import is the first real test.

  **`S4g` — the postcheck, 2026-08-15, and it found more than the docs pass did.** Three review
  agents against the S4 backend with fresh context. Everything below shipped green: the gate passed
  at 81 assertions with every one of these live. It now runs **119**, and the new section 9c exists
  only to provoke them, because a fix with no test is a fix that regresses.

  The three that mattered:

  - **`fees_implausible` blocked at twice the ceiling it advertised.** It divided by FILL quantity,
    and every contract appears in an entry fill and an exit fill: measured, 1,768 against 884, a
    ratio of exactly 2.000. So ingest blocked above $40 per round turn while `tape.ts` blocked
    above $20 on the same file, and anything between the two reached the append-only log to be
    caught only by the read — the exact ordering the check was moved to ingest to prevent. Both now
    import one constant from `lib/fees/allocate.ts`. The constant was never what drifted.
  - **The third receipt refused the copy-trader outright.** Account Balance History carries one row
    per account per day; the comparison keyed on date alone while our side pooled every account.
    Measured on the real export split across two: 20 of 24 days "mismatched", the whole −$3,774.86
    double-counted, import **blocked** — the case `accounts.ts` says the account model exists for.
  - **Dropping the first or last trading day was completely invisible.** The window came from our
    own days, so a statement day outside it was skipped in silence: −$563.50 across 7 round trips,
    `ok: true`, zero findings. Only interior gaps were caught, and the edges are exactly where a
    truncated export loses rows.

  And the rest, each now provoked in the gate: **Cash History was not actually required** (no fee
  rows meant no opinion, so net silently equalled gross); **partial fee coverage** was unreported,
  the same bug this slice already condemned on the round-trip side; **a round trip needed only one
  of its two fills**, so a missing exit inherited the entry's instant *labelled as authoritative*;
  **a blank money cell parsed as `0`** because `Number('')` is `0` and `0` is finite, which made a
  blank `Total Realized PNL` read as "the broker says you made nothing"; **an unreadable statement
  parsed to `[]`** and silently disabled the only receipt that can block; **an empty upload returned
  `ok: true`**; **a Fills export without `_timestamp` fell back to a local column** and resolved
  every instant in the server's zone; and **one order filling in three partials collapsed to one
  dedupe key**, so two real executions were dropped by `onConflictDoNothing` and counted as a
  re-import.

  Two structural changes came out of it rather than one-line fixes:

  - **`commitImport` now requires the `PreflightResult` and throws on a failing one.** Every check
    in this slice was advisory — S4e could have called the write path directly and put an unchecked
    import into a log with no repair. The same argument the append-only trigger exists for.
  - **`scripts/*.mts` are inside `tsc` now**, and `preflight` is pure again. The gate was outside
    typechecking entirely, so a renamed field would not have failed the build — it would have failed
    at runtime inside a `check()` that compares with `String()`, where `undefined === undefined`
    passes. And `statement.ts` had quietly made `preflight` server-only by importing a value from
    `write.ts`; `resolveRoundTripInstant` moved to its own pure module.

  Filed rather than fixed, because each is its own piece of work: scale (#4), import recovery and
  the S4e route's ceilings (#5), the `TRUNCATE` hole in the append-only trigger (#6), and the
  remaining loose numeric coercions (#7).

  **That fee-plausibility one was corrected on 2026-08-15 too**, during the docs
  pass before `S4e`: it existed, but only in `lib/desk/tape.ts`, which is the READ path. `spec.md`
  says plausibility "belongs at ingest, in code", and it is right — a read that flags a number is
  flagging one already written to an append-only log, where it cannot be corrected. The tape keeps
  its copy on purpose; a read should not trust its input either
- **S4d** — ✅ **CLOSED 2026-08-14.** `lib/intake/accounts.ts` (`#59`/`#80`)
- **S4e** — ⏸ **the UI, deferred by Luke.** Type step, drop zone, determinate progress with a
  minimum-visible floor. **The slice does not close until this lands**, and it is where the timing
  harness `S3c` deferred finally gets a sequence to replay

**`scripts/s4-gate.mts` — 68 assertions, re-runnable, run against the real ten-day export**, not
fixtures. `tsc` and `eslint` clean; `S1`, `S2` and `S3a` gates all still pass.

#### What the backend actually guarantees now

- **`event` is append-only and the DATABASE enforces it.** A trigger refuses `UPDATE` and `DELETE`
  unless `run.privileged` is set for the transaction. Everything else in the doctrine is a
  convention a future writer can forget; this is the only one that cannot be
- **A re-upload is a no-op twice over, at two different levels.** `(account_id, file_hash)` stops
  the *work*; the partial unique index on `(account_id, dedupe_key)` stops the *rows*. The second
  is what catches the same trade arriving inside a different file
- **The write path returns rows the database ACCEPTED**, never rows attempted — "imported 187" when
  the real answer is zero is precisely the confident-wrong number this product exists to refuse
- **Nothing is filed under a default account.** Every event goes under the account named in the row

#### Ported from `run-trading@v2`, and what was deliberately left behind

Each of the four steps was reviewed against that build before being written (Luke's call, and it
paid for itself every time).

| Taken | Why |
|---|---|
| The append-only trigger | The one piece of that ingest worth having verbatim |
| Dedupe keys namespaced by type (`f:` `p:` `x:` `o:`) | Tradovate ids are unique only within their own export, so a fill and a round trip can share a number |
| A round trip's instant resolved from its FILLS | Position History carries local wall-clock with no zone. The LATER of the two fills is the close, which is what `session_date` derives from |
| Keying an account on its NAME | The only identifier in all four exports; the numeric id is in two |
| `onConflictDoNothing` + re-read on account resolve | Four files arriving together makes the race the normal case, not an edge one |

| Left behind | Why |
|---|---|
| `firm` as the platform column | v2's own comment calls it *"a known misnomer… not renamed because every event is already filed under it."* A naming error becomes unfixable once a corpus sits on it, and this build had none |
| Provenance as a `csv_import` event | It cannot answer *"have these exact bytes been seen before"* — nowhere to hang a file hash under a unique constraint, and no status for a parse that has not been committed. `import` is its own table |
| Guards that query the database | v2's uploader took one file at a time. This flow takes all four, so the checks are pure and run genuinely before anything commits |
| Thrown `Error(message)` | Welds a check to its copy: a screen cannot re-word it and a test on prose breaks when the prose improves. Findings are a code plus its numbers |
| The `pending:` adoption path | A mechanism with no caller — that build had a hand-add flow, this one creates the account from the import. Its four conditions are earned and worth re-reading if a hand-add flow lands |
| The fallback default account | v2 admits it produced a junk `default-<traderId>` row that showed up in the roster as a phantom account. Every real export names its account, so an unnamed row is now a blocking finding |

#### Three things measurement taught that reading would not have

- **The privileged erasure path must be ONE statement on `neon-http`.** `set_config(…, true)` is
  transaction-local and this driver has no interactive transactions, so a `set_config` call followed
  by a `DELETE` call loses the flag in between and the trigger correctly refuses. A `DO` block
  shares the transaction. **The two-call version reads correctly and does not work**
- **The chunk ceiling is exactly where the arithmetic says, and the error never admits it.** `event`
  binds 14 columns, so 65535/14 predicts 4,681 rows. Measured: 4,681 inserts, 5,000 does not — and
  Neon reports a generic *"Database request failed"* on both sides, so the cause is knowable only
  from where the boundary falls. The gate brackets it rather than asserting one side, since
  "6,000 fails" is also true of a broken connection
- **A gate that writes real rows needs an idempotent teardown**, and `event` refusing `DELETE` is
  what makes that non-obvious: one failed run left events behind that then blocked the next run's
  setup

### S5 — Trades ⭐ *the record*

Session headers carrying net/count/win rate, read-only rows, filtered-set digest, visible
quarantine with S9b's two actions, provenance line.

> 📖 **[`psychology.md` §6](psychology.md#6-what-to-steal)** — Monarch's four properties govern every
> string on this page: each clause about a *trade* and never the person, specificity in place of
> evaluation, comparison only to the trader's own prior period, ending on a position rather than a
> grade. A quarantine row is the sharpest test of it — it reports a fact about a record, not a
> verdict about a trader.

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

> 📖 **[`psychology.md`](psychology.md) is input to the blocking decision itself, not to the build.**
> Read it **before** choosing pattern-or-reading, because it argues both sides:
>
> - **Against the pattern:** repeating an unfixed pattern with a *rising cumulative cost* is the
>   brooding profile — passive, abstract, consequence-focused ([§9 P3](psychology.md#9-open-questions)).
>   And History's claim *"did it get better?"* cannot be evidenced as specified: regression to the
>   mean and survivorship both inflate it ([§8](psychology.md#8-the-measurement-run-is-not-yet-taking)).
> - **For the pattern:** History is also the ostrich mitigation — a trader who avoids for eight days
>   picks up a *thread* rather than a pile of missed dailies. The reading shape has no persistent
>   claim, so that protection disappears with it.
>
> Three things must land **in the spec when S7 unblocks**, not be discovered during it:
>
> 1. **The control group is a one-way door.** The engine surfaces several candidate patterns and
>   names one. *Track the unnamed candidates too, and never show them* — a within-subject control,
>   same trader, same period, same market. Unnamed candidates cannot be reconstructed retroactively:
>   if the first read does not capture them, that evidence never exists
>   ([§8](psychology.md#8-the-measurement-run-is-not-yet-taking)).
> 2. **The trader authors the if-then, never Run** — the largest effect in the literature (d=0.65)
>   and the safest legal posture, arrived at independently
>   ([§2](psychology.md#2-the-if-then-and-why-two-briefs-collided-into-one-answer)).
> 3. **The fence is retrospective vs prospective**, not descriptive vs prescriptive. Watch for the
>   present-tense bridge — *"…9 lost. You're at three losses now"* — which is the most likely
>   accidental crossing in the product ([§3](psychology.md#3-the-fence-is-retrospective-not-descriptive)).

### S8 — Today

Monarch's widget contract applied unchanged. Last because every widget links to a page that
must already exist.

> 📖 **The re-entry rule lands here, and it is now a `CLAUDE.md` doctrine line: no state may
> represent absence.** Today is the surface most likely to break it, because a landing page is where
> "you haven't imported in 9 days" wants to live. It reopens where the trader left it — no backlog,
> no catch-up, no gap counted. The trader who has been away is the one this page is worth most to.
> [`psychology.md` §6](psychology.md#6-what-to-steal).

### S9 — Polish

Empty states, error copy, keyboard, mobile, dark mode across the kitchen sink.

---

## What runs in parallel

Per the two-plane model: this repo runs several worktree sessions; slices only parallelise where
they don't share a surface.

| Wave | Parallel |
|---|---|
| 1 | `S0` skeleton · `S1` data layer + read engine · `S2` primitives (mostly folded into `S1`) |
| 2 | ✅ `S3a` auth · ✅ `S3b` shell · ✅ `S3c` kitchen sink + ported primitives |
| 3 | `S4` alone — everything downstream depends on its shape. **Backend closed 2026-08-14; `S4e` (the UI) is what remains** |
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

*Status as of 2026-08-14. `S0`–`S3c` merged; waves 1 and 2 complete. **`S4`'s backend (`S4a`–`S4d`) is
closed; `S4e`, the UI, is what keeps the slice open.** `S5`–`S9` untouched.*

- [x] **`S1` fired or cleared the kill signal, and the result is recorded** — CLEARED. The MNQ→NQ
      multiplier finding, confirmed by Luke as something he did not already know
      (`problem-brief.md`). Recorded before the slice was written.
- [x] **Reconciliation matches the broker to the cent on Luke's real export** — $0.00 across two
      independent sets, asserted by `scripts/s1-gate.mts` and re-run on every change since.
- [~] **Every merged slice is independently demoable** — *partially, and the wording does not fit
      what got built.* `S0` demos at `/status`, `S3b` at any signed-in page, `S3c` at
      `/kitchen-sink`. `S1`, `S2` and `S3a` are a library, a data table and an identity resolver; their honest demo is a gate script, not a screen, which is why
      each carries a non-UI done bar instead. **Revisit the wording at the retro** rather than
      pretending a parser is demoable — see the amendment candidates in
      `blueprint-instrumentation.md`.
- [~] **Kitchen sink renders every component in every state, both modes** — every PRIMITIVE, yes,
      in both modes, with a contrast proof that computes rather than asserts. The seven Run
      compositions are deferred to the slices that own their data shapes, so **this line closes
      with `S8`, not with `S3c`** — which is the honest reading of a rack that grows as the
      product does.
- [ ] The critical path works end to end for a switcher with no prior data — needs `S4`
