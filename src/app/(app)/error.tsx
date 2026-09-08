'use client';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { PAGE_COLUMN } from '@/lib/shell';
import { analytics } from '@/lib/analytics';
import { cn } from '@/lib/cn';

/* THE SIGNED-IN APP'S FAILURE STATE, and until 2026-09-08 there was no `error.tsx` anywhere under
 * `src/app` at all. Two separate places in this codebase already recorded that as a known gap, in
 * the same sentence, because both were written the day a live 500 taught it:
 *
 *   - `lib/trades/filter.ts:117` - `?accounts=x` reached Postgres as a `uuid`, answered "invalid
 *     input syntax", threw the Server Component, and *"the trader meet Next's bare error screen
 *     with no error.tsx under src/app to soften it."*
 *   - `lib/trades/filter.ts:127` - `?from=2026-13-45` did the same on the date axis.
 *
 * Both were fixed by guarding the INPUT, which was right and is not the same as having a boundary.
 * A guard covers the failure you have already met once. This covers the next one.
 *
 * IT LIVES IN `(app)`, NOT AT THE ROOT, for exactly the reason `(app)/loading.tsx` does and that
 * file explains at length: a boundary at the root sits ABOVE the layout that renders the shell, so
 * a failure in one page would blank the sidebar, the header band and the rail rather than the pane
 * that actually broke. Here the shell stays mounted and the trader can navigate away from the
 * broken page instead of being stranded on it. Errors thrown by `(app)/layout.tsx` itself are above
 * this boundary by definition, and `global-error.tsx` is what answers those.
 *
 * WHAT THE COPY MUST DO, following `views/accounts/finding-notice.tsx`'s five rules, which are the
 * house rules for anything that tells a trader something went wrong:
 *
 *   1. SAY WHAT IS WRONG, THEN WHAT TO DO.
 *   2. NEVER BLAME THE TRADER. A URL they hand-edited is still a normal thing to do.
 *   3. NO EM DASHES.
 *   4. THE APP NEVER NAMES ITSELF.
 *   5. AND ONE THIS SURFACE ADDS: SAY THAT NOTHING WAS LOST. On a product whose single claim is
 *      that the record is the broker's, an unexplained crash reads as "it ate my trades." It did
 *      not - `event` is append-only and a render failure never wrote anything - so the screen says
 *      so plainly rather than leaving the trader to assume the worse of the two explanations.
 *
 * THE DIGEST IS SHOWN ON PURPOSE. Next replaces a production error's message with an opaque
 * `digest` and logs the real one server-side. For a ten-trader beta that hash IS the support
 * channel: the trader quotes eight characters, and it finds the exact stack in the Vercel log. A
 * boundary that swallows it leaves both sides with "it broke".
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    /* THE ONLY REPORTING CHANNEL A CLIENT BOUNDARY HONESTLY HAS. `notify.ts` is server-only and
       `/api/track` is public and allowlisted, so this is fire-and-forget analytics: the digest and
       the path, no message. The message is the one field that can carry a trader's own data (a
       Postgres error quotes the offending value back), and `track.ts` rule 2 is no PII. */
    analytics.pageError(error.digest ?? 'no-digest');
    // Still console.error, because the digest alone is useless in a LOCAL failure, where Next
    // leaves the real message intact and there is no server log to join it to.
    console.error('[error boundary]', error);
  }, [error]);

  return (
    <div className={cn(PAGE_COLUMN, 'py-6')}>
      <EmptyState
        icon={AlertCircle}
        title="This page could not load"
        description="Nothing was lost and your record is unchanged. Try again, and if it happens twice, send this code with your report."
        action={
          <div className="flex flex-col items-center gap-3">
            <Button onClick={reset}>Try again</Button>
            {error.digest && (
              // Metadata about the failure, not prose about it: `muted` is the metadata tier
              // (CLAUDE.md, two tiers never three), and the code is selectable so it can be copied.
              <p className="text-body text-muted select-all">{error.digest}</p>
            )}
          </div>
        }
      />
    </div>
  );
}
