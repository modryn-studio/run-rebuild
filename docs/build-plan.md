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

### S4 — Add account + the three-file ingest ⭐ *the biggest slice* — ✅ **CLOSED 2026-08-31**

**Closed by Luke against the seven-point bar.** Every sub-slice was already done; what held this
open for six days was one word in `S4e` below - the flow was merged and gated and **unreachable**,
because the only control that opened it had been cleared off `/accounts`. `S6b` put the door back on
2026-08-26 and `S6` finished the third one ("Add manually"), so the last thing this slice owed is
built. An import is now reachable three ways: the roster's `Add account`, an account's own page, and
the manual path that creates a `pending:` row for an import to adopt later.

**One thing this slice never exercised and should be, before it matters:** a real CSV import
adopting an account created by "Add manually". Both halves are built and gated separately; the
seam between them has only been read, not run. Tracked in the phase 5 gate's last line rather than
holding the slice open, because it is a test rather than a gap.

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
- **S4e** — ✅ **BUILT, MERGED, AND REACHABLE SINCE 2026-08-26.** The warning that stood here for
  eleven days - *built but not reachable* - was resolved by `S6b`'s roster putting `Add account` back
  in the shell band. The two were worth stating separately, and they still are: this records that a
  slice can be complete and undelivered at the same time. Ported v2's actual flow rather than the
  plan drafted before it (Luke, 2026-08-15: "if i approved a confirm step, that was my mistake... i
  do not want to change the flow the v2 has") — two doors (Brokers, disabled; Import trades), a
  drop zone with header-detected file typing, determinate progress with a minimum-visible floor,
  and an unlabelled account as a normal state rather than a pre-upload type question. The refusal
  screen replaces the progress panel outright on failure rather than squeezing findings under it
  (measured: 34px → 234px at the same viewport). **"Add manually" is explicitly NOT part of this
  slice** — see the S6 note below.

  ~~**What remains is a DOOR, and it is `S6`'s to build, not this slice's**~~ **BUILT** (recorded
  2026-08-25, closed 2026-08-31).
  `AddAccountModal` was mounted on `/accounts` and only there, so clearing that page to an empty
  shell on 2026-08-20 took the product's one route into the three-file ingest with it. The flow
  itself is intact and gated; `/kitchen-sink/demo` still mounts the real modal under `dryRun`, which
  is why this reads as merged rather than unfinished. But an import nobody can reach is not
  delivered, so `S4` did not close until `S6` put the control back - which it did.
  That is not a deferral of convenience: `/accounts` is where the launcher belongs, because
  launching an import from a specific account's own page is the context v2's adoption path depends
  on — the same reason "Add manually" was pushed to `S6` in the first place.
  **`S4e` is a MODAL, not a page** (Luke, 2026-08-25), and it never was one; `add-account-modal.tsx`
  over `modal-shell.tsx`, opened from a roster surface.

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

### S5 — Trades ⭐ *the record* — ✅ **CLOSED 2026-08-25**

Session headers carrying the session net (count and win rate came out 2026-08-19 — see spec.md §3), read-only rows, filtered-set digest, visible
quarantine with S9b's two actions, provenance line.

> 📖 **[`psychology.md` §6](psychology.md#6-what-to-steal)** — Monarch's four properties govern every
> string on this page: each clause about a *trade* and never the person, specificity in place of
> evaluation, comparison only to the trader's own prior period, ending on a position rather than a
> grade. A quarantine row is the sharpest test of it — it reports a fact about a record, not a
> verdict about a trader.

#### Closed against the seven-point bar, 2026-08-25

CLAUDE.md: *"it works, handles its error case, handles its empty case, works on mobile, matches the
design system, is merged, and is deployed. Not before."*

| | evidence |
|---|---|
| it works | `scripts/s5-gate.mts` green end to end — reconciliation, narrowing applied in SQL, the window cutting on session date, scratches counted as neither win nor loss, a quarantined trade staying on the tape and out of the figures |
| error case | tape fetch failure names its cause and offers the retry; CSV export says *"That did not download"* beside a Try again; an id that resolves to nothing 404s rather than confirming which ids exist |
| empty case | two empty states, and which one is honest depends on whether anything is narrowing |
| works on mobile | **a real phone, on the deployed build, confirmed by Luke** — not a 375px desktop viewport, which has a mouse and passes every touch target by default |
| design system | `/postcheck` token scan run twice; the second pass is `c8ae529` |
| merged + deployed | `main`, and `main` is live |

**What is deliberately NOT in this slice, and is tracked rather than forgotten.** None of it blocks
the bar above; all of it is real.

- **Launch scale, not this corpus.** [#23](https://github.com/modryn-studio/run-rebuild/issues/23)
  (the tape ships every id on every load, and its DOM window only grows) and
  [#25](https://github.com/modryn-studio/run-rebuild/issues/25) (the export has no `maxDuration` and
  its chunks run serially) are both measured against the stated 20,000-trade target against a
  360-trade dogfooding corpus. #23 is a paging-strategy rewrite — a keyset cursor over
  `(session_date, entry_at, id)`, windowed rendering, session totals off the API — which is its own
  slice and not a loose end on this one. [#19](https://github.com/modryn-studio/run-rebuild/issues/19)
  was closed as superseded by the two of them.
- **Quality, not correctness.** [#18](https://github.com/modryn-studio/run-rebuild/issues/18) export
  filename collision, [#22](https://github.com/modryn-studio/run-rebuild/issues/22) the sheets'
  `fixed` depending on no ancestor gaining a containing block,
  [#24](https://github.com/modryn-studio/run-rebuild/issues/24) the hue invariant having no build
  gate, [#27](https://github.com/modryn-studio/run-rebuild/issues/27) the popovers claiming
  `aria-modal` without trapping Tab.
- **Product decisions the issues themselves defer to `S7`:** #10 per-trade note, #11 trade
  classification, #13 scaling in and out, #15 a per-product page.

### S5d — /trades on a phone *(2026-08-20 — ✅ **CLOSED 2026-08-25**, device check cleared)*

Derived from **Monarch's native mobile app**, not its web app — which matters, because the web at a
390px viewport does NOT do any of this: it keeps the 224px sidebar and the desktop table. Measured,
not assumed. So the source here is Luke's three screenshots plus Run's own system, and nothing in
this slice can be re-derived from the live site later.

**Nothing here is broken today.** Measured at 390px: no horizontal overflow, 61px rows, the rail
stacked below the tape. This is a redesign, not a repair, and the honest reason to do it is that
`app-shell.tsx` said *"MOBILE IS DELIBERATELY UNFINISHED ... what is here is 'not broken', not
'designed'"*. This slice is what let that paragraph be deleted, and it was, on 2026-08-25.

**Depends on `S3d`** (the bottom bar) landing first — the drawer cannot lose its nav rows until
something else carries them.

#### What the reference does, and what Run does with it

| Monarch's mobile screen | Run's version |
|---|---|
| Top bar: hamburger · bell · centred title · bulk-select · add | hamburger · bell · centred title. **The two right-hand slots stay empty** — trades are not editable and there is no manual add, so both of Monarch's controls refuse to port |
| Full-width search pill, filter icon at its right edge | The same pill. `Search` becomes the field itself; `Date` and `Filters` collapse behind the one filter icon |
| Date group header: date left, day's net right, on a grey band | **Already built.** Run's session bands are this exactly — `bg-band`, date left, net right, muted |
| Row: category emoji · merchant · amount. One line | Instrument mark · product name · result. One line. **Account, direction and time come off the row** and live in the detail screen |
| No summary panel anywhere on the list screen | The summary rail does not render below `md` |
| Tap a row → full screen, animated up from the bottom | A sheet opened from client state, with `/trades/[id]` kept as the address (2026-08-25; it was a plain route from 2026-08-20 to 08-25, see below) |

#### The row loses three fields, and that is the trade

Direction and time are things a futures trader genuinely reads, and dropping them is the cost of a
one-line row. It is defensible because **the detail screen carries every one of them** — screenshot 3
is a complete fact list — and because the `Columns` control already establishes that account and time
are the two fields a trader can live without. What it means in practice is that the phone is for
*scanning* and the detail screen is for *checking*, which is the same split the reference makes.

#### `/trades/[id]` — a route, then an overlay that keeps the address (revised 2026-08-25)

**The original call, 2026-08-20.** Chosen over restyling the existing drawer because the phone's back
gesture has to work. An overlay would need history interception to answer the back button, and
getting that wrong strands the user on a page they cannot leave.

**What that cost, measured 2026-08-25.** The reasoning held; the price was not visible until the
screen existed. Because the sheet lived inside the segment, nothing could move until the navigation
committed: **250ms before the panel existed and 305ms before it began to travel**, warm, on
localhost with no network at all. `FilterSheet`, which is client state, starts moving in **34ms**.
Closing was worse — the body was off-screen at 183ms but the route did not commit until **600ms**,
leaving 417ms of the tape sitting under a trade-detail header. Luke, on the phone: *"i dont like the
way it opens. it doesn't feel smooth like the filters page."*

And the wait bought nothing. `TradeDetail` takes a `TapeRow`, the tape is holding the row that was
tapped, and `TradeDrawer` has rendered the identical screen from that same object with no fetch
since the day it shipped. The phone was round-tripping the server for an object already in memory,
**including the contract name the tapped row was rendering on screen at that moment**.

**What it is now.** The tape opens `TradeSheet` from client state and `useOverlayBack` writes
`/trades/<id>` with the native History API — which Next supports, and which was measured before it
was relied on: all 60 tape rows stayed mounted and **zero network requests fired**. The route still
exists and still renders the whole screen on its own; it is the cold path for a pasted link, a
bookmark or a refresh. So the back gesture, the shareable URL and surviving a reload all still hold,
and the tape never unmounts — which is what makes Back free.

**The history-interception objection was answered, not waived.** It is real, and `overlay-back.ts`
carries the symmetry argument: one tagged entry per overlay, consumed by whichever of popstate or
the in-app control gets there first, and never consumed if the trader left by another route. It was
wrong on the first attempt in exactly the predicted way — one Back from the Date Range screen closed
the drill-in *and* the sheet under it, because `popstate` is a window event and both listeners
answered it. Monotonic tokens order the stack so only the innermost responds.

- The existing `TradeDrawer` body is already the right content and should be **shared, not forked** —
  `Section`, `Row`, `CopyButton` and the header block are all in `trade-drawer-body.tsx` for exactly
  this reason. Desktop keeps the drawer; the phone gets the route; both render the same parts.
- **The tape has to restore scroll position on return**, or every back tap dumps the trader at the
  top of 360 trades. This is the part most likely to be missed and the most annoying if it is.
  *(Answered for free by the 2026-08-25 revision: the tape is never unmounted, so there is no scroll
  position to restore.)*
- The steppers become the route's own prev/next. `position` (`3 of 4`) already exists for it.
- Slides up: `translate-y-full` → `0` on `.drawer-transition`, which is already the enter/leave curve.

#### What shipped, and the two things it changed on the way

**The detail body is now shared.** `TradeDetail` (`trade-detail.tsx`) holds the header block and every
fact section and owns NO chrome — no panel, no scrollport, no close control, no width. The drawer and
the route are two containers around it. That was the point: this body is the only surface showing
gross, fees and net together, so a fork here is a fork in the reconcile claim itself.

**`routeTitle` became an exact match, and that was a real bug.** It prefix-matched so `/trades/<id>`
would read "Trades" — written before any drill-down existed, to avoid an empty band. With the route
built, it rendered TWO title bars: the shell's at y=0 and the page's own at y=84. That is precisely
what `header-slot.tsx` was written to prevent, in its own words *"a page needing a title and controls
has to build a SECOND band underneath it"*. The old comment's next sentence already described the
right answer, so the fix was the design arriving rather than changing: a drill-down yields the band,
and the page portals a trail — the way back plus which trade — into `HEADER_TITLE_SLOT_ID`.
**The contract this creates:** any route below a NAV href owes the title slot a trail, or its band
renders nameless. One such route exists today and it does.

**Verified at 390px:** one-line rows at 52px (down from 61), rail absent, tap navigates to
`/trades/<id>`, one `<h1>` in the band, back link to `/trades`, no horizontal overflow. At 1280px the
tap still opens the drawer in place and the band still reads "Trades".

#### The phone's query controls, and where they diverge from the desktop

Built 2026-08-21. `Search`, `Date` and `Filters` no longer render as three band chips below `md`.

- **One search row under the title band**, sticky against `<main>` so it stays put as the tape
  scrolls, with the filter mark inside the field at its right edge. `-mx-4` reaches the screen
  edges; `-mb-4` cancels the page column's gap, without which the first session band appeared to
  change height the moment it stuck (measured y=137 then y=120).
- **`FilterSheet`** is the desktop rail's three columns re-containered as a screen of rows with one
  level of drill-in. Two screens, one sheet: the drill-in is a second layer over the list on the
  same `.sheet-transition`, not a second sheet.
- **Single-select commits on the tap and takes the sheet down**; multi-select still stages a draft
  and commits on Apply. The split is by axis, not by screen: a range is a whole answer, "ES and NQ"
  is two taps. `Clear all` commits like a range does, for the same reason.
- **The filter mark carries a COUNT, not a dot**, and it is the only control in the app that does.
  Everywhere else the count is already on screen beside the mark. `sheetCount` in `filter.ts`
  counts the date window and `activeCount` does not, which is the difference between one control
  holding every axis and a band where the window has its own button.
- **All time is a quick range here and is not one on the desktop panel.** A list of ticks with no
  tick anywhere reads as "nothing selected" rather than "everything", so the tape's resting state
  would be the one state that screen could not describe.

#### Two panel bugs this turn found by measuring rather than looking

- **The summary rail opened itself on every phone load** — measured at 390px sitting at x=70, over
  the tape, on first paint. Two effects held two booleans that both defaulted to the DESKTOP answer,
  so the phone override and the storage restore raced and storage won. One breakpoint value that
  starts `null` removes the race by construction: nothing acts on an answer it has not read.
- **The sidebar had the same bug by another route.** "On mobile it stays closed regardless" was only
  true when nothing was stored, so a trader who leaves the sidebar open on a desktop got a drawer
  over the page on their phone. The overlay test now comes first, because it is not a default — it
  is a rule about what the panel IS at that width.
- Related, and fixed in both: closing either panel on a phone wrote the SHARED preference, so
  dismissing a drawer collapsed the desktop rail on the next visit. A phone no longer writes it.

#### Still open — not built, deliberately

- **No prev/next on the route.** The drawer's steppers walk the tape because the tape is loaded
  beside them. Here the neighbours are whatever the trader's CURRENT FILTER says they are, which the
  route cannot know without carrying the filter in the URL and reading a window around the id.
  Half-building it would give a phone two arrows that disagree with the list behind them.
- **The amount is not centred** the way the reference's detail screen has it. `TradeDetail` puts the
  mark left and the figure top-right, which is `run-trading@v2`'s measured layout, ported "exactly"
  at Luke's request. Changing it would fork the one body both containers share. Its own change.
- ~~**Scroll restoration on back has not been proven on a device.**~~ **MOOT 2026-08-25.** The
  question was whether Next's scroll restoration survives a 360-row tape that windows 60 at a time.
  It no longer arises: opening a trade is client state now, so the tape is never unmounted and there
  is no scroll position to restore. The rebuild that removed the wait removed this with it.
- ~~**The footer buttons are under the touch floor.**~~ **CLOSED 2026-08-25.** They stay at `md`
  (36px) and now carry `.hit-44`, which expands the target to 44 invisibly - the same technique
  `.lift-press` has used for the icon chips since 2026-07-30. Luke's 36px stops being a compromise.
  For the record, checked rather than assumed: 44x44 is Apple's HIG and WCAG 2.5.5 (AAA); the AA
  criterion is 2.5.8 at 24x24 with a spacing exception, which these cleared several times over
  already. The house rule is the stricter one and it is now met at no visual cost.
- **The date picker is native.** `ui/date-input.tsx` replaces the UA's `mm/dd/yyyy` mask with
  "Earliest" / "Latest" and keeps the platform's own calendar underneath. A hand-drawn calendar
  would have to re-earn localisation, keyboard operation and both modes to be no better at the one
  job asked of it. Revisit only if a real need appears.

#### Open, and worth deciding inside the slice rather than now

- ~~**The rail's figures have nowhere else to go yet.**~~ **DECIDED 2026-08-25: the mobile header
  keeps a way back to the rail**, which is the second of the two options this raised. `Show summary`
  opens it as a drawer below `md`; measured at 390px, all five figures the concern named (Net P&L,
  Win rate, Trades, Best session, Worst session) are reachable in one tap. `S8` is free to carry
  them on Today as well, but is no longer load-bearing for reaching them.
- ~~**The tab bar's active state fights a doctrine line.**~~ **RECORDED 2026-08-25**, which is all
  this item asked for. The answer went the way it predicted — ink plus weight, because a 64px tab
  has no room for a ground pill and Run draws one icon weight with no filled variants. The exception
  is written down twice, at the point of use in `app-shell.tsx` and in `design-system.md`, rather
  than left as a silent divergence from the ground rule.

### S3d — The bottom bar *(2026-08-20 — ✅ built)*

The shell half of `S5d`, split out because it changes every signed-in page rather than one.

- **Four items, not five**: Today · Accounts · Trades · Read, off the existing `NAV` array with the
  same icons and order. One source, so the bar and the drawer can never disagree about the app's
  spine.
- **Below `md` only**, the same 767px boundary `SIDEBAR_OVERLAY_QUERY` already draws.
- **Fixed to the bottom, clearing `env(safe-area-inset-bottom)`** — an iPhone home indicator sits
  where a tab bar's labels want to be.
- **The drawer loses its four nav rows at that breakpoint** and keeps everything else: wordmark and
  settings at the top, the account row pinned at the bottom. That is screenshot 2's structure, and it
  is thin until `S6`–`S8` add secondary surfaces (Luke, 2026-08-20: *"the left sidebar might be kind
  of empty right now but that's okay"*).
- `main`'s bottom padding has to clear the bar, or the last tape row sits under it.

**WHAT IT COST TO GET THE CLEARANCE RIGHT, because it is a scar rather than a detail.** The bar's
height started as a TypeScript constant applied through an inline `style`, with `md:pb-12` beside it
to restore the desktop value. An inline style always beats a class, so that override was dead on
arrival and the pane carried a phone's clearance at 1280px — measured, not guessed. The height is now
`--bottom-bar-h` in `globals.css`, read by BOTH the bar's inline height and
`.pane-bottom-clearance`'s media query. A token can be read by a media query; a TS constant cannot.

**Built and verified at 390px:** bar fixed at the foot, four tabs at 98px each, `aria-current` on the
active one, drawer nav hidden, account row still anchored, desktop untouched (bar hidden, four rows
in the drawer, 48px pane padding).

### S6 — Accounts ⭐ — ✅ **CLOSED 2026-08-31**

**Closed by Luke against the seven-point bar**, and it is the slice that unblocked `S4`.

| The bar | How it was met |
|---|---|
| It works | Roster, hero chart with Breakdown, filters, reorder, the detail route, its trades child, and the whole editor |
| Its error case | The 409 on a delete that would orphan a record; the 409 on a type/status pair the CHECK refuses; a refused import replacing the progress panel outright |
| Its empty case | *"No accounts yet"* for a trader with none, and *"No accounts match"* for a filter that emptied the list - two different sentences, because they are two different facts |
| Mobile | No modals below 768px: add, import, edit and both confirmations are full-screen sheets, and the device Back button answers every one of them |
| Design system | Racked in `/kitchen-sink` - roster row, account sheet, account fields, the ending question, scope tabs, the sheet header in five states |
| Merged | Yes |
| Deployed | Yes, and used on a real phone across four rounds of iteration |

**Sub-slices:** `S6a` read layer · `S6b` roster · `S6c` hero chart · `S6d` detail route ·
`S6e` editing · `S6f` filters + reorder · `S6g` mobile pass. All shipped; `s6-plan.md` §3 carries
each one's own note.

**Eight follow-ups were filed rather than fixed**
([#30](https://github.com/modryn-studio/run-rebuild/issues/30)–[#37](https://github.com/modryn-studio/run-rebuild/issues/37)),
and the distinction is the one the bar cares about: each is an improvement to a surface that works,
not a gap in one that does not. The largest - keyboard operability of the /accounts dialogs (#30)
and the payload the detail pages ship (#31) - are real and neither stops a trader using the page.

**What this slice taught, beyond the feature:** the phone architecture the whole product now follows.
No modals below `PHONE_QUERY`; the header decides whether a screen slides; one history entry per
overlay level, pushed by the tap that opened it; a `loading.tsx` occupies its page's own boxes,
gutter included. All of it is in `CLAUDE.md` and `design-system.md` §6, and the bugs that produced
each rule are in `scar-tissue.md`.

Hero metric selector, groups by state with own totals, **freshness stamp on every row**,
`CLOSED` as a permanent group, summary rail.

**IT ALSO CARRIES THE PRODUCT'S ONLY DOOR INTO THE INGEST, and that moved here by accident rather
than by design** (recorded 2026-08-25). `AddAccountModal` was mounted on `/accounts` and nowhere
else, so clearing that page to an empty shell on 2026-08-20 left `S4e`'s whole flow built, merged,
gated and unreachable. Until this slice ships a launcher, a trader cannot get data into Run at all.
That makes the roster the first thing to build here, not the last.

`run-trading@v2` is the reference and its arrangement is worth copying rather than re-deciding:

- **`AccountsHeader` puts `Add account` in the shell's header band as the single brand-filled
  primary** — *"a roster page has exactly one action"*. It is portalled into the band, not drawn as
  a second one.
- **An `AccountModalsProvider` wraps the page content and owns the open state**, because the
  controls that open it sit in unrelated subtrees — the header is portalled out, the empty-roster
  CTA is inside a card, and every roster row is inside a collapsible group. Their common ancestor is
  the page, which is a Server Component and cannot hold state. The alternative, one modal per
  control, puts a copy on the page per roster row each with its own request in flight.
- **TWO openers, not one**, and this is the distinction `run-rebuild` does not have yet. `add()`
  asks WHICH account to create. `importTrades(accountId)` brings fills into an account that already
  exists — v2: *"a question with no meaning when the trader is standing on one."* Rebuild ships
  `AddAccountModal` only; v2's second modal is `AddTradesModal`, and the per-account opener is
  exactly the context the adoption path below depends on.

**"Add manually" lands after this slice, not inside `S4e` (Luke, 2026-08-17).** `S4e`'s modal ships
two doors only — Brokers and Import trades — and that omission is deliberate
(`add-account-modal.tsx`'s header comment, and the S4e line above). The mechanism itself is cheap:
`run-trading@v2`'s `resolveAccount` adoption path (`current-trader.ts`) is a single `UPDATE` guarded
on `id + traderId + firm + externalAccountId LIKE 'pending:%'`, and the schema already carries the
columns it needs (`brokerAccountId`, `firmSource`, added ahead of time in `S4e`). What it does not
have anywhere to stand on is a launch surface: v2's adoption path is trustworthy only because the
import is launched *from that specific account's own page* — that context is the signal that the
file belongs to it, not an inference. `run-rebuild` has no per-account page until this slice builds
one; the current `/accounts` is an empty shell, cleared on 2026-08-20 at Luke's request, and the
roster that briefly stood there (`accounts-view.tsx`) was deleted rather than left to negotiate
with. Building manual-add before `S6` means either standing up a real per-account
page early, out of order, or launching the adopt action from the global modal with none of the
context v2's fix depended on. `S6`'s own page is where "Add manually" becomes a door with something
to stand on.

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

### S8 — Today — ⬅ **next; the read is NOT in the beta** *(amended 2026-09-03; carried the read from 2026-08-31 to 2026-09-03)*

> **2026-09-03 (Luke): *"do not implement the nightly job wired to the reading. too bad, we are
> not shipping that in the beta version right now."*** `Your Daily Recap` — built 2026-09-01 on a
> fixture — is **unmounted** from `/today` (the component and its rack rows stay; one line brings it
> back). What replaces it is decided against a live read of the reference's dashboard rather than
> from `wireframes.md` §5 alone: **[`monarch-dashboard-teardown.md`](monarch-dashboard-teardown.md)**,
> every card mapped. **Luke's changes landed the same day and are §8 of that doc, which is the
> current list**: six cards ship, not three. `Net P&L`, `Last session` and `Accounts` are joined by
> **the self-set daily loss line** and **profit-target progress** (one slice, one migration - and
> BLOCKED until Luke amends `spec.md` §6, which still lists stated-intent-vs-actual as NOT IN V1),
> and by **`Set up Run`**, a five-step setup card that empties itself and then unmounts. The recap
> is **reset to a blank sheet** - the built card has no design authority any more - and Monarch's
> `Advice` is reopened for a session of Luke's own. Build order and the reasoning are in §A7.
> The paragraphs below describe the slice as it stood while it carried the read.

Monarch's widget contract applied unchanged. Last because every widget links to a page that
must already exist.

**IT GAINED THE PRODUCT'S WHOLE CLAIM ON 2026-08-31.** `spec.md` §4 was amended to take `Read` out
of the nav: Monarch has no `Recap` row either, its Weekly Recap is a dashboard widget, and this
build has been porting the reference closely on `/accounts` and `/trades` with good results. So the
read ships here as **`Your Daily Recap`**, a card that opens in place, and `Today` becomes the only
front door rather than a summary of three others.

**Four widgets, and three of them are already answerable from the read layer:**

| Widget | Reads | State |
|---|---|---|
| `Your Daily Recap` | the nightly job's stored read | **new — the slice's real work** |
| `Net P&L` | `getDailySeries()` | ready |
| `Accounts` | `getRoster()` + `getFreshness()` | ready |
| `Last session` | `getTape()` + `getDigest()` on the newest session date | ready |

**THE NAV ROW STAYS, AND IT STAYS A 404** *(reversed 2026-08-31, Luke: "dont delete /read from
the left sidebar. just keep it as a 404 for now")*. This section used to open by saying the slice
deletes it. It does not: the read moving onto a card is what makes the `/read` PAGE deferred rather
than cancelled, and the row is the placeholder for the page §"DEFERRED" below describes. The recap
modal's `Ask a follow-up` now points at the same route, so one page ships and both doors open.

#### WHEN THE READ RUNS — settled 2026-08-31, and `market-hours.md` decides it

Luke: *"i would think most users would want it as soon as they are done trading for the day. but
when does that happen, really? i guess, technically we could run it on that 1 hour the market uses
for maintenance."* That is the answer, and the doc backs it. §1 gives three different hours and only
one gap:

| | |
|---|---|
| the trade date | 17:00 CT → 17:00 CT — the boundary a fill is DATED to |
| the tradeable session | 17:00 CT → 16:00 CT — when the book is open |
| **the maintenance break** | **16:00 CT → 17:00 CT — Globex is DOWN, Mon–Thu** |

The session's fills are complete at 16:00, the book is shut until 17:00, and the date does not roll
until 17:00. **It is the only hour in which a session is finished and the next one has not started**,
which makes it the only honest time to read a day. A job at ~16:15 CT reads a complete session and
publishes before the trader could take another trade.

**ONE READ PER SESSION DATE**, and it is two rules at once. `ai-economics.md` §1 measures a full
desk read at **$1.58 billed** — ≈$47 per trader per month nightly, before the tape grows, and
`renderTape()` has no window cap. And a read a trader can re-roll is a read they will re-roll until
they like it, which is the opposite of a record. So a manual *"read it now"* **spends** that day's
allowance rather than adding to it.

> ⚠️ **`ai-economics.md` §6's cost architecture assumes the PATTERN, and 2026-08-31 chose the
> reading.** Its two-speed proposal — weekly discovery at Opus, nightly at Haiku against *open
> claims* — gets to ≈$4/trader/month by making the daily call SQL plus one sentence. There are no
> claims in the reading shape, so the daily call is the full desk read every night. **The cost
> question is reopened, not solved**, and it belongs to the slice that builds the job.

#### CADENCE, DECIDED 2026-09-01 (before the backend starts)

**NO BACKFILL. One read, for the latest session, and nothing before it** (Luke: *"im thinking the
daily recap does not past sessions. only one read (the latest session)"*).

A trader arrives with a year of tape and gets ONE read: the session that just closed. The engine
never writes reads for sessions that finished before it existed. Three reasons, and the first is the
product one:

1. **A read written months late cannot say what it exists to say.** `spec.md` §5-S5: *"here's your
   pattern, and here's what yesterday did to it."* A read generated in September about a session in
   March has seen every session since; it cannot honestly say what that day did to anything, and it
   is contaminated by outcomes the trader already knows.
2. **It would be a fabrication with a date on it.** Every read prints a trust note naming what it
   was drawn from. Backfilled reads would carry March's date over September's window.
3. **It is the expensive half of the bill for the least valuable artefact** - one import could
   invoice a year of reads before the trader has read one.

**The first-import moment is served by `S11` instead**, which is the right shape for it: one reveal
over the whole corpus, once, rather than 250 retrospective dailies.

**Generation is never lazy.** Not on open, not on demand - see §"WHY THE READ IS NOT GENERATED ON
CLICK" below.

#### A PUBLISHED READ IS FROZEN, DECIDED 2026-09-01

**Once a read is published it never changes.** Not when a later discovery pass sharpens the claim
behind it, not when the tape grows, not ever.

Luke's reasoning, and it is the better one: *"the /read page is like a journal the user doesn't have
to write themselves... you dont erase your journal notes from tuesday on friday and revise them."*

The engine's claims DO improve - that is what the weekly pass is for. The question was what happens
to reads already written when they do:

| | |
|---|---|
| **Frozen** (chosen) | Tuesday's read says forever what it said on Tuesday. A sharper claim shows up in the NEXT read and the ones after. |
| Live | Tuesday's read is regenerated with the better claim, and next month it says something it never said on Tuesday. |

**Three things frozen protects:**

1. **A record you can quote.** Run's one claim is that the record is the broker's, reconciled. A card
   that says one thing in March and another in June has lied once and cannot tell you which time.
2. **The trust note stays true.** Every read prints what it was drawn from - *"19 round trips across
   2 accounts"*. Rewritten later from a bigger window, that sentence is false, or it changes too and
   the same card has now said two different things about its own provenance.
3. **It is not re-billed.** A live read means every discovery pass re-invoices every past session.

**The objection, and the answer.** *"If the engine was wrong on Tuesday, is leaving the wrong read up
not worse?"* It was not wrong; it was true given what was known, the same way last week's forecast
stays true whether or not it rained. What the live option was reaching for is better served
explicitly: **a later read may say the claim has changed and why.** A stated correction teaches
something; a silent rewrite teaches the trader not to trust the archive.

> 📌 **FOR THE `/read` PAGE, WHEN IT IS PLANNED** (Luke, 2026-09-01, recorded so it is not lost):
> *"the /read page is like a journal the user doesn't have to write themselves. that is kind of nice.
> maybe we offer both options."* Two things sit on it - the weekly discovery read, and the archive of
> every daily. **"Both options" is the open one**: whether the trader can also write their own entry
> beside the generated one. Not planned now, and deliberately not decided here - `S7` still owns the
> page, and `spec.md` §4.2's Tab 2 is the existing sketch.

#### WHY THE READ IS NOT GENERATED ON CLICK

Considered and rejected 2026-09-01. It is the obvious way to save money and it costs three things
the product cannot spend:

- **`spec.md` §4.2 keeps exactly one thing from Monarch and calls it "the important half": *the read
  arrives generated*.** A read that generates on click does not arrive generated; it arrives as a
  spinner.
- **The survivorship hole sits where the value is.** Investors check **9.5% less the day after a
  loss** (`psychology.md`), so the trader least likely to open the card is the one the read is worth
  most to. Generate-on-click means systematically having no read for the worst sessions.
- **The control group is a one-way door.** S7 above: unnamed candidates *"cannot be reconstructed
  retroactively: if the first read does not capture them, that evidence never exists."*

It also forfeits the batch discount, because somebody is waiting.

**The cost is fixed at the engine instead** - `ai-economics.md` §6's two speeds, a windowed tape,
batch on the discovery leg only (the nightly leg is live, because the 16:15 CT publish is a
promise), and cached lens prompts.

> ⚠️ **CORRECTION TO `recap.ts` AND TO `ai-economics.md` §6's status.** Both currently say the
> two-speed architecture "assumes the PATTERN, and 2026-08-31 chose the reading", leaving the cost
> question reopened. That is wrong, and it was this repo's own note. Choosing the reading was a
> decision about what the TRADER SEES; two speeds is a decision about what the ENGINE STORES.
> Discovery can run weekly at Opus over a windowed tape and emit claims that are never rendered,
> while the nightly leg is Haiku writing prose around finished SQL figures and the open claims. The
> trader still meets one sentence about one thing and never meets a "pattern object". §6's ≈$4
> budget survives the product decision intact.

#### DEFERRED, AND WHAT WOULD EARN THE `/read` PAGE BACK

Both of these came up while designing the card (Luke, 2026-08-31) and both were refused for the
same reason. Written down because they are good ideas that are simply not widget-shaped.

**1. Browsing back through reads** — *"what if we had left and right arrows to view yesterday's
recap and the recap from two days ago? or is this becoming more of a page than a widget now?"* It
is, and that instinct is the finding. There are **zero** previous/next controls on Monarch's entire
dashboard (checked in the markup, every widget), and the pattern literature states why: a
dashboard's claim is *at a glance*, and pagination turns a glance into a task. The sanctioned
alternatives are detail-on-demand (open it) and navigate out (go to the page that owns it). **This
is the page.** A trader who wants the arrows badly enough is a trader who has told you the page is
earned — which is the same bar `Sessions` is held to.

**2. A `Daily / Weekly` scope picker on the card.** Allowed by the widget contract — Monarch's
net-worth widget carries `1 month` — but there is no weekly read to switch to, and a picker with
one real option is a control that cannot be answered. A weekly roll-up is also a genuinely
different artefact rather than seven dailies concatenated: it is the shape Monarch actually ships,
and `spec.md` §4.2's *"weekly roll-ups can exist later as a view over dailies; the atom is the day"*
already reserves the room for it.

**What the deferred page would hold:** a list of past reads by session, the arrows, and the weekly
roll-up as a second cadence. `user-guide.md` §6 keeps the original page spec for that day.

**What it does NOT build:** History, and anything needing a pattern object. `S7` still owns that
question ([#2](https://github.com/modryn-studio/run-rebuild/issues/2)), and the decision recorded
2026-08-31 is that the READING wins for v1. The one irreversible piece ships here regardless: the
nightly job stores the engine's REJECTED candidates from day one. They cannot be reconstructed
later, and they are the corpus a tracked claim would eventually be built on - which `spin.md`
argues is the moat, rather than the model that reads it.

> 📖 **The re-entry rule lands here, and it is now a `CLAUDE.md` doctrine line: no state may
> represent absence.** Today is the surface most likely to break it, because a landing page is where
> "you haven't imported in 9 days" wants to live. It reopens where the trader left it — no backlog,
> no catch-up, no gap counted. The trader who has been away is the one this page is worth most to.
> [`psychology.md` §6](psychology.md#6-what-to-steal).

#### THE MODAL'S FLOOR, AND THE EVIDENCE VOCABULARY *(built 2026-09-01 — expect to iterate)*

Three questions, asked together after reading Monarch's own recap flow end to end and TradeZella's
Data Reveal (Luke, 2026-09-01: *"should we have an introduction step... should we have an outro
step... what about using generative ui on that step"*). Two were refused, one was built, and the
reasoning matters more than the outcome because **this will be iterated** (*"im sure we will have to
go back and iterate this implementation later to make it work correctly and look the way i want
it"*).

##### Refused: an intro step

Monarch's step 1 of 5 is not a splash. It is **a table of contents made of real numbers** — net
worth −$1,288, spending +74.5%, no upcoming recurring — and those three lines are the three slides
that follow. They need it because **their card cannot say anything**: its line is the same generic
sentence every week, since a recap covering four subjects has no single first line.

**Run's card already is that slide.** `lede` is the claim, on the card, before the tap. An intro
would re-add the exact repetition removed on 2026-08-31 — tap a card that says X, get a modal that
opens by saying X again. That repetition was the wall, not the length.

##### Refused: an outro step, and the confetti with it

Two separate objections, and the second is the one that generalises.

**The register.** Monarch can celebrate because checking your finances is neutral-to-good news. A
read names what a habit cost. Confetti over *"you were up $290 at 10:40 and closed −$653"* is the
product laughing, and `psychology.md` has the measurement: investors check **9.5% less the day after
a loss**, so the red day is exactly when this surface cannot be tone-deaf.

**The mechanic.** *"Another week reviewed — nice work!"* rewards **the act of checking**, not the
trading. That is a streak in a costume, and `CLAUDE.md`'s re-entry doctrine bans it: no state may
represent absence, no backlog, no catch-up, no streak. The same reasoning is why the thumbs below
do **not** change their copy when pressed.

*(Confetti is not dead — it is written up against `S11`, where the moment is genuinely neutral.)*

##### Built: two thumbs and one action

| | |
|---|---|
| **Thumbs** | In the FOOTER, above the action, not at the foot of the scroller: `ModalScroller`'s hint is `absolute bottom-3` and centred, so it draws over whatever the scroller's last row is (measured on a 375px sheet at (180,694) against the thumb at (169,672)). **Ephemeral** — no read id to key a vote to and no route to post it to, so it dies with the overlay. Pressing the same thumb twice clears it. |
| **`Ask a follow-up`** | The footer's single full-width action, `secondary`. Points at `/read`. |

**Why the thumbs are worth a control at all:** the read is a generated claim about somebody's money,
and nothing else in the product can tell whether one landed. `spin.md` argues the corpus of what the
engine got right and wrong is the asset rather than the model reading it, and a thumb is the
cheapest row that corpus can be built out of.

**Why `secondary` rather than the reference's gradient CTA:** the gradient is banned outright, and
an accent fill would make the invitation to keep talking the loudest object on a screen about a
trader's own mistake.

##### Fixed: the recap was the only modal hand-rolling its own header *(2026-09-01)*

Luke: *"modals in run-rebuild should have a token or prop or whatever it's called in dev. something
that we would use that makes all modals consistent. i believe all the modals are consistent
throughout the app already."* Audited, and he was right on both halves.

Every modal goes through `ModalShell`/`ConfirmShell` and wears one of two shared headers from
`views/accounts/shared.tsx` - `ModalHeader` (centred title, back/close: Add account, Label account,
Import refused) or `ConfirmHeader` (left title, close: Close, Delete, the ending question). Both
branch on `useSurface()` and hand a phone a real `SheetHeader` bar. **Nothing is wrong with any of
them.**

**The recap was the exception, and it cost the phone.** Four ways off: no phone branch at all, so
below 768px it drew a bare 14px X floating in the content where every other sheet has an h-16 bar
with a 22px `SHEET_CONTROL_ICON`; `text-h2` where every other modal is `text-title`; an 18px accent
eyebrow no other modal has; and it wrote `CONFIRM_TITLE_ID` by hand.

**The fix, second time round, is no prop at all.** The first attempt added `showTitle` to
`ConfirmHeader` so the desktop row could stay title-less like the reference's. Luke rejected it on
sight: *"why does the recap modal look so different from the other modals... i need consistency.
update the recap modal to be exactly the same format, padding, etc. as the other modals. how is this
difficult? shouldn't we have a standard?"*

He is right, and the lesson generalises past this screen: **a surface that wants a third header
shape is arguing with the standard, not exposing a case the standard missed.** `showTitle` came back
out; `ConfirmHeader` is byte-identical to what it was.

The recap now renders `ModalHeader` unchanged - the same component as Add account, Edit account and
Import refused. Measured on the running modal:

| | |
|---|---|
| header | `grid h-14 shrink-0 grid-cols-[36px_1fr_36px] items-center px-3`, 56px tall |
| title | `modal-title`, `text-title` 18px, centred |
| close | 36px control, 12px from the right, vertically centred in the bar |
| body | `px-6 pt-4 pb-4`, `no-scrollbar`, the standard gutter |
| footer | `shrink-0 px-6 py-4` |

**Which is why the claim is not the title.** It is a sentence and a bar centres one truncated line,
so the bar names the SURFACE ("Your Daily Recap", the card's own words) and the claim opens the body
underneath at `text-h2` under the accent eyebrow. That is the reference's own split too: chrome row,
eyebrow, headline.

**`ConfirmShell` gained `labelledBy`** (default `CONFIRM_TITLE_ID`), because it no longer only
frames confirmations: a confirmation's `<h2>` carries `CONFIRM_TITLE_ID` and `ModalHeader`'s carries
`MODAL_TITLE_ID`, and pointing at the wrong one leaves the dialog unnamed. The recap passes
`MODAL_TITLE_ID`, which is the better name anyway - a dialog should be announced as what it is, not
as the sentence it opens with.

**Not moved to `ui/`.** The obvious tidy is to lift both headers out of `views/accounts/`, but they
depend on `useSurface`/`SurfaceHeader` from `views/accounts/surface.tsx`, so the move would drag
that with it and point `ui/` at a feature folder. `views/today` already imports `ConfirmShell` from
`views/accounts/`, so this adds no new class of edge. Worth doing when a third feature needs the
surface machinery, and not before.

##### The note, the thumbs and the ground *(2026-09-01, read out of the reference's markup)*

**The note stays computed, and `spec.md` P8 is the reason** (Luke asked: *"i would assume we would
need some sort of hard coded note there right? or what is the purpose of this note?"*). P8 is LOCKED
and was amended for exactly this on 2026-08-11:

> **The product states what its own output depends on, every time.** For Run this is **provenance,
> not adjustability**. Monarch's note ends *"you can review and adjust"*; Run has nothing to adjust,
> so Run's note names the source instead. Stronger, because *"this came from your Tradovate export
> of Aug 5"* is checkable, while *"you can adjust it"* is an invitation to doubt.

Theirs has to be generic because their figures depend on choices the user makes (categorisation,
recurring items) and can only be described in the abstract. Ours depends on a **count**, and a count
is checkable against `/trades` in ten seconds. A hardcoded note would be the wrong artefact, not a
cheaper one.

**What was cut:** the second sentence, *"If a trade here is wrong, re-sync the account and the next
read uses the correction."* That is the adjustability half P8 rules out, doing the exact damage P8
names - inviting doubt about a figure the first clause had just certified. Re-sync lives on
`/trades`, next to the trade.

**Measured off `app.monarch.com/dashboard/weekly-recap`, and every value ported:**

| | reference | Run |
|---|---|---|
| note | `RecapFlow__NoteText` 14/400/21, `rgb(119,117,115)` | `text-body` 14/20, `--color-muted` |
| thumbs | `FeedbackActions` 20px under the note, two bare 36px pills, 16px marks, muted, **no prompt line** | same, `mt-5` |
| modal card | `ModalCard__Root` `rgb(246,245,243)` | `.modal-paper` = `--color-bg`, **the same value to the byte** |
| content blocks | white `MessageCard`, radius 12 | `Card` (surface + radius + shadow; §3 allows border OR shadow, not both) |
| fade | `RecapFlow__FadeOverlay` 48px, `linear-gradient(transparent, rgb(246,245,243))` | `.modal-fade`, ending on `var(--modal-ground, var(--color-surface))` |
| arrow | `FloatingScrollArrow` 36px white pill on the fade | the existing `IconButton` hint, now on paper |

**`.modal-paper` sets the ground AND `--modal-ground` together**, because setting only the first
leaves the fade resolving to its `surface` default and drawing a visible band across the card's
floor. Verified per-mode: dark measures card `#191918`, blocks `#222221`, fade ending `#191918`.

**Scoped to this modal only** (Luke chose it over porting the ground to every modal). The recap is
the only modal in the product whose body is CONTENT rather than a form or a question, so it is the
only one with blocks that need a ground to sit on. A form on paper would be the reference's look
with none of the reason for it. `ModalShell` gained `cardClassName`, `AccountSheet` gained
`layerClassName`, and `ConfirmShell` forwards one `ground` prop to whichever of the two it resolves
to - so the desktop card and the phone sheet cannot end up different colours.

**The thumbs came back out of the footer.** They were moved there when the scroll hint drew on top
of them; that is fixed at the cause instead, since the hint and its fade now share one `more` state
and are gone the moment the content ends.

##### Built: `RecapEvidence`, a closed vocabulary the engine SELECTS from

*"what about using generative ui on that step depending on what the ai call brings back"* — yes,
with one word changed. The engine picks a `kind`; **SQL fills the payload**; `lib/desk/recap.ts`
names every shape that exists. The model never emits markup or a number. The generative-UI
literature arrives at the same rule from the other side: data inside a rendered card comes from a
real backend call, or the interface is a more convincing way to present a hallucination.

| `kind` | When | Status |
|---|---|---|
| `trades` | discrete decisions to point at | **shipped** — the citations, and the `default` arm |
| `comparison` | a habit, against the trader's own baseline | **shipped** — two figures, no chart |
| `intraday` | **shape over time** (*up $290 at 10:40, closed −$653*) | **planned, deliberately not typed yet** |

**`intraday` is left out on purpose.** A `kind` that is typed and never rendered is a hole with a
name on it. It is the one chart that earns a place in a daily read — a sentence cannot carry a
curve — and `getIntradaySeriesFor` already computes the series, so the work is the chart primitive
and the tokens, not the data.

**The field ships before the second kind is worth much**, because `CLAUDE.md`'s scoping rule
applies: free now, unretrofittable once the job, the card, the overlay and the `/read` archive all
read it.

##### The baseline is counted in TRADES, never in days

Luke, 2026-09-01: *"60 days? no. 60 trades maybe. users a day traders here. who's accounts last
maybe a couple days before they are blown."* `prop-firm-identity.md` is the evidence rather than the
anecdote: **Tradovate deletes a failed account within minutes-to-hours** (§6), most accounts renew
monthly *including failed ones* (§1), and a trader holds several at once across several firms (§1).
A window in days assumes an account that lives for weeks. The width is also **printed** — a baseline
whose span is not stated is a number taken on faith.

##### Open, and each one belongs to the slice that builds the job

1. **Copy-trading inflates the window.** §1 of `prop-firm-identity.md`: a trader runs the same
   decision across several accounts, at several firms. So 240 round trips can be 48 decisions, and a
   baseline counted over raw round trips is up to five times narrower than it prints. **Decide
   whether the unit is a round trip or a de-duplicated decision before the first comparison ships.**
2. **The thumbs have nowhere to go.** They need a read id, a route, and a table. That table is the
   feedback corpus, so it is worth designing once rather than bolting on.
3. **`Ask a follow-up` points at a 404**, which is the standing accepted state for `/read` and not a
   bug — but it is the second door to it now, so shipping that page closes two things at once.
4. **What the read is allowed to say.** Luke, 2026-09-01: *"yes it is allowed to say what went
   right. but we dont govern that. we let the llm do what it wants... we have to trust it."* So the
   prompt does not carry a corrective/positive quota. Recorded because the coaching literature
   argues for one, and this is a deliberate decision against it rather than an omission — and
   because every fixture on the rack today is corrective, which is a property of hand-written
   fixtures rather than of the engine.

### S8b — The two rows the account menu already opens *(added 2026-08-20)*

**Both of these rows ship today and both go nowhere.** `account-menu.tsx` renders Settings as a
live `<Link href="/settings">` and What's new as an inert button, and neither route exists. That was
found by auditing routes against this plan (Luke, 2026-08-20: *"the /settings page needs to be added
to the build plan. same with /whats-new"*) — until now no slice claimed either, so they were not
"not built yet", they were **unplanned**, which is a different and worse thing. Today and Read 404
on purpose because `S8` and `S7` are coming for them; these two had nobody coming.

**`/settings`** — `spec.md` §"Taxonomy lives in Settings, not in the product surface" already fixes
what belongs here: **setups, symbols and tags**, the vocabulary the product computes against. It
follows the reference, which keeps categories, merchants, rules and tags in Settings even though the
entire product runs on them. Plus the two settings that already exist as state with nowhere to be
edited: `trader.display_timezone` (written today by `DetectTimezone`, never shown) and the theme
(reachable only from the account menu).

> ⚠️ **`display_timezone` is display only and must never reach the bucketing code** (`CLAUDE.md`).
> A settings screen is exactly where that rule gets broken, because a timezone control looks like it
> should change what a session date means. It must not.

**`/whats-new`** — a changelog. Inert in both builds today for the honest reason that neither has
one. It is the smallest surface in the plan and it stays out of the sidebar: it is an account-menu
row, not a destination, because a changelog is something you read once and never look for again.

**THE SIDEBAR'S SETTINGS GEAR BELONGS TO THIS SLICE TOO** (added 2026-08-20). The sidebar header now
carries a settings control beside the collapse toggle, matching the reference's own placement
(measured on `app.monarch.com/transactions`: a 224px sidebar with a 62px logo and four 36px round
controls, the third of which is a link to `/settings/profile`). **It ships `disabled`**, because
there is nothing to open yet and a control that looks live and does nothing on click is worse than
one that says so. It becomes a link the day this slice lands — the same day the account menu's
Settings row stops 404-ing, since both point at the same page.

**Why `S8b` and not inside `S9`.** Polish is a pass over what exists; these are two new routes.
Sized after `S8` because both are low-stakes and neither blocks anything — but ahead of the public
launch gate, since a live link to a 404 in the account menu is the kind of thing a first visitor
finds. **If they slip, the rows go inert rather than shipping links to nothing.**

### S9 — Polish

Empty states, error copy, keyboard, mobile, dark mode across the kitchen sink.

### S9c — Notifications *(added 2026-08-20; deliberately near-last)*

The sidebar header carries a bell beside the settings gear, matching the reference's placement.
**It ships `disabled` and shows no unread dot**, and both of those are the point until this slice
lands: a permanent dot on a control that opens nothing is a status light for a condition that has
never occurred, which is the same rule `QuarantineNotice` already follows by rendering nothing at
zero.

**Last on purpose** (Luke, 2026-08-20: *"i would say the notifications would be one of the last
things we implement"*). Numbered `S9c` rather than `S9b` — that label is already the
quarantine-resolve slice in `spec.md`.

**The open question this slice has to answer first is what Run would ever notify about**, because
the doctrine rules out most of what a finance app uses notifications for. **No state may represent
absence**: no "you haven't imported in 9 days", no streak, no backlog, no catch-up. That is the
majority of the reference's own notification surface, and none of it can ship here. What is left is
narrow and worth stating before any UI is built:

- an import that **finished** while the trader was away, and what it found
- a trade that **quarantined**, since that is a fact about the record they have to act on
- the daily **read** being ready

All three are *events that happened*, never *reminders that something did not*. If the list cannot
be filled without reaching for absence, the honest outcome is that Run has no notification centre
and the bell comes out of the sidebar — which is a legitimate result of this slice, not a failure of
it.

**The unread dot's colour is unresolved.** The reference uses red with a 2px ring in the sidebar's
own ground colour, so the dot reads as cut out of the bell rather than sitting on it. The ring is
worth taking. The red is not obviously right here: `--color-neg` means *a result that lost money*,
and overloading it for "you have mail" is exactly the kind of second job that broke the border
tokens. `--color-accent` is the product's existing dot language. Decide it with the slice.

### S10 — Subject pages: the chart selects, and a subject pins *(added 2026-08-31)*

**Held behind `S7`, except phase A. Nothing here is v1 scope until the pattern-versus-reading
decision lands**, because if Read ships patterns then a product page is where a named pattern's
evidence lives, and that changes what the rail on it has to say.

Written up now rather than later because the research below cost a session and is not re-derivable
from the reference by reading it: the finding is a class name in Monarch's markup, and it inverts
the obvious plan.

#### The finding: it is not a merchant page

`app.monarch.com/merchants/<id>` renders a period heading whose class is
**`FilteredCashFlowPage__DateLabel`**. It is `/cash-flow` with a merchant pinned, not a page of its
own. Confirmed by clicking the breadcrumb (2026-08-31):

```
/merchants/2494…?date=2026-06-01&timeframe=month&sankey=category&view=breakdown
        │  "Cash Flow" ▼          every parameter survives, including the period
/cash-flow?date=2026-06-01&timeframe=month&sankey=category&view=breakdown
```

**Going up does not go back. It removes the pin and keeps where you were.**

| | `/cash-flow` — unpinned | `/merchants/[id]` — pinned |
|---|---|---|
| Chart | bars over time | same |
| Heading | "June 2026" | same |
| Body | 4 hero figures + Income/Expenses breakdown, grouped by **Category · Group · Merchant** | Transactions card + Summary rail |
| Grain | Monthly · Quarterly · Yearly | Daily · Weekly · Monthly · Quarterly · Yearly |
| Filters | Accounts · Tags · Hidden | **the same axes** — every one except the pinned subject |

**Run already owns this pair.** `/accounts` is chart + breakdown + rail; `/accounts/details/[id]` is
that page with one account pinned, and its filter sheet already shows the pinned account as a locked
chip. What is missing is not a page. It is that the breakdown groups exactly one way.

#### The mechanism, measured by driving it

The chart bars are `<path role="button">`. Clicking one rewrote `date=2026-08-01` to
`date=2026-06-01`; the heading became "June 2026" and **both cards below rescoped to June**.
Switching the grain to Yearly rewrote *both* `timeframe=year` **and** `date=2026-01-01`.

So: **the chart is the navigation.** Two pieces of state in the URL — a grain, and which bucket is
selected — and everything under the chart is scoped to the selection.

#### The decision, and it is the reason phase A exists

Run's chart carries `1D · 1W · 1M · 3M · YTD · 1Y · ALL`. That is a **window**: how far back to
look, one answer, the whole page shows that span. Monarch has a window *and a selection*.

The consequence is small and it is not: **`PeriodHeading` has been unbuildable because it has
nothing to name.** A window has no "August"; a selection does. And the per-period summary is what
makes two periods comparable, which is the question a trading journal exists to answer — the finding
that cleared the kill signal is a CHANGE BETWEEN PERIODS (MNQ to NQ, stops unchanged), not a fact
about a span.

**SETTLED 2026-08-31: do not adopt Monarch's two controls. Add one idea to the control that already
works.** The range chip already picks the window and implies the grain (`1Y` gives monthly bars,
`1M` gives daily). What is missing is only that a bar can be clicked:

> **The range chip says which bars exist. Clicking a bar says which one you are reading.**

One new concept, no second control, and it is strictly less than Monarch, which needs the grain
because its window is fixed.

#### The three phases

**A — the chart selects.** Bars become buttons, the selected bucket goes in the URL, `PeriodHeading`
ships and names it. Touches `/accounts` and `/accounts/details/[id]` only. **Independently
shippable, and the only phase not held behind `S7`** — but see the product question below before
starting it.

**B — the breakdown groups more than one way.** `By account · By product · By session` on
`/accounts`. The rows are the same shape and the projection already carries `symbol_root` and
`session_date` as promoted, indexed columns, so it is a second `GROUP BY`. No migration.

**C — pinning.** `/products/[root]` and `/sessions/[date]` are the existing page with a subject
pinned: same `SubjectPage`, same `PnlChart`, same `TradesTape`, same `TradesRail`, subject shown as a
locked chip in Filters. "Up" removes the pin and keeps the period.

Keyed on the **root**, never the contract month — `MNQ`, not `MNQU6`. A trader asks how they trade
the Nasdaq, not how they traded the September Nasdaq; the month is an expiry, not a strategy.

#### The product question phase A raises, which is why it is not free

Scoping the tape to a clicked bar changes what `/accounts/details/[id]` IS: today it is the
account's whole record, and after A it is a record you read one period at a time. That is a product
decision rather than a mechanism, and it belongs with B and C rather than being smuggled in ahead of
them. **If A ships alone, it ships with the tape unscoped and only the heading and the rail
following the selection** — or it waits.

#### The doors in

Three, and the third is the one that is easy to miss:

1. **The breakdown row** — click a product in the grouped breakdown, land on its page pinned.
2. **The trade detail's instrument name** — the same gesture as Monarch's merchant link in its
   transaction drawer.
3. **The account detail's own trade drawer** (Luke, 2026-08-31, with a screenshot). Monarch puts a
   distinct link under the merchant name: **"View 16 transactions"**. Not the name made clickable —
   its own line, **carrying the count**. That is the affordance worth copying exactly: it states how
   much is on the other side before the tap, which is the difference between a link and an
   invitation. Run's version reads "View 47 MNQ trades".

**No new nav row.** These are drill-downs, the same standing as `/accounts/details/[id]`;
`spec.md`'s divider rule already settles it.

#### Two flags, and two things not to copy

**A subject page is cross-account by construction** — the one structural advantage this corpus has
over any prop firm's own dashboard, since a firm's dashboard sees one firm and this is keyed on the
TRADER. It is also the read most likely to break *"scope every read by account and window from the
first query"*, so that scoping has to be decided rather than inherited. And
[#31](https://github.com/modryn-studio/run-rebuild/issues/31) already measures the account pages
shipping more payload than they draw; a third surface on the same reads compounds it.

**Not to copy:** the chart bars carry no `aria-label`, so Monarch's entire period selector is
invisible to a screen reader — and the breadcrumbs are `<div role="link">` with no `href`, so no
middle-click and no copy-link-address. Run's bars are buttons with names, and its breadcrumbs are
anchors.

**Supersedes** [#15](https://github.com/modryn-studio/run-rebuild/issues/15), which framed this as a
bespoke `/products/[symbol]` page and asked "page or filter?". The answer is neither: it is the page
Run already has, with a subject pinned.


---

### S11 — The first-import reveal *(added 2026-09-01 — **DEFERRED, not scoped, review before planning**)*

**Not v1 and not next. Written down because the finding cost a session and the idea does not survive
as a memory.** Luke, 2026-09-01: *"we will not focus on first-import right now. but it's an
interesting idea. document your idea for later review."*

#### The finding: TradeZella's "Data Reveal" is activation, not a recap

Nine slides in `docs/screenshots/Tradezella Data Reveal/`, read 2026-09-01. Slide 9 is the tell:

> **First import complete ✓** — "This is your initial performance snapshot — find all your recaps
> in Reports > Recaps & Insights", two email opt-in checkboxes, and a **Go to Dashboard** button.

So it fires **once, after the first CSV import**, over *187 trades across 9 days*. Their *ongoing*
recap is an email and an archive page. It is therefore **not** the analogue of Run's daily recap
card, and comparing the two was the wrong axis. The right comparison is: nine slides earn their
length because a first import has nine subjects in it. A daily read has one.

#### Why Run should eventually have one

`/today`'s card reads a **session**. It cannot say the thing a first import can say, and that thing
is the strongest sentence Run will ever get to write:

> *We reconciled 1,847 round trips across three firms to the cent. Here is what nobody had told you.*

The moment after the fourth CSV lands is the highest-intent moment in the product, and today Run
spends it on a progress bar and a roster. It is also **the only place a chart belongs** without
arguing with `psychology.md` §P3: a one-time reveal over a whole corpus has plenty to show, whereas
a nightly read about one mistake does not.

#### What Run's version would be, and where it wins

Same shape — a stepped, once-only sheet after the first successful commit — with three differences
that are not decoration:

1. **Every figure reconciles.** Their slides 2 and 4 both display `MAX DRAWDOWN 1644.2%`, graded
   "WATCH OUT", inside the feature meant to prove they understand your trading. That number is
   `CLAUDE.md`'s own cautionary tale, shipped with confidence. Run's reveal ends on the trust note
   the recap already carries — round trips, accounts, fees resolved — and the figures survive it.
2. **No grades and no composite score.** Theirs grades the *same* win rate `GOOD` on slide 2 and
   `GREAT` on slide 4, one slide apart. `psychology.md` §"The Zella Score is self-refuting" already
   has the argument; the screenshots are the evidence.
3. **Cross-firm.** The one thing a single-broker sync cannot show, and Run's corpus already is.

#### What not to copy

- **"Key Takeaway: No learning available for this trade."** The shape promises a lesson and then
  admits it has none. That is the P9 empty-state failure with a heading on it.
- **"Held onto loser"** on a trade that lasted 1m28s. A label taxonomy that contradicts its own
  body copy.
- **"Key Takeaway: No learning available for this trade."** — see above.

#### The confetti belongs HERE, and nowhere else *(added 2026-09-01)*

Monarch fires confetti on its recap's last step and TradeZella lands its ninth slide on
`First import complete ✓`. **`S8` refused the confetti for the daily read** and the reasoning is
there: a read names what a habit cost, investors check 9.5% less the day after a loss, and
celebrating the act of checking is a streak in a costume.

**None of that applies to this moment**, and the difference is not a matter of degree:

- The news is **genuinely good and genuinely neutral** — the trader just acquired a reconciled
  record of their own trading across every firm they have used. Nobody is being congratulated for
  a loss, and nobody is being congratulated for showing up.
- It fires **once**, so it cannot become a habit loop. The re-entry doctrine bans states that
  represent absence and rewards that accrue for returning; a one-time completion is neither.
- It marks **a thing the trader did** (four files, correctly matched) rather than a thing the
  product did to them.

So: if confetti ships anywhere in Run, it ships on this screen's last step and on no other. Recorded
here so the next person who asks "why not confetti?" finds the answer in one place, with the one
exception attached to it.

#### Worth stealing

- **Comparative insight.** *"This trade lasted 1 minute, while half your losing trades for the past
  60 days lasted under 1 minute."* A baseline the trader did not know they had. Closer to Run's
  ambition than the grades are, and the read engine can already assert it.
- **Per-trade Running P&L with MAE/MFE.** `getIntradaySeriesFor` computes the series already.
- **Screenshot-to-share**, built into every slide. Traders post these.

#### Open before this can be planned

- Does it run once ever, or once per *account* first import? A trader adding a fourth firm in month
  six has a new corpus and no reveal.
- One read's cost is `$1.58` billed (`ai-economics.md` §1). A corpus-wide reveal is not one read.
  **Price it before scoping it.**
- It collides with `S10`: several slides are a subject page with a period pinned, which is a page
  that would already exist.

---

## The road to a public beta *(added 2026-09-03)*

**The beta is PUBLIC SIGNUP** (Luke, 2026-09-03) - anyone can register. That one answer re-ranks
everything below, because the slice order above was written against a solo dogfooding corpus and a
closed cohort. Three things change:

- **You cannot watch every user.** A failure that a closed cohort would text you about becomes a
  silent abandonment.
- **You cannot control the shape of their exports.** Every parser assumption meets a stranger's file.
- **The volume risks become real**, and so do the legal ones: an erasure request has a clock on it.

### Where the work actually lives now

The slices above are the BUILD. The tracker is the rest, and on 2026-09-03 it stopped being a
backlog and became a plan: `run-trading` was retired and its 77 open issues were read one by one
against this codebase, closed, and the ten that carry live knowledge migrated here. Nothing below is
speculative - each line is either measured in v2 or verified in this source.

### 1. Blockers - a public signup exposes each of these on day one

| | Why it is a blocker rather than a bug |
|---|---|
| [#40](https://github.com/modryn-studio/run-rebuild/issues/40) no global email send budget | Verified in `auth.ts`: per-address `claim()` is durable, per-IP is an in-memory Map, and **nothing bounds the total**. Gmail caps at 2,000/day. An attacker cycling addresses locks out every signup for 24h and takes the work inbox with it |
| [#41](https://github.com/modryn-studio/run-rebuild/issues/41) a re-import that saves nothing confirms like a success | The same `{step.detail && failed}` line as v2. Re-uploading is the likeliest new-trader mistake, and confirming a write that did not happen contradicts the product's one claim |
| [#1](https://github.com/modryn-studio/run-rebuild/issues/1) auth is broken on preview deployments | Still live. The per-request `baseURL` fix is DEV-only; a Vercel preview runs `NODE_ENV=production`, so it stays pinned. Preview is where a release gets looked at before real users see it |

### 2. Finish `/today`

Five cards left of the six (`monarch-dashboard-teardown.md` §A7). The loss line and profit target are
**one slice, one migration** - and blocked on a `spec.md` §6 carve-out, which is a signature rather
than work. `Set up Run` is last of the six on purpose: four of its five steps point at flows that
must already exist.

### 3. The door

`run.trading` and `app.run.trading` are **one repo, one deploy, two route groups**
([#43](https://github.com/modryn-studio/run-rebuild/issues/43)) - not a second repository. The
design system is the argument: *"`globals.css` is the design system, and the only copy of it"*, and a
second repo needs a copy of it or a package. The `seo` skill already models the shape, and
`layout.tsx`'s `robots: { index: false }` already carries the note about removing it when the project
goes public.

Terms and Privacy stop being optional at public signup, and the Privacy Policy has to describe the
erasure path - which is why [#42](https://github.com/modryn-studio/run-rebuild/issues/42) is on this
list rather than a later one.

### 4. Before real users, not before the first one

[#42](https://github.com/modryn-studio/run-rebuild/issues/42) erasure at scale (measured in v2:
130,809 rows time out, 2,500 completes - a constraint on a path this build has not written yet),
[#49](https://github.com/modryn-studio/run-rebuild/issues/49)'s **dev database branch** (no
dependencies; the condition under which a seed script becomes a customer-data incident), and
[#37](https://github.com/modryn-studio/run-rebuild/issues/37) tracking on the account write paths.

### Deliberately NOT before the beta, and why

Ingest at scale ([#4](https://github.com/modryn-studio/run-rebuild/issues/4)), the tape's unbounded
DOM window ([#23](https://github.com/modryn-studio/run-rebuild/issues/23)), the export's missing
duration cap ([#25](https://github.com/modryn-studio/run-rebuild/issues/25)) and the two
accessibility issues ([#27](https://github.com/modryn-studio/run-rebuild/issues/27),
[#30](https://github.com/modryn-studio/run-rebuild/issues/30)).

All four are real. **None of them fires at ten traders**, and all four are cheaper once `/today` has
settled and stopped moving the surfaces they touch. Recorded here so the deferral is a decision with
a stated trigger rather than an oversight: the trigger is the first trader with a year of tape, and
the a11y pair should land before any public claim about accessibility is made.

### What is banked rather than planned

[#48](https://github.com/modryn-studio/run-rebuild/issues/48) holds eight decisions from v2 that
would cost real thinking to re-derive - the timezone override, roster order persistence, keyboard
drag, prefix learning, the economic calendar, the close-outcome taxonomy, generative UI, and the
measured 56-85s desk-read latency. None is scheduled. All of them have a home.

---

## What runs in parallel

Per the two-plane model: this repo runs several worktree sessions; slices only parallelise where
they don't share a surface.

| Wave | Parallel |
|---|---|
| 1 | `S0` skeleton · `S1` data layer + read engine · `S2` primitives (mostly folded into `S1`) |
| 2 | ✅ `S3a` auth · ✅ `S3b` shell · ✅ `S3c` kitchen sink + ported primitives |
| 3 | ✅ `S4` alone — everything downstream depends on its shape. Backend closed 2026-08-14, `S4e` merged, and the door it owed arrived with `S6`. **CLOSED 2026-08-31** |
| 4 | ✅ `S5` · ✅ `S6` (different pages, same projections). Both closed — `S5` 2026-08-25, `S6` 2026-08-31 |
| 5 | `S8` · `S7` **only once the pattern-vs-reading decision is made** — ⬅ **the plan is here now** |
| 6 | `S8b` settings + what's new · `S9` polish |
| 7 | `S9c` notifications — last, and only if the doctrine leaves anything to notify about |
| — | `S10` subject pages — **not in a wave.** Phases B and C are held behind `S7`'s decision; phase A can slot anywhere once its own product question is answered |

**`S3d` then `S5d` (the phone) slot wherever the mobile pass is scheduled** — `S3d` first, since the
drawer cannot give up its nav rows until the bottom bar carries them.

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

*Status as of **2026-08-27**. `S0`–`S3c` merged; waves 1 and 2 complete. `S3d`, `S5` and `S5d` are
closed — the record and the phone both.*

***`S4` AND `S6` ARE BOTH CLOSED (2026-08-31, Luke).*** *`S6` shipped the roster, the hero chart,
the detail route, the editor, filters, reorder and the phone; `S4`'s last debt was a door, and `S6`
built all three of them. The critical path from a signed-in trader to a reconciled tape is now
whole and reachable in the product rather than only in a gate script.*

***THE PLAN SAID `S6d` AND `S6e` WERE NOT BUILT FOR THREE DAYS AFTER THEY SHIPPED***, and that is
worth keeping rather than quietly correcting. A build plan that lags the build is the one artefact
whose whole job is telling you what is left; this one was describing a 404 that had been fixed. The
lesson is the same one `CLAUDE.md` states about itself - **the doc changes in the commit that makes
it false** - and it was broken here because the slices closed across several sessions of iteration
that each felt like polish rather than delivery.

*`S7`–`S9` untouched. `S7` is blocked on a product decision rather than on engineering
([#2](https://github.com/modryn-studio/run-rebuild/issues/2)), and it is the next thing in the plan
that needs a person rather than a keyboard. `S10` was added 2026-08-31 and is held behind it.*

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
- [~] **The critical path works end to end for a switcher with no prior data** — *the path is built
      and reachable as of `S4`/`S6` closing (2026-08-31); what has not been RUN is a genuinely cold
      one.* Every step exists and is gated - sign in, add an account, drop three files, reconcile to
      the cent, read the tape - and Luke's own corpus has been through all of it. **Two seams have
      only been read, not exercised:** a real CSV import adopting an account created by "Add
      manually", and a first-run trader whose roster is empty at every screen rather than populated.
      Closes when somebody does it once, deliberately, on a fresh account.
