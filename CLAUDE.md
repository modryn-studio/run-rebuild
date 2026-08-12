## Starting a new project from this

1. Copy the folder (or `git clone` then reset history). Rename in `package.json` and `README.md`.
2. Fill in `src/config/site.ts` — name + description feed layout metadata, emails, the login page.
3. `cp .env.local.example .env.local` and fill it. Required, and the app will not boot without
   them: `ANTHROPIC_API_KEY`, `DATABASE_URL`, `BETTER_AUTH_SECRET`. Also fill
   `REPLICATE_API_TOKEN` locally — it generates media, it does not serve it, so it belongs on
   your machine and not on the deploy.
4. **Lock the design system before the first component.** Recolor the `@theme` tokens in
   `src/app/globals.css`, choose a real display face and point `--font-heading` at it, then build
   the `ui/` primitives with all five states — against `modryn-hq@v3:playbooks/design-system.md`.
   Improvising structure per-component is why UI comes out as slop; front-load it here.
5. `npm install`, then `npx drizzle-kit generate` + `migrate` (see the migration rule below).
6. `npm run dev`.
7. Rewrite this file for the project.

**Strip what you don't need.** Nothing here is load-bearing on anything else, so delete freely:
`src/app/admin/` + `require-admin.ts` (no admin surface) · `analytics.ts` + `track.ts` +
`/api/track` + `analytics_event` (no funnel) · `lib/ai.ts` + the
AI SDK deps (not an AI product). Deleting is cheaper than carrying a half-wired subsystem.

**What is deliberately NOT here**, because it is a per-product decision rather than a default:
anonymous sessions (see the note at the top of `src/lib/auth.ts`), an app shell, a component
library beyond the five primitives, and a worker process. Add them when a build asks for them.

---

## Operating Rules

- **This file is owned like code. Keep it under ~200 lines.** If a rule stops being true, change it
  in the same commit as the code that made it false.

---

## Scar Tissue — things that cost real time to learn

These are not style preferences. Each one is a bug that shipped or a session that got burned.

- **DB scripts need BOTH flags.** `tsx --env-file=.env.local --conditions=react-server`. The first
  loads `DATABASE_URL`; the second gets past the `server-only` guard in `lib/env.ts`. Missing either
  fails in a way that does not name the cause.
- **Migrations: `drizzle-kit generate` + `migrate`, NEVER `push`.** `push` records nothing, and one
  push makes `migrate` skip older migrations forever, silently, exit 0. There is no warning and no
  easy repair.
- **A `'use client'` file may import TYPES from a db-backed module, never VALUES.** Those modules
  reach `@/lib/db` → `@/lib/env` → `server-only`, so one label map or constant pulled into a client
  file ships the secret schema to the browser and fails the build. `import type` is erased and always
  safe. This bit three times in one week — the fix is a leaf module with no db behind it, or keeping
  the constant in the component.
- **Every export of a `'use client'` module becomes a client reference** when a Server Component
  imports it, so a plain string arrives as an opaque object and `clsx` drops it — silently, no error,
  no type complaint. Shared constants live in a plain module with no `'use client'` at its top, and
  re-exporting them from the client file does NOT launder them.
- **Better Auth rejects any origin that is not `BETTER_AUTH_URL`.** That URL is pinned to :3000, but
  Next picks :3001, :3002, ... the moment 3000 is taken — any second dev server, any worktree. Every
  browser POST then 403s with `Invalid origin` before the throttle hook and before any mail, while
  the login screen reports a generic send failure, so retrying can never work. `trustedOrigins`
  carries `http://localhost:*` in development for exactly this. **And it is invisible to curl:** the
  origin check only runs on requests carrying a Cookie header, so a bare probe sails through to a
  different error. Reproduce auth bugs in a browser or not at all.
- **Next.js 16 is not the Next.js in your training data.** Read the version-matched docs in
  `node_modules/next/dist/docs/` before writing framework code. `next dev` maintains that pointer in
  `AGENTS.md` — that file exists solely so Next writes its managed block there instead of into this one.
