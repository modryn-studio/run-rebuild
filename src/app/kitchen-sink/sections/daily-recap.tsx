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
      title="Today widgets"
      intro="The standard every card on /today follows, ported from the reference and measured off it. Two halves with a rule between them: the header is title over period, the body is the content with a chevron. Both halves are targets and both do the same thing; only the body takes a hover ground, because the body is the half carrying the chevron. No widget paginates."
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

      <Row label="The modal, and the scroll hint" note="open any card above; no modal in this app has a scrollbar">
        <Note>
          Measured on the reference&rsquo;s own recap: its scroller is <code>overflow-y: auto</code>
          with <code>scrollbar-width: none</code>, and a <strong>36px circular button</strong> sits
          centred <strong>12px above the floor</strong>, fading to <code>opacity: 0</code> at the end
          rather than unmounting. <code>ModalScroller</code> is all three of those, and every modal in
          the app uses it &mdash; the recap, Close, Delete, the ending question, and everything
          through <code>ModalBody</code>.
        </Note>
        <Note>
          The hint is an <code>IconButton</code> rather than the reference&rsquo;s shadowed white
          circle: §3 says a control gets a border OR a shadow and only <code>Card</code> gets the
          shadow, and that primitive is already &ldquo;36px, a hairline, a hair of lift&rdquo; at
          exactly the size measured. It is <code>aria-hidden</code> and out of the tab order, because
          it duplicates a gesture the scroll region already has &mdash; a keyboard user would meet an
          extra stop for nothing.
        </Note>
        <Note>
          The overlay&rsquo;s own header follows the reference&rsquo;s split: an
          <strong> accent 18px eyebrow with the mark</strong> over an <strong>ink 24px claim</strong>.
          Theirs runs 18 over 30; ours is one step down because Run&rsquo;s ramp is one step down.
        </Note>
      </Row>

      <Row label="The standard" note="three header shapes, one geometry, and the hover rule">
        <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
          <Widget title="Accounts" period="6 accounts" href="/accounts">
            <p className="text-body text-muted">
              A header that links out is an anchor, so it gets middle-click and copy-link-address.
            </p>
          </Widget>
          <Widget title="Your Daily Recap" period="Friday, Aug 28" mark="read" onOpen={() => {}}>
            <p className="text-body text-muted">
              A header with nowhere to go is a button. Same box, same target, different element.
            </p>
          </Widget>
          <Widget title="Net P&L" period="Last 30 days">
            <p className="text-body text-muted">
              A widget whose subject has no page is not interactive at all, rather than a link to
              nothing.
            </p>
          </Widget>
          <Widget title="Last session" period="Friday, Aug 28" href="/trades">
            <p className="text-body-lg text-text">&minus;$563.50 &middot; 12 trades</p>
          </Widget>
        </div>
        <Note>
          Read out of the reference&rsquo;s markup rather than off a screenshot: the whole header
          block is the target (<code>DashboardWidget__HeaderClickable</code>), not a chevron beside
          it, and the body is a second target pointing at the same place. On a phone that difference
          is the entire affordance.
        </Note>
        <Note>
          <strong>Hover the two halves.</strong> Only the body takes a ground, and that is
          deliberate: the body carries the chevron, so it is the half that already claims the
          gesture. A title that lit up as well would make one card read as two controls.{' '}
          <code>focus-visible</code> is untouched on both, because what is suppressed is a pointer
          affordance rather than the target.
        </Note>
        <Note>
          One geometry constant serves all three header shapes, so a link, a button and a plain
          block cannot drift apart. The measured reference is 78px; this is 83, because 14 is not a
          step on this scale and 16 is.
        </Note>
        <Note>
          <strong>Only the recap&rsquo;s title takes the accent</strong>, and the mark is what
          carries it: the two travel as one prop because they are one signal, not two decorations.
          A mark and a coloured title together mean <em>a machine wrote this</em>, which is the only
          distinction on a dashboard of figure cards worth a colour. The reference does the same
          thing with a red-to-orange gradient clipped to the glyphs whose end stop IS its icon&rsquo;s
          colour, so a flat token says it without the gradient this system bans. Measured 6.37:1 on
          light and 6.55:1 on dark.
        </Note>
      </Row>
    </Section>
  );
}
