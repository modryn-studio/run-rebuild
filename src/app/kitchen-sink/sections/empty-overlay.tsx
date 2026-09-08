import { Upload } from 'lucide-react';
import { Note, Row, Section } from '../_components/section';
import { PageEmptyOverlay } from '@/components/ui/page-empty-overlay';
import { Button } from '@/components/ui/button';
import { LastSession } from '@/components/views/today/last-session';
import { MonthCalendar } from '@/components/views/today/month-calendar';
import { LAST_SESSION_FIXTURE } from '@/lib/examples/trades';
import { CALENDAR_FIXTURE } from '@/lib/examples/today';

/* THE DAY-ONE PATTERN, racked in the same commit it shipped. What to check: the example reads as
 * the real page at 40% and takes no pointer; the card floats at the raised shadow, not the card one;
 * the headline is `text-h2` and wraps to two lines at most at the card's width; the CTA is the
 * primary button and nothing else on the card is pressable. Compare against `app.monarch.com` with
 * an empty account - it is the same component under every one of their pages. */
export function EmptyOverlaySection() {
  return (
    <Section
      id="empty-overlay"
      title="Day one"
      intro="The reference's empty state: the page rendered with example data at 40% opacity and inert, with one white card over it - a 24px accent icon, a two-line headline, one CTA. Copied from the DOM (500x243, 24px padding, 12px radius, raised shadow; icon to headline 27px, headline to CTA 32px). Only the copy changes per page. Today, Accounts and Trades all use it; the read does not, because an unbuilt page is not an empty one."
    >
      <Row label="On two cards" note="the example takes no pointer; the card is the only live thing">
        <div className="max-w-4xl">
          <PageEmptyOverlay
            icon={Upload}
            headline="Let's begin with the export from the account you trade most"
            cta={<Button>Import your trades</Button>}
          >
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              <LastSession session={LAST_SESSION_FIXTURE} href="/trades" imported zone="America/Chicago" />
              <MonthCalendar days={CALENDAR_FIXTURE} endsOn="2027-03-19" imported />
            </div>
          </PageEmptyOverlay>
        </div>
        <Note>
          <strong>The example is the one place this product shows a number it cannot reconcile</strong>,
          and the overlay&rsquo;s note is the fence: 40%, inert, under a card whose first words are
          &ldquo;Let&rsquo;s begin&rdquo;. Example data anywhere else, or at full opacity, is a bug.
        </Note>
      </Row>
    </Section>
  );
}
