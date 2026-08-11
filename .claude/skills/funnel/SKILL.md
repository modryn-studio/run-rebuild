---
name: funnel
description: >
  Runs the product-analytics funnel against the live Neon DB and surfaces conversion anomalies -
  event counts by day, the signup funnel, sign-in method split, session sequences. Read-only.
  Trigger on "run funnel", "funnel health", "how's the funnel", "any traffic".
argument-hint: "[optional: number of days, default all-time]"
---

<!-- Sync: your-project-native (adapted from the boilerplate's generic funnel.prompt.md to this repo's
     real analytics_event queries + neon MCP). No boilerplate copy yet; promote when the boilerplate
     is rebuilt off your-project. -->

# /funnel — the live funnel health check

Read-only reporting: pull live data from Neon, format it, flag what's worth acting on. This is the
ad-hoc query companion to the persistent `/admin` dashboard, over the same `analytics_event` data.

## Step 1: Read the two source-of-truth lists

- `src/app/api/track/route.ts` — `ALLOWED_EVENTS` (which client events can even land).
- `scripts/funnel.sql` — the query set. Table is `analytics_event`.

## Step 2: Run each query against live Neon

Run each block in `scripts/funnel.sql` via the neon MCP (`mcp__neon__run_sql`), against this
project's database. Look up the project id with `mcp__neon__list_projects` if it isn't already known
in the conversation — never hardcode one from memory or an old run. The queries are standalone.
Present results as clean tables.

The queries, and what each answers:
- **Event counts by day** — traffic spikes and dead days.
- **The signup funnel** — saw_login → started → signed_up, with completion %. Extend this with the
  product's own steps as events are added (see `/track`) — the point is the first step where people
  stop, not the total.
- **Where signup dies** — started but never completed. If this list is long, the problem is in the
  auth screen, not in acquisition.
- **Sign-in method** — google vs email code split.
- **One visitor's whole session, in order** — the single most useful query here when something looks
  wrong. A funnel tells you where people stop; a sequence tells you why.
- **Sessions per visitor** — return visits.
- **Bot check** — run before trusting any number above; a crawler hitting one route repeatedly will
  quietly wreck the top of the funnel.

## Step 3: Flag anomalies ("Worth acting on")

- **Zero events in 24h** — no traffic, or the pipeline broke. Check `/api/track` deploys and
  `analytics_event` exists.
- **A funnel step reads zero while an earlier step doesn't** — either the screen isn't instrumented
  yet, or the step is broken. Cross-check against which events actually fire (some server events in
  `funnel.sql` may not be wired at their call sites yet - run `/track` to reconcile).
- **Signup completion below expectation** — call it out, point at where in the flow it leaks.
- If everything's healthy, say so in one line.

## Step 4 (only if asked): how to add a new event

Point at `/track` - it makes the three-file change (call site + `ALLOWED_EVENTS` + `funnel.sql`)
that keeps this report honest. Don't hand-edit one file here.

Read-only skill: never writes to the DB, never commits.
