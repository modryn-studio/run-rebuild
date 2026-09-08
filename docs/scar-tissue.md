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

### A function cannot be a prop from a Server Component, and nothing catches it but a request

`/today` 500'd on every request in production, hours after shipping green. `MonthCalendar` is
`'use client'` and took `href: (month: string) => string` from `today/page.tsx`, a Server Component,
so that the page could own the URL shape and the account scope could not drift between two surfaces.
The intent was right. A function is not serialisable across the RSC edge, so the render threw before
anything drew.

**Three gates were green and none of them could have been anything else.** `tsc` sees an honest prop
type and no boundary at all. `npm run build` compiles every route and passes: RSC serialisation
fails at REQUEST time, so a page that never renders during the build never fails during it.
`/kitchen-sink` racked the card in every state and passed, because the rack is itself a
`'use client'` module — client-to-client never exercises the edge the shipped page uses.

**Pass data, never behaviour.** The fix sends `scope: string[]` — the ids the header band had already
written into the URL — and the client builds its own href. Same guarantee, nothing on the wire but
strings.

**The rule the incident is really about:** *a page behind auth is not verified until it has been
loaded behind auth.* Every other surface built that day was checked in a browser; this one was
checked in a type system, and the summary said so without drawing the conclusion. The logged-in
`chrome-devtools` profile exists for exactly this (`driving-chrome.md`), and it found the fix
correct in one call.

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

### Monarch's phone reference is the NATIVE APP, and `app.monarch.com` narrowed is not it

**2026-09-04.** A session driving `app.monarch.com/transactions` for the tape's account-cell work
resized the viewport to 390px to find out what the reference does on a phone, and wrote the answer
into a code comment: *"there is no phone layout there to copy — the table horizontally scrolls, the
row is clipped mid-cell, the account collapses to a 20px disc under our own 22px `ICON_TOUCH`
floor."*

Every one of those observations is accurate about the web app at 390px, and every one of them is
irrelevant. **That surface is a desktop table squeezed, not a designed phone screen.** Monarch's
considered phone product is a native app, which the browser cannot reach at all. Luke supplies it as
screenshots, and has been supplying it since `S5d` — which is why roughly fifteen comments across
this codebase already say "the reference's mobile row/screen/drawer/list" and mean the app.

**The failure is not that the reading was wrong. It is that a wrong-surface reading was written down
in the same voice as a right-surface one**, in a comment a later session would have followed. Two
sources, one name, and nothing in the text to tell them apart.

What made it costly rather than merely untidy: the session used it as one of three legs holding up a
decision (keep the tape's whole-row tap rather than copying Monarch's chevron-only). The leg was
load-bearing for the PHONE half of that decision, and it was rotten. The honest evidence was already
in the repo, from the right source, and said the same thing more strongly:

- `build-plan.md` §S5d, from Luke's screenshots: the app's transaction row is **one line — category
  emoji, merchant, amount** — and **"Tap a row → full screen, animated up from the bottom."**
- `trades-tape.tsx` §S5d, 2026-08-20: *"The reference's mobile row has no chevron: the whole row is
  the target and a tap is the affordance."*

So the app's row is a whole-row tap with no chevron, and it carries **no account cell at all** — the
same two facts the squeezed web view had obscured. Run's phone row already matched both, by
decisions taken in August against the correct source.

**The rule:** desktop web is fair game and is where every measured number in the design system came
from. Below `md`, ask Luke for the screenshot. Never narrow the browser and call the result the
reference.

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

### A modal nested inside the card it covers, and an exit animation nobody switched on

**#35, filed by the 2026-08-28 postcheck, fixed 2026-08-31.** Two facts about one shell, and both
had shipped working.

**THE NESTING.** `label-account-form.tsx` returns `<>{screen}{confirmations}</>`, and
`label-account-modal.tsx` wraps that whole thing in `ModalShell`'s card - so `Close this account?`
rendered INSIDE the editor it sits on top of. Its own comment claimed *"`z-[70]` OVER THE EDIT
MODAL'S `z-[60]`"*, which was never what was happening: nested inside that stacking context, it won
by DOM order instead.

