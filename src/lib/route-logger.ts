import 'server-only';
import { after } from 'next/server';
import { alertSubject, notifyHtml, sendNotification } from '@/lib/notify';

export interface RouteLogContext {
  reqId: string;
  reqStart: number;
}

export interface RouteLogger {
  /** Call at the top of the handler — prints separator + START line, returns context */
  begin(): RouteLogContext;
  /** Log an info line under the current request */
  info(reqId: string, message: string, data?: Record<string, unknown>): void;
  /** Log a warning line */
  warn(reqId: string, message: string, data?: Record<string, unknown>): void;
  /** Wrap a completed response — prints ✅ timing line and returns the response */
  end(ctx: RouteLogContext, response: Response, data?: Record<string, unknown>): Response;
  /** Log an error with elapsed time */
  err(ctx: RouteLogContext, error: unknown): void;
}

/* THE SECOND GUARD, AND IT IS IN MEMORY ON PURPOSE.
 *
 * `claim()` is the durable throttle and it is the right one for the normal case: it is atomic and
 * it holds across instances. But it FAILS OPEN by design - "never let throttle bookkeeping suppress
 * a real alert" - and the failure this file most needs to survive is the DATABASE being down. That
 * case fires both barrels at once: every route 500s, and every claim to suppress the resulting mail
 * fails open. One email per request, until the Gmail quota is gone and sign-in mail goes with it,
 * which is exactly the outage #40 exists to prevent.
 *
 * A module-level timestamp cannot fail that way because it asks nothing of the database. On
 * serverless it is per-instance rather than global, so it is a weaker guarantee than `claim` - and
 * that is fine, because it is not replacing `claim`, it is covering the one case `claim` cannot. */
const lastAlertAt = new Map<string, number>();
const ALERT_FLOOR_MS = 60_000;

export function createRouteLogger(routeName: string): RouteLogger {
  const tag = `[${routeName}]`;

  return {
    begin() {
      const reqId = Math.random().toString(36).slice(2, 7).toUpperCase();
      const reqStart = Date.now();
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`${tag} ▶ START [${reqId}] ${new Date().toISOString()}`);
      return { reqId, reqStart };
    },

    info(reqId, message, data) {
      if (data && Object.keys(data).length > 0) {
        console.log(`${tag} [${reqId}] ${message}`, data);
      } else {
        console.log(`${tag} [${reqId}] ${message}`);
      }
    },

    warn(reqId, message, data) {
      if (data && Object.keys(data).length > 0) {
        console.warn(`${tag} [${reqId}] ⚠️  ${message}`, data);
      } else {
        console.warn(`${tag} [${reqId}] ⚠️  ${message}`);
      }
    },

    end({ reqId, reqStart }, response, data) {
      const elapsed = Date.now() - reqStart;
      const logData = { ...data, elapsedMs: elapsed, status: response.status };
      console.log(`${tag} [${reqId}] ✅ Done`, logData);
      return response;
    },

    /* EVERY ROUTE FAILURE REACHES A HUMAN, and until 2026-09-08 almost none of them did.
     *
     * Seven paths - `/api/accounts` POST, PATCH and DELETE, `/api/trader/timezone`,
     * `/api/trades/export`, `/api/trades/page` and `/api/track` - answered 500 into a Vercel log
     * and nothing else. Only csv-import and new-signup ever alerted. In a ten-trader beta nobody
     * reads Vercel logs on the off-chance, so a route that started failing on Tuesday would be
     * discovered when a trader mentioned it, or never.
     *
     * THE ALERT LIVES HERE RATHER THAN IN SEVEN CATCH BLOCKS. Every one of those paths already
     * calls `log.err`, so this is the one place that covers all of them - and covers the next route
     * somebody writes without them having to remember. It is the same argument `require-admin.ts`
     * makes about a check repeated across six files.
     *
     * THROTTLED PER ROUTE, because the failure worth knowing about is "this route is broken", not
     * each of the two hundred requests that proved it. One mail per route per 15 minutes.
     *
     * `after()` RATHER THAN A FLOATING PROMISE, for the reason the csv-import route records: a
     * floating promise CAN be killed when the response completes, and an alert that is dropped
     * whenever the handler returns quickly is an alert for slow failures only.
     *
     * IT CANNOT MAKE THINGS WORSE. `sendNotification` is a silent no-op without GMAIL creds and
     * swallows its own transport errors; the catch here covers the rest, including `after()`
     * throwing when this is somehow called outside a request. Logging must never fail a request. */
    err({ reqId, reqStart }, error) {
      const elapsed = Date.now() - reqStart;
      console.error(`${tag} [${reqId}] ❌ Error after ${elapsed}ms:`, error);

      const now = Date.now();
      const since = now - (lastAlertAt.get(routeName) ?? 0);
      if (since < ALERT_FLOOR_MS) return;
      lastAlertAt.set(routeName, now);

      try {
        after(async () => {
          await sendNotification(
            alertSubject('🚨', `${routeName} failed`),
            notifyHtml(`${routeName} answered an error`, [
              ['Route', routeName],
              ['Request ID', reqId],
              ['Failed after', `${elapsed}ms`],
              ['Error', error instanceof Error ? error.message : String(error)],
              ['Stack', error instanceof Error ? (error.stack ?? '(none)').slice(0, 1500) : '(none)'],
              ['When (UTC)', new Date().toISOString()],
            ]),
            { throttleKey: `route_error:${routeName}`, cooldownMinutes: 15 }
          );
        });
      } catch {
        // An alert that cannot be scheduled must not turn a handled 500 into an unhandled one.
      }
    },
  };
}
