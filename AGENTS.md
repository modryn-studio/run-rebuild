# modryn-base — agent notes

The doctrine for this repo lives in `CLAUDE.md`. Read that first; it is hand-owned and it is the
source of truth for how to build here.

This file exists for one mechanical reason: `next dev` writes a managed agent-rules block on every
start, and it targets `AGENTS.md` when that file exists and `CLAUDE.md` when it does not (see
`node_modules/next/dist/server/lib/generate-agent-files.js`). Without this file, Next.js edits the
doctrine file on every dev-server boot. Keep this file present so that block lands here instead.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
