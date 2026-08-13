// Better Auth server instance. Sign-in = an emailed 6-digit code + Google. Providers stay dark
// until their creds land; the app boots and runs without any of them.
//
// NO ANONYMOUS SESSIONS by default. Better Auth's `anonymous` plugin is one line to add, but it
// brings a real obligation with it: when an anonymous session is claimed by a real sign-in, every
// row keyed on the throwaway user id has to be re-pointed inside `onLinkAccount` or it is orphaned
// the moment the plugin deletes that user — and the returning-user case (the real account already
// holds data) cannot always be merged. That is a per-product decision, so it is not made here.
//
// Uses the existing neon-http `db` — Better Auth's drizzle adapter does no transactions, so the
// http driver's lack of interactive transactions is a non-issue here.
//
// WHY A CODE AND NOT A MAGIC LINK: a link signs in whichever device OPENS it, so requesting it at
// the desk and tapping it on the phone signs the phone in and leaves the desk waiting. Gmail's
// in-app browser fails the same way. A code is read on one device and typed into the other.
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import { count, eq } from 'drizzle-orm';
import { sendUserEmail, otpHtml, sendNotification, notifyHtml, alertSubject, claim } from '@/lib/notify';
import { db, authUser, authSession, authAccount, authVerification } from '@/lib/db';
import { track } from '@/lib/track';
import { env } from '@/lib/env';
import { site } from '@/config/site';

// How long a mailed sign-in code stays valid. 15 minutes, not Better Auth's 300s default: five
// minutes sounds generous until it is real life — the mail takes 40s, the phone buzzes, the person
// looks at it four minutes later and the code is already dead. The cost of a longer window is small
// (single-use, 3 attempts, hashed at rest); the cost of a dead code is someone who cannot get in.
const OTP_TTL_SECONDS = 900;

// Durable half of the send limit. One code per address per minute, enforced on the DB so it holds
// across serverless instances. The UI runs the same 60s countdown on its Resend button, so a
// legitimate resend never trips this — only automated bursts do.
const OTP_SEND_COOLDOWN_MINUTES = 1;

// Email sign-in stays dark until SMTP creds land; Google doesn't depend on it.
const emailOtpPlugin =
  env.GMAIL_USER && env.GMAIL_APP_PASSWORD
    ? emailOTP({
        expiresIn: OTP_TTL_SECONDS,
        otpLength: 6,
        allowedAttempts: 3,
        // Hashed at rest. The default is 'plain', which would leave a working sign-in credential
        // for every pending user sitting readable in the DB — anyone with read access could mint a
        // session as them. Hashing costs nothing: the code is only ever compared, never displayed.
        storeOTP: 'hashed',
        async sendVerificationOTP({ email, otp, type }) {
          // Sign-in is the only type this app mails. There is no password to reset, and email
          // verification is implied by holding the code. Any other type would be an unmailed
          // surprise, so it is an explicit no-op rather than a silent fall-through.
          if (type !== 'sign-in') return;

          // NOTE: the per-address send cooldown is NOT enforced here. By the time this runs, the
          // plugin has already generated a fresh OTP and overwritten the stored one, so skipping
          // the email here would kill the code the user already holds and send no replacement — a
          // silent lockout. It is enforced in the `before` hook below, which rejects the request
          // before any rotation happens.

          // isNewUser at SEND time, not verify time: the account itself isn't created until the
          // code is verified, by which point this email has already gone out. A pre-check here can
          // only be wrong in the sliver between two sends for the same address in flight at once,
          // and getting it wrong only picks the other template's wording, never a wrong outcome.
          const existing = await db
            .select({ id: authUser.id })
            .from(authUser)
            .where(eq(authUser.email, email.trim().toLowerCase()))
            .limit(1);
          const isNewUser = existing.length === 0;

          // The code is in the subject too: it shows in the phone's notification preview, which is
          // often enough to type it without opening the mail at all.
          await sendUserEmail(
            email,
            `Your code is ${otp}`,
            otpHtml(otp, email, isNewUser),
            `${isNewUser ? 'Confirm your email to finish signing up' : `Sign in to ${site.name}`}: ${otp}\n\nThis email was sent to ${email}.`
          );
        },
      })
    : null;

