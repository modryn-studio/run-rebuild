import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Section } from '@/components/views/legal/legal-page';
import { site } from '@/config/site';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: `The terms under which ${site.name} is offered.`,
  // The exception to the app's global noindex: a legal document has to be findable.
  robots: { index: true, follow: true },
};

const EFFECTIVE = '2026-09-08';

/* THE TERMS, in plain English, and shorter than most because the product does less than most: it
 * holds a copy of a trader's own broker exports and shows them back, reconciled. The clauses that
 * matter are 5 (what the numbers are and are not), 6 (this is not advice - the CFTC line from
 * `psychology.md` §3 and `priya`'s brief), and 8 (it is a beta). Everything else is the standard
 * furniture, kept because its absence is what a lawyer notices first.
 *
 * WRITTEN FOR A US OPERATOR WITHOUT NAMING A STATE. The entity and its state of organisation are
 * Luke's to fill in (`ENTITY` below); until then the governing-law clause names the United States
 * and the operator's state of organisation, which is true and complete enough to ship a beta on.
 * House style holds even here: no em dashes, and the product speaks as "we" and "the service".
 */
const ENTITY = 'Modryn Studio';
const CONTACT = 'luke@modrynstudio.com';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" effective={EFFECTIVE}>
      <p className="text-body-lg text-pretty">
        These terms are an agreement between you and {ENTITY} (&ldquo;we&rdquo;) about your use of{' '}
        {site.name}, a trading journal for futures traders (the &ldquo;service&rdquo;). By creating an
        account or using the service you agree to them. If you do not agree, do not use the service.
      </p>

      <Section title="1. Who can use the service">
        <p>You must be at least 18 years old and able to form a binding contract. You must give us an accurate email address, because it is how you sign in and how we reach you.</p>
      </Section>

      <Section title="2. Your account">
        <p>You sign in with a code we email you, or with a Google account. You are responsible for keeping access to that email or Google account secure, and for everything done under your sign-in. Tell us at once if you believe someone else has used it.</p>
        <p>While the service is in beta, creating an account may require an invitation. We may decline or remove an account at our discretion, and you may delete yours at any time (see section 7).</p>
      </Section>

      <Section title="3. What the service does">
        <p>You upload exports from your futures broker. We parse them, store the resulting record, reconcile it against the broker&rsquo;s own figures, and show it back to you: your trades, grouped by session, with fees resolved and totals computed. We do not connect to your broker, place orders, hold funds, or have any access to your brokerage account.</p>
      </Section>

      <Section title="4. Your data and our licence to it">
        <p>The exports you upload and the record we derive from them are yours. You grant us a licence to store, process, and display that data solely to provide the service to you, to keep it secure, and to improve the service in aggregate, anonymised form. We do not sell your data and we do not share it with third parties except the infrastructure providers named in our <Link href="/privacy" className="underline underline-offset-4">Privacy Policy</Link>.</p>
        <p>You are responsible for having the right to upload what you upload. Do not upload another person&rsquo;s brokerage data without their permission.</p>
      </Section>

      <Section title="5. The numbers">
        <p>Every figure the service shows is derived from the files you upload. We work to reconcile them exactly against your broker&rsquo;s own totals, and when we cannot, the service says so rather than guessing. But the record is only as complete and accurate as the exports it was built from. Your broker&rsquo;s statements are the authoritative record of your trading; if the two ever disagree, the broker is right and you should tell us.</p>
        <p>We make no warranty that any figure is correct, complete, or suitable for tax, accounting, or regulatory purposes. Do not rely on the service for any of those without checking against your broker.</p>
      </Section>

      <Section title="6. Not financial advice">
        <p>The service describes what you have already done. It does not recommend trades, strategies, position sizes, or whether to trade at all, and nothing in it should be read as a recommendation. We are not a broker, an investment adviser, a commodity trading advisor, or a fiduciary, and we are not registered with the CFTC, the NFA, the SEC, or any similar body.</p>
        <p>Futures trading involves substantial risk of loss and is not suitable for everyone. Any decision you make about your trading is yours alone.</p>
      </Section>

      <Section title="7. Deleting your account">
        <p>You can download your complete record as a CSV and delete your account, with everything in it, from Settings at any time. Deletion is immediate and cannot be undone. We keep no copy of your record after you delete it, other than in routine backups that expire on their own schedule (see the Privacy Policy).</p>
      </Section>

      <Section title="8. The beta">
        <p>The service is offered in beta. It may change, break, lose features, or stop entirely. We may pause or end the beta at any time. Where we can, we will give notice and time to download your record first, but we cannot promise to. Do not treat the service as the only copy of anything.</p>
      </Section>

      <Section title="9. Acceptable use">
        <p>Do not attempt to access other users&rsquo; data, probe or disrupt the service, upload malicious files, scrape the service, or use it to break any law. Do not resell access to the service.</p>
      </Section>

      <Section title="10. Disclaimer and limitation of liability">
        <p>The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any kind, express or implied, including fitness for a particular purpose. To the fullest extent permitted by law, we are not liable for any indirect, incidental, consequential, or special damages, or for any trading losses, arising from your use of or inability to use the service. Our total liability to you for any claim arising from the service will not exceed the amount you paid us for it in the twelve months before the claim, or one hundred US dollars, whichever is greater.</p>
      </Section>

      <Section title="11. Changes to these terms">
        <p>We may update these terms. If a change is material, we will tell you by email or in the service before it takes effect. Continuing to use the service after that date means you accept the change.</p>
      </Section>

      <Section title="12. Governing law">
        <p>These terms are governed by the laws of the United States and of the state in which {ENTITY} is organised, without regard to conflict-of-law rules. Any dispute will be brought in the courts of that state.</p>
      </Section>

      <Section title="13. Contact">
        <p>Questions about these terms: <a href={`mailto:${CONTACT}`} className="underline underline-offset-4">{CONTACT}</a>.</p>
      </Section>
    </LegalPage>
  );
}
