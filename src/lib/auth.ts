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
import { alertSubject, claim, notifyHtml, otpHtml, sendNotification, sendUserEmail, takeSendBudget } from '@/lib/notify';
import { db, authUser, authSession, authAccount, authVerification } from '@/lib/db';
import { track } from '@/lib/track';
import { mayCreateAccount, mayRequestCode } from '@/lib/beta-access';
import { NOT_INVITED_CODE, NOT_INVITED_MESSAGE } from '@/lib/beta-invite';
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

/* ─── A PREVIEW IS NOT PRODUCTION, AND `NODE_ENV` CANNOT TELL THEM APART (#1, 2026-09-03) ──────
 *
 * Sign-in failed on every Vercel preview deployment, both paths, and the cause was one line:
 * `isProd` is true on a preview because a preview BUILDS in production mode. So `baseURL` stayed
 * pinned to `https://app.run.trading` and Better Auth rejected any POST from
 * `run-rebuild-git-<branch>-*.vercel.app` with `Invalid origin` - a 403 fired BEFORE the OTP
 * throttle hook and before any mail was attempted, so the login screen reported a generic send
 * failure that no retry could ever fix.
 *
 * IT MATTERS MORE NOW THAN WHEN IT WAS FILED. `build-plan.md` adopts worktree-per-slice, so every
 * slice produces a preview - and the beta is public signup, which makes preview the last place a
 * release gets looked at before strangers do.
 *
 * `VERCEL_ENV`, NOT `VERCEL_URL`'s PRESENCE, is the discriminator. The platform sets `VERCEL_URL`
 * on production deployments too, so keying off it would widen production's allowlist - the exact
 * open-redirect surface the pinned string exists to close.
 *
 * THE GOOGLE HALF IS NOT FIXED BY THIS AND CANNOT BE. The callback URL is built from `baseURL`, so
 * OAuth on a preview would ask Google to redirect to a host that is not a registered redirect URI,
 * and Google does not accept wildcards. A preview can therefore do the emailed code and not
 * Google, which is the honest outcome rather than a partial one - and it is enough to review a
 * slice. Registering every preview host is not possible; a stable alias per branch would be, if
 * that ever becomes worth it.
 *
 * WHATEVER GOES WRONG HERE IS INVISIBLE TO CURL: the origin check only runs on a request carrying
 * a Cookie header. Reproduce in a browser or not at all. */
