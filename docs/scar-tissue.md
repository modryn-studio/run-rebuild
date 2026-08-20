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
