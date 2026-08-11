# Run

A trading journal for futures traders. Your record, reconciled against your broker, and one
pattern a day with what it costs you.

Built from `modryn-base` via the Modryn web-app blueprint. Next.js 16 · React 19 · TypeScript 6 ·
Tailwind v4 · Neon + Drizzle · Better Auth.

## The docs are the spec

`docs/` is not background reading. It is the phase 1–5 artifact set, and `spec.md` and
`architecture.md` are **locked** — if the code and those files disagree, one of them is a bug,
and the file gets updated first.

| File | What it settles |
|---|---|
| [`docs/problem-brief.md`](docs/problem-brief.md) | The problem, the audience, and the kill signal |
| [`docs/spec.md`](docs/spec.md) | What v1 is. Stories, acceptance criteria, NOT IN V1 |
| [`docs/wireframes.md`](docs/wireframes.md) | All five screens, structure only |
| [`docs/design-system.md`](docs/design-system.md) | Every visual decision, with its measurement |
| [`docs/architecture.md`](docs/architecture.md) | Where every piece of state lives, and why |
| [`docs/build-plan.md`](docs/build-plan.md) | The slice order, and the definition of done |
| [`docs/blueprint-instrumentation.md`](docs/blueprint-instrumentation.md) | The open questions, the friction log, the retro |

## Start

```bash
cp .env.local.example .env.local   # all four required keys, see CLAUDE.md
npm install
npx drizzle-kit generate && npx drizzle-kit migrate
npm run dev
```

`CLAUDE.md` carries the scar tissue: the flags DB scripts need, why `drizzle-kit push` is banned,
and what a `'use client'` module does to a shared constant.
