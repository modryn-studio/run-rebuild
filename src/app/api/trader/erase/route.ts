import { after } from 'next/server';
import { z } from 'zod';
import { createRouteLogger } from '@/lib/route-logger';
import { getTrader, getSessionUser } from '@/lib/trader';
import { eraseTrader } from '@/lib/erase';
import { alertSubject, notifyHtml, sendNotification } from '@/lib/notify';

const log = createRouteLogger('trader-erase');

/* ERASURE: the whole trader, every row, one request. Issue #42's beta obligation, and until this
 * route existed there was no erasure path anywhere in `src/` - `run.privileged` appeared in gate
 * scripts and nowhere else, and `track.ts` promised a cascade "on delete" that nothing could
 * trigger. A deletion request meant hand-written SQL.
 *
 * THE SQL LIVES IN `lib/erase.ts`, with the reasoning for its shape, so that `erase-gate.mts` proves
 * the statement this route runs rather than a copy of it.
 *
 * CONFIRMATION IS SERVER-SIDE. The client sends the address the trader typed and this compares it to
 * the session's, so a stray click cannot reach the block and a forged body cannot skip the screen.
 * Case-insensitive, because an address is.
 */
export const maxDuration = 60;

const bodySchema = z.object({ confirm: z.string().min(3).max(320) });

export async function DELETE(req: Request): Promise<Response> {
  const ctx = log.begin();
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return log.end(ctx, Response.json({ error: 'Invalid request' }, { status: 400 }));
    }

    const [trader, user] = await Promise.all([getTrader(), getSessionUser()]);
    if (!trader || !user?.email) {
      return log.end(ctx, Response.json({ error: 'Not signed in' }, { status: 401 }));
    }
    if (parsed.data.confirm.trim().toLowerCase() !== user.email.toLowerCase()) {
      return log.end(
        ctx,
        Response.json({ error: 'That is not the address on this account.' }, { status: 400 })
      );
    }

    const { elapsedMs: elapsed } = await eraseTrader(trader.authUserId);

    log.info(ctx.reqId, 'trader erased', { elapsedMs: elapsed });

    /* NOT THROTTLED. An erasure is one-per-person and it is the alert most worth reading: somebody
       left, and how long the delete took is the number #42 is waiting on. The address is included
       because this goes to the data controller's own inbox and "who" is the question. */
    after(() =>
      sendNotification(
        alertSubject('🗑️', 'A trader erased their account'),
        notifyHtml('Account erased', [
          ['Email', user.email ?? '(unknown)'],
          ['Erase took', `${elapsed}ms`],
          ['When (UTC)', new Date().toISOString()],
        ])
      )
    );

    return log.end(ctx, Response.json({ ok: true }));
  } catch (err) {
    log.err(ctx, err);
    return log.end(ctx, Response.json({ error: 'Could not delete the account' }, { status: 500 }));
  }
}
