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
| `docs/user-guide.md` | Every screen, what it leads to, and what Back does. Unbuilt ones dashed |
| `docs/ai-economics.md` | What AI costs, what the market charges, what has to fit in the budget |
| `docs/recap-job.md` | The daily read's TRIGGER, every edge case, and what changes when the API lands |
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
- **A CHECK the UI can reach is asked as a question first.** `account_type_status_check` pairs the
  type with the status, so changing the type of an ENDED account restates the ending in the same
  Save. A constraint can only refuse, and it refuses as a 500.

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
- **Never fetch what the client is already holding**, and check before designing any wait. The phone
  round-tripped the server for the `TapeRow` the tapped row was rendering: 305ms before anything
  moved, plus a skeleton for data already in memory. Deleting the fetch deleted the loading state.
- **Any overlay with an `x` or a back arrow answers the device back button** — `useOverlayBack`, one
  tagged history entry per level, innermost consumed first. A phone modal that lets the OS gesture
  leave the page instead of closing it is a bug. **And Back may only go where the screen SHOWS a way
  to go**: a screen drawing a back arrow goes one layer, a screen drawing only an `x` closes.

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
- **Turbopack's build cache is OFF** (`experimental.turbopackFileSystemCacheForBuild: false`, default `true` since 16.3.0). It shipped CURRENT HTML WITH A STALE STYLESHEET; the phone was unusable and build, lint, typecheck and `/status` were all green. `next dev` uses a different cache, so local can never show you this.
- **`npm run build` verifies its own stylesheet** (`scripts/verify-css.mjs`). Every unconditional class rule in `globals.css`, and every token those rules read, must reach the emitted CSS or the build fails.
- **Next.js 16 is not the Next.js in your training data.** Read `node_modules/next/dist/docs/` before writing framework code.
- **TypeScript stays on 6**; 7.0 breaks typescript-eslint and takes `npm run lint` down.
- **Tailwind v4 has no config file.** `@theme` in `src/app/globals.css`, never `:root`, never `tailwind.config.*`.
- **API routes use `createRouteLogger`**; env vars go in `src/lib/env.ts` (zod, fail-fast).
- **The client cache is ON** (`experimental.staleTimes: { dynamic: 30 }`). Next's default is 0, which makes every return trip between two dynamic pages a fresh round trip that MUST play its loading state. Safe here only because nothing writes without `router.refresh()`.
- **NO `loading.tsx` AT THE APP ROOT.** Past ~50KB of streamed payload its boundary stops hydrating, silently. Put one on a segment that waits on data and nowhere else; a route needing a Suspense boundary declares its own. Acted on 2026-08-20: the boundary moved from `src/app/loading.tsx` to `src/app/(app)/loading.tsx`, so it wraps the page rather than the shell.

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
- **A row is ONE type size; chrome is never smaller than the content it controls.** `text-small` (12px) appears nowhere on `/trades`. Peers in a button row are one component at one size, varying only `variant`. **`docs/design-system.md` §2a is the measured contract — read it before porting a page from `run-trading@v2`.**
- **A motion class owns the TIMING; the call site owns the POSITION.** `.drawer-transition` and `.panel-transition` name only `transition`; the displacing is a Tailwind utility at the call site. `.sheet-transition` broke that and put `translate` for the dismissed state in the stylesheet, which is how a stale CSS deploy turned a full-screen sheet into an inert overlay over the whole app.
- **A drill-down page on a phone puts its panel and bar in the segment's `layout.tsx`, and only the BODY slides.** A layout mounts once (so a boundary and its page cannot run the entrance twice) and resolves before its page (so the bar paints off one cached row). Key the body on `useSelectedLayoutSegment()`. **`<ViewTransition>` is NOT available**: react 19.2.7 stable does not export it and Next 16.3 only vendors the experimental React behind four experimental flags. `design-system.md` §6b.
- **Render off `usePhone()`, ACT off `usePhoneState()`.** The first answers `false` before the media query is read (so hydration matches the server); the second answers `null` until it is known. Anything that navigates, writes or fetches on the breakpoint must wait for a real answer.
- **An overlay owns ONE history entry at a time and RE-ARMS on the way out** (the handler returns `true` to mean "consumed a level, still open"), and `useOverlayBack` decides who answers a pop from a module array — never from `history.state`, which Next copies forward onto neighbouring entries. **A pop an overlay causes itself is declared**, or the overlay underneath answers it as a press. **An overlay is armed by a state change, never by its own mount** — `useOverlayBack(true)` pushes twice and backs once under StrictMode. Both rules exist because breaking either made the phone's filter apply "sometimes".
- **An overlay that COMMITS a navigation calls `useOverlayBack`'s returned marker**, or its cleanup's `history.back()` reverts the write: inside one React commit every effect cleanup runs before anything else. **No scrollbars below 768px** (`globals.css`, at the end, on `*`). **A filter control writes to `usePathname()`**, never a hard-coded route.
- **A `loading.tsx` occupies the page's own boxes, GUTTER INCLUDED.** A card's `-mx-4` cancels a gutter; a boundary without that gutter hangs it off the screen. `ICON_TOUCH` (22px) is the mark size for anything aimed at with a thumb — every phone bar control,
  the roster's discs, the sheet headers. `SHEET_CONTROL_ICON` reads from it. `ICON_INLINE` (13px) is
  a mark subordinate to the text it sits in. Both are named steps; the scale is 13 / 16 / 20 / 22 / 24.
- **No modals on a phone, and the HEADER decides whether a screen slides.** Below `PHONE_QUERY` (768px) every dismissible surface is a full-screen sheet. A screen that RENAMES the bar slides up as its own layer; one that does not is a `key` + `.value-fade` inside the layer it is already in. `design-system.md` §6a.
- **A control gets a border OR a drop shadow, never both**, and only `Card` gets the shadow.
- **One icon set, one wrapper** (`src/components/ui/icon.tsx`). Never inline an `<svg>`.
- **Both modes, always.** The `.dark` block is per-mode literals, not inversions.
- **Three loading marks, and the shape decides.** `Skeleton` when you know what is coming (the default), `Spinner` inside buttons only, the wordmark for a cold entry. Below 300ms show nothing (`.wait-reveal`). **Persistent chrome goes in `layout.tsx`**, or a `loading.tsx` and its page each mount it and the entrance runs twice. `design-system.md` §7.
- **A component isn't done until it appears in `/kitchen-sink` in every state**, in the same commit. The rack holds **no literal values** — no hex, px, font name or arbitrary Tailwind.
- **"Works on mobile" means a deployed build on a real phone.** A 375px desktop viewport has a mouse, so `:hover` fires and every touch target passes. It is a width check, not the gate.

**Before proposing a motion or interaction change, check `modryn-hq@v4:playbooks/ui-ux-sources.md`.**
It records what each source gave us and, more usefully, what was weighed and TURNED DOWN.

**House style**
- **No em dashes in user-facing copy.** Comma, colon, parentheses, or a plain hyphen. Comments and docs are exempt; lint enforces the rest.
- **The app never names itself to the person using it.** Use *you / your*, *we*, or nothing. Marketing surfaces are the exception.

**Tooling**
- **NEVER read Monarch's phone UI from the browser.** `app.monarch.com` narrowed is a desktop table squeezed, not a designed screen — their phone product is a NATIVE APP the browser cannot reach. Desktop web is the reference and is where the measured numbers come from; **below `md`, ask Luke for the screenshot.** "The reference's mobile row" in this codebase always means the app.
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
