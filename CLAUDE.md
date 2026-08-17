# Run

A trading journal for futures traders. The record is the broker's, reconciled and visibly so, and
once a day it names one pattern in your own trading and what it costs you.

## Read this first: the docs are the spec, not background

`docs/` holds the phase 1–5 artifacts. **`spec.md` and `architecture.md` are LOCKED.** If the code
and those files disagree, one of them is a bug — and the file gets updated **first**, in the same
change. Point agents at the file, never at your memory of it.

| File | What it settles |
|---|---|
| `docs/spec.md` | What v1 is. Stories, EARS acceptance criteria, NOT IN V1 |
| `docs/architecture.md` | Where every piece of state lives, and why |
| `docs/build-plan.md` | Slice order `S0`–`S9`, and the definition of done |
| `docs/design-system.md` | Every visual decision, with the measurement behind it |
| `docs/wireframes.md` · `docs/problem-brief.md` | Structure · the problem and the kill signal |
| `docs/psychology.md` | Why the product changes behaviour, what it must never build, and the advice line |
| `docs/blueprint-instrumentation.md` | Open questions, friction log, retro. **Append friction in the moment** |

**A slice is done when:** it works, handles its error case, handles its empty case, works on mobile,
matches the design system, is merged, and is deployed. Not before.

---

## Operating Rules

- **This file is owned like code. Keep it under ~200 lines.** If a rule stops being true, change it
  in the same commit as the code that made it false.
- **Log friction in the moment** — `// FRICTION <date>: <what>` in code, `<!-- FRICTION -->` in docs.
  `grep -rn FRICTION .` assembles it at the retro. Written later is memory, which is what this
  replaces.
- **Tag the repo at every gate** (`git tag p5-gate`). Phase durations derive from tag dates.

### Branching: one worktree per slice, and `main` is always live

```bash
claude --worktree s4-ingest     # builds .claude/worktrees/s4-ingest on branch worktree-s4-ingest
```

- **`main` is deployed and always green.** It is the integration point. There is no `dev` branch:
  a second integration point only pays off when several people integrate before a release, and
  solo it just delays the "deployed" half of the definition of done.
- **A worktree is a slice.** It branches from `origin/main`, not from local `HEAD`, so it starts
  clean. One slice, one worktree, one merge. Two or three at once, never eight — `build-plan.md`'s
  waves already say which slices can run together.
- **Merge when the slice is done**, by the seven-point definition, not when it mostly works. Then
  delete the worktree. A worktree kept "just in case" is the long-lived branch you avoided.
- **Each worktree needs its own `npm install`** (a fresh checkout has no `node_modules`), and gets
  its own dev port automatically — which is why `dev` must never pin one.
- **`.worktreeinclude` carries `.env.local` in.** Without it the worktree cannot boot, and the
  error does not name the cause.

---

## Run's own doctrine — violating any of these is a bug, not a preference

Each is load-bearing on the product's one claim: **never show a number you cannot reconcile.**

- **Money is integer cents (`bigint`). Never a float.** Prices are `numeric(19,6)`. A float cannot
  reconcile, and `MAX DRAWDOWN 1644.2%` is what the alternative looks like in production.
- **One module owns every time bucket.** Session date, day, week, month, YTD — all from one place,
  one vocabulary. Two code paths computing one derived value is how a product disagrees with itself
  about "your worst day". It has already happened once, with a TS bucketer and a SQL `date_trunc`
  both called "grain".
- **`SESSION_BOUNDARY_ZONE` and `SESSION_BOUNDARY_HOUR` travel together.** `America/Chicago` + `17`.
  Pairing that zone with `18` (or New York with `17`) files an hour of every evening session under
  the wrong trade date, silently. A named IANA zone, never a fixed offset — an offset breaks twice
  a year.
- **`session_date` derives from `exit_at`.** A trade belongs to the session it was realised in.
- **`trader.display_timezone` is display only.** It must never reach the bucketing code.
- **Never build a matching engine.** Tradovate's Position History already carries Tradovate's own
  entry→exit pairing. Under the reconcile rule, a matcher is a machine for producing numbers you
  cannot reconcile.
- **Cash History is required on import, not optional.** The Fills export's `commission` column is
  one of four fee lines, measured at **42% of true cost**. On a real 10-day export the fees exceeded
  the gross loss. Gross-only reporting understates the real loss by half.
