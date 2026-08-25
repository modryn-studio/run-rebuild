# Scar tissue — Run

> Every rule in `CLAUDE.md`'s Scar Tissue list, with the evidence behind it.
>
> **The rules live in `CLAUDE.md`, not here**, and that split is deliberate: that file is loaded
> into every session and this one is not, so a rule that lived only here would be a rule nobody
> enforces. This file is what you read *before changing or arguing with* one of them.
>
> Studio-wide scars live in `modryn-hq@v4:playbooks/scar-tissue.md`. These are Run's own, plus the
> inherited ones whose evidence is specific to this build.

---

## Stack and framework

### DB scripts need BOTH flags

`tsx --env-file=.env.local --conditions=react-server`. The first loads `DATABASE_URL`; the second
gets past the `server-only` guard in `lib/env.ts`. Missing either fails in a way that does not name
the cause.

### Migrations: `generate` + `migrate`, never `push`

One `push` makes `migrate` skip older migrations forever, silently, exit 0. No warning, no easy
repair.

### A `'use client'` file may import TYPES from a db-backed module, never VALUES

Values reach `@/lib/db` → `@/lib/env` → `server-only`, so one constant pulled into a client file
ships the secret schema to the browser and fails the build. `import type` is erased and always safe.

### Every export of a `'use client'` module becomes a client reference

When a Server Component imports it, a plain string arrives as an opaque object and `clsx` drops it —
silently, no error, no type complaint.

**The shell's layout constants live in `src/lib/shell.ts`, a module with no `'use client'` at its
top, and that absence is the point.** Re-exporting from the client file does NOT launder them.

Measured on the previous build, 2026-07-29, same constant, same call shape, three pages:

| Page | Kind | Rendered |
|---|---|---|
| `/sessions` | client component | `"mx-auto w-full px-4"` — correct |
| `/accounts` | server component | `"pb-8"` — `PAGE_COLUMN` gone |
| `/dashboard` | server component | `"pb-8"` — `PAGE_COLUMN` gone |

The tell was that the two broken pages were the two Server Components. Importing a *component* from
a client module into a server file is fine and is done in `(app)/layout.tsx` with `<AppShell>`;
reasoning from that to "constants are fine too" is what shipped the bug.

### A row fetched over JSON has no `Date`s, and TypeScript will not tell you

A server component hands a client one real `Date`; the same row refetched from a route arrives as
an ISO **string** wearing the same `Date` type, because `JSON.parse` cannot restore it and the cast
at the fetch boundary is a lie the compiler accepts.

It fails **only on the rows that came second** — the tape's first 300 clocks render, row 301 reads
`Invalid Date` — so it looks like a data bug in one batch rather than a type one everywhere.

**Revive at the boundary** (`reviveTrade` in `trades-tape.tsx`), never at the call site, or the next
consumer re-learns it.

### Next.js 16 is not the Next.js in your training data

Read `node_modules/next/dist/docs/` before writing framework code. `next dev` maintains that pointer
in `AGENTS.md`, which exists so Next writes its managed block there instead of into `CLAUDE.md`.

### Turbopack's build cache is OFF, and the build verifies its own stylesheet

**2026-08-24. The worst deploy this project has had, and every signal was green while it happened.**

Deployment `0849edc` served **current HTML with a stale stylesheet**. Not a cache in a browser, not a
CDN: the build itself emitted the wrong CSS.

Measured, rather than inferred:

| | bytes | `.sheet-transition` |
|---|---|---|
| deployed stylesheet | 56,566 | absent |
| clean local build, same commit | 60,818 | present |

The deployed file was a strict SUBSET of the correct one. Every rule the merged branch added was
gone: `sheet-transition`, `drawer-transition`, `icon-btn`, `menu-panel`, `clip-allow-shadow`,
`pane-bottom-clearance`, `btn-secondary`, plus the `--color-success` / `--color-danger` /
`--text-h3` / `--ease-sheet` / `--bottom-bar-h` tokens. Tracing each missing rule to the commit that
introduced it put all of them on the merged branch, and everything still present at `f81b38c` (S0).

It also still carried `.pop-in-up`, a class that `90c7ff0` **replaced** with `menu-panel`. So the
stylesheet was not the previous release's either. It dated to an intermediate commit ON THE BRANCH,
which is what makes a build cache holding branch artifacts the explanation rather than a guess about
the CDN.

