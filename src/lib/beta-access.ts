import 'server-only';
import { eq } from 'drizzle-orm';
import { db, authUser } from '@/lib/db';
import { env } from '@/lib/env';

// The refusal copy lives in a plain module so the CLIENT login screen can render the same
// sentence this module's callers throw. See `beta-invite.ts` for why it is split that way.
export { NOT_INVITED_CODE, NOT_INVITED_MESSAGE } from '@/lib/beta-invite';

/* WHO MAY OPEN AN ACCOUNT. The beta is invite-only (`build-plan.md`, 2026-09-08), and until this
 * module existed that was a sentence rather than a gate: `src/app/page.tsx` told visitors the app
 * was "not open for signups yet" while `/login` accepted any address in the world.
 *
 * ONE PREDICATE, TWO CALL SITES, AND THEY ANSWER DIFFERENT QUESTIONS. `require-admin.ts` exists
 * because the reference implementation repeated its check across six files and one missed file was
 * the whole hole, so the list is resolved in exactly one place here. But the two call sites in
 * `auth.ts` are not a repetition, they are two different moments:
 *
 *   1. BEFORE A CODE IS SENT (`hooks.before`, the OTP send path). Without this a stranger gets a
 *      real 6-digit code in their inbox, types it in, and only then learns they cannot sign up.
 *      That spends a unit of the global Gmail budget (#40) on somebody who was always going to be
 *      refused, and it is a worse experience than being told at the door.
 *   2. BEFORE THE ROW IS WRITTEN (`databaseHooks.user.create.before`). This is the only point the
 *      emailed-code path and the GOOGLE path both pass through, so it is the one that actually
 *      closes the gate. Google never touches the send hook at all.
 *
 * THE LIST IS `BETA_ALLOWLIST` PLUS `ADMIN_EMAILS`, unioned, so the founder is never locked out of
 * his own product by an editing slip and there is no second place to remember.
 *
 * IT FAILS CLOSED. An unset or empty list refuses every NEW signup rather than admitting everyone,
 * which is the same direction `require-admin.ts` fails and the same direction the whole product
 * does: refuse rather than guess. A misconfigured deploy is then a closed door, which is
 * recoverable, instead of an open one, which is not.
 *
 * AND IT ONLY EVER GATES NEW ACCOUNTS. Somebody already in the beta signs in normally forever,
 * even if their address is later removed from the list. That distinction is the whole reason
 * `mayRequestCode` does a database lookup rather than just testing the string: taking a trader off
 * the list must not strand the data they have already imported. Revoking an existing account is a
 * different action with different consequences, and it is not this module's job.
 */

/** Normalised, deduplicated, lowercase. Both env vars are plain lists of addresses and neither is
 *  a secret: access is proven by a real session, never by holding one of these strings. */
function allowlist(): Set<string> {
  const raw = `${env.BETA_ALLOWLIST ?? ''},${env.ADMIN_EMAILS ?? ''}`;
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

/** The gate is OPEN when `BETA_OPEN` is exactly "true". Compared as a string on purpose: an env var
 *  set to "1", "yes" or "TRUE" leaves the door shut, because a door that opens on a typo is the
 *  failure this module exists to prevent. Flipping it is the whole public-launch switch. */
const isOpen = (): boolean => env.BETA_OPEN === 'true';

/** True when this address may create a NEW account. Pure string work, no IO. */
export function mayCreateAccount(email: string | null | undefined): boolean {
  const address = email?.trim().toLowerCase();
  if (!address) return false;
  if (isOpen()) return true;
  return allowlist().has(address);
}

/**
 * True when a sign-in code may be sent to this address: either it is invited, or it already has an
 * account and is simply coming back.
 *
 * The database lookup is the point. Gating the send on the allowlist ALONE would silently lock out
 * every existing beta trader the moment their address left the list, and the failure would look
 * like broken email rather than a policy decision.
 */
export async function mayRequestCode(email: string): Promise<boolean> {
  if (mayCreateAccount(email)) return true;
  const address = email.trim().toLowerCase();
  try {
    const [existing] = await db
      .select({ id: authUser.id })
      .from(authUser)
      .where(eq(authUser.email, address))
      .limit(1);
    return Boolean(existing);
  } catch {
    /* FAILS CLOSED, and this is the one place that deserves an argument rather than an assertion.
       `takeSendBudget` next door fails OPEN, because a throttle table being down must not take
       sign-in down with it. This is the opposite: a lookup failing here means we cannot tell
       whether this person is allowed, and admitting an unknown address on a database hiccup is
       exactly the hole the module exists to close. A returning trader retries in a minute; an
       uninvited one never gets in on a transient error. */
    return false;
  }
}
