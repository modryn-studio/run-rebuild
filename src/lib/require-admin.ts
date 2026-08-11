import 'server-only';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

// The ONE admin check. Deliberately a single helper rather than an inline comparison per
// surface: the reference implementation repeated its check across six files, and one missed
// file is the whole hole. Every admin surface calls this and nothing else.
//
// Identity comes from a real Better Auth session, so there is no shared secret to leak, paste
// into a URL, or rotate. Revoking access is one edit to ADMIN_EMAILS.

export interface AdminUser {
  email: string;
}

function allowlist(): string[] {
  return (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * The signed-in admin, or null. Null covers every failure the same way (not signed in, signed
 * in as someone else, allowlist unconfigured) so callers can't accidentally treat one as
 * softer than another.
 *
 * Fails CLOSED: an empty or unset ADMIN_EMAILS locks everyone out rather than letting everyone
 * in, so an unconfigured deploy is safe by default.
 */
export async function getAdmin(): Promise<AdminUser | null> {
  const allowed = allowlist();
  if (allowed.length === 0) return null;

  const session = await auth.api.getSession({ headers: await headers() });
  const email = session?.user?.email?.toLowerCase();
  if (!email || !allowed.includes(email)) return null;

  return { email };
}