- **Fees resolve per round trip, by an exact per-contract-per-side split** — never pro-rata, never
  per fill. Across 360 real round trips the exact split reproduced the file to the cent, zero
  remainder. Fees key to fills on **raw strings**, because Cash History timestamps carry no timezone
  and parsing them shifts every fee by the server's offset.
- **An unknown `symbol_root` quarantines.** Never a default multiplier, never a guess from a similar
  root, never priced at zero. `contract_spec` is seeded narrow, from the exchange's own published
  spec, with the source URL and read date beside each row.
- **`event` is append-only.** Corrections append with `corrects_event_id`; the original never
  mutates. Everything else is a projection you can rebuild by replaying it.
- **Nothing reads `event.payload` on a render path.** Promoted columns or a projection.
- **Scope every read by account and window from the first query.** Free now, unretrofittable once
  four surfaces depend on it.
- **Every query is scoped by `trader_id` from the session, never from the request.** The record is
  somebody's trading history.
- **Chunk writes at 1,000 rows.** Postgres caps a statement at 65,535 bind parameters.
- **The LLM never computes a number.** It receives finished figures and writes the sentence around
  them. Every number in a read comes from SQL.
- **Trades are not editable — the option is not offered.** The claim is "our numbers are the
  broker's numbers." A quarantined trade gets re-sync or exclude-with-a-reason, and neither writes
  to the trade.
- **An excluded or quarantined trade stays visible and countable.** An exclusion may never silently
  shrink the record.
- **No state may represent absence.** No "you haven't imported in 9 days", no backlog, no catch-up,
  no streak — every surface reopens where it was left. Free now, unretrofittable once Today, Trades
  and Read each hold an idea of "current". Investors check **9.5% less the day after a loss**, so the
  trader who has been away is the one the read is worth most to (`docs/psychology.md`).

---

## Scar Tissue — inherited, and every one still applies

Each is a bug that shipped or a session that got burned.

- **DB scripts need BOTH flags.** `tsx --env-file=.env.local --conditions=react-server`. The first
  loads `DATABASE_URL`; the second gets past the `server-only` guard in `lib/env.ts`. Missing either
  fails in a way that does not name the cause.
- **Migrations: `drizzle-kit generate` + `migrate`, NEVER `push`.** One push makes `migrate` skip
  older migrations forever, silently, exit 0. No warning, no easy repair.
- **A `'use client'` file may import TYPES from a db-backed module, never VALUES.** Those reach
  `@/lib/db` → `@/lib/env` → `server-only`, so one constant pulled into a client file ships the
  secret schema to the browser and fails the build. `import type` is erased and always safe.
- **Every export of a `'use client'` module becomes a client reference** when a Server Component
  imports it, so a plain string arrives as an opaque object and `clsx` drops it — silently, no
  error, no type complaint. **The shell's layout constants live in a module with no `'use client'`
  at its top, and that absence is the point.** Re-exporting from the client file does NOT launder
  them. On the old build this cost two server-rendered pages their gutter and max-width entirely.
- **In dev, `baseURL` resolves per request from the `Host` header — it is not pinned to one port.**
  A pinned `BETTER_AUTH_URL` breaks the moment a second dev server or worktree takes the next port,
  and it breaks in a way that costs the most time: every browser POST 403s before the throttle hook
  and before any mail, the screen reports a generic send failure, and retrying can never work.
  `src/lib/auth.ts` uses Better Auth's `baseURL: { allowedHosts: [...], protocol: 'http' }` in dev
  instead — its own multi-host feature, not a workaround — so sign-in works on whatever port Next
  actually bound to. Production keeps a pinned string; a wildcard host allowlist in production is
  an open redirect. **Still invisible to curl either way:** the origin check only runs on requests
  carrying a Cookie header. Reproduce auth bugs in a browser or not at all.
- **Next.js 16 is not the Next.js in your training data.** Read `node_modules/next/dist/docs/`
  before writing framework code. `next dev` maintains that pointer in `AGENTS.md`, which exists so
  Next writes its managed block there instead of into this file.
- **TypeScript stays on 6.** 7.0 ships no programmatic API, so typescript-eslint throws on import
  and takes `npm run lint` down with it.
- **Tailwind v4 has no config file.** `@theme` in `src/app/globals.css` — never `:root`, never
  `tailwind.config.*`.
