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
| `docs/scar-tissue.md` | The evidence behind every rule below. **Read before arguing with one** |
| `docs/wireframes.md` · `docs/problem-brief.md` | Structure · the problem and the kill signal |
| `docs/psychology.md` | Why the product changes behaviour, what it must never build, the advice line |
| `docs/blueprint-instrumentation.md` | Open questions, friction log, retro. **Append friction in the moment** |

**A slice is done when:** it works, handles its error case, handles its empty case, works on mobile,
matches the design system, is merged, and is deployed. Not before.

---

## Operating Rules

- **This file is owned like code. Keep it under ~200 lines.** If a rule stops being true, change it
  in the same commit as the code that made it false. If a rule needs a paragraph of evidence, the
  rule stays here and the evidence goes to `docs/scar-tissue.md`.
- **Log friction in the moment** — `// FRICTION <date>: <what>` in code, `<!-- FRICTION -->` in docs.
  `grep -rn FRICTION .` assembles it at the retro. Written later is memory, which is what this
  replaces.
- **Tag the repo at every gate** (`git tag p5-gate`). Phase durations derive from tag dates.

### Branching: one worktree per slice, and `main` is always live

```bash
claude --worktree s4-ingest     # builds .claude/worktrees/s4-ingest on branch worktree-s4-ingest
```

- **`main` is deployed and always green.** It is the integration point. There is no `dev` branch: a
  second integration point only pays off when several people integrate before a release, and solo it
  just delays the "deployed" half of the definition of done.
- **A worktree is a slice.** It branches from `origin/main`, not local `HEAD`. One slice, one
  worktree, one merge. Two or three at once, never eight — `build-plan.md`'s waves say which can run
  together. **Merge when the slice is done** by the seven-point definition, then delete it. A
  worktree kept "just in case" is the long-lived branch you avoided.
- **Each worktree needs its own `npm install`**, and gets its own dev port automatically — which is
  why `dev` must never pin one. **`.worktreeinclude` carries `.env.local` in**; without it the
  worktree cannot boot and the error does not name the cause.

---

## Run's own doctrine — violating any of these is a bug, not a preference

Each is load-bearing on the product's one claim: **never show a number you cannot reconcile.**

**Money and time**
- **Money is integer cents (`bigint`), never a float.** Prices are `numeric(19,6)`. A float cannot
  reconcile, and `MAX DRAWDOWN 1644.2%` is what the alternative looks like in production.
- **One module owns every time bucket** (`src/lib/time/`). Two code paths computing one derived
  value is how a product disagrees with itself about "your worst day". It has happened once already.
- **`SESSION_BOUNDARY_ZONE` and `SESSION_BOUNDARY_HOUR` travel together** — `America/Chicago` + `17`.
  A named IANA zone, never a fixed offset; an offset breaks twice a year.
- **`session_date` derives from `exit_at`.** A trade belongs to the session it was realised in.
- **`trader.display_timezone` is display only.** It must never reach the bucketing code.

**The import**
- **Never build a matching engine.** Tradovate's Position History already carries Tradovate's own
  entry→exit pairing. Under the reconcile rule, a matcher produces numbers you cannot reconcile.
- **Cash History is required on import, not optional.** The Fills export's `commission` column is
  one of four fee lines, measured at **42% of true cost**. On a real 10-day export the fees exceeded
  the gross loss.
- **Fees resolve per round trip, by an exact per-contract-per-side split** — never pro-rata, never
  per fill. Across 360 real round trips the exact split reproduced the file to the cent. Fees key to
  fills on **raw strings**: Cash History timestamps carry no timezone, and parsing them shifts every
  fee by the server's offset.
- **An unknown `symbol_root` quarantines.** Never a default multiplier, never a guess from a similar
  root, never priced at zero. `contract_spec` is seeded narrow from the exchange's published spec,
  with the source URL and read date beside each row.

