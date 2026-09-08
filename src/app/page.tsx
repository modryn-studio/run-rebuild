import type { Metadata } from 'next';
import Link from 'next/link';
import { site } from '@/config/site';
import { RequestAccess } from '@/components/views/door/request-access';
import { buttonClasses } from '@/components/ui/button';

export const metadata: Metadata = {
  title: `${site.name}: your trading record, reconciled against your broker`,
  description: site.description,
  // THE DOOR IS INDEXED. The root layout sets noindex for the whole host because the app behind the
  // login must never be; this page, Terms and Privacy override it, and `sitemap.ts` lists exactly
  // those three. Move one without the others and Search Console reports a contradiction.
  robots: { index: true, follow: true },
  openGraph: {
    title: site.name,
    description: site.description,
    url: site.url,
    siteName: site.name,
    type: 'website',
  },
};

/* THE PUBLIC DOOR. Copied in structure from the reference's landing (`monarch.com`, read from the
 * page text on 2026-09-08 - see `build-plan.md` §3 for the full map): a hero with one claim and one
 * CTA, an eyebrow-and-paragraph on what it is, three pillars, feature sections each under an all-caps
 * eyebrow, then the closing CTA. What is NOT copied and why: their member reviews and press quotes,
 * because Run has none yet and an empty social-proof band is worse than none; their pricing block,
 * because the beta has no price.
 *
 * ONE HONEST WORD ABOUT THE READ. Luke's call (2026-09-08): keep the full promise and mark what is
 * coming. The read is described because it is the product's reason to exist and the kill signal
 * cleared on it; it carries a "coming" mark because it is not in the beta. Nothing else on this page
 * describes anything the app does not do today.
 *
 * NO IMAGES YET. The reference's sections each carry a product screenshot; Run's will too, taken from
 * the app once the empty states land, and any generated media is a Replicate spend that needs Luke's
 * yes first. Type and space carry the page until then, which is how it should read anyway.
 *
 * `main` OUTSIDE THE SHELL, like `/login`: the door is the one surface where the product is allowed
 * to name itself, and it does so exactly once, in the wordmark.
 */
