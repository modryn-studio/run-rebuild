---
name: notify
description: >
  Scans all API routes and wires founder notifications (Gmail SMTP via notify.ts) into any
  meaningful event that doesn't have one yet. Trigger on "run notify", "audit notifications", "am I
  alerted on X", or after adding a route with a business-meaningful success or failure path.
argument-hint: "[optional: path or area to focus]"
---

<!-- Sync: your-project-native (adapted from the boilerplate's Stripe/order-flavored notify.prompt.md
     to this repo's real `notify.ts` helper). No boilerplate copy yet; promote when the boilerplate is
     rebuilt off your-project. -->

# /notify — the founder-notification audit-and-fix sweep

Scan `src/app/api/**/route.ts` and add founder notifications to any meaningful event that doesn't
already have one. Whole-codebase sweep (postcheck's instrumentation check is the diff-scoped version
and points here).

## The helper (read first, every run)

`src/lib/notify.ts`:
- `sendNotification(subject, html, opts?)` — fire-and-forget founder alert over Gmail SMTP to
  `FEEDBACK_TO`. Never throws. Pass `{ throttleKey, cooldownMinutes }` for anything that can repeat.
- `notifyHtml(title, rows)` — the one alert template; `rows` is `[label, value][]`.
- `alertSubject(emoji, summary)` — `` emoji [site.name] summary `` (reads `site.name` from
  `src/config/site.ts`). Founder-alert emoji is fine here; it is NOT product UI, so the no-emoji-in-UI
  rule doesn't apply.

Founder alerts are the early-warning system: the point is to know a real user did the thing the
product exists for, or that a write silently broke, WITHOUT opening Neon.

## Step 1: Audit routes

List `src/app/api/**/route.ts`. For each handler, find the meaningful events.

**Always notify:**
- **The first real instance of the product's core action for a given user** — whatever this app
  exists to let someone do, the first time they do it. Guard so it fires once per user, not every time.
- **A reconciliation or integrity MISMATCH** — any write that sums, pairs, or reconciles two sources
  where a mismatch means the underlying math is wrong: `🚨 [site.name] Reconciliation MISMATCH`, manual.
- **An external integration connecting** — an OAuth callback or webhook succeeding for the first time
  on an account. A live token or connection now exists.
- **Post-write failure needing manual action** — anything failing after data already landed:
  `🚨 [site.name] MANUAL ACTION REQUIRED`.

(Signup alerts already fire from `auth.ts`'s user-create hook, not a route — confirm, don't dupe.)

**Skip — do not notify:**
- `GET` reads · polling / `202` responses (would flood) · validation `400`s (already `log.warn`) ·
  auth `401`/`403` · `/api/track`.

## Step 2: Add missing notifications, following the existing pattern exactly

Prefer `after()` from `next/server` so the alert never delays the response:

```ts
import { after } from 'next/server';
import { sendNotification, notifyHtml, alertSubject } from '@/lib/notify';

after(() =>
  sendNotification(
    alertSubject('📈', 'First <action> — user connected'),
    notifyHtml('First <action>', [
      ['User ID', userId],
      ['Detail', String(detail)],
    ]),
    { throttleKey: `first-action:${userId}`, cooldownMinutes: 'once' }
  )
);
```

For synchronous failure paths where `after()` isn't right, `void sendNotification(...)` before the
error response. Always include the primary id for lookup (user, account) and, on failure,
`['Error', String(err)]` + `['Action', 'Manual ... required']`. No free user text in rows.

## Step 3: Validate + report

`tsc` on every touched file, fix type errors. Report each route modified with its event + subject
line, and each route skipped with why. Commit only when asked.
