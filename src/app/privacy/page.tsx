import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Section } from '@/components/views/legal/legal-page';
import { site } from '@/config/site';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `What ${site.name} collects, why, and how to delete it.`,
  // The exception to the app's global noindex: a privacy policy has to be findable.
  robots: { index: true, follow: true },
};

const EFFECTIVE = '2026-09-08';

/* THE PRIVACY POLICY, and it is written from the code rather than from a template. Every item in
 * section 1 is a column or a file this repo actually stores; every provider in section 4 is one the
 * deploy actually calls; the erasure path in section 6 is `lib/erase.ts` behind `/settings/data`.
 * `build-plan.md` §3 required exactly that: "the Privacy Policy has to describe the erasure path".
 * Nothing here describes a feature that does not exist yet - the daily read, when it ships, gets its
 * own paragraph in the same change.
 */
const ENTITY = 'Modryn Studio';
const CONTACT = 'luke@modrynstudio.com';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" effective={EFFECTIVE}>
      <p className="text-body-lg text-pretty">
        {site.name} is a trading journal. To work, it has to hold a copy of your trading record. This
        page says exactly what we collect, why, who else touches it, and how to take it back. It is
        written to be read, not skimmed; it is short because the product does one thing.
      </p>

      <Section title="1. What we collect">
        <p><strong>Your sign-in.</strong> Your email address; your name and profile image if you sign in with Google; the time zone your browser reports, or the one you choose.</p>
        <p><strong>Your broker exports.</strong> The files you upload from your futures broker: fills, position history, cash history (fees and commissions), orders, and account balance history. We keep the parsed rows, a hash of each file, and the file names. We do not keep the raw files after parsing.</p>
        <p><strong>Your record.</strong> What we derive from those files: trades, sessions, accounts, and the labels you give them (account type, firm, size, name).</p>
        <p><strong>How you use the service.</strong> Events such as signing in, uploading a file, or a page failing to load, with a random visitor id and the page path. Never the contents of what you uploaded, and never free text you typed.</p>
        <p><strong>Cookies.</strong> A session cookie so you stay signed in, a visitor id so we can tell one visit from another, and your appearance preference (light, dark, or system). No advertising cookies. No third-party trackers.</p>
      </Section>

      <Section title="2. What we do with it">
        <p>We use your data to provide the service: to build your record, reconcile it, show it to you, sign you in, and email you sign-in codes. We use usage events, in aggregate, to see where the product fails or confuses people. We use your email to tell you about material changes to the service or to these terms.</p>
        <p>We do not sell your data. We do not show advertising. We do not share your record with anyone except the infrastructure providers below, and only so they can run the service.</p>
      </Section>

      <Section title="3. What we never do">
        <p>We never connect to your brokerage account, and we cannot: you upload files, we do not pull them. We never place trades, move money, or hold funds. We never share your trading record with other users.</p>
      </Section>

      <Section title="4. Who else touches your data">
        <p>The service runs on infrastructure we rent, and your data passes through or rests on it:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Vercel</strong> hosts the application and serves every page. Your data passes through their servers in transit.</li>
          <li><strong>Neon</strong> hosts the database in the United States. Your record rests there, encrypted at rest.</li>
          <li><strong>Google</strong>, only if you choose to sign in with Google: they tell us your email, name, and profile image.</li>
          <li><strong>Google Workspace (Gmail)</strong> sends the sign-in codes and any email we send you.</li>
          <li><strong>Vercel Analytics</strong> counts page views without cookies or personal identifiers.</li>
        </ul>
        <p>Each of these is bound by its own terms and privacy policy, and each is limited to what running the service requires.</p>
      </Section>

      <Section title="5. How long we keep it">
        <p>For as long as you have an account. Your record is never expired or trimmed by us; it stays until you delete it. Sign-in codes expire within minutes and are deleted. Usage events are kept in aggregate.</p>
      </Section>

      <Section title="6. Downloading and deleting your data">
        <p>In <Link href="/settings/data" className="underline underline-offset-4">Settings &rsaquo; Data</Link> you can download your complete record as a CSV at any time, and you can delete your account.</p>
        <p>Deleting your account removes every import, every trade, every account, your labels, your usage events, and your sign-in, immediately and irreversibly. Nothing is retained in the live database. Automated database backups held by our provider may contain your data for a short period after deletion and expire on their own schedule; they are never restored to bring a deleted account back.</p>
        <p>If you cannot sign in to do this yourself, email us from the address on the account and we will do it for you.</p>
      </Section>

      <Section title="7. Security">
        <p>All traffic is encrypted in transit. Sign-in codes are stored hashed and expire quickly. Your data is stored encrypted at rest by our database provider. Access to production systems is limited to the people who run the service. No system is perfectly secure, and if we learn of a breach affecting your data we will tell you.</p>
      </Section>

      <Section title="8. Children">
        <p>The service is for adults. We do not knowingly collect data from anyone under 18, and if we learn we have, we delete it.</p>
      </Section>

      <Section title="9. Your rights">
        <p>Wherever you live, you can see your data, take a copy of it, correct your labels, and delete all of it, from within the service. If your jurisdiction gives you further rights, email us and we will honour them.</p>
      </Section>

      <Section title="10. Changes">
        <p>If we change this policy in a way that matters, we will tell you by email or in the service before the change takes effect, and we will update the date at the top.</p>
      </Section>

      <Section title="11. Contact">
        <p>{ENTITY}, <a href={`mailto:${CONTACT}`} className="underline underline-offset-4">{CONTACT}</a>.</p>
      </Section>
    </LegalPage>
  );
}
