/* THE UPLOAD CEILING, AND IT IS THE PLATFORM'S, NOT A PREFERENCE.
 *
 * A Vercel serverless function rejects a request body over 4.5 MB AT THE EDGE. The handler never
 * runs, so nothing in `route.ts` can catch it, log it, notify anyone or shape a message: the trader
 * gets a raw 413 from infrastructure they have never heard of, on the single screen this product
 * cannot afford to fail on. Before this module existed there was no byte check anywhere - not in
 * `next.config.ts`, not in the route, not in the picker - and issue #5 measured a real annual
 * Tradovate export at 19.4 MB. So the FIRST import by a trader with a year of history was the one
 * guaranteed to hit it.
 *
 * THE CAP IS ON THE BATCH, NOT THE FILE, because the limit is on the request body and the picker
 * sends every staged file in one multipart POST. A per-file check would pass five 3 MB files and
 * still be rejected.
 *
 * 4 MB RATHER THAN 4.5, for two reasons. Multipart encoding adds boundaries, headers and the
 * `adoptAccountId` field on top of the file bytes, so the body is always larger than the sum being
 * measured; and a ceiling a trader can hit by a rounding error is worse than one with slack in it.
 *
 * THIS IS A SHARED MODULE ON PURPOSE - imported by the client picker AND the route. It holds no db
 * import and no `server-only`, so a `'use client'` file may take VALUES from it, which is the
 * distinction `CLAUDE.md` draws and the reason `intake/stream.ts` is shaped the same way. The check
 * has to exist on both sides and say the SAME sentence: the client's is the one a trader actually
 * meets, and the route's is what catches a request that did not come from the picker.
 *
 * WHAT IT IS NOT: a fix for #5. Splitting the export is a workaround the trader performs, and the
 * real answer is a chunked or direct-to-storage upload that does not pass through a function body
 * at all. That is scoped in #5 and deliberately not built here. What this replaces is a silent
 * infrastructure 413 with a sentence that names the number and says what to do next.
 */

/** The whole batch, in bytes. See above for why it is under Vercel's 4.5 MB and not at it. */
export const UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

/** One decimal, because "4.5 MB" and "19.4 MB" are the numbers a trader can act on and "4718592"
 *  is not. Deliberately MB rather than MiB in the copy: the file manager they just came from
 *  rounds the same way, and matching it is worth more than being exactly right about the base. */
export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  // A trailing `.0` reads as a measurement where the ceiling is a round number: "4 MB", not
  // "4.0 MB". The trader's own number keeps its decimal, because 19.4 is the one they can act on.
  const oneDecimal = mb.toFixed(1);
  return `${oneDecimal.endsWith('.0') ? oneDecimal.slice(0, -2) : oneDecimal} MB`;
}

/**
 * The refusal, in the product's voice, or null when the batch fits.
 *
 * Follows `views/accounts/finding-notice.tsx`'s rules, which govern anything that tells a trader
 * something went wrong: name the number, say what to do, never blame them, no em dashes, and the
 * app never names itself. Splitting an export by date range is a real remedy here rather than a
 * consolation - `commit.ts` keys an import on `(account_id, file_hash)`, so separate batches
 * accumulate into one record and re-uploading a batch already landed is a safe no-op.
 */
export function uploadSizeRefusal(totalBytes: number): string | null {
  if (totalBytes <= UPLOAD_MAX_BYTES) return null;
  return `These files come to ${formatBytes(totalBytes)}, and an upload has to stay under ${formatBytes(UPLOAD_MAX_BYTES)}. Re-export a shorter date range and upload it in batches: each one adds to your record, and a batch you have already sent is ignored rather than duplicated.`;
}