**What it cost.** `filter-sheet.tsx` is a `fixed inset-0 z-[70]` panel that is ALWAYS MOUNTED, and
the one rule holding it off-screen is `.sheet-transition[data-open='false'] { translate: 0 100% }`.
Without it the sheet painted over the entire app, and because its wrapper carries
`pointer-events-none` while closed, the visible UI was inert and taps fell through to a tape nobody
could see. The phone was unusable. `npm run build` exited 0, `npm run lint` exited 0, `tsc` was
clean, and `/status` reported the correct commit.

**Why it could not be seen locally.** `next dev` uses a DIFFERENT cache
(`.next/dev/cache/turbopack`) from `next build` (`.next/cache/turbopack`). A dev server on :3002 can
never show this, and it showed a perfect page throughout.

**The mechanism, read from the installed package rather than remembered.**
`experimental.turbopackFileSystemCacheForBuild` is declared at
`node_modules/next/dist/server/config-shared.d.ts:732` and appears in the resolved defaults at
`:1812` as `true`. Next's own docs date that default: *"v16.3.0 - FileSystem caching is enabled by
default for builds."* This project pins 16.3.0, so it adopted the behaviour the week it shipped.
Vercel restores `.next/cache` between deployments, which makes that cache the one input to a
production build that is not the source tree, and the only difference between Vercel's build and a
clean local one.

**What is NOT claimed.** A two-commit warm-cache rebuild was run in an isolated worktree - build
`6ec8494` cold, then `0849edc` against that warm cache - and it did **not** reproduce the fault.
Both builds were correct. So the precise invalidation path is unproven. That is an argument for
removing the cache, not for keeping it: an experimental cache that cannot be shown to be wrong on
demand, and cannot be shown to be right either, does not belong between the source and what a
trader loads. A third-party blog claiming the flag is opt-in is wrong; the installed package and the
official docs agree that it defaults on.

**The two rules that came out of it.**

1. `experimental.turbopackFileSystemCacheForBuild: false` in `next.config.ts`. The build is
   deterministic or it is not trustworthy, and this app builds cold in about two minutes.
2. `scripts/verify-css.mjs` runs as the second half of `npm run build`. It derives the required set
   from `globals.css` itself - every unconditional top-level class rule with a real body, plus every
   custom property those rules read - and fails the build if any is absent from the emitted CSS. A
   hand-maintained list would have gone stale; this one extends itself the moment a rule is added.
   Verified both ways before it was trusted: it PASSES the known-good build and FAILS the actual
   production stylesheet, naming all 8 missing classes and 3 missing tokens.

**Its own first version was wrong, which is worth recording.** The scan skipped comments as it
walked and captured each rule's selector as everything since the previous `}` - which, for a rule
preceded by a comment block, is the comment. This stylesheet documents nearly every rule it
declares, so the check silently covered 19 classes out of 40, and `.sheet-transition` - the exact
rule it exists to protect - was one it missed. It reported success. A check that under-reports is
worse than no check, so comments are stripped before the scan now.

**The third rule, and the one that was hiding in plain sight.** An audit of every overlay found that
the codebase ALREADY had the right convention and `.sheet-transition` was the only thing breaking
it. `.drawer-transition` and `.panel-transition` name only `transition` and `transition-property`,
and leave the displacing to a Tailwind utility at the call site (`max-md:-translate-x-full`,
`translate-x-full`). `.sheet-transition` carried `translate: 0 100%` for the dismissed state, so the
one thing holding a full-screen panel off the screen lived in a hand-written rule. That is why the
sidebar, the summary rail, the trade drawer and every popover survived the same broken stylesheet
untouched, and this one did not.

**The class owns the TIMING. The call site owns the POSITION.** `translate-y-full` moved to
`filter-sheet.tsx`, and the rule now carries only `transition-duration`. Verified in the emitted
CSS: `.sheet-transition[data-open=false]{transition-duration:.2s}` with the position coming from
`.translate-y-full{--tw-translate-y:100%;translate:...}` in the utilities layer. If the hand-written
rule vanished now, the sheet would lose its animation and stay hidden.

`.menu-panel[data-open='false']` is the same shape one order of magnitude smaller - a popover that
would stick open over the sidebar's nav rows. It keeps its `display: none` through
`transition-behavior: allow-discrete`, which is the right mechanism, and now carries a plain
`hidden` utility alongside it. Checked rather than assumed: the exit still creates a
`CSSTransition` on `display`, and the computed value stays `block` through the exit, so
`allow-discrete` is intact.