const isPreview = env.VERCEL_ENV === 'preview';
const previewUrl = env.VERCEL_URL ? `https://${env.VERCEL_URL}` : null;

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
   * env var to keep in sync.
   *
   * `protocol: 'http'` IS A NARROWING, NOT A REQUIREMENT — checked against the installed
   * library rather than assumed, after a first draft of this comment claimed the opposite.
   * `getTrustedOrigins` adds an `http://` entry for any host `isLoopbackHost` recognises, and
   * it recognises `localhost:*` and `127.0.0.1:*` wildcards, so dev would work without this.
   * What it changes is that the allowlist becomes exactly `http://localhost:*` and
   * `http://127.0.0.1:*` instead of also carrying `https://` twins nothing local will ever
   * use. Keep it for the narrower surface and the stated intent, not because omitting it
   * breaks anything.
   *
   * WHATEVER GOES WRONG HERE IS INVISIBLE TO A COOKIELESS CURL PROBE: the origin check only
   * runs when the request carries a Cookie header. Reproduce auth bugs in a browser or not at
   * all.
   *
   * PRODUCTION STAYS PINNED, on purpose — a wildcard host allowlist in production is an open
   * redirect waiting to happen. `env.BETTER_AUTH_URL` there is a plain string, and Better
   * Auth's static-string path (not this dynamic one) resolves it once at boot. */
  baseURL: isPreview && previewUrl
    ? previewUrl
    : isProd
      ? env.BETTER_AUTH_URL
      : {
        // `*.localhost:*` is here for the door/app split. Production runs the marketing site on
        // the apex and the product on `app.run.trading`; locally that shape is reachable because
        // Chrome resolves any `*.localhost` to loopback with no hosts-file edit, and Next serves
        // whatever Host it is handed. Checked against the installed library: `app.localhost:3001`
        // does NOT match `localhost:*` — the pattern is matched against the whole host — so
        // without this line a sign-in from the app subdomain 403s, invisibly to curl, which is
        // exactly the failure the port pin already cost a session. Safari does not resolve
        // `*.localhost`; it needs a hosts entry.
        allowedHosts: ['localhost:*', '*.localhost:*', '127.0.0.1:*'],
        protocol: 'http',
      },
  /* THIS APP'S OWN COOKIE NAME, and it fixes a real sign-out loop rather than tidying a namespace.
   *
   * COOKIES IGNORE THE PORT. `localhost:3000` and `localhost:3002` are ONE cookie jar as far as the
   * browser is concerned — the port is not part of a cookie's identity, only the host is. So two Run
   * builds running side by side on different ports are writing to the same jar.
   *
   * Both were also using Better Auth's DEFAULT cookie name, so they were writing the same KEY. Sign
   * into `run-trading@v2` on :3000 and it overwrites the token this app set on :3002, and the other
   * way round — which is why signing into either one silently signed the trader out of the other
   * (Luke, 2026-08-17: "i keep getting signed out of my real Chrome browser as well... for
   * run-trading@v2 on local 3000 and run-rebuild on local 3002").
   *
   * THE SHARED SECRET IS WHAT MADE IT CONFUSING rather than obvious. Both `.env.local` files carry
   * the SAME `BETTER_AUTH_SECRET` and DIFFERENT `DATABASE_URL`s (verified by hash, 2026-08-17), so
   * the foreign cookie's signature VALIDATES here — it is not rejected as forged. It simply resolves
   * to a session id that exists only in the other build's database, so the lookup finds nothing and
   * the trader is treated as signed out. A mismatched secret would at least have failed loudly.
   *
   * A distinct prefix is the whole fix and it is one-sided: v2 keeps the default, this build takes
   * its own name, and the two tokens stop colliding. Not a dev-only workaround — production runs one
   * host per build, but the cost of the collision is a silent sign-out and the cost of the prefix is
   * nothing. */
  advanced: { cookiePrefix: 'run-rebuild' },
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
      /* THE INVITE GATE, AND IT IS FIRST ON PURPOSE (2026-09-08). Both throttles below exist to
         ration a scarce resource - one inbox's patience, and the shared Gmail quota - and an
         address that was never going to be admitted should not spend either. Refusing here also
         means a stranger is told at the door rather than after a real code has landed in their
         inbox and been typed in.

         `mayRequestCode` hits the database, so it deliberately runs after the malformed-address
         return above: junk never costs a query. It answers true for anyone who ALREADY has an
         account, which is what keeps an existing trader signing in after their address leaves the
         list. See `beta-access.ts` for why that distinction is load-bearing. */
      if (!(await mayRequestCode(address))) {
        throw new APIError('FORBIDDEN', { message: NOT_INVITED_MESSAGE, code: NOT_INVITED_CODE });
      }

      // Keyed on the address alone, not address+type: the point is to protect one human's inbox
      // and the shared mail quota, and both are spent regardless of which OTP type asked.
      if (!(await claim(`otp:${address}`, OTP_SEND_COOLDOWN_MINUTES))) {
        throw new APIError('TOO_MANY_REQUESTS', {
          message: 'A code was just sent. Wait a minute before asking for another.',
        });
      }

      /* ─── THE GLOBAL BUDGET, AND IT IS A DIFFERENT QUESTION FROM THE ONE ABOVE (#40) ────────
       *
       * The claim above caps ONE inbox. It says nothing about how many distinct inboxes exist,
       * and every fresh address is a fresh key - so an attacker cycling addresses walks straight
       * through it. Gmail SMTP caps this Workspace account at 2,000 recipients/day; exhausting it
       * suspends sending for up to 24 hours, which locks out every signup AND takes the work
       * inbox down with it, since auth mail shares it.
       *
       * SECOND, NOT FIRST, and the order is deliberate: a repeat request from one address should
       * be refused by its own cooldown WITHOUT spending a unit of the global budget. Reversing
       * these two would let one impatient trader burn the day's allowance.
       *
       * `takeSendBudget` FAILS OPEN - a throttle table that is down must not take sign-in down
       * with it - and it alerts the founder at 75% and at the cap, because when this trips it
       * refuses legitimate signups too and that has to reach a human. See `notify.ts`.
       *
       * THE MESSAGE DOES NOT NAME THE CAUSE. A trader who hits this did nothing wrong and can do
       * nothing about it; telling them a quota is exhausted invites them to retry, and telling an
       * attacker they succeeded is worse. */
      if (!(await takeSendBudget())) {
        throw new APIError('TOO_MANY_REQUESTS', {
          message: 'Sign-in codes are temporarily unavailable. Try again shortly.',
        });
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        /* THE GATE THAT ACTUALLY CLOSES (2026-09-08). The send hook above covers the emailed-code
           path; GOOGLE never touches it, so without this a stranger with a Google account walks
           straight into the closed beta. This hook is the one place both providers converge before
           a row is written, which is what makes it the check rather than a second copy of one.

           IT THROWS RATHER THAN RETURNING FALSE. Better Auth's `createWithHooks` treats a `false`
           return as "abort and return null" (verified in `node_modules/better-auth/dist/db/
           with-hooks.mjs`, not assumed), and a null user surfaces downstream as an opaque failure.
           An APIError is a real response the login screen can render. */
        before: async (user) => {
          const email = (user as { email?: unknown }).email;
          if (!mayCreateAccount(typeof email === 'string' ? email : null)) {
            throw new APIError('FORBIDDEN', { message: NOT_INVITED_MESSAGE, code: NOT_INVITED_CODE });
          }
        },
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
  /* WHERE A FAILED OAUTH CALLBACK LANDS. Better Auth redirects an APIError thrown during the
     social callback to `errorURL` with `?error=<code>&error_description=<message>` attached, and
     the DEFAULT is `${baseURL}/error` - a Better Auth page, not one of ours. A trader refused at
     the invite gate via Google would have met a stock error screen with no way back.
     `/login` is where they can act, so that is where they go; the screen matches on the CODE and
     renders its own copy, never the description off the URL (see `beta-invite.ts`). */
  onAPIError: { errorURL: '/login' },
  plugins: [...(emailOtpPlugin ? [emailOtpPlugin] : [])],
});