**It worked, and that is the dangerous part.** `position: fixed` escapes an `overflow: hidden`
ancestor, so the confirmation drew correctly - right up until the day something puts a `transform`,
`filter` or `contain` on `cardSurface`. Any one of those makes the card a containing block for fixed
descendants and clips the confirmation to the card it is supposed to cover. Two other files had
already been moved to avoid exactly this, which is how it got noticed at all.

**A portal settles it rather than a rule nobody can see.** `ModalShell` renders into `document.body`,
so every modal is a direct child of it, `z-index` means what the comments always said, and nesting
one shell inside another stops being something a call site can do by accident. Verified on the
running app: `confirmDirectChildOfBody: true`, `nestedInEditor: false`.

**THE EXIT NOBODY SWITCHED ON.** `closing` was declared on `AddAccountModal`, threaded through to
`ModalShell`, and left `undefined` by every caller - `account-modals.tsx` renders
`{adding && <AddAccountModal onClose={...} />}` and `import-trades-modal.tsx` forwards without it.
So the mechanism was built, wired, documented at length, and dead: `Add account` vanished in one
frame while the editor beside it faded.

The fix was to stop expecting a call site to remember. `AddAccountModal` owns `useModalClose` itself,
the way `LabelAccountModal` already did. Sampled frame by frame afterwards: opacity 1 at 8ms, 0.79 at
39, 0.48 at 89, 0.17 at 139, unmounted by 190.

**The rule: a prop that every call site must remember to pass is a prop that will be forgotten.** If
a behaviour belongs to a component, the component owns the state for it - a flag threaded in from
outside only documents an intention.

### Three overlays, three copies of the same shell, and only one of them animated

**2026-08-31, Luke: "i need consistency! ... the scrim animation is not the same as the /account
page. for example the 'add account' modal scrim animation in and out."**

He noticed it on `/today`, and the cause was two files back. `ModalShell` had the whole treatment -
scrim fading in over 300ms, the WHOLE overlay fading out over 160ms, Escape, a body-scroll lock, and
a backdrop click that has to have STARTED outside the card. `ConfirmShell` had reimplemented the
same idea and carried none of it: a bare scrim with no transition, `pop-in-center` on entry, **no
exit at all**, no Escape, no lock. `daily-recap.tsx` then hand-rolled a THIRD one, worse again -
nothing on either path, and no slide on a phone.

So `Add account` faded both ways, `Close this account?` appeared and vanished in a frame three feet
away, and the newest surface in the product matched neither.

**The distance between the two files was three optional props.** `role`, `labelledBy` and `width` -
every default being what the eleven existing callers already got. `ConfirmShell` now renders
`ModalShell` instead of a copy of it, and the recap renders `ConfirmShell`. Measured after: the
ending confirmation reports `alertdialog`, 448px, `z-70`, scrim 0.3s, exit 0.16s - the last two of
which it had never had.

**The rule: a second copy of a shell is not a component, it is a fork.** It will always be the copy
that is missing the Escape handler, because the copy was made for the layout and the layout is the
part you can see. Three props are cheaper than three shells, and the test is not "does it look the
same" but "does it arrive and leave the same way".

### An overlay that mounts with `open` already true pushes twice and backs once

**2026-08-31, Luke: "when i close the daily recap modal, it routes me to /accounts."** Reproduced,
then instrumented rather than reasoned about - `history.pushState` and `history.back` monkey-patched
on the running page, counting calls.

**Opening the overlay, before a single close: `pushes: 2, backs: 1`.**

React StrictMode double-invokes effects on MOUNT in development, and Next 16 turns it on by default.
The sequence is setup, cleanup, setup - so an overlay whose flag is ALREADY `true` at mount runs
`useOverlayBack`'s body three times over: push, `history.back()`, push. And `history.back()` is
async, so the spurious pop lands after the second push and leaves the stack one entry out of step.
The close's own `back()` then pops one too far: off `/today`, onto whatever the trader was on before
it.

