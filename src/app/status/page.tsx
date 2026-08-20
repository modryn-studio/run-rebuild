import type { Metadata } from 'next';
import { sql } from 'drizzle-orm';
import { db, contractSpec } from '@/lib/db';
import { env } from '@/lib/env';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Card } from '@/components/ui/card';

// S0's walking skeleton, and the whole point of it is that it is not a feature.
//
// One route, one query, one rendered value: schema -> migration -> Neon -> Drizzle -> Server
// Component -> deployed page. It exists so that when something breaks in S4, the pipeline is
// not a suspect. It goes away once a real screen can make the same claim.
export const metadata: Metadata = {
  title: 'Status',
  robots: { index: false, follow: false },
};

// FORCE-DYNAMIC IS LOAD-BEARING HERE. Statically rendered, this query would run at build time
// and the page would prove the build worked, not that the deployed app can reach the database.
// Those are different claims and only the second one is worth a route.
export const dynamic = 'force-dynamic';

export default async function StatusPage() {
  // THE ERROR CASE IS THE POINT OF THIS ROUTE, not an afterthought on it. Uncaught, an
  // unreachable database renders the framework's generic error page — which reports that
  // something failed while withholding the one fact this page exists to state. A status page
  // that cannot say "the database is the thing that is down" is not a status page.
  let instruments: number | null = null;
  let reachable = true;
  try {
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(contractSpec);
    instruments = row?.n ?? 0;
  } catch {
    reachable = false;
  }

  // WHICH BUILD AM I LOOKING AT. Absent locally, so "local" is the honest answer rather than a
  // blank. This is what makes a rollback verifiable instead of a thing you hope happened: promote
  // an older deployment and the seven characters below change in front of you.
  const build = env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local';

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-16 sm:px-6">
      {/* Its own toggle: /status sits OUTSIDE the app shell, which carries one in its header.
          THE POSITIONING IS ON A WRAPPER, NOT ON THE CONTROL. `.lift-press` sets `position:
          relative` to anchor its invisible 44px hit expander, and it is deliberately UNLAYERED so a
          call site cannot half-override the mechanic — which means it also beats Tailwind's layered
          `fixed`. Passing `fixed` through `className` silently became `relative` with a 16px offset
          and put the toggle in the middle of the page. A primitive that owns its own `position` is
          not a thing a caller may re-position; it is a thing a caller wraps. */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <h1 className="text-h2">Status</h1>
      <p className="text-small mt-1">
        The walking skeleton. One query, read at request time.
      </p>

      {/* `Card`, not the same three classes retyped (2026-08-20). The chrome here was already
          CORRECT - shadow, no border - so this changes nothing on screen. It is a maintenance fix:
          a hand-rolled copy of `cardSurface` does not follow the primitive when the primitive
          moves, and this is the page that must keep working when everything else is suspect. */}
      <Card className="mt-8 p-6">
        <p className="text-caption text-muted uppercase">Instruments known</p>
        {reachable ? (
          <>
            <p className="text-figure mt-1 tabular-nums">{instruments}</p>
            <p className="text-small mt-3">
              <span className="num">contract_spec</span> is seeded narrow, from the
              exchange&rsquo;s own published specs, and grows only when a real import quarantines
              something. An unknown symbol quarantines rather than falling back to a guess, and
              the multiplier is not in this table at all: it is derived from your own round trips.
            </p>
          </>
        ) : (
          <>
            {/* No number, not a zero. A zero here would read as "no instruments" when the truth is
                "we could not ask", and inventing the difference is the failure this product is
                built against. */}
            <p className="text-figure text-neg mt-1">Unknown</p>
            <p className="text-small mt-3">
              The database did not answer, so this is not a count of zero, it is no count at all.
              The app is serving and the build below is live.
            </p>
          </>
        )}
      </Card>

      <p className="text-caption text-muted mt-6">
        Build <span className="num text-text">{build}</span>
      </p>
    </main>
  );
}
