'use client';

/* Login — the front door.

   Deliberately a single centred column: the site name, the site description, and one card. No
   marketing nav and no hero slot, because a boilerplate that ships dead links and an empty media
   frame makes every new project start by deleting things. Add that chrome when the project has
   real links to put in it.

   Sign-in = Google + a 6-digit emailed code; email/password is off by design (src/lib/auth.ts).
   A code, not a magic link: a link signs in whichever device OPENS it, so requesting it at the desk
   and tapping it on the phone signs the phone in and leaves the desk waiting, and Gmail's in-app
   browser fails the same way. A code is read on one device and typed into the other.
   Google is DARK until GOOGLE_CLIENT_ID/SECRET land; the code path is live once SMTP creds do. */

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { safeNext } from '@/lib/next-path';
import { site } from '@/config/site';
import { analytics } from '@/lib/analytics';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CodeInput } from '@/components/ui/code-input';
import { TextField } from '@/components/ui/text-field';
import { ThemeToggle } from '@/components/ui/theme-toggle';

type Busy = 'google' | 'sending' | 'verifying' | null;

// Seconds the Resend button stays disabled. Matches OTP_SEND_COOLDOWN_MINUTES on the server, so a
// legitimate resend never silently hits the server-side throttle and returns nothing.
const RESEND_COOLDOWN = 60;

/* THE CODE STEP SURVIVES A RELOAD (Luke, 2026-08-03: "im locked out unless i submit a new email
 * code").
 *
 * `step` and `email` were plain component state, so a refresh - or a hot reload, or wandering off
 * to the inbox in the same tab and coming back - dropped the user onto the email form with a
 * perfectly good code sitting in their inbox and NO WAY TO TYPE IT. The code stays valid for 15
 * minutes; the screen that accepts it lasted until the next render. Asking for a second code is
 * then the only way forward, which is both a dead end for the user and a way to walk into the
 * server's own send throttle.
 *
 * sessionStorage, not localStorage: this is a per-tab, in-flight step, not a preference. It expires
 * with the code it belongs to, so a stale entry can never strand someone on a code step whose code
 * is already dead.
 *
 * THE CODE ITSELF IS NEVER STORED - only the address it went to and when. The digits are the
 * credential; keeping them in a place a later script could read is exactly the trade this product
 * does not make. */
const PENDING_KEY = 'otp_pending';
const OTP_TTL_MS = 15 * 60 * 1000;

type Pending = { email: string; sentAt: number };

function readPending(): Pending | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Pending>;
    if (typeof p.email !== 'string' || typeof p.sentAt !== 'number') return null;
    if (Date.now() - p.sentAt >= OTP_TTL_MS) return null;
    return { email: p.email, sentAt: p.sentAt };
  } catch {
    // A quota error, a private-browsing lockout, or somebody else's JSON. Not being able to restore
    // is a worse screen, never a broken one.
    return null;
  }
}

function writePending(email: string) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ email, sentAt: Date.now() }));
  } catch {
    /* see readPending */
  }
}

function clearPending() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* see readPending */
  }
}