**And the process gap that let it ship.** `FilterSheet` never entered `/kitchen-sink`, which
CLAUDE.md requires in the same commit. That is not bookkeeping: the rack is the one place a CLOSED
overlay gets rendered where someone is looking, and closed was the state that broke. It could not be
racked at all while `md:hidden` was baked into the component, because the rack runs at desktop width
and the sheet erased itself there - so the breakpoint gate moved to the call site, and the rack now
renders a permanently-closed sheet whose whole specimen is the absence of one.

### TypeScript stays on 6

7.0 ships no programmatic API, so typescript-eslint throws on import and takes `npm run lint` down
with it.

---

## Auth

### In dev, `baseURL` resolves per request from the `Host` header

It is not pinned to one port. A pinned `BETTER_AUTH_URL` breaks the moment a second dev server or
worktree takes the next port, and it breaks in the way that costs the most time: every browser POST
403s **before** the throttle hook and **before** any mail, the screen reports a generic send
failure, and retrying can never work.

`src/lib/auth.ts` uses Better Auth's `baseURL: { allowedHosts: [...], protocol: 'http' }` in dev —
its own multi-host feature, not a workaround — so sign-in works on whatever port Next actually bound
to. **Production keeps a pinned string**; a wildcard host allowlist in production is an open
redirect.

**Still invisible to curl either way:** the origin check only runs on requests carrying a Cookie
header. Reproduce auth bugs in a browser or not at all.

### Cookies ignore the PORT, so two local builds share one jar

`localhost:3000` and `localhost:3002` are the same host to a browser. With Better Auth's default
cookie name on both, `run-trading@v2` and this build were writing the same key — signing into either
**silently signed you out of the other**, on the real browser, repeatedly.

The shared `BETTER_AUTH_SECRET` is what made it baffling rather than obvious: the foreign cookie's
signature *validates*, so it is not rejected as forged; it just resolves to a session id that lives
only in the other build's database.

`advanced: { cookiePrefix: 'run-rebuild' }` in `src/lib/auth.ts` is the fix, and it is one-sided —
v2 keeps the default.

### An emailed code, not a magic link

A link signs in whichever device opens it.

### The OTP send throttle lives in the `before` hook

Not in `sendVerificationOTP`. By the send hook the plugin has already rotated the stored code, so
throttling there is a silent lockout.

### `?next=` is attacker-supplied by construction

Read it through `safeNext`. `startsWith('/')` is NOT enough: `//evil.example` is protocol-relative
and leaves the origin while reading as a path.

---

## Design system

The full set, with the measurement or the bug behind each rule, is
[`docs/design-system.md`](design-system.md) and `modryn-hq@v4:playbooks/design-rules.md`. The three
that bite hardest if you have not read them:

### A utility with no token behind it emits nothing

No error, no warning, no type complaint, just an unstyled element. S0 ported primitives naming
`text-accent-foreground`, `bg-elevated`, `rounded-md` and `font-heading` — none of which exist in
this stylesheet — and they rendered unstyled and typechecked clean. Lint catches it now.

### Tokens read only from inline styles or hand-written CSS need `@theme static`

Otherwise they are tree-shaken away. `--ease-in-out` measured EMPTY in both modes for exactly this
reason, while `--ease-out` survived only because the default transition happens to reference it.

### Shadow tokens must be indirect

`--shadow-card: var(--elevation-card)`, never a shadow value written straight into `@theme`.
Tailwind resolves a directly-declared shadow at BUILD time and inlines it, so a `.dark` override
does nothing and every shadow renders at its light value in dark mode. That shipped in the
boilerplate once.

### One icon set, one wrapper

`src/components/ui/icon.tsx`. Hand-drawn is the default, ported verbatim from `run-trading@v2`;
`lucide-react` is the stated fallback for the few names v2 never drew (`read`, `expand`, `warn`).
Both obey the same wrapper: `viewBox 0 0 24 24`, stroke 1.5, round cap/join.

Never inline an `<svg>`, never generate a UI icon elsewhere — **stroke weights drifted 50% across a
codebase before this rule, in two builds independently.** Lucide's own default is 24px at stroke 2,
which is why an unwrapped icon looks almost right and is not.

### The specificity trap, which has bitten three times

The `.lift-press` / `.lift-rest` rules rely on *equal specificity, source order decides*. Adding
`:not(:disabled)` to one selector and not its sibling silently breaks that: `.lift-rest:hover` is
(0,2,0) while `.lift-press:not(:disabled):hover` is (0,3,0), so a control carrying both classes gets
the wrong rule.

Found first on a disabled icon button that still lifted, then on a header control that hovered into
the chip treatment, then on an open trigger that sprang back the instant the cursor rested on it
after a click — the normal case, not an edge one. **Add a pseudo-class guard to both halves of a
pair or neither.**

