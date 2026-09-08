import type { Metadata } from 'next';
import { requireTrader } from '@/lib/trader';
import { CHANGELOG } from '@/lib/changelog';
import { PAGE_COLUMN } from '@/lib/shell';
import { cardSurface } from '@/components/ui/card';
import { cn } from '@/lib/cn';

export const metadata: Metadata = { title: "What's new" };

/* THE CHANGELOG. `build-plan.md` §S8b: an account-menu row, deliberately not a sidebar destination,
 * and until 2026-09-08 that row was an inert button because there was nothing to open. This is the
 * smallest surface in the plan and it stays that way: a list, newest first, one card.
 *
 * THE SHELL TITLES THIS SCREEN (`app-shell`'s `NAMED_ROUTES`), the same way it titles every nav row,
 * so the band reads "What's new" at every width without this page portalling anything.
 *
 * SIGNED-IN, like everything under `(app)`. A changelog is not secret, but it names features by
 * the words the product uses for them, and the public door has its own way of describing those.
 */
export default async function WhatsNewPage() {
  await requireTrader();

  return (
    <div className={cn(PAGE_COLUMN, 'py-6')}>
      <div className={cn(cardSurface, 'mx-auto max-w-3xl')}>
        <ol className="divide-rule divide-y">
          {CHANGELOG.map((entry) => (
            <li key={`${entry.date}-${entry.title}`} className="px-5 py-4">
              {/* Metadata above prose: the date is when, the title is what. Two tiers, never three. */}
              <p className="text-caption text-muted">{formatDate(entry.date)}</p>
              <h2 className="text-h3 mt-1">{entry.title}</h2>
              <p className="text-body mt-1 max-w-prose text-pretty">{entry.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* A calendar date, so it is formatted as one: no zone, no instant. `en-US` long month, because the
 * audience is US futures traders and the rest of the app's dates read the same way. */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