export function Login() {
  /* WHERE THIS SIGN-IN IS HEADED. `?next=` is set by the app's auth gate when it turns a signed-out
     visitor away from a real URL, so signing in returns them to the page they asked for rather than
     dropping them on the dashboard.
     Read through `safeNext`, which is the same guard the gate writes with - the parameter is
     attacker-supplied by construction, and an unchecked one would let a link like
     `yourapp.com/login?next=https://evil.example` hand a freshly authenticated user to somebody
     else's page. See lib/next-path.ts.
     `useSearchParams` FORCES A CLIENT-SIDE BAILOUT, so it needs a Suspense boundary above it or
     the page cannot be prerendered. `src/app/login/page.tsx` declares that boundary explicitly, and
     the note there is worth reading before moving this call: it used to be satisfied by a
     `loading.tsx` at the app ROOT, which nobody had put there for this reason and which was in the
     wrong place for its own. This comment used to read "which the route already provides" - true,
     and true by accident. */
  const next = safeNext(useSearchParams().get('next'));
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const verifyingRef = useRef(false);
  // Set by onBack while a send/resend is in flight, so that request's success or failure - which
  // resolves after the user has already left the code step - can't silently drag them back to it
  // (or paint a stale error) once it lands. Cleared at the top of every new sendCode call.
  const abandonedRef = useRef(false);

  // Top of the funnel. Empty deps: once per mount, not per re-render - otherwise every
  // keystroke in the email field would count as another view.
  useEffect(() => {
    analytics.loginViewed();
  }, []);

  /* Put the user back on the code step if one is still live. In an effect rather than a lazy
     useState initializer, because sessionStorage does not exist on the server and seeding state
     from it would hydrate a different tree than was rendered. Costs one frame of the email form. */
  useEffect(() => {
    const pending = readPending();
    if (!pending) return;
    setEmail(pending.email);
    setStep('code');
    // What is LEFT of the resend cooldown, not a fresh 60. A user who waited two minutes before
    // reloading should not be told to wait another minute.
    const elapsed = Math.floor((Date.now() - pending.sentAt) / 1000);
    setCooldown(Math.max(0, RESEND_COOLDOWN - elapsed));
  }, []);

  // Resend countdown. Re-arms itself each tick rather than running one interval, so it can never
  // outlive the component or keep firing after it reaches zero.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function withGoogle() {
    // Intent, not success. `signup_completed` is recorded server-side in auth.ts, where it
    // cannot be spoofed or lost to an ad blocker; the gap between the two is the drop-off.
    analytics.signupStarted('google');
    setBusy('google');
    setError(null);
    try {
      // Better Auth resolves with { error } rather than throwing; on success it redirects away.
      // safeNext defaults to HOME (lib/next-path.ts) - never '/login', or signing in bounces back
      // to this screen.
      const res = await authClient.signIn.social({ provider: 'google', callbackURL: next });
      if (res?.error) {
        setError('Something went wrong. Please try again.');
        setBusy(null);
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setBusy(null);
    }
  }

  // Used by both the first send and Resend. `resend` only changes which analytics beat fires and
  // whether we are already on the code step.
  async function sendCode(resend = false) {
    const address = email.trim();
    if (!address) return;
    abandonedRef.current = false;
    if (!resend) analytics.signupStarted('email');
    setBusy('sending');
    setError(null);
    try {
      // Better Auth resolves with { error } rather than throwing, so a failed send must NOT fall
      // through to the "we sent you a code" state.
      const res = await authClient.emailOtp.sendVerificationOtp({ email: address, type: 'sign-in' });
      // The user clicked "Use a different email" while this was in flight - don't paint this
      // response over a screen they already left.
      if (abandonedRef.current) return;
      if (res?.error) {
        setError(
          res.error.status === 429
            ? 'Too many tries. Wait a minute, then try again.'
            : 'We could not send that code. Please try again.'
        );
        setBusy(null);
        return;
      }
      writePending(address);
      setStep('code');
      setCode('');
      setCooldown(RESEND_COOLDOWN);
      // Forces CodeInput to remount (see its `key` below) so autoFocus fires again. Without this,
      // a resend leaves focus sitting on the "Send a new code" button instead of the boxes, since
      // `step` never actually changes value across a resend and React has no other reason to
      // recreate the input.
      setSentCount((n) => n + 1);
    } catch {
      if (!abandonedRef.current) setError('We could not send that code. Please try again.');
    } finally {
      setBusy((b) => (b === 'sending' ? null : b));
    }
  }

  async function verify(otp: string) {
    // Ref, not the `busy` state: onComplete fires from an input event, and `disabled` only takes
    // effect on the next render. A fast second paste in that gap would submit twice and burn one
    // of the three allowed attempts on a code that was already in flight.
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setBusy('verifying');
    setError(null);
    try {
      const res = await authClient.signIn.emailOtp({ email: email.trim(), otp });
      if (res?.error) {
        // Clear the boxes: leaving a rejected code in place invites re-submitting the same digits.
        setCode('');
        setError(
          res.error.status === 429
            ? 'Too many tries. Wait a minute, then try again.'
            : 'That code is wrong or expired. Check your email, or send a new one.'
        );
        setBusy(null);
        verifyingRef.current = false;
        return;
      }
      // Signed in, so the pending step is spent. Cleared before the navigation rather than after:
      // there is no "after" once the document is replaced.
      clearPending();
      // Full navigation, not router.push: the session cookie is set on this response, and a hard
      // load guarantees every server component reads it rather than a cached signed-out render.
      // The ref is deliberately NOT released here: the page is leaving, and re-enabling the input
      // during the navigation would let a stray keystroke fire a second sign-in.
      window.location.assign(next);
    } catch {
      setCode('');
      setError('Something went wrong. Please try again.');
      setBusy(null);
      verifyingRef.current = false;
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* THE COMMENT HERE USED TO SAY "rendered once, globally, in src/app/layout.tsx" AND IT WAS
          FALSE. Layout stopped rendering a floating toggle when S3b grew a real header, and its own
          note records the arrangement that replaced it: the shell renders one in its band, and
          "surfaces OUTSIDE the shell — /login, /status — render their own". /status does. This did
          not, so it kept the import (which no lint rule flags) and a comment pointing at a global
          that no longer exists, and the one screen a visitor lands on cold had no way to change
          mode. Same placement as /status, because these two are the same case. */}
      {/* Positioned by a WRAPPER, not by `className` on the control — see the note in status/page.tsx:
          `.lift-press` owns `position: relative` and is unlayered, so a `fixed` passed in loses. */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="text-display text-center text-balance">{site.name}</h1>
          {/* THE PRODUCT'S OWN SENTENCE, and it was `muted` — the highest-stakes instance of prose set in
              the ink meant for a property of the thing beside it. This is what a visitor reads to
              learn what Run is, on the one screen they land on cold. Full strength (2026-08-14). */}
          <p className="text-body-lg mt-4 text-center text-pretty">{site.description}</p>

          {/* The card frame stays mounted across states - only its contents swap - so a successful
              send reads as "the card you just used answered you", not as a page reset. */}
          {/* `Card`, NOT A HAND-ROLLED SURFACE (2026-08-20). This was
              `border-border bg-surface rounded-[var(--radius)] border p-6` - a card built by hand
              that reproduced the radius and the fill and then got the elevation exactly backwards:
              a BORDER and NO SHADOW, where `Card` is a shadow and no border. It is the one screen a
              cold visitor lands on, and it was the only surface in the product making the opposite
              claim to every other one.
              Measured rather than argued: `app.monarch.com/transactions` (2026-08-20) renders its
              cards at `border-radius: 12px`, `box-shadow: rgba(34,32,29,0.1) 0 2px 4px`,
              `border-width: 0px` - which is `--elevation-card` to the byte - and both cards on
              /trades already match it. This one did not, because it never went through the
              primitive. `modryn-base`'s own login uses `<Card className="mt-8 p-6">`; this build
              diverged from it at the port.
              `p-6` STAYS. The trades cards are `px-5` (20px), matching the reference's data cards,
              but this is a form card with stacked full-width controls rather than rows of figures,
              and base uses 24 here too. The chrome was the defect; the padding was not. */}
          <Card className="mt-8 p-6">
            {/* One error slot, at the TOP: a Google failure originates from the button above, so a
                message under the email form would attribute it to the wrong control. */}
            {/* `role="alert"`, ADDED 2026-08-20 (S5 step 3). This slot appeared and disappeared
                silently for anyone not watching it: a message that is only a colour and a position
                is not an error state, it is a decoration that happens to be terracotta. Every other
                error surface in the product announces itself - `FieldError` carries the same role,
                and the intake's refusals are notices - so this was the one that did not.
                `aria-live` is not added beside it: `role="alert"` already implies `assertive`, and
                declaring both is how one announcement becomes two. */}
            {error && (
              <p role="alert" className="text-small text-neg mb-4 text-center">
                {error}
              </p>
            )}

            {step === 'code' ? (
              <CodePanel
                key={sentCount}
                email={email.trim()}
                code={code}
                onCode={(v) => {
                  setCode(v);
                  // Drop the rejected-code message the moment they start retyping, so the boxes
                  // don't sit red underneath a fresh attempt.
                  if (error) setError(null);
                }}
                onComplete={verify}
                verifying={busy === 'verifying'}
                invalid={Boolean(error) && busy !== 'verifying'}
                cooldown={cooldown}
                sending={busy === 'sending'}
                onResend={() => void sendCode(true)}
                onBack={() => {
                  abandonedRef.current = true;
                  clearPending();
                  setStep('form');
                  setCode('');
                  setError(null);
                }}
              />
            ) : (
              <>
                <Button
                  onClick={withGoogle}
                  loading={busy === 'google'}
                  disabled={Boolean(busy)}
                  variant="secondary"
                  size="lg"
                  className="w-full gap-3"
                >
                  <GoogleMark />
                  Continue with Google
                </Button>

                <div className="text-caption text-muted my-4 text-center uppercase">or</div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendCode();
                  }}
                  className="flex flex-col gap-3"
                >
                  {/* `TextField`, NOT a raw `Input` (2026-08-20, S5 step 3), and this screen is
                      the reason that primitive exists: its header comment names /login as the place
                      that carried an `aria-label` and no `<label>` element, so the one screen a
                      cold visitor lands on rendered ZERO labels. The primitive was written and
                      racked and this call site was never migrated to it, which is the ordinary way
                      a fix gets built and not applied.
                      `labelHidden` rather than no label. The visible design is a single
                      placeholder-driven field and that stays; a visually hidden label is still a
                      label, and `TextField` makes `label` required precisely so the choice has to
                      be stated rather than skipped.
                      NO `error` PROP, deliberately: this form's failures are reported in the one
                      slot at the top of the card, because a Google failure originates ABOVE this
                      field and a message underneath it would attribute it to the wrong control.
                      `aria-invalid` is not wired for the same reason - it would claim the email is
                      what failed when the message may be about the button above it. */}
                  <TextField
                    label="Email address"
                    labelHidden
                    type="email"
                    required
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      // Clear a stale failure as soon as the user acts on it.
                      if (error) setError(null);
                    }}
                    placeholder="Enter your email"
                  />
                  <Button
                    type="submit"
                    loading={busy === 'sending'}
                    disabled={Boolean(busy)}
                    size="lg"
                    className="w-full"
                  >
                    Continue with email
                  </Button>
                </form>

                {/* PROJECT TODO: these two need real pages before this is public. */}
                {/* THE ONE STATED EXCEPTION TO THE INK RULE (Luke, 2026-08-14: "leave it muted").
                    By the rule in globals.css this is prose and would take full ink. Consent
                    boilerplate is prose nobody chose to read, and setting it at the same strength as
                    the sentence that explains the product would have it competing with the CTA it
                    sits under. The exception is this string, not the category: an explanation that
                    happens to be legal still reads as prose. */}
                <p className="text-small text-muted mt-6 text-center">
                  By continuing you agree to our Terms and Privacy Policy.
                </p>
              </>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}

