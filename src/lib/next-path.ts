/* WHERE TO SEND SOMEONE AFTER THEY SIGN IN, and the guard that makes it safe.
 *
 * Hitting a deep URL while signed out should bounce to `/login` and then, after signing in, land on
 * the URL they actually asked for — not on the app's home. Dropping it is a bug users report as
 * "it forgot where I was going". So the auth gate carries it as `?next=`.
 *
 * ─── WHY THIS IS ITS OWN FILE ────────────────────────────────────────────────────────────────────
 *
 * `next` is a URL, supplied by whoever wrote the link, that this app will navigate to with a live
 * session attached. Unguarded that is an OPEN REDIRECT: mail somebody
 * `yourapp.com/login?next=https://evil.example`, they sign in trusting the domain in the address
 * bar, and the app hands them to the attacker's page — which is then free to imitate the sign-in it
 * just completed. The phishing value is precisely that the first hop was genuine.
 *
 * It is guarded in ONE function, imported by the reader and the writer both, because a check that
 * lives at the call site is a check somebody adds a second call site without.
 *
 * ─── WHAT IS ALLOWED ─────────────────────────────────────────────────────────────────────────────
 *
 * A path on this origin, and nothing else. Concretely it must start with a single `/` and must not
 * start with `//` or `/\` - both of which browsers read as PROTOCOL-RELATIVE, so `//evil.example`
 * navigates off-site while looking like a path. That pair is the whole trick and the reason a naive
 * `startsWith('/')` is not enough.
 *
 * Anything else - an absolute URL, a scheme, a backslash, a control character - is not corrected or
 * rejected loudly. It falls back to the default, because someone who followed a bad link should
 * land somewhere real rather than on an error about a query parameter they never saw.
 */

/* Where a signed-in user goes when there is nothing better.
 *
 * `/today` SINCE 2026-09-09, AND IT WAS `/` UNTIL THEN. That value was correct for as long as `/`
 * was a placeholder reading "still being built, and not open for signups yet" - landing there after
 * signing in was harmless because there was nothing there. It stopped being correct the moment the
 * public door shipped (`src/app/page.tsx`, 2026-09-08): every sign-in with no `?next=` - which is
 * the ordinary case, since the gate only sets one for a deep link - handed a freshly authenticated
 * trader the MARKETING PAGE. Luke, finding it the next morning: *"like after i log in, i get routed
 * to it? doesn't make sense to me."*
 *
 * The docstring here already said "point this at the app's real home", so nothing had to be
 * discovered - only done. The lesson worth keeping is the shape: a constant naming a ROUTE goes
 * stale when the route changes meaning, and nothing in the type system or the build can notice.
 * `/today` is the app's first nav row and the screen every other surface treats as home. */
export const HOME = '/today';

/**
 * A `next` value from the URL, reduced to something safe to navigate to.
 * Returns `HOME` for anything that is not a same-origin path.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next) return HOME;
  // Reject anything with a control character or whitespace before the shape checks: those can be
  // used to smuggle a scheme past a naive prefix test in some parsers.
  if (/[\x00-\x1f\x7f\s]/.test(next)) return HOME;
  if (!next.startsWith('/')) return HOME;
  // `//host` and `/\host` are protocol-relative. Both leave the origin while reading as a path.
  if (next.startsWith('//') || next.startsWith('/\\')) return HOME;
  // A backslash anywhere in the authority position is normalised to `/` by browsers, so it is
  // refused outright rather than reasoned about.
  if (next.includes('\\')) return HOME;
  return next;
}

/** The login URL that will return to `path`. `HOME` needs no parameter - it is the default. */
export function loginWithNext(path: string): string {
  const safe = safeNext(path);
  return safe === HOME ? '/login' : `/login?next=${encodeURIComponent(safe)}`;
}
