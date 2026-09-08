import type { ReactNode } from 'react';
import Link from 'next/link';
import { site } from '@/config/site';

/* THE FRAME FOR A LEGAL DOCUMENT: a public page outside the shell, one measure of prose, a date,
 * and a way back. Terms and Privacy share it so they cannot drift apart in shape.
 *
 * PUBLIC AND INDEXABLE. These two pages are the exception to the app's `noindex`: a privacy policy
 * that Google cannot find is one a regulator will ask why not. They set `robots` themselves in
 * their own `metadata` and the root layout's global `noindex` is overridden per page, which is the
 * mechanism Next provides for exactly this.
 *
 * `max-w-prose` IS THE MEASURE, the one place in the app a 65-character line is right: this is a
 * document to be read top to bottom, not a surface to be scanned.
 */
export function LegalPage({
  title,
  effective,
  children,
}: {
  title: string;
  /** ISO date. Shown as the effective date and used nowhere else. */
  effective: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-prose px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-caption text-muted">
        <Link href="/" className="hover:text-text underline-offset-4 hover:underline">
          {site.name}
        </Link>
      </p>
      <h1 className="text-display mt-4 text-balance">{title}</h1>
      <p className="text-body text-muted mt-2">Effective {formatDate(effective)}</p>
      <div className="mt-10">{children}</div>
      <p className="text-caption text-muted mt-16">
        <Link href="/terms" className="hover:text-text underline-offset-4 hover:underline">
          Terms
        </Link>
        {' · '}
        <Link href="/privacy" className="hover:text-text underline-offset-4 hover:underline">
          Privacy
        </Link>
      </p>
    </main>
  );
}

/** A section of the document: a numbered heading and its paragraphs. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-h3">{title}</h2>
      <div className="text-body-lg mt-3 flex flex-col gap-3 text-pretty">{children}</div>
    </section>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