- **One icon set, one wrapper.** `src/components/ui/icon.tsx`. Hand-drawn is the default, ported
  verbatim from `run-trading@v2`; `lucide-react` is the stated fallback for the few names v2 never
  drew (`read`, `expand`, `warn`). Both obey the same wrapper: `viewBox 0 0 24 24`, stroke 1.5,
  round cap/join. Never inline an `<svg>`, never generate a UI icon elsewhere — stroke weights
  drifted 50% across a codebase before this rule, in both builds independently.
- **API routes use `createRouteLogger`** from `@/lib/route-logger` — never raw `console.log`.
- **Env vars go in `src/lib/env.ts`** (zod, fail-fast) or they fail at request time instead of boot.
- **An emailed code, not a magic link.** A link signs in whichever device opens it.
- **The OTP send throttle lives in the `before` hook**, not in `sendVerificationOTP` — by the send
  hook the plugin has already rotated the stored code, so throttling there is a silent lockout.
- **`?next=` is attacker-supplied by construction.** Read it through `safeNext`. `startsWith('/')`
  is NOT enough: `//evil.example` is protocol-relative and leaves the origin while reading as a path.

---

## Stack

Next.js 16.3 (App Router) · React 19 (React Compiler on) · TypeScript 6 · Tailwind v4 ·
Vercel AI SDK v7 · Neon + Drizzle · Better Auth (emailed code + Google) · nodemailer · lucide-react.

```
docs/               the phase artifacts. spec.md and architecture.md are LOCKED
src/app/            App Router — admin/, api/auth/, api/track/, login/, status/
src/components/ui/  primitives ported from run-trading@v3, against these exact tokens
src/lib/csv/        one parser per Tradovate export. Detected by header signature, never filename
src/lib/intake/     preflight · write · commit · accounts · statement. Everything before a row lands
src/lib/desk/       the tape: finished figures for the read. Never computes on a render path
src/lib/time/       the ONE bucketer. Session date, day, week, month, YTD — all from here
src/lib/            auth · db · env · route-logger · notify · track · analytics · cn · shell · trader
drizzle/            migrations. generate + migrate, never push
```

**Environment:** `ANTHROPIC_API_KEY`, `DATABASE_URL`, `BETTER_AUTH_SECRET` are required and the app
will not boot without them. `REPLICATE_API_TOKEN` is **local only** — it generates media, it does not
serve it, so it belongs on your machine and not on the deploy.

---

## Conventions

- **Code style:** senior-engineer minimalism — small surface, obvious naming, no premature
  abstraction, comments explain WHY, early returns for errors. One file, one responsibility.
- **`src/app/globals.css` is the design system**, and the only copy of it. Every token carries the
  measurement that set it, including values tried and rejected. Read the comments before changing a
  number; most of them are the record of getting it wrong once.
- **If a screen needs a value that isn't in the system, add it to the system first, then use it.**
  One-offs are how a design system dies.
- **A utility with no token behind it emits nothing** — no error, no warning, no type complaint, just
  an unstyled element. When adding a class, confirm the token exists. Tokens read only from inline
  styles or hand-written CSS need `@theme static` or they are tree-shaken away.
- **Both modes, always.** The `.dark` block is per-mode literals, not inversions — scrims, shadows
  and pressed grounds each have their own value, and each can be wrong in exactly one mode.
- **A component isn't done until it appears in `/kitchen-sink` in every state** (`S3c`), and that
  is a live gate, not a checklist item: the rack is where a component is reviewed, so one that
  isn't in it has not been looked at. It is also where the system gets judged, because a design
  system cannot be evaluated one component at a time. Its first run found `text-figure` in `rem`
  in a px ramp, `Textarea` on Tailwind's default `text-sm`, and a dark band/hover collision.
- **"Works on mobile" means a deployed build on a real phone.** A 375px viewport in a desktop
  browser is a width check, not a device check: it has a mouse, so `:hover` fires and every touch
  target passes; it has no on-screen keyboard, no iOS Safari, and no real scroll momentum. The
  rack's 375 column and this rule do different jobs, and only the second one is the gate.
- **`layout.tsx` sets `robots: { index: false }`.** Remove it when the project genuinely goes public.
- **No em dashes in user-facing copy** (headlines, labels, any UI text). Comma, colon, parentheses,
  or a plain hyphen. Code comments and docs are exempt.
- **The app never names itself to the person using it.** Use *you / your*, or *we*, or nothing.
  Marketing surfaces are the exception.