const isProd = process.env.NODE_ENV === 'production';

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  /* IN DEVELOPMENT, baseURL IS RESOLVED PER REQUEST FROM THE Host HEADER, not pinned to one
   * port. This replaces an earlier fix (groundwork 2026-08-10) that kept baseURL pinned to
   * :3000 and only widened `trustedOrigins` to any localhost port — which fixed the origin
   * check but NOT the base URL Better Auth actually builds redirects and OAuth callbacks
   * from, so a browser on :3001 would still get sent through a :3000 callback. `allowedHosts`
   * is Better Auth's own multi-host feature: it derives the real origin from each request's
   * `Host` header, checked against this allowlist, so sign-in works on whichever port Next
   * bound to — 3000, 3001, a worktree's 3002, whatever — with no coordination required and no
   * env var to keep in sync. `protocol: 'http'` matters: without it, a wildcard host like
   * `localhost:*` doesn't match the loopback auto-detection (that check strips a NUMERIC port
   * suffix and compares the hostname, and `*` isn't a digit), so the derived trusted origins
   * would come out `https://localhost:*` — wrong scheme for local dev — and every POST would
   * 403 again, invisibly to a cookieless curl probe (the origin check only runs when the
   * request carries a Cookie header; reproduce auth bugs in a browser or not at all).
   *
   * PRODUCTION STAYS PINNED, on purpose — a wildcard host allowlist in production is an open
   * redirect waiting to happen. `env.BETTER_AUTH_URL` there is a plain string, and Better
   * Auth's static-string path (not this dynamic one) resolves it once at boot. */
  baseURL: isProd
    ? env.BETTER_AUTH_URL
    : { allowedHosts: ['localhost:*', '127.0.0.1:*'], protocol: 'http' },
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user: authUser, session: authSession, account: authAccount, verification: authVerification },
  }),
  // Email+password is off by design: sign-in is an emailed code + Google.
  emailAndPassword: { enabled: false },
  // Per-IP limiter. Deliberately `enabled: true` rather than Better Auth's default (production
  // only): a limiter that never runs in development is a limiter nobody has ever seen work, and it
  // would first execute against real users. Storage is an in-memory Map, so on serverless this is
  // per-instance and leaky by nature — it blunts a burst from one IP, it does not bound total
  // sends. The durable per-address cap lives in the `before` hook below.
  // Upgrade path if abuse is ever real: set `secondaryStorage` (Redis) and this becomes global.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      // Each request here spends real mail quota and lands in someone's inbox, so it is far
      // tighter than the default. 3/min matches the 60s resend countdown with room for a retry.
      '/email-otp/send-verification-otp': { window: 60, max: 3 },
      // Guessing a 6-digit code: `allowedAttempts: 3` already burns the code; this bounds how fast
      // an attacker can cycle fresh ones.
      '/sign-in/email-otp': { window: 60, max: 10 },
    },
  },
  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : undefined,
  // Durable half of the send limit, and it has to sit HERE rather than inside sendVerificationOTP.
  // The plugin's send route calls resolveOTP first, which generates a new code and overwrites the
  // stored one, and only then calls the send hook. Throttling inside that hook would therefore
  // invalidate the code already sitting in the user's inbox while sending no replacement: they
  // would be locked out until the cooldown lapsed, with the UI cheerfully claiming a code was on
  // its way. Rejecting at the door instead means nothing rotates, and the client gets a real 429
  // that the login screen already renders as "wait a minute".
  //
  // ('reuse' as a resendStrategy would dodge the rotation, but it is silently a no-op under
  // storeOTP: 'hashed' — the plugin cannot recover a hashed OTP to resend it.)
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/email-otp/send-verification-otp') return;
      const raw = (ctx.body as { email?: unknown } | undefined)?.email;
      const address = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
      // Anything malformed is left for the route's own validator, so junk never claims a slot.
      if (!address.includes('@')) return;
      // Keyed on the address alone, not address+type: the point is to protect one human's inbox
      // and the shared mail quota, and both are spent regardless of which OTP type asked.
      if (!(await claim(`otp:${address}`, OTP_SEND_COOLDOWN_MINUTES))) {
        throw new APIError('TOO_MANY_REQUESTS', {
          message: 'A code was just sent. Wait a minute before asking for another.',
        });
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Recorded server-side so it can't be spoofed or dropped by an ad blocker.
          // track() swallows its own errors, so this can never fail a signup.
          void track('signup_completed', { userId: user.id });

          // No throttle key: a signup is genuinely one-per-event, and these are the alerts worth
          // waking up for. Detailed on purpose — this gets read on a phone, so it should answer
          // "who, which number, can I look them up" without a query.
          void (async () => {
            let signupNumber = '?';
            try {
              const [row] = await db.select({ n: count() }).from(authUser);
              signupNumber = String(row?.n ?? '?');
            } catch {
              // The running count is a nicety; never let it suppress the alert.
            }
            await sendNotification(
              alertSubject('🆕', `New signup #${signupNumber}`),
              notifyHtml('New signup', [
                ['Email', user.email],
                ['Name', user.name ?? '(none)'],
                ['Signup number', signupNumber],
                ['Sign-in method', user.name ? 'Google (name present)' : 'email code (no name)'],
                ['Auth user ID', user.id],
                ['When (UTC)', new Date().toISOString()],
              ])
            );
          })();
        },
      },
    },
  },
  plugins: [...(emailOtpPlugin ? [emailOtpPlugin] : [])],
});
