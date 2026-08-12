'use client';

import { useEffect } from 'react';

/**
 * Reports the browser's own time zone once per mount. Renders nothing.
 *
 * A CLIENT COMPONENT BECAUSE THE ANSWER ONLY EXISTS ON THE CLIENT. A server has no idea what
 * zone a trader is in — the `Accept-Language` header does not carry one and an IP lookup is a
 * guess with a VPN-shaped hole in it. `Intl.DateTimeFormat().resolvedOptions().timeZone` is the
 * browser stating a fact about itself.
 *
 * IT LOSES TO A STORED CHOICE, and the server enforces that rather than this component: the
 * POST is `source: 'detected'`, and `setDisplayTimezone` refuses to overwrite a zone a human
 * picked. Putting the precedence check here instead would mean trusting a client to decline.
 *
 * Fires and forgets. A failed report leaves the trader on their previous zone, which is a
 * cosmetic miss on one page view and is not worth an error surface. `sessionStorage` keeps it
 * to once per tab rather than once per navigation.
 *
 * MOUNTED ON `/admin` TODAY BECAUSE IT IS THE ONLY AUTHENTICATED SURFACE. It moves into the app
 * shell in `S3b`, where it will cover every signed-in page. Mounting it in the root layout
 * instead would force the whole app dynamic to read a session it usually does not need.
 */
export function DetectTimezone() {
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return;

    const key = `tz-reported:${zone}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');

    void fetch('/api/trader/timezone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone, source: 'detected' }),
    }).catch(() => {
      // Cosmetic. Never surfaced, never retried on this page view.
    });
  }, []);

  return null;
}