**The data**
- **`event` is append-only.** Corrections append with `corrects_event_id`; the original never
  mutates. Everything else is a projection you can rebuild by replaying it.
- **Nothing reads `event.payload` on a render path.** Promoted columns or a projection.
- **Scope every read by account and window from the first query.** Free now, unretrofittable once
  four surfaces depend on it.
- **Every query is scoped by `trader_id` from the session, never from the request.**
- **Chunk writes at 1,000 rows.** Postgres caps a statement at 65,535 bind parameters.

**The surfaces**
- **The LLM never computes a number.** It receives finished figures and writes the sentence around
  them. Every number in a read comes from SQL.
- **Trades are not editable, and the option is not offered.** The claim is "our numbers are the
  broker's numbers." A quarantined trade gets re-sync or exclude-with-a-reason; neither writes to
  the trade. **An excluded or quarantined trade stays visible and countable** — an exclusion may
  never silently shrink the record.
- **No state may represent absence.** No "you haven't imported in 9 days", no backlog, no catch-up,
  no streak — every surface reopens where it was left. Investors check **9.5% less the day after a
  loss**, so the trader who has been away is the one the read is worth most to (`psychology.md`).

---

## Scar Tissue — the rules

Each line is a bug that shipped or a session that got burned. **The evidence, the measurements and
the reasoning behind every one live in `docs/scar-tissue.md`.** Read that before changing or arguing
with a rule. The rules stay HERE, because this file is loaded into every session and that one is not.

**Stack**
- **DB scripts need BOTH flags:** `tsx --env-file=.env.local --conditions=react-server`.
- **Migrations: `drizzle-kit generate` + `migrate`, NEVER `push`.** One push makes `migrate` skip older migrations forever, silently.
- **A `'use client'` file may import TYPES from a db-backed module, never VALUES.** `import type` is erased and always safe.
- **Every export of a `'use client'` module becomes a client reference.** The shell's layout constants live in a plain module (`src/lib/shell.ts`) and re-exporting does not launder them.
- **A row fetched over JSON has no `Date`s, and TypeScript will not tell you.** Revive at the boundary (`reviveTrade`), never at the call site.
- **Next.js 16 is not the Next.js in your training data.** Read `node_modules/next/dist/docs/` before writing framework code.
- **TypeScript stays on 6**; 7.0 breaks typescript-eslint and takes `npm run lint` down.
- **Tailwind v4 has no config file.** `@theme` in `src/app/globals.css`, never `:root`, never `tailwind.config.*`.
- **API routes use `createRouteLogger`**; env vars go in `src/lib/env.ts` (zod, fail-fast).
- **NO `loading.tsx` AT THE APP ROOT.** Past ~50KB of streamed payload its boundary stops hydrating, silently. Put one on a segment that waits on data and nowhere else; a route needing a Suspense boundary declares its own. **`src/app/loading.tsx` currently violates this** — inherited from `modryn-base`'s scar list, not yet acted on here.

**Auth**
- **No pinned `BETTER_AUTH_URL` in dev** — `baseURL` resolves per request from `Host`. Production keeps a pinned string. **Reproduce auth bugs in a browser or not at all**; the origin check only runs on requests carrying a Cookie header.
- **Cookies ignore the PORT, so two local builds share one jar.** `advanced: { cookiePrefix: 'run-rebuild' }` is the fix, and it is one-sided.
- **An emailed code, not a magic link.** The OTP send throttle lives in the `before` hook, not `sendVerificationOTP`.
- **`?next=` is attacker-supplied.** Always read it through `safeNext`; `startsWith('/')` is NOT enough.

**Design system** — the full set lives in `docs/design-system.md` and
`modryn-hq@v4:playbooks/design-rules.md`. **Read them before touching a token, a primitive or the
shell.** Enforced in three places rather than by memory: the primitives carry the reasoning at the
point of use, `/kitchen-sink` renders and measures them, and lint fails a build on a token that
does not exist. The ones that bite hardest:

