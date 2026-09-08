'use client';

import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { SettingsRow } from './settings-card';

/* THE DATA PAGE'S TWO ACTIONS: take everything out, or delete everything. Copied in shape from the
 * reference's `/settings/data` (2026-09-08): a stack of cards, each a heading, a sentence, and one
 * button - "Download transactions ... Download CSV", then the destructive ones with their buttons
 * disabled until a field is filled.
 *
 * THE DOWNLOAD IS THE TRADES EXPORT WITH `all: true`. `/api/trades/export` already builds the
 * file this product means by "your data" - every round trip with gross, fees and net, in the
 * trader's own zone - and this page must not grow a second CSV writer. It also must not ship every
 * trade id to the client to send them back (#23, #31 are about exactly that), so the route learned
 * to select the set itself.
 *
 * THE BLOB-AND-CLICK IS `download-csv.tsx`'S, including the deferred `revokeObjectURL`: `click()`
 * only queues the download, and revoking synchronously pulls the blob out from under it in Firefox
 * and Safari. Chrome survives it, which is how that looked fine once.
 */
export function DownloadTrades() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch('/api/trades/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const text = await res.text();
      const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `trades-${new Date().toLocaleDateString('en-CA')}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsRow
      title="Every trade, as a CSV"
      note={
        failed
          ? 'The file could not be built. Try again.'
          : 'One row per round trip: date, account, product, entry, exit, gross, fees and net.'
      }
      control={
        <Button variant="secondary" disabled={busy} onClick={() => void save()}>
          {busy ? 'Building' : 'Download CSV'}
        </Button>
      }
    />
  );
}

/* DELETE THE ACCOUNT. #42's beta obligation, and the one control in the product that removes data.
 *
 * TYPE THE ADDRESS, NOT "DELETE". The confirmation is the address on the account because the server
 * checks it against the session (`/api/trader/erase`), so the screen and the guard are the same
 * fact - a forged request cannot skip the screen, and a stray click cannot reach the request. The
 * button stays disabled until the field matches, which is the reference's own pattern for its
 * destructive Data-page actions ("Delete transactions", disabled until a date is picked).
 *
 * WHAT IT SAYS IS WHAT IT DOES. Every import, every trade, every account row, and the sign-in
 * itself. `event` is append-only for every other path in the product; this is the one that removes
 * it, and it says so rather than softening it - a trader asking to be erased is owed the plain
 * sentence.
 *
 * SIGN-OUT AFTER, THEN A HARD NAVIGATION. The session row is already gone by the time the response
 * lands, so `signOut` may answer with an error; it is called anyway to clear the client cache and
 * the cookie, and the failure is ignored. `location.assign` rather than the router: every Server
 * Component must re-read a session that no longer exists.
 */
export function DeleteAccount({ email }: { email: string }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  async function erase() {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/trader/erase', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: typed.trim() }),
      });
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        const message =
          typeof body === 'object' && body !== null && 'error' in body
            ? String((body as { error: unknown }).error)
            : 'Could not delete the account.';
        throw new Error(message);
      }
      try {
        await authClient.signOut();
      } catch {
        // The session is already gone server-side; this only cleared the client.
      }
      /* A HARD NAVIGATION, AND THE LINT RULE IS WRONG ABOUT THIS ONE CASE. `useRouter().push()` keeps
         the client router cache and the current RSC tree, both of which were rendered for a session
         that no longer exists; the login page would then paint from a tree that still believes it is
         signed in. `login.tsx` and the sign-out row make the same call for the same reason. */
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/login');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the account.');
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void erase();
      }}
    >
      <TextField
        label="Type your email address to confirm"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        inputMode="email"
        error={error}
      />
      <div>
        <Button type="submit" variant="danger" disabled={!matches || busy}>
          {busy ? 'Deleting' : 'Delete my account'}
        </Button>
      </div>
    </form>
  );
}
