import type { Metadata } from 'next';
import { sql } from 'drizzle-orm';
import { db, contractSpec } from '@/lib/db';
import { env } from '@/lib/env';

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
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(contractSpec);
  const instruments = row?.n ?? 0;

  // WHICH BUILD AM I LOOKING AT. Absent locally, so "local" is the honest answer rather than a
  // blank. This is what makes a rollback verifiable instead of a thing you hope happened: promote
  // an older deployment and the seven characters below change in front of you.
  const build = env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local';

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="text-h2">Status</h1>
      <p className="text-small text-muted mt-1">
        The walking skeleton. One query, read at request time.
      </p>

      <div className="bg-surface mt-8 rounded-[var(--radius)] p-6 shadow-[var(--shadow-card)]">
        <p className="text-caption text-muted uppercase">Instruments known</p>
        <p className="text-figure mt-1 tabular-nums">{instruments}</p>
        <p className="text-small text-muted mt-3">
          Zero is the correct answer today. <span className="num">contract_spec</span> is seeded in
          S2, narrow and from the exchange&rsquo;s own published specs, and an unknown symbol
          quarantines rather than falling back to a default multiplier.
        </p>
      </div>

      <p className="text-caption text-muted mt-6">
        Build <span className="num text-text">{build}</span>
      </p>
    </main>
  );
}