- **TypeScript stays on 6.** 7.0 ships no programmatic API, so typescript-eslint throws on import and
  takes `npm run lint` down with it. Measured on a real repo the native compiler was ~9% faster, not
  10x, because the check is I/O-bound. Revisit when typescript-eslint actually supports it.
- **Tailwind v4 has no config file.** `@theme` tokens in `src/app/globals.css` — never `:root`, never
  `tailwind.config.*`.
- **One icon set, one size per context.** Icons come from `lucide-react`. **Never inline an `<svg>`
  in a component**, and never generate a UI icon. Stroke weights drifted 50% across a codebase before
  this rule existed. (The two `<svg>`s that remain — the Google mark and the spinner — are brand and
  motion, not UI icons.)
- **API routes use `createRouteLogger`** from `@/lib/route-logger` — never raw `console.log`.
- **Env vars go in `src/lib/env.ts`** (zod, fail-fast) or they fail at request time instead of boot.
- **An emailed code, not a magic link.** A link signs in whichever device OPENS it, so requesting it
  at the desk and tapping it on the phone signs the phone in and leaves the desk waiting. Gmail's
  in-app browser fails the same way.
- **The OTP send throttle lives in the `before` hook, not in `sendVerificationOTP`.** By the time the
  send hook runs, the plugin has already rotated the stored code — throttling there kills the code
  the user is holding and sends no replacement. Silent lockout. See `src/lib/auth.ts`.
- **`?next=` is attacker-supplied by construction.** Always read it through `safeNext`
  (`lib/next-path.ts`). `startsWith('/')` is NOT enough — `//evil.example` and `/\evil.example` are
  protocol-relative and leave the origin while reading as a path.
- **No em dashes in user-facing copy** (headlines, subtitles, button labels, any UI text). Comma,
  colon, parentheses, or a plain hyphen. Code comments and docs are exempt.
- **The app never names itself to the person using it.** "Every file stays in Acme" is the app
  describing someone else. Use *you / your*, or first-person *we*, or nothing. Marketing surfaces are
  the exception — a FAQ answering "What is Acme?" has to name it.

---

## Stack

Next.js 16.3 (App Router) · React 19 (React Compiler on) · TypeScript 6 · Tailwind v4 ·
Vercel AI SDK v7 · Neon + Drizzle · Better Auth (emailed code + Google) · nodemailer (Gmail SMTP) ·
Vercel Analytics · lucide-react.

```
src/app/            App Router pages, layouts, route handlers (admin/, api/auth/, api/track/, login/)
src/components/ui/  five primitives — button, input, textarea, theme-toggle, code-input (+ spinner)
src/components/views/auth/  the login screen
src/config/site.ts  name + description; single source of truth
src/lib/            auth · db · env · route-logger · notify · track · analytics · cn · next-path · ai
scripts/            email-preview (renders the mail templates), load-env, funnel.sql
```

## Conventions

- **Code style:** senior-engineer minimalism — small surface, obvious naming, no premature
  abstraction, comments explain WHY, early returns for errors. One file, one responsibility.
- **Both modes, always.** Light + dark with a persisting toggle ship out of the box —
  `ThemeProvider` + `ThemeToggle` are wired into the root layout (no `next-themes`; it's unmaintained
  with open React 19/Next 16 bugs). Recolor the `.dark` block in `globals.css` per brand.
- **Adding an analytics event = three changes in ONE commit:** `src/lib/analytics.ts`,
  `ALLOWED_EVENTS` in `src/app/api/track/route.ts`, and a query in `scripts/funnel.sql`. An event
  tracked but never queried is noise; a funnel query with no event behind it is a lie.
- **`src/app/layout.tsx` sets `robots: { index: false }`.** Remove it when the project genuinely
  goes public — not before.
- **UI bar:** build *to* `modryn-hq@v3:playbooks/design-system.md`. Never ship a framework-default font
  as the brand face, violet gradient CTAs, gradient text, glow blobs, glassmorphism, pill-everything,
  or emoji as UI. If it looks like default LLM output, it's rejected.
- **Generative UI** (AI SDK v7 `streamText` + tools + `message.parts`): `modryn-hq@v3:playbooks/generative-ui.md`.
