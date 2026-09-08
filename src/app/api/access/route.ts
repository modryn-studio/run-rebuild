import { after } from 'next/server';
import { z } from 'zod';
import { createRouteLogger } from '@/lib/route-logger';
import { alertSubject, claim, notifyHtml, sendNotification } from '@/lib/notify';
import { track } from '@/lib/track';

const log = createRouteLogger('access');

/* REQUEST ACCESS: the public door's one form. An address comes in; Luke gets an email; the trader
 * gets one sentence back. Adding them is then one edit to `BETA_ALLOWLIST`.
 *
 * NO TABLE, ON PURPOSE, FOR NOW. A waitlist table with an admin approve button is the right shape
 * at a hundred requests and the wrong one at ten - it is a migration, a page, and a second place the
 * allowlist can live, for a list the founder is going to read as email anyway. The event in
 * `analytics_event` is the durable record: `SELECT properties->>'domain' FROM analytics_event WHERE
 * name = 'access_requested'` is the waitlist. When approvals stop fitting in an env var, the table
 * comes then, and `build-plan.md` §3 says so.
 *
 * NO PII IN THE EVENT, so the address itself is not tracked - only its domain, which is enough to
 * see whether requests are coming from prop-firm inboxes or gmail. The address goes in the email to
 * Luke and nowhere else (`track.ts` rule 2).
 *
 * THROTTLED PER ADDRESS, one request per day: the button is public, and a stranger holding it down
 * must not turn the founder's inbox into the thing #40 protected the sign-in codes from. It does not
 * spend the global send budget because an alert to Luke is not a user email, but the per-address
 * claim is the same durable key the OTP path uses.
 *
 * ALWAYS 200 ON A WELL-FORMED ADDRESS, whether or not the email went. A public form that answers
 * differently for a throttled address is an oracle, and the trader's next step is the same either
 * way: wait to hear from us.
 */
const bodySchema = z.object({ email: z.string().trim().toLowerCase().email().max(320) });

export async function POST(req: Request): Promise<Response> {
  const ctx = log.begin();
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return log.end(ctx, Response.json({ error: 'Enter a valid email address.' }, { status: 400 }));
    }
    const { email } = parsed.data;
    const domain = email.split('@')[1] ?? '';

    if (await claim(`access:${email}`, 60 * 24)) {
      after(async () => {
        await Promise.allSettled([
          sendNotification(
            alertSubject('🙋', 'Access requested'),
            notifyHtml('Somebody asked to join the beta', [
              ['Email', email],
              ['Add them', 'Append the address to BETA_ALLOWLIST in Vercel and redeploy.'],
              ['When (UTC)', new Date().toISOString()],
            ])
          ),
          track('access_requested', { properties: { domain }, path: '/' }),
        ]);
      });
    }

    return log.end(ctx, Response.json({ ok: true }));
  } catch (err) {
    log.err(ctx, err);
    return log.end(ctx, Response.json({ error: 'Something went wrong. Try again.' }, { status: 500 }));
  }
}