**Every other overlay in the product was already safe, by accident of shape rather than by rule.**
The sheets and the summary rail all pass a flag that starts `false` - `open`, `!collapsed && phone`,
`open && depth >= 1` - so the double-invoke happens while the effect is early-returning and pushes
nothing. `useOverlayBack(true, ...)` was the only literal in the codebase, and it was written that
way because the overlay is conditionally MOUNTED, which felt like the same thing. It is not.

**The fix is one frame.** The overlay arms itself in a `requestAnimationFrame` and passes that flag
instead, so StrictMode's cancelled frame never fires and the real one arms once. Measured after:
`pushes: 1, backs: 0` on open, and the close lands on `/today`.

**The rule: an overlay is armed by a state change, never by its own mount.** A production build does
not double-invoke, so this class of bug is invisible until someone runs the app the way it is
actually developed - which is every day.

### Chrome throws away a history entry pushed inside a `popstate` handler

**2026-08-29, Luke, on a real phone:** *"while deep in the filters screen on mobile, i click the back
button on my phone and it minimizes the entire chrome app. it should actually close out the filters
menu."*

Nothing in our code was wrong by inspection, which is why this is here. Chromium's **history
manipulation intervention**:

> If a history entry is added but there is no user gesture by the time the user hits back, the page
> adding the history entry will be skipped and the popstate event will not fire.

The sheet had just been changed to own ONE entry, re-armed inside its own pop handler. A pop is the
browser's gesture, not the document's - so every re-armed entry was created with no gesture behind
it, Chrome marked it skippable, and the next Back walked straight past it **without firing
`popstate`**. On a tab whose oldest entry is the app, past it is out of the app.

**So depth is one registration per LEVEL again, each entry pushed by the tap that opened its level.**
That was the original shape, and it was unsafe for two reasons that are both fixed underneath it
now: `markReplacing` stops a commit from taking its entry back, and the module declares the pops it
causes itself so the level underneath does not answer one. The re-arm survives for exactly one case -
a press SPENT while a write is in flight, where there is no tap to hang an entry on - and that entry
is knowingly skippable.

**The general rule: a history entry needs a user gesture behind it, or the browser is entitled to
decide it never happened.** Anything that pushes from a timer, an effect with no interaction in its
causal chain, or a `popstate` handler is building on an entry that may not be there.

