import 'server-only';
import { db, analyticsEvent } from '@/lib/db';

// Server-side product analytics. Writes to `analytics_event`.
//
// Replaces the inherited boilerplate stub, which was a no-op that "silently dropped events in
// production" - a tracker that looks wired and records nothing.
//
// Two rules this file exists to enforce:
//  1. Tracking never breaks the caller. Every failure is swallowed; a telemetry outage must
//     not take a signup down with it.
//  2. No PII in `properties`. Small scalars only (method, step, reason, count). The user is
//     referenced by id and cascades on delete, so an erasure request removes this too.
//
// It deliberately does NOT no-op in development: a tracker you cannot exercise locally is one
// whose first real run is in production.

export interface TrackOpts {
  /** Set once the visitor is signed in; null for the whole pre-signup funnel. */
  userId?: string | null;
  /** First-party cookie id - stable across tabs, reloads, and the OAuth round trip. */
  visitorId?: string | null;
  /** Per-tab id. */
  sessionId?: string | null;
  /** Small scalars only. Never an email, name, fill, or free text from a user. */
  properties?: Record<string, unknown>;
  path?: string | null;
  userAgent?: string | null;
}

export async function track(name: string, opts: TrackOpts = {}): Promise<void> {
  try {
    await db.insert(analyticsEvent).values({
      name,
      userId: opts.userId ?? null,
      visitorId: opts.visitorId ?? null,
      sessionId: opts.sessionId ?? null,
      properties: opts.properties ?? null,
      path: opts.path ?? null,
      userAgent: opts.userAgent ?? null,
    });
  } catch (error) {
    // Swallowed, but not silently: a tracker that fails invisibly is one you discover months
    // later with an empty funnel. Not createRouteLogger - this is a lib with no request ctx.
    console.warn('[track] failed to record analytics event', name, error);
  }
}