- **A utility with no token behind it emits nothing** — no error, no warning, no type complaint. Confirm a token exists before writing a class. Tokens read only from inline styles or hand-written CSS need `@theme static`.
- **Shadow tokens must be indirect** (`--shadow-card: var(--elevation-card)`), or the `.dark` override silently does nothing.
- **Three easing curves, each with a job, and `ease-in` is BANNED.** `ease` in place; `ease-out` entering or leaving; `ease-in-out` moving or resizing; `linear` only for constant motion. A perceived-performance rule, not a taste one.
- **Muted is METADATA; ink is PROSE.** Two tiers, never three.
- **A control gets a border OR a drop shadow, never both**, and only `Card` gets the shadow.
- **One icon set, one wrapper** (`src/components/ui/icon.tsx`). Never inline an `<svg>`.
- **Both modes, always.** The `.dark` block is per-mode literals, not inversions.
- **A component isn't done until it appears in `/kitchen-sink` in every state**, in the same commit. The rack holds **no literal values** — no hex, px, font name or arbitrary Tailwind.
- **"Works on mobile" means a deployed build on a real phone.** A 375px desktop viewport has a mouse, so `:hover` fires and every touch target passes. It is a width check, not the gate.

**Before proposing a motion or interaction change, check `modryn-hq@v4:playbooks/ui-ux-sources.md`.**
It records what each source gave us and, more usefully, what was weighed and TURNED DOWN.

**House style**
- **No em dashes in user-facing copy.** Comma, colon, parentheses, or a plain hyphen. Comments and docs are exempt; lint enforces the rest.
- **The app never names itself to the person using it.** Use *you / your*, *we*, or nothing. Marketing surfaces are the exception.

**Tooling**
- **`chrome-devtools start --isolated` deletes its profile on exit.** Pass `--userDataDir <path>`. Its screenshot follows the FRONTED tab, not the one `select_page` chose. **Never run `chrome-devtools stop`.**

---

## Stack

Next.js 16.3 (App Router) · React 19 (React Compiler on) · TypeScript 6 · Tailwind v4 ·
Vercel AI SDK v7 · Neon + Drizzle · Better Auth (emailed code + Google) · nodemailer · lucide-react.

```
docs/               the phase artifacts. spec.md and architecture.md are LOCKED
src/app/            App Router — admin/, api/, login/, status/, trades/, kitchen-sink/
src/components/ui/  primitives ported from run-trading@v3, against these exact tokens
src/components/views/  the product's own surfaces — trades/ (tape, rail, drawer), accounts/, auth/
src/lib/csv/        one parser per Tradovate export. Detected by header signature, never filename
src/lib/intake/     preflight · write · commit · accounts · statement. Everything before a row lands
src/lib/desk/       the tape: finished figures for the read. Never computes on a render path
src/lib/time/       the ONE bucketer. Session date, day, week, month, YTD — all from here
src/lib/            auth · db · env · route-logger · notify · track · analytics · cn · shell · trader
drizzle/            migrations. generate + migrate, never push
```

**Environment:** `ANTHROPIC_API_KEY`, `DATABASE_URL`, `BETTER_AUTH_SECRET` are required and the app
will not boot without them. `REPLICATE_API_TOKEN` is **local only** — it generates media, it does
not serve it, so it belongs on your machine and not on the deploy.

---

## Conventions

- **Code style:** senior-engineer minimalism — small surface, obvious naming, no premature
  abstraction, comments explain WHY, early returns for errors. One file, one responsibility.
- **`src/app/globals.css` is the design system**, and the only copy of it. Every token carries the
  measurement that set it, including values tried and rejected. Read the comments before changing a
  number; most of them are the record of getting it wrong once.
- **If a screen needs a value that isn't in the system, add it to the system first, then use it.**
  One-offs are how a design system dies.
- **`layout.tsx` sets `robots: { index: false }`.** Remove it when the project genuinely goes public.
