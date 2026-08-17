import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { desc, eq, sql } from 'drizzle-orm';
import { db, analyticsEvent, authUser } from '@/lib/db';
import { getAdmin } from '@/lib/require-admin';
import { requireTrader } from '@/lib/trader';
import { HeaderSlot } from '@/components/shell/header-slot';
import { PAGE_COLUMN } from '@/lib/shell';
import { cn } from '@/lib/cn';

// Never let this into an index, even by accident.
export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

// Always fresh: a cached funnel is a wrong funnel.
export const dynamic = 'force-dynamic';

// The card chrome, once. This page is a placeholder you will replace, so it does not earn a shared
// primitive — but it does earn one constant, because six hand-typed copies is how padding drifts.
const CARD = 'border-border bg-surface rounded-[var(--radius)] border';

// All-time figures. Counts are done in SQL, not by pulling every row and counting in JS —
// that reads the same at 100 rows and falls over at 100k.
async function loadStats() {
  const [byEvent, methods, signups, recent, userTotals] = await Promise.all([
    db
      .select({
        name: analyticsEvent.name,
        visitors: sql<number>`count(distinct ${analyticsEvent.visitorId})::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(analyticsEvent)
      .groupBy(analyticsEvent.name),

    db
      .select({
        method: sql<string | null>`${analyticsEvent.properties} ->> 'method'`,
        n: sql<number>`count(*)::int`,
      })
      .from(analyticsEvent)
      .where(eq(analyticsEvent.name, 'signup_started'))
      .groupBy(sql`${analyticsEvent.properties} ->> 'method'`),

    db
      .select({
        id: authUser.id,
        email: authUser.email,
        name: authUser.name,
        createdAt: authUser.createdAt,
      })
      .from(authUser)
      .orderBy(desc(authUser.createdAt))
      .limit(50),

    db
      .select({
        name: analyticsEvent.name,
        path: analyticsEvent.path,
        visitorId: analyticsEvent.visitorId,
        properties: analyticsEvent.properties,
        createdAt: analyticsEvent.createdAt,
      })
      .from(analyticsEvent)
      .orderBy(desc(analyticsEvent.createdAt))
      .limit(50),

    db.select({ n: sql<number>`count(*)::int` }).from(authUser),
  ]);

  const visitors = (name: string) => byEvent.find((e) => e.name === name)?.visitors ?? 0;

  return {
    funnel: {
      sawLogin: visitors('login_viewed'),
      startedSignup: visitors('signup_started'),
      signedUp: visitors('signup_completed'),
    },
    methods,
    signups,
    recent,
    users: userTotals[0]?.n ?? 0,
  };
}

function pct(numerator: number, denominator: number): string {
  if (!denominator) return '-';
  return `${Math.round((numerator / denominator) * 1000) / 10}%`;
}

export default async function AdminPage() {
  // Not a redirect and not a 403: a 404 doesn't confirm the route exists.
  const admin = await getAdmin();
  if (!admin) notFound();

  const s = await loadStats();

  // Resolves the trader row on first sight, so signing in is all it takes to have a record.
  // Rendered below rather than logged, because a value that only ever appears in a server log
  // is a value nobody checks.
  const trader = await requireTrader();

  return (
    // No <main>, no gutter of its own, no DetectTimezone: the shell owns all three now (S3b).
    //
    // THE HEADER AND THE BODY ARE SIBLINGS, each applying PAGE_COLUMN ONCE. Two wrong shapes were
    // measured on the way here, and both type-checked and looked plausible:
    //
    //   1. A `mx-auto max-w-5xl px-4` wrapper around both. PAGE_COLUMN's gutter then sat inside
    //      another gutter and the header indent went from its measured 8px to 24px.
    //   2. PAGE_COLUMN applied directly to each `<section>`. Those sections ARE the cards, so the
    //      gutter became padding inside the card's own border and the card bled to the pane edge.
    //
    // The indent is only correct when the gutter is on a WRAPPER the cards sit in. Caught by
    // measuring the rendered page, never by tsc — which is why the shell is checked in a browser.
    <>
      {/* THE TITLE SLOT, not the controls one: `/admin` is not a NAV destination, so the shell
          cannot derive its name from the route and that end of the band would otherwise be empty. */}
      <HeaderSlot slot="title">
        <h1 className="text-title text-text truncate font-medium">Admin</h1>
      </HeaderSlot>

      <div className={PAGE_COLUMN}>
        <p className="text-small mb-10">
          All-time. Signed in as {admin.email}, showing clocks in {trader.displayTimezone}{' '}
          {trader.displayTimezoneSetByUser ? '(your choice)' : '(detected)'}.
        </p>

        {/* THE HEADLINE NUMBERS. Replace these with the metrics that actually decide whether this
          product works — traffic is the least interesting thing on this page. */}
        <section className="mb-10 grid gap-4 sm:grid-cols-2">
          <Stat label="Users" value={s.users} />
          <Stat label="Tracked events" value={s.recent.length} hint="last 50 shown below" />
        </section>

        <section className={cn(CARD, 'mb-10 p-6')}>
          <h2 className="text-title mb-1">Funnel</h2>
          <p className="text-small mb-4">Unique visitors per step.</p>
          <Row label="Saw login" value={s.funnel.sawLogin} />
          <Row
            label="Started signup"
            value={s.funnel.startedSignup}
            hint={pct(s.funnel.startedSignup, s.funnel.sawLogin)}
          />
          <Row
            label="Signed up"
            value={s.funnel.signedUp}
            hint={pct(s.funnel.signedUp, s.funnel.startedSignup)}
          />
          <p className="text-small mt-4">
            Steps read zero until their screens exist and are instrumented. Add product steps here
            as you add events: see src/lib/analytics.ts.
          </p>
        </section>

        <section className={cn(CARD, 'mb-10 p-6')}>
          <h2 className="text-title mb-4">Sign-in method</h2>
          {s.methods.length === 0 ? (
            <Empty />
          ) : (
            s.methods.map((m) => (
              <Row key={m.method ?? 'unknown'} label={m.method ?? 'unknown'} value={m.n} />
            ))
          )}
        </section>

        <section className={cn(CARD, 'mb-10 p-6')}>
          <h2 className="text-title mb-4">Recent signups</h2>
          {s.signups.length === 0 ? (
            <Empty />
          ) : (
            <ul className="divide-border divide-y">
              {s.signups.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-4 py-2">
                  <span className="text-body truncate">{u.email}</span>
                  <span className="text-small text-muted shrink-0">
                    {new Date(u.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={cn(CARD, 'p-6')}>
          <h2 className="text-title mb-1">Recent activity</h2>
          <p className="text-small mb-4">Last 50 tracked events.</p>
          {s.recent.length === 0 ? (
            <Empty />
          ) : (
            <ul className="divide-border divide-y">
              {s.recent.map((e, i) => (
                <li key={i} className="flex items-center justify-between gap-4 py-2">
                  <span className="text-body">
                    {e.name}
                    {e.path ? <span className="text-muted"> · {e.path}</span> : null}
                  </span>
                  <span className="text-small text-muted shrink-0">
                    {new Date(e.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className={`${CARD} p-5`}>
      <p className="text-caption text-muted uppercase">{label}</p>
      <p className="text-figure mt-1 tabular-nums">{value.toLocaleString()}</p>
      {hint ? <p className="text-small text-muted mt-1">{hint}</p> : null}
    </div>
  );
}

// value takes a string too, for ratios like "3/5" where a bare count would lose the denominator.
function Row({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  // `rule`: a line between two rows in a list is a divider, not a card edge. See globals.css.
  return (
    <div className="border-rule flex items-baseline justify-between gap-4 border-b py-2 last:border-b-0">
      <span className="text-body">{label}</span>
      <span className="flex items-baseline gap-3">
        {hint ? <span className="text-small text-muted tabular-nums">{hint}</span> : null}
        <span className="text-body-lg tabular-nums">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
      </span>
    </div>
  );
}

function Empty() {
  /* An empty state REPLACES the data rather than describing it, so it is the thing being read,
     not a property of something beside it. Full ink (2026-08-14). */
  return <p className="text-small">Nothing yet.</p>;
}