export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <span className="text-title font-medium">{site.name}</span>
        <Link href="/login" className={buttonClasses('secondary', 'sm')}>
          Sign in
        </Link>
      </header>

      {/* HERO. The one claim, in the trader's terms, then the one thing to do. */}
      <section className="py-16 sm:py-24">
        <h1 className="text-display max-w-3xl text-balance">
          Your trading record, reconciled against your broker. To the cent.
        </h1>
        <p className="text-body-lg text-muted mt-6 max-w-2xl text-pretty">
          Upload your Tradovate exports and every trade lands grouped by session, fees resolved from
          the broker&rsquo;s own cash history, totals that match your statement. When a number cannot
          be reconciled, it says so instead of guessing.
        </p>
        <div className="mt-10">
          <RequestAccess />
          <p className="text-small text-muted mt-3">Private beta. Invitations go out in small batches.</p>
        </div>
      </section>

      {/* WHAT IS IT. Eyebrow, then one paragraph - the reference's "WHAT IS MONARCH?" block. */}
      <section className="border-rule border-t py-16">
        <Eyebrow>What is {site.name}?</Eyebrow>
        <h2 className="text-h1 mt-3 max-w-2xl text-balance">A journal whose numbers are the broker&rsquo;s numbers</h2>
        <p className="text-body-lg text-muted mt-5 max-w-2xl text-pretty">
          Most journals ask you to type your trades in, or estimate your fees, or match entries to
          exits with a rule of thumb. Every one of those is a place the record can drift from what
          actually happened. {site.name} reads the exports your broker already gives you and builds
          the record from those alone, so what you see is what you did.
        </p>
      </section>

      {/* PILLARS. Three, not four: the critical path is Import, Record, Read (`spec.md` §3). */}
      <section className="grid gap-8 py-16 sm:grid-cols-3">
        <Pillar title="Import" body="Drop in the four files Tradovate exports. Fills, positions, cash history, orders. The account is detected from the file, not typed." />
        <Pillar title="Record" body="Every round trip, every session, every account, with fees resolved per trade. Reconciled against the statement and marked when it cannot be." />
        <Pillar title="Read" body="Once a day, one pattern in your own trading and what it is costing you in dollars. Named from your trades, never invented." coming />
      </section>

      {/* FEATURES. Each under an all-caps eyebrow, heading, one paragraph - the reference's rhythm. */}
      <div className="border-rule divide-rule border-t divide-y">
        <Feature eyebrow="Trades" title="Every trade, grouped by the session it closed in">
          A trade belongs to the session it was realised in, on the exchange&rsquo;s own 5:00pm Chicago
          boundary. Entry, exit, quantity, gross, fees and net on every row, and the row is the
          broker&rsquo;s pairing, not a matching engine&rsquo;s guess.
        </Feature>
        <Feature eyebrow="Fees" title="Resolved from cash history, never estimated">
          The commission column in a fills export is one of four fee lines and understates the real
          cost by more than half. Fees come from the cash history instead, split per contract per side,
          and on a real ten-day export they reproduced the file to the cent.
        </Feature>
        <Feature eyebrow="Accounts" title="Every account on one page, with its P&amp;L over time">
          Evaluations, funded accounts, personal accounts. Label each once and every figure knows what
          kind of account it belongs to. Switch one out of totals and it leaves the arithmetic without
          leaving the record.
        </Feature>
        <Feature eyebrow="Reconciliation" title="When it cannot be reconciled, it says so">
          An unknown product is quarantined, not priced at zero. A file whose fees do not cover its
          trades is refused, not imported with a gap. A day the statement disagrees with is flagged,
          not averaged away. The record never shows a number it cannot stand behind.
        </Feature>
        <Feature eyebrow="The read" title="One pattern a day, in dollars" coming>
          Not a summary you could have written yourself. One named thing in your own trading, with the
          trades that make it up and what it has cost, written from figures the database computed and
          nothing the model invented.
        </Feature>
        <Feature eyebrow="Your data" title="Yours to take out, yours to delete">
          Download every trade as a CSV whenever you like. Delete your account and everything in it
          goes with it, immediately, with nothing kept.
        </Feature>
      </div>

      {/* CLOSING CTA, the reference's last band. */}
      <section className="border-rule border-t py-16 sm:py-24">
        <h2 className="text-h1 max-w-2xl text-balance">See your record the way your broker sees it.</h2>
        <div className="mt-8">
          <RequestAccess />
        </div>
      </section>

      <footer className="border-rule text-caption text-muted flex flex-wrap items-center justify-between gap-4 border-t py-8">
        <span>{site.name}</span>
        <nav className="flex gap-6">
          <Link href="/terms" className="hover:text-text">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-text">
            Privacy
          </Link>
          <Link href="/login" className="hover:text-text">
            Sign in
          </Link>
        </nav>
      </footer>
    </main>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  // The reference's ALL-CAPS section label. Metadata over the heading, so muted.
  return <p className="text-caption text-muted font-medium tracking-wide uppercase">{children}</p>;
}

function Pillar({ title, body, coming }: { title: string; body: string; coming?: boolean }) {
  return (
    <div>
      <h3 className="text-h3 flex items-center gap-2">
        {title}
        {coming && <Coming />}
      </h3>
      <p className="text-body-lg text-muted mt-3 text-pretty">{body}</p>
    </div>
  );
}

function Feature({
  eyebrow,
  title,
  children,
  coming,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  coming?: boolean;
}) {
  return (
    <section className="grid gap-4 py-12 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-12">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 className="text-h2 mt-3 flex flex-wrap items-center gap-3 text-balance">
          {title}
          {coming && <Coming />}
        </h3>
      </div>
      <p className="text-body-lg text-muted text-pretty">{children}</p>
    </section>
  );
}

/* THE MARK ON THE READ. A badge, not an apology: it says the shape of the product plainly and says
   which part is not in the beta. `radius-xs` is the badge radius; `text-caption` is the badge type. */
function Coming() {
  return (
    <span className="text-caption bg-surface-2 text-muted rounded-[var(--radius-xs)] px-2 py-0.5 font-medium">
      Coming
    </span>
  );
}
