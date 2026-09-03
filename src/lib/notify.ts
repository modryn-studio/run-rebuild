import 'server-only';
import nodemailer from 'nodemailer';
import { sql } from 'drizzle-orm';
import { db, alertThrottle, sendBudget } from '@/lib/db';
import { env } from '@/lib/env';
import { site } from '@/config/site';

// All email, founder alerts and user mail alike, over one transport: nodemailer +
// Gmail SMTP on a Google Workspace account. Chosen over Resend, whose free
// tier allows a single domain (already spent on modrynstudio.com).
//
// Dark until configured: with no GMAIL_USER / GMAIL_APP_PASSWORD these are silent no-ops
// rather than crashes, matching how the rest of the app degrades when creds are absent.
// GMAIL_APP_PASSWORD is a Google *app password*, not the account password.

function transport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
  });
}

function configured(): boolean {
  return Boolean(env.GMAIL_USER && env.GMAIL_APP_PASSWORD);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Claim the right to send under `key`, at most once per `cooldownMinutes`.
 *
 * Also used by auth.ts as the DURABLE half of the sign-in-code rate limit (issue #13). Better
 * Auth's own limiter is an in-memory Map, which on Vercel is per-instance and therefore close to
 * meaningless (same reasoning as this table's header comment). This claim is the one that actually
 * caps how often a given inbox can be mailed.
 *
 * Atomic: the INSERT ... ON CONFLICT DO UPDATE only updates when the existing row is older
 * than the cooldown, and RETURNING tells us whether we won. Two instances firing at once means
 * exactly one email, not two - a read-then-write check would race.
 */
export async function claim(key: string, cooldownMinutes: number | 'once'): Promise<boolean> {
  try {
    // 'once' is a permanent latch, not a long cooldown: the row's existence alone means
    // "already sent". This is what "first successful import" needs - a cooldown, however
    // long, eventually re-fires and would email a second "first" import.
    const q =
      cooldownMinutes === 'once'
        ? db.insert(alertThrottle).values({ key }).onConflictDoNothing()
        : db
            .insert(alertThrottle)
            .values({ key })
            .onConflictDoUpdate({
              target: alertThrottle.key,
              set: { lastSentAt: sql`now()` },
              where: sql`${alertThrottle.lastSentAt} < now() - (${cooldownMinutes} * interval '1 minute')`,
            });
    const rows = await q.returning({ key: alertThrottle.key });
    return rows.length > 0;
  } catch {
    // Never let throttle bookkeeping suppress a real alert.
    return true;
  }
}

/* ─── THE GLOBAL SEND BUDGET (#40, 2026-09-03) ─────────────────────────────────────────────────
 *
 * `claim()` above caps how often ONE inbox can be mailed. It says nothing about how many distinct
 * inboxes exist, and that is the gap public signup opens: every fresh address is a fresh key, so an
 * attacker cycling addresses walks straight through it. The per-IP layer does not help either -
 * `auth.ts` says so itself, it is an in-memory Map and on Vercel that is per serverless instance.
 *
 * WHAT IS ACTUALLY AT RISK. All mail goes over Gmail SMTP on the Workspace account, capped at
 * **2,000 recipients/day**. Exhaust it and Google suspends sending for up to 24 hours: nobody can
 * sign in, and because auth mail shares the work inbox, that inbox goes down with it. The attacker
 * needs no account, no credentials and no sophistication.
 *
 * A COUNTER, NOT A COOLDOWN, WHICH IS WHY IT DOES NOT REUSE `claim()` OR ITS TABLE. That helper
 * answers "has this key been used recently"; this answers "how many times today, across all keys".
 * Bolting a counter onto `alert_throttle` would make one table do two jobs, which is the same
 * second-job pattern that broke the border tokens. `send_budget` is its own row per UTC day.
 */

/* WELL UNDER GOOGLE'S 2,000, and deliberately: the cap has to leave room for everything ELSE on
   that account - founder alerts, and real correspondence. A beta legitimately needing more than
   800 sign-in codes in a day has outgrown Gmail SMTP, and raising this number is not the fix. */
const DAILY_SEND_CAP = 800;

/** Where the founder is told, chosen so the warning arrives while it can still be acted on rather
 *  than as a postmortem. */
const WARN_AT = Math.floor(DAILY_SEND_CAP * 0.75);

/**
 * Take one unit of today's global mail budget. `false` means it is spent and the caller must NOT
 * send.
 *
 * ATOMIC, AND IT HAS TO BE: two instances at the cap must not both be told they may send. The
 * increment and the read are one statement, so the decision is the database's rather than a
 * read-then-write race between serverless instances - the same reasoning `claim()` gives.
 *
 * IT FAILS OPEN. A throttle table that is down must not take sign-in down with it. The budget
 * guards against abuse; it is not a correctness requirement, and trading availability for it is
 * the wrong bargain. `claim()` makes the identical call.
 *
 * THE COST OF THAT IS UNDER-COUNTING, and it was observed rather than reasoned: on the first run
 * against a cold Neon compute one call in twelve was swallowed and the day's total came back one
 * short. That is the trade working as intended - a transient database error lets a mail through
 * rather than refusing a real sign-in - and it means this number is a floor, not an audit. Verified
 * on a warm connection: ten concurrent calls land exactly ten increments, because the increment is
 * one statement and Postgres does the arithmetic.
 *
 * IT ALERTS RATHER THAN FAILING QUIETLY, which is the half most likely to be got wrong. When the
 * budget trips, legitimate signups fail too - so a tripped budget has to reach a human. The alert
 * goes through `claim()` so a sustained attack sends one warning, not eight hundred.
 */
export async function takeSendBudget(): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  try {
    const [row] = await db
      .insert(sendBudget)
      .values({ day, sent: 1 })
      .onConflictDoUpdate({
        target: sendBudget.day,
        set: { sent: sql`${sendBudget.sent} + 1` },
      })
      .returning({ sent: sendBudget.sent });

    const sent = row?.sent ?? 0;

    if (sent === WARN_AT || sent === DAILY_SEND_CAP) {
      /* NOT AWAITED, and never allowed to block the decision below: this is bookkeeping about the
         send, not part of it. `sendNotification` is already fire-and-forget and swallows its own
         failures. */
      void sendNotification(
        sent >= DAILY_SEND_CAP ? 'Mail budget SPENT' : 'Mail budget at 75%',
        `<p>${sent} of ${DAILY_SEND_CAP} sends used on ${day} (UTC).</p>` +
          (sent >= DAILY_SEND_CAP
            ? '<p><strong>Sign-in emails are now being refused.</strong> If this is not an attack, raise the cap or move off Gmail SMTP.</p>'
            : '<p>If this is not expected traffic, it is probably an address-cycling attack on the sign-in form.</p>'),
        { throttleKey: `send-budget-alert:${day}`, cooldownMinutes: 60 }
      );
    }

    return sent <= DAILY_SEND_CAP;
  } catch {
    // Never let budget bookkeeping take sign-in down.
    return true;
  }
}

/**
 * Internal alert to the founder. Fire-and-forget - never throws, safe to call unawaited.
 *
 * Pass `throttleKey` for anything that could repeat (a failing job, an error path). Leave it
 * off for genuinely one-per-event alerts like a new signup.
 */
export async function sendNotification(
  subject: string,
  html: string,
  opts?: { throttleKey?: string; cooldownMinutes?: number | 'once' }
): Promise<void> {
  if (!configured()) return;
  const to = env.FEEDBACK_TO || env.GMAIL_USER;
  if (!to) return;

  if (opts?.throttleKey) {
    const ok = await claim(opts.throttleKey, opts.cooldownMinutes ?? 60);
    if (!ok) return;
  }

  try {
    await transport().sendMail({ from: env.GMAIL_USER, to, subject, html });
  } catch (error) {
    // Logged, not swallowed silently: the reference version discarded failures entirely, so a
    // broken alert pipeline looked identical to a quiet week.
    console.warn('[notify] alert send failed', subject, error);
  }
}

/** Transactional mail to a user (the sign-in code). Throws so auth can surface a failure. */
export async function sendUserEmail(to: string, subject: string, html: string, text?: string): Promise<void> {
  if (!configured()) throw new Error('Email is not configured (GMAIL_USER / GMAIL_APP_PASSWORD)');
  await transport().sendMail({
    // MAIL_FROM lets the visible sender be noreply@yourdomain while SMTP still authenticates as
    // GMAIL_USER. Gmail only honours it once that address is a verified "Send mail as" alias on
    // the account, otherwise it silently rewrites the header and the setting looks broken with no
    // error. Falls back to the SMTP account, which is correct until the alias domain is set up.
    from: `"${site.name}" <${env.MAIL_FROM || env.GMAIL_USER}>`,
    // Reply-To, not just From: a mail client's Reply button defaults to the From address, and the
    // copy tells the recipient to reply and reach "the team" at support@ - without this, a reply
    // would silently land at account@ instead, a mismatch from what the email itself says.
    replyTo: replyToAddress(),
    to,
    subject,
    html,
    text,
  });
}

/** The address shown/used as "reply to this email" - separate from the technical From sender. */
function replyToAddress(): string | undefined {
  return env.SUPPORT_EMAIL || env.MAIL_FROM || env.GMAIL_USER;
}

/**
 * Subject convention: emoji + [site] + a short human summary, so the inbox is scannable at a
 * glance (🆕 new, ✅ success, 🚨 needs action). Emoji in a founder alert is not the same thing
 * as emoji in product UI, which ui-ux-standards bans - these never appear in the app.
 */
export function alertSubject(emoji: string, summary: string): string {
  return `${emoji} [${site.name}] ${summary}`;
}

/** The one internal-alert template. A new alert is a subject plus a few labelled rows. */
export function notifyHtml(title: string, rows: [string, string][]): string {
  const body = rows
    .map(([k, v]) => `<p style="margin:4px 0"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</p>`)
    .join('');
  return `<div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;line-height:1.5">
  <h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>
  ${body}
  <hr style="margin:16px 0;border:none;border-top:1px solid #ddd" />
  <p style="color:#666;margin:0"><a href="${site.url}">${escapeHtml(site.name)}</a></p>
</div>`;
}

/**
 * Sign-in code email. Plain and calm, per brand.md: no hype, no exclamation marks.
 *
 * A code rather than a magic link because a link signs in whichever device OPENS it: request it
 * at the desk, tap it on the phone, and the phone gets the session while the desk keeps waiting.
 * Gmail's in-app browser has the same failure. A code is read on one device and typed into the
 * other, so the right one ends up signed in.
 *
 * Letter-spaced, not chunked ("123 456"), so a double-click selects all six digits at once.
 *
 * Layout AND copy follow the category's settled verification-email shape: wordmark header, white
 * card with a boxed code, small-print footer with the recipient address + logomark. Colors are the
 * app's own tokens, and the code itself is plain ink, not the accent - "accent = interactive
 * moments" does not survive a screen whose one job is to be read and typed. Deliberately left out
 * of the footer: a notification-preferences link (no preferences panel exists yet) and social icons
 * (no accounts set up yet).
 *
 * Table-based, no @font-face: email clients don't load custom fonts (Gmail strips them outright),
 * so this uses system serif/sans/mono stacks that approximate the app's type system rather than
 * trying to load Newsreader/Hanken/IBM Plex.
 *
 * `isNewUser` (Luke, 2026-07-22) picks the heading + subtext: a returning user signing back in
 * has no "email address" left to confirm and no signup to "finish" - the shape this copy is
 * modelled on is a signup-verification flow, and this same endpoint also handles plain sign-in
 * (Better Auth's
 * emailOTP has no separate "send a sign-in code" vs "send a signup code" - one send, one code,
 * the new-vs-returning branch happens at VERIFY time by whether the email already has an
 * account). The caller (auth.ts) resolves isNewUser with its own pre-check, since the account
 * itself isn't created until the code is verified, after this email has already gone out.
 *
 * Real light/dark support, using the app's actual dark tokens from globals.css's
 * `.dark` block, not a guess: a phone in dark mode was rendering some mail client's own automatic
 * "smart" inversion of the light-only markup, which doesn't match the app at all. Two things had
 * to be true at once for a REAL override, not an accidental one:
 *   1. `<meta name="color-scheme"/"supported-color-schemes" content="light dark">` tells a client
 *      "this email declares its own dark palette" - which is what actually SUPPRESSES Apple Mail's
 *      guess-based auto-darkening in favour of the CSS below, rather than layering on top of it.
 *   2. Colors live on CLASSES (`.email-*`), not just inline `style=`. Inline declarations win on
 *      specificity over anything in a <style> block by default, so the dark @media rules below
 *      use `!important` - without it they would be present in the markup and silently never apply.
 * Coverage is real but partial by nature of the medium: Apple Mail (iOS/macOS), Outlook 2019+,
 * Samsung Mail, and Thunderbird all honour `prefers-color-scheme` and will show the app's genuine
 * dark palette. Gmail's iOS/Android apps are the one gap with NO fix from the sending side: they force
 * their own full/partial color inversion regardless of any meta tag or CSS here (Gmail's own
 * mobile-app limitation, not something this markup controls) - Gmail webmail is unaffected either
 * way, since it never recolors the body at all.
 */
export function otpHtml(otp: string, email: string, isNewUser: boolean): string {
  const replyTo = replyToAddress();
  const heading = isNewUser ? 'Confirm your email address' : `Sign in to ${escapeHtml(site.name)}`;
  const subtext = isNewUser
    ? 'Use the code below to verify your email address and finish signing up:'
    : 'Enter the code below to continue:';
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
  /* Dark values are the app's real .dark tokens (src/app/globals.css), not an approximation. */
  @media (prefers-color-scheme: dark) {
    .email-bg { background:#14161a !important; }
    .email-card { background:#1a1d22 !important; border-color:#2c3038 !important; }
    .email-text { color:#e8eaed !important; }
    .email-muted { color:#959ca7 !important; }
    .email-faint { color:#878b94 !important; }
    .email-code-box { background:#21242b !important; }
    .email-hr { border-top-color:#2c3038 !important; }
    .email-logo-light { display:none !important; }
    .email-logo-dark { display:block !important; }
  }
</style>
</head>
<body style="margin:0;padding:0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-bg" style="background:#f6f4ef">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%">
<tr><td style="padding:0 8px 24px">
<span class="email-text" style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:500;letter-spacing:-0.01em;color:#1c2430">${escapeHtml(site.name)}</span>
</td></tr>
<tr><td class="email-card" style="background:#fdfcf9;border:1px solid #e4dfd3;border-radius:12px;padding:32px;font-family:ui-sans-serif,system-ui,sans-serif">
<p class="email-text" style="margin:0 0 8px;font-size:20px;font-weight:600;color:#1c2430">${heading}</p>
<p class="email-muted" style="margin:0 0 20px;font-size:15px;color:#585c64">${subtext}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td align="center" class="email-code-box" style="background:#efece3;border-radius:8px;padding:22px 12px">
<span class="email-text" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:34px;font-weight:600;letter-spacing:8px;color:#1c2430">${escapeHtml(otp)}</span>
</td></tr></table>
<p class="email-text" style="margin:20px 0 0;font-size:15px;color:#1c2430">If you are having trouble and need support, reply to this email and someone from our team will be happy to help.</p>
<p class="email-text" style="margin:16px 0 0;font-size:15px;line-height:1.5;color:#1c2430">Thanks,<br><br>${escapeHtml(site.name)} team<br><a href="mailto:${replyTo}" class="email-muted" style="color:#585c64;text-decoration:underline">${replyTo}</a></p>
<hr class="email-hr" style="margin:24px 0;border:none;border-top:1px solid #e4dfd3">
<p class="email-faint" style="margin:0;font-size:12px;color:#6d6a62">If you have any questions or comments, feel free to reply to the email and our team will get in touch.</p>
</td></tr>
<tr><td style="padding:20px 8px 0">
<p class="email-faint" style="margin:0 0 20px;font-size:12px;color:#6d6a62;font-family:ui-sans-serif,system-ui,sans-serif">This email was sent to ${escapeHtml(email)}.</p>
<img src="${site.url}/brand/logomark.png" width="20" height="20" alt="${escapeHtml(site.name)}" class="email-logo-light" style="display:block;border:0">
<img src="${site.url}/brand/logomark-dark.png" width="20" height="20" alt="${escapeHtml(site.name)}" class="email-logo-dark" style="display:none;border:0">
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