// Step 2: enter the mailed code. Deliberately text-title, not a second masthead: a transactional step
// should not carry the same weight as the brand claim above it.
//
// No "Verify" button. The code is a fixed six digits, so the sixth keystroke is unambiguous intent
// and submitting for the user removes a step that exists only to be clicked. The button reappears
// as nothing but a spinner row while the check is in flight, so the wait is still visible.
function CodePanel({
  email,
  code,
  onCode,
  onComplete,
  verifying,
  invalid,
  cooldown,
  sending,
  onResend,
  onBack,
}: {
  email: string;
  code: string;
  onCode: (v: string) => void;
  onComplete: (v: string) => void;
  verifying: boolean;
  invalid: boolean;
  cooldown: number;
  sending: boolean;
  onResend: () => void;
  onBack: () => void;
}) {
  return (
    <div className="text-center">
      <p className="text-title">Check your email</p>
      {/* Guidance: read, not scanned. */}
      <p className="text-body mt-2">
        We sent a 6-digit code to {email}. It expires in 15 minutes.
      </p>

      <div className="mt-6">
        <CodeInput
          value={code}
          onChange={onCode}
          onComplete={onComplete}
          // Also disabled while a resend is in flight: the old code's digits are still sitting in
          // this input until the resend resolves (see the `key` remount above), and typing the 6th
          // one during that window would submit a code the server may already have replaced.
          disabled={verifying || sending}
          invalid={invalid}
          autoFocus
        />
      </div>

      {verifying && (
        <Button loading disabled size="lg" className="mt-4 w-full">
          Signing in
        </Button>
      )}

      <div className="text-small text-muted mt-6 flex flex-col gap-2">
        {/* Disabled-with-a-countdown rather than hidden: a missing button reads as "there is no way
            to get another one", which is the moment people give up and leave. */}
        <button
          onClick={onResend}
          disabled={cooldown > 0 || sending || verifying}
          className="hover:text-text font-medium underline underline-offset-2 transition disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
        >
          {cooldown > 0 ? `Send a new code in ${cooldown}s` : sending ? 'Sending' : 'Send a new code'}
        </button>
        <button
          onClick={onBack}
          disabled={verifying}
          className="hover:text-text font-medium underline underline-offset-2 transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          Use a different email
        </button>
      </div>
    </div>
  );
}

// Google's brand mark. Its four colors are fixed by Google's sign-in branding guidelines, so this
// is a deliberate exception to the palette (same call every reference login makes).
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
