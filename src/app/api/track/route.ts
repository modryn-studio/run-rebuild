import { after } from 'next/server';
import { createRouteLogger } from '@/lib/route-logger';
import { auth } from '@/lib/auth';
import { track } from '@/lib/track';
import { z } from 'zod';

const log = createRouteLogger('track');

// The allowlist is this endpoint's only real gate: it is public and unauthenticated, so
// without it anyone could write arbitrary rows into the analytics table. Unknown names are
// dropped with a 200, not a 400 — a stale client should not see errors.
//
// Adding an event = three changes in the same commit: src/lib/analytics.ts (or a server-side
// track() call), this set, and a query in scripts/funnel.sql.
//
// Server-side events (signup_completed) call track() directly and never pass through here, so
// they are intentionally absent from this list.
const ALLOWED_EVENTS = new Set<string>([
  'login_viewed',
  'signup_started',
  'welcome_viewed',
]);

const bodySchema = z.object({
  name: z.string(),
  properties: z.record(z.string(), z.unknown()).optional(),
  visitorId: z.string().optional(),
  sessionId: z.string().optional(),
  path: z.string().optional(),
});

export async function POST(req: Request): Promise<Response> {
  const ctx = log.begin();
  try {
    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return log.end(ctx, Response.json({ error: 'Invalid request' }, { status: 400 }));
    }

    const { name, properties, visitorId, sessionId, path } = parsed.data;

    if (!ALLOWED_EVENTS.has(name)) {
      // Silently drop unknown events — not an error.
      return log.end(ctx, Response.json({ ok: true }));
    }

    // Attach the user when one is signed in, so the pre-signup funnel can be joined to who it
    // became. Never fatal: analytics must not 500 because a session lookup hiccupped.
    let userId: string | null = null;
    try {
      userId = (await auth.api.getSession({ headers: req.headers }))?.user?.id ?? null;
    } catch {
      userId = null;
    }

    // after() so the insert runs once the response is already sent — the client never waits on
    // telemetry, and on serverless the write still completes.
    after(() =>
      track(name, {
        userId,
        visitorId,
        sessionId,
        properties,
        path,
        userAgent: req.headers.get('user-agent'),
      })
    );

    return log.end(ctx, Response.json({ ok: true }));
  } catch (error) {
    log.err(ctx, error);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
