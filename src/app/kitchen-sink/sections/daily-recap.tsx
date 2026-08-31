'use client';

/* THE DASHBOARD WIDGET, AND THE READ IT CARRIES (`S8`).
 *
 * Racked in the same change that built it, and this is the section that most needs to exist:
 * `/today` shows ONE state, and the other four are the ones that ship wrong. A card designed
 * against a good read is a card that looks broken on a Tuesday.
 *
 * THE TWO "ready" SPECIMENS ARE THE POINT. One is a sharp read that names a mechanism and prices
 * it; the other is an ordinary session where nothing much happened and the read says so. If the
 * card only reads well over the first, the card is wrong - and that is a judgement nobody can make
 * from one fixture.
 *
 * THE OVERLAY IS NOT RACKED HERE. It is a full-screen sheet on a phone and a centred dialog on a
 * desktop, both of which cover the rack they would be specimened in. Open it from a card - every
 * `Read it` here is live.
 */

import { Widget } from '@/components/views/today/widget';
import { DailyRecap } from '@/components/views/today/daily-recap';
import {
  RECAP_EMPTY,
  RECAP_PENDING,
  RECAP_PLAIN,
  RECAP_STRONG,
  RECAP_THIN,
} from '@/components/views/today/fixtures';
import { Note, Row, Section } from '../_components/section';

export function DailyRecapSection() {
  return (
    <Section
      id="daily-recap"
      title="Dashboard widgets"
      intro="Monarch's widget contract, ported: the title links to the page that owns the concept, the period sits beside it, and the body is a chart, a list, or an empty state with a specific CTA. No widget paginates, on either product."
    >
      <Row label="Your Daily Recap" note="a read exists, and the card carries its own first line">
        <div className="max-w-md">
          <DailyRecap recap={RECAP_STRONG} />
        </div>
        <Note>
          Monarch&rsquo;s recap card says the same generic sentence every week, because a recap
          covering four subjects has no single first line. A read about one thing does, so this card
          says something true about the trader before they tap. It is the one place this beats the
          reference rather than copying it.
        </Note>
        <Note>
          The period is the SESSION, never &ldquo;today&rdquo; or &ldquo;yesterday&rdquo;. A session
          closing at 16:00 CT is read within the hour, so the same read is today&rsquo;s to a trader
          who looks that evening and yesterday&rsquo;s to one who looks in the morning. Naming the
          day is true at every hour, and it does not quietly count how long you have been away.
        </Note>
      </Row>

      <Row label="An ordinary session" note="the specimen that decides whether the card is right">
        <div className="max-w-md">
          <DailyRecap recap={RECAP_PLAIN} />
        </div>
        <Note>
          Nothing dramatic happened and the read says so. This is four days out of five, and a card
          tuned to the specimen above would read as an anticlimax here. It still ends on something
          the trader can hold: fees took 40% of the gross.
        </Note>
      </Row>

      <Row label="Too thin to read" note="the engine ran and declined">
        <div className="max-w-md">
          <DailyRecap recap={RECAP_THIN} />
        </div>
        <Note>
          It never fills the space with a metric definition. It says what happened and what would
          change it, which is the P9 rule: an empty state is specific or it is not worth drawing.
        </Note>
      </Row>

      <Row label="No read yet" note="a corpus exists, the job has not run">
        <div className="max-w-md">
          <DailyRecap recap={RECAP_PENDING} />
        </div>
        <Note>
          Reachable two ways: before the first nightly run, and after one that failed. It states
          when the read arrives rather than apologising, because a trader who reads
          &ldquo;something went wrong&rdquo; on a surface about their own money has learned
          something worse than nothing.
        </Note>
      </Row>

      <Row label="Day one" note="the only state with nothing behind it">
        <div className="max-w-md">
          <DailyRecap recap={RECAP_EMPTY} />
        </div>
        <Note>
          The copy is <code>wireframes.md</code>&rsquo;s own, kept word for word: it names the file
          and the outcome in one line. No period beside the title, because there is no session to
          name.
        </Note>
      </Row>

      <Row label="The widget shell" note="header links out, or opens in place, or does neither">
        <div className="flex max-w-2xl flex-col gap-4">
          <Widget title="Accounts" period="6 accounts" href="/accounts">
            <p className="text-body text-muted">
              A title that links is an anchor, so it gets middle-click and copy-link-address.
            </p>
          </Widget>
          <Widget title="Your Daily Recap" period="Friday, Aug 28" onOpen={() => {}}>
            <p className="text-body text-muted">
              A title with nowhere to go is a button. Same box, same target, different element.
            </p>
          </Widget>
          <Widget title="Net P&L">
            <p className="text-body text-muted">
              A widget whose subject has no page is not interactive at all, rather than a link to
              nothing.
            </p>
          </Widget>
        </div>
        <Note>
          Read out of the reference&rsquo;s markup: the whole header block is the target
          (<code>DashboardWidget__HeaderClickable</code>), not a chevron beside it. On a phone that
          difference is the entire affordance.
        </Note>
      </Row>
    </Section>
  );
}