[Chromium docs](https://chromium.googlesource.com/chromium/src/+/main/docs/history_manipulation_intervention.md)

### An overlay's own `history.back()`, answered by the overlay underneath it

**2026-08-28, postcheck, and it is the cause behind "the back button isn't working correctly with all
the pages" on a phone.**

`live` orders the overlays correctly for a pop the OS starts: listeners fire in registration order,
and the innermost token is still last when they run, so only the innermost answers. It could not
order the pop an overlay causes when it dismisses **itself**. The cleanup drops its own token FIRST
and only then calls `history.back()`, whose `popstate` arrives a task later - by which time the OUTER
overlay's token is last, its listener is still registered, and its guard passes.

What that looked like: open Edit on an account, tap **Close account**, tap **Cancel**. The
confirmation consumed its own entry, and the editor underneath heard the pop and closed too, taking
with it the Reopen button its own copy had just promised. On the SUCCESSFUL close it was worse, since
that path exists to leave the form open showing what was written. Entry A was also never consumed, so
the next real Back press did nothing visible.

**The module announces its own pops.** `selfBacks` is raised immediately before `history.back()` and
spent by the first listener to see the event, which marks the EVENT so every later listener agrees
about the same pop rather than each racing a counter. The guard is registered from the first
`useOverlayBack` effect, so nothing this module adds can run before it.

It cannot strand a count: the only `back()` is guarded by `location.href === pushedHref`, which means
our entry is the current one, so there is always an entry to pop and always a `popstate` to spend the
raise on.

**The general rule: a mechanism that orders LISTENERS still has to say which EVENTS are its own.**

### Clear all was detected, and detection cannot tell two gestures apart

**2026-08-28, postcheck.** The phone filter sheet's owner decided whether `Clear all` had been pressed
by testing the committed draft for emptiness on every axis (`isNothing`). That is also the state of a
trader who has only searched - so `/trades?q=tradeify` -> filter mark -> **Apply** deleted the search
term and widened the tape. Pressing a button labelled Apply lost the only narrowing they had.

The predicate had already been patched once, when two new axes were added and a real "clear
everything" started looking like an ordinary apply. That patch was correct and the shape was still
wrong: every axis added to the product was one more line to remember here, and no amount of
remembering fixes two gestures producing one draft.

`Clear all` now says so - one boolean, passed with the commit. **Never infer which control was
pressed from the state it produced.**

### A CHECK the UI could reach, and no question in front of it

**2026-08-28, on Luke's own corpus, in production.** A CLOSED sim-funded account, relabelled to
Evaluation and given a new firm and size. The type row offered Evaluation, Save sent
`accountType: 'evaluation'` on its own, and Postgres refused:

```
new row for relation "account" violates check constraint "account_type_status_check"
  Failing row contains (..., evaluation, ..., closed, ...)
```

**The refusal was correct.** `account_type_status_check` (`drizzle/0013`) pairs the two columns: an
evaluation is `passed` or `failed`, a sim-funded account is `failed` or `closed`, a personal one only
`closed`. `evaluation + closed` is not a state that means anything, and the constraint exists
precisely because v2 left this pairing to its UI and accepted incoherent rows.

**What was wrong was everything in front of it.** The route caught the `NeonDbError` in its generic
`catch` and answered 500 with "Could not save the account". The editor showed that sentence under
the Save button and offered nothing else. So a legitimate data rule arrived as a fault, on a screen
with no way forward: the trader could not save, and could not tell whether the fault was theirs.

Two facts had to move together and only one of them was on screen. The other one already had a
question written for it - `close-account-modal.tsx` asks "How did it end?" and offers the endings
that fit the type - but that question was only ever asked on the way IN to an ending, never when a
type change stranded one.

**The fix, in three parts.**

1. `ACCOUNT_ENDINGS` in `lib/prop-firms.ts` is the CHECK restated in the vocabulary layer, and
   `close-account-modal.tsx` now reads it instead of holding its own copy. Two copies of "a
   sim-funded account is failed or closed" is how one of them eventually offers an ending the
   database refuses.
2. The editor asks, on Save, in a modal of its own (`ending-modal.tsx`), and the write carries both
   columns. Relabelling anything as Personal has exactly one possible ending, so that one is taken
   rather than asked for and no modal opens - a list of one is not a choice.

   **It shipped for one commit as a block at the bottom of the editor, and that was wrong twice.**
   Luke, 2026-08-28: *"i think that was lazy. for an open eval, when user goes into the edit modal
   and selects 'close', a second modal opens with the question. that is better."* He is describing a
   shape v2 had already settled and written down: a question that INTERRUPTS, gets one answer, and
   hands control back to the form underneath. Growing a section at the foot of the Actions list put
   a question the trader had not asked for below two rows about things they had.

   The one way it differs from its sibling: **it does not write.** Close is a moment of intent, so
   it commits on confirm. Nothing is ending here - a label is being corrected - so the correction
   belongs to the same Save as the type that forced it. v2 states the rule for its own form: "Every
   value on this screen goes in one request, `status` included. One commit point, no races."

   **And the explanation under the question had to go.** It read *"An evaluation is passed or
   failed. This one is closed."* Luke, 2026-08-28: *"this is unnecessary copy... a eval can be
   closed in sense, right? closed as passed or failed. we dont need to harp on the user about what
   closed means... The user doesn't care what the backend considers as closed."* He is right, and it
   is v2's OWN scar re-earned one level up - v2 removed the sub-copy under these same options on
   2026-07-31 with the note "teaching a trader their own vocabulary back to them". `passed`,
   `failed` and `closed` are storage tokens. An evaluation IS closed, in the only sense a trader
   means it. The question is the whole screen.
3. The route checks the pair before writing and answers **409 with a sentence** rather than a 500.
   It reads the row to do it, because either half may be absent from the body. That read also moves
   the 404 earlier, which is strictly better. The sentence names no status token, for the reason
   above: it is a backstop for a client that did not ask, not a lecture.

**The general rule, and it is why this is here rather than in a commit message: a constraint can
only REFUSE, and it refuses in the shape of a driver error.** Every CHECK that a UI can reach needs
a question in front of it, or its correctness shows up as a 500 on the screen furthest from it.

**THE FUNDED ACCOUNT'S TWO WORDS TOOK THREE GOES**, and the research is worth keeping because this
is the kind of decision that gets re-litigated by whoever reads the table next.

v2 offers "Ended in good standing" / "Blown". This build ported it, and Luke refused it (2026-08-28):
*"i am not okay with the copy of Ended in good standing and blown. absolutely not... we dont use that
copy."* His candidates were `failed yes/no`, `failed/deactivated`, `failed/closed`.

**`Deactivated` is out, and the firms are why.** FundedNext's own help centre: a funded account is
`Active`, `Inactive` or `Breached`, and *"Once breached, the account will be deactivated"* -
deactivation is downstream of BOTH endings. My Funded Futures **breaches** an account for inactivity
(no trade in 7 days), so on the firm whose accounts are in this corpus the two words name one event.
A label that cannot tell the two endings apart has no job on a screen whose only job is telling them
apart.

**So the split is the only one that is real: it broke a rule, or it did not.** Everything else a
funded account does - retired, stopped paying the fee, payouts finished, promoted to live - is the
second one, and naming any of them is inventing a story out of a token. Luke: *"hardly anyone gets to
a point of a sim funded account closed for anything other than failing."*

**`Ended` / `Failed`**, and `Failed` is LAST in both lists on purpose: the same word in the same
position whichever kind of account is being closed, so the second row means one thing across the
product. The cost, stated when the choice was made and accepted: "Ended" is true of the failed one
too, so the pair leans on the reader to take it as "just ended". Two words that lean on their
neighbour beat two words that invent a reason.

Sources: [FundedNext, Active / Inactive / Breached](https://help.fundednext.com/en/articles/8394166-what-do-active-inactive-and-breached-accounts-mean-in-the-fundednext-dashboard) ·
[My Funded Futures, inactivity rule](https://help.myfundedfutures.com/en/articles/11972075-inactivity-rule)

**WHAT v2 DOES, reviewed 2026-08-28 at Luke's request.** It never hits this, and the reason is not
one to copy: v2 has three statuses (`active | passed | failed`) and no CHECK pairing them with the
phase, so `evaluation` and `sim_funded` both take passed/failed and nothing can disagree. A personal
account that ended is stored `failed` and DISPLAYED as "Closed" - the derived label
`architecture.md` §status calls a bug, and the reason this build carries a fourth value. So v2 buys
its silence with incoherent data. What IS worth taking from it is the shape of the question (a
second modal, not a screen), the single commit point, and the copy discipline under the options.

### `tradeTitle` was exported from a `'use client'` file

Straight into the rule CLAUDE.md already states — *every export of a `'use client'` module becomes a
client reference*. `generateMetadata` in the route called it and the page 500'd with:

> Attempted to call tradeTitle() from the server but tradeTitle is on the client.

A pure helper shared across the boundary needs a file with **no directive on it** (`lib/trades/title.ts`),
the same reason `src/lib/shell.ts` exists. Re-exporting from a client module does not launder it.
