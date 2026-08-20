'use client';

/* "Download CSV" — the control the summary rail ends with. Ported from `run-trading@v2`'s
 * `download-csv.tsx` (2026-08-19, S5c).
 *
 * `wireframes.md` §3 draws this in the right rail and its own line 90 says so outright ("Right rail
 * with Totals/Percent toggle and Download CSV"), so this is the spec being met rather than a
 * feature being added.
 *
 * IT MUST NOT BE BUILT FROM WHAT IS ON SCREEN. The page loads 300 rows of a filter that may have
 * selected thousands, so a file assembled in the browser would silently be "the part you scrolled
 * to" — an export that disagrees with the tape above it. The ids the page already computed go to
 * the server and the whole selection comes back. See `api/trades/export`.
 *
 * ONLY THE `request` PATH. v2 carried a second `rows` mode for its accounts roster, where every row
 * was already in the browser and a round trip would be work that can only fail. There is no such
 * surface here yet; the mode returns when one exists, rather than shipping a branch nothing takes.
 *
 * CENTRED, unlike everything above it (Luke, 2026-08-05: "they also center the 'download csv' text
 * link in the summary card footer. should do the same?"). Yes, and for a reason beyond matching: a
 * rail is label/value pairs anchored to two edges, so a link on the left edge reads as another label
 * whose value failed to load. Centring says action, not row.
 */

import { useState } from 'react';

export function DownloadCsv({
  /** Without the extension or the date — both are added here so every export is named alike. */
  name,
  /** The ordered ids of the whole filtered selection, not just the page. */
  ids,
}: {
  name: string;
  ids: string[];
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch('/api/trades/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const text = await res.text();

      /* A blob and a synthetic click, because the file is a POST response and an `<a download>`
         cannot make a POST. */
      const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      // The trader's own calendar day, not a trade date: this names when the file was made.
      a.download = `${name}-${new Date().toLocaleDateString('en-CA')}.csv`;
      a.click();
      /* REVOKED ON A LATER TASK, not in this one. `click()` only QUEUES the download; revoking
         synchronously pulls the blob out from under it and Firefox and Safari cancel the file.
         Chrome happens to survive it, which is why it looked fine. */
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  /* NOTHING TO EXPORT IS NOT A BUTTON. An empty file is a worse answer than no offer, because the
     trader has to open it to find that out. */
  if (ids.length === 0) return null;

  return (
    <div className="border-rule border-t px-5 py-3 text-center">
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="text-link text-body disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Preparing...' : failed ? 'Try again' : 'Download CSV'}
      </button>
      {/* Said once, beside the retry, rather than in a toast. The button is the thing that failed
          and the button is where a trader is already looking. */}
      {failed && !busy && <p className="text-small text-muted mt-1">That did not download.</p>}
    </div>
  );
}