---

## Tooling

### `chrome-devtools start --isolated` deletes its profile on exit

That is what the flag means: a temporary user-data-dir, cleaned up when the browser closes. Every
daemon restart is a fresh browser with no cookies, so a driven session cannot survive one. Pass
`--userDataDir <path>` instead for a persistent dedicated profile. It is still not the real Chrome
profile, so the Chrome 136+ remote-debugging block does not apply.

### The CLI's screenshot follows the FRONTED tab, not the selected one

`evaluate_script` targets the tab chosen by `select_page`; `take_screenshot` captures whatever is
fronted in the real browser window. They disagree silently, so a screenshot can show a different app
on a different port with no error — which reads as "the change did not apply" rather than "wrong
tab".

Trust `evaluate_script` for verification and treat screenshots as illustration. The daemon can also
time out with "Timeout waiting for daemon response" and recover on its own within a few seconds;
retry once. **Never run `chrome-devtools stop`.**

---

## Surfaces

### The phone fetched a trade it was already holding

`/trades/[id]` shipped as a route on 2026-08-20 for a good reason — the phone's back gesture has to
work, and an overlay owes it an answer. The presentation later became a sheet, but the mechanism
stayed a route, so the sheet lived in `[id]/layout.tsx` and could not exist until the navigation
committed.

Measured on 2026-08-25 against the dev server at 390×844, warm, three consecutive runs:

| | tap → first movement | tap → settled |
|---|---|---|
| `FilterSheet` (client state) | **34ms** | 283ms |
| its drill-in | **43ms** | ~290ms |
| the trade sheet (a route) | **305ms** | 555ms |
| the trade sheet, cold | **834ms** | 1087ms |

On **localhost, with no network**. Closing was worse: the body was fully off-screen at 183ms, but
`router.back()` did not commit until 600ms, so for **417ms** the tape sat on screen underneath a
trade-detail header still reading the contract name. That is the "weird in between screen" Luke
screenshotted, and removing the container's background had made it *more* confusing rather than
less — it stopped being a blank rectangle and became the wrong header on the right page.

**The wait bought nothing.** `TradeDetail` takes a `TapeRow`. `getTradesByIds` returns `TapeRow[]`.
`TradeDrawer` renders the identical screen on the desktop from a row already in `flat`, with no
fetch, and always has. The phone was round-tripping the server for an object in memory — including
the contract name, which `trades-tape.tsx` computes on the row itself and was painting on screen at
the moment of the tap.

So the skeleton, `[id]/loading.tsx` and the title portal were all scaffolding around a fetch that
should not have existed. They were deleted, not improved.

**The fix, and why it keeps the URL.** `window.history.pushState` writes `/trades/<id>` without
re-running the router. Next documents this ("update the browser's history stack without reloading
the page... integrate into the Next.js Router"), and it was measured before being relied on: pushing
a different **pathname** left all 60 tape rows mounted and fired **zero** network requests, and so
did the `back()` that undid it. Shareable, reload-survivable, and the tape never unmounts — which is
what makes Back cost nothing, and which also answered the "restore scroll position on return" item
in `build-plan.md` by removing the problem.

Rebuilt, same harness: **header swaps in ~60ms, body settles in ~230ms**, in a dev build.

### One `popstate`, every overlay listening

The first `useOverlayBack` closed too much: one press of the device Back button from the Date Range
screen dismissed the drill-in **and** the sheet underneath it. `popstate` is a *window* event, so
every mounted overlay hears every pop, and both listeners closed.

Each entry is tagged with a monotonic token, and `popstate` reports the entry you **landed on**, so
anything issued after it has just been discarded. `token > landed` is the test. `!==` is not enough:
with three levels open it is true for the outermost as well, and one press would collapse the stack.

Verified over 16 open/close cycles mixing in-app controls and the device button: `history.state`
returns to no-overlay every time, the URL returns to `/trades`, and four consecutive drill-in round
trips produce byte-identical state.

### `tradeTitle` was exported from a `'use client'` file

Straight into the rule CLAUDE.md already states — *every export of a `'use client'` module becomes a
client reference*. `generateMetadata` in the route called it and the page 500'd with:

> Attempted to call tradeTitle() from the server but tradeTitle is on the client.

A pure helper shared across the boundary needs a file with **no directive on it** (`lib/trades/title.ts`),
the same reason `src/lib/shell.ts` exists. Re-exporting from a client module does not launder it.
