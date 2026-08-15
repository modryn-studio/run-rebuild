'use client';

// Client-side product analytics. Fire-and-forget POSTs to /api/track; never awaited, never
// throws, never blocks an interaction.
//
// Identity is two ids, on purpose:
//  - visitorId  first-party cookie, 1 year. Survives tabs, reloads and the signup boundary,
//               so the pre-signup funnel stitches to the account it became.
//  - sessionId  sessionStorage, per tab. One visit.
// sessionStorage alone resets on every new tab and silently inflates the session count — that
// was the bug this two-id shape exists to fix.
//
// Adding an event means three changes in the SAME commit: this file, ALLOWED_EVENTS in
// src/app/api/track/route.ts, and a query in scripts/funnel.sql. An event that is tracked but
// never queried is noise; a funnel query with no event behind it is a lie.

// Rename the `mn_` prefix per project so two Modryn apps on the same apex don't share ids.
const VISITOR_COOKIE = 'mn_vid';
const SESSION_KEY = 'mn_sid';
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365;

type EventProps = Record<string, string | number | boolean | undefined>;

function readCookie(name: string): string | null {
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

function getVisitorId(): string {
  const existing = readCookie(VISITOR_COOKIE);
  if (existing) return existing;
  const id = crypto.randomUUID();
  // Not httpOnly by necessity (the client writes it). SameSite=Lax so it survives the OAuth
  // round trip back from Google, which is exactly the boundary we need to stitch across.
  document.cookie = `${VISITOR_COOKIE}=${id}; path=/; max-age=${VISITOR_MAX_AGE}; SameSite=Lax`;
  return id;
}

function getSessionId(): string {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

function send(name: string, properties?: EventProps): void {
  if (typeof window === 'undefined') return;
  try {
    void fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        properties,
        visitorId: getVisitorId(),
        sessionId: getSessionId(),
        path: window.location.pathname,
      }),
      // Survives the unload that a navigation-triggered event otherwise races.
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Storage/cookies can throw in private modes or blocked-cookie contexts. Never break the UI.
  }
}

// Named methods keep call sites typed and discoverable. Every name here must also appear in
// ALLOWED_EVENTS server-side, or it is dropped.
//
// The three below are the auth funnel every project has. Add product events beneath them.
export const analytics = {
  track: send,
  loginViewed: () => send('login_viewed'),
  signupStarted: (method: 'google' | 'email') => send('signup_started', { method }),
  welcomeViewed: () => send('welcome_viewed'),

  /* THE INTAKE FUNNEL (S4e). Started and completed are separate events rather than one with a
     status, because the gap between them is the number that matters: an upload that starts and
     never finishes is the failure this product exists to not have, and it is invisible if the only
     event fires at the end. `files` is a count, never a filename — a filename is the trader's own
     data and analytics is not where it belongs. */
  uploadStarted: (files: number) => send('upload_started', { files }),
  /** `imported` is rows the DATABASE accepted, so a re-upload legitimately reports 0. */
  uploadCompleted: (files: number, imported: number) =>
    send('upload_completed', { files, imported }),
  /** The preflight CODE, never its message. A code survives a copy rewrite; prose does not. */
  uploadFailed: (code: string) => send('upload_failed', { code }),
};
