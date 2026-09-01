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
  RECAP_COMPARISON,
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

      <Row label="A comparison read" note="the second evidence shape, and the same one screen">
        <div className="max-w-md">
          <DailyRecap recap={RECAP_COMPARISON} />
        </div>
        <Note>
          <strong>Open it.</strong> The evidence tier is a baseline instead of a list, because the
          claim is about a habit and a habit has no three trades to point at. The engine picks the
          shape from a closed vocabulary (<code>RecapEvidence</code>); SQL fills it; the switch ends
          on a <code>default</code> that renders the citations, so a kind this build has never heard
          of degrades to the evidence every read has rather than to an empty box.
        </Note>
        <Note>
          <strong>The baseline is counted in TRADES, never in days</strong>, and it is printed rather
          than implied. A prop account is deleted by Tradovate within minutes-to-hours of being
          failed, so a window in days assumes an account that lives for weeks.{' '}
          <code>prop-firm-identity.md</code> §6 is the evidence.
        </Note>
        <Note>
          Both figures are one type size and the rank is carried by ink. A baseline is a property of
          the figure beside it, which is what the metadata tier is for, and sizing it down
          would say it matters less, when it is the only reason the first number means anything.
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
          the app uses it: the recap, Close, Delete, the ending question, and everything
          through <code>ModalBody</code>.
        </Note>
        <Note>
          The hint is an <code>IconButton</code> rather than the reference&rsquo;s shadowed white
          circle: §3 says a control gets a border OR a shadow and only <code>Card</code> gets the
          shadow, and that primitive is already &ldquo;36px, a hairline, a hair of lift&rdquo; at
          exactly the size measured. It is <code>aria-hidden</code> and out of the tab order, because
          it duplicates a gesture the scroll region already has, and a keyboard user would meet an
          extra stop for nothing.
        </Note>
        <Note>
          <strong>The 48px fade under it is the other half of the same signal</strong>, ported
          2026-09-01 and measured off the reference&rsquo;s <code>RecapFlow__FadeOverlay</code>:
          48px tall, absolute over the foot of the scroll region,{' '}
          <code>linear-gradient(transparent, &lt;the card&rsquo;s own ground&gt;)</code>.{' '}
          <code>.modal-fade</code> reads that ground from{' '}
          <code>var(--modal-ground, var(--color-surface))</code>, which is why a card on a different
          ground does not draw a band across its own floor. It shares the arrow&rsquo;s{' '}
          <code>more</code> state, so both are gone the instant the content ends: a permanent fade
          would say &ldquo;cut off&rdquo; about a modal that simply fits.
        </Note>
        <Note>
          <strong>It is <code>ModalHeader</code>, unchanged and unparameterised</strong>: the
          same component, geometry and gutter as Add account, Edit account and Import refused:{' '}
          <code>grid h-14 grid-cols-[36px_1fr_36px] px-3</code>, a centred{' '}
          <code>text-title</code>, the close at 12px from the right, and on a phone the same{' '}
          <code>SheetHeader</code> bar with a 22px control.
        </Note>
        <Note>
          <strong>This got fixed twice, and the second attempt is the instructive one.</strong> The
          recap first hand-rolled a header outright, which cost it the phone bar entirely: below
          768px it drew a bare 14px X floating in the content. The fix for that added a{' '}
          <code>showTitle</code> prop so the desktop row could stay title-less like the
          reference&rsquo;s, and it still read as a different modal, because it was one. The
          standard is the standard: a screen that wants a third header shape is arguing with it,
          not exposing a case it missed.
        </Note>
        <Note>
          <strong>Which is why the claim is not the title.</strong> It is a sentence, and a bar
          centres one truncated line. So the bar names the SURFACE (the card&rsquo;s own words) and
          the claim opens the body underneath at <code>text-h2</code> where it has the room, under
          an <strong>accent 18px eyebrow with the mark</strong>. That is also the
          reference&rsquo;s split: chrome row, eyebrow, headline. The header carries{' '}
          <code>modal-title</code> and the claim carries no id, because a dialog&rsquo;s accessible
          name should be what it is, not the sentence it opens with.
        </Note>
      </Row>

      <Row label="The note, the thumbs and the ground" note="open any card above">
        <Note>
          <strong>The trust note is computed, not hardcoded</strong>, and{' '}
          <code>spec.md</code> P8 is why: <em>&ldquo;For Run this is provenance, not adjustability.
          Monarch&rsquo;s note ends &lsquo;you can review and adjust&rsquo;; Run has nothing to
          adjust, so Run&rsquo;s note names the source instead. Stronger, because &lsquo;this came
          from your Tradovate export of Aug 5&rsquo; is checkable, while &lsquo;you can adjust
          it&rsquo; is an invitation to doubt.&rdquo;</em> Theirs has to be generic because their
          figures depend on choices the user makes; ours depends on a count, and a count is
          checkable against <code>/trades</code> in ten seconds.
        </Note>
        <Note>
          <strong>One sentence, not two.</strong> It used to end{' '}
          <em>&ldquo;If a trade here is wrong, re-sync the account and the next read uses the
          correction&rdquo;</em>: the adjustability half P8 rules out, doing the exact damage
          P8 names: inviting doubt about a figure the first clause had just certified. Re-sync
          belongs on <code>/trades</code>, next to the trade. 14px against the body&rsquo;s 16,
          which is the reference&rsquo;s own relationship (its note measures 14/400/21).
        </Note>
        <Note>
          <strong>The thumbs sit 20px under the note</strong>, measured: their wrapper is{' '}
          <code>flex-direction: column</code> with <code>row-gap: 20px</code>. Two bare 36px pill
          buttons with 16px marks, muted at rest, and <strong>no prompt line</strong>, which is
          their shape too. A &ldquo;Was this useful?&rdquo; above them makes the product ask for
          something instead of offering somewhere to put an opinion.
        </Note>
        <Note>
          <strong>A chosen thumb FILLS rather than turning pine</strong>, and the colour call is the
          point: the accent is this product&rsquo;s one accent and it means <em>act on this</em>. An
          answered opinion is a record, not an action, so the state changes by weight and stays in
          the metadata tier the note above it lives in. <code>fill-current</code> overrides
          lucide&rsquo;s own <code>fill=&quot;none&quot;</code> attribute, which is the same
          presentation-attribute-loses-to-CSS mechanism the mark&rsquo;s <code>size-*</code> uses.
        </Note>
        <Note>
          <strong>A thumbs-down reveals two reasons, and they are different complaints.</strong>{' '}
          <em>Inaccurate</em> is a claim about the NUMBERS, which under P12 is the most serious thing
          this product can be told; <em>Unhelpful</em> is a claim about the JUDGEMENT, where every
          figure checks out and the read still was not worth opening. One is a bug report and the
          other a preference, and a single thumb cannot tell them apart.
        </Note>
        <Note>
          <strong>The whole row is one value that can be CHANGED but never cleared.</strong> One
          reason at a time, and pressing what is already chosen is a no-op, on both thumbs and
          both chips. They were independent toggles for a day on the argument that a read can be both
          inaccurate and unhelpful, which is true of the READ and false of the REPORT: a person
          pressing this has one thing they mean, and offering four states where there are three makes
          the control ask a question nobody has. The way out of a mis-tap is the other option, which
          is one press either way, and a thumbs-up drops the reason entirely.
        </Note>
        <Note>
          The chips are <code>SegmentedItem</code>, the app&rsquo;s own picked-thing toggle, with{' '}
          <strong>no size override at all</strong>. They briefly carried <code>text-body</code>
          because that component rendered at 11px, which is indefensible beside a 14px note; the
          component sits at the 12px its own comment always claimed, so{' '}
          <strong>every pill in the product is one size</strong>: these, the scope tabs and
          the chart&rsquo;s range row. Measured: 32px tall, 12px side padding, 12px type, 8px
          between. This call site states only its outline.
        </Note>
        <Note>
          Selected swaps the outline and the ink to accent rather than filling with it, because a
          solid pine pill would be the loudest object on a screen whose subject is a trader&rsquo;s
          own mistake. The border is in both states: <code>SegmentedItem</code> unselected is bare
          muted text, which reads as prose rather than as a control on the recap&rsquo;s paper card.
        </Note>
        <Note>
          <strong>This modal is the only one on the page&rsquo;s own ground.</strong> The card is{' '}
          <code>--color-bg</code> and the evidence sits on white <code>Card</code>s, which is the
          same figure-on-ground <code>/trades</code> already uses, moved inside a modal. Measured on
          the reference&rsquo;s <code>ModalCard__Root</code>: <code>rgb(246,245,243)</code>, which
          is Run&rsquo;s <code>--color-bg</code> to the byte. It is scoped here on purpose: this is
          the only modal whose body is CONTENT rather than a form or a question, so it is the only
          one with blocks that need a ground.
        </Note>
        <Note>
          <code>.modal-paper</code> sets the ground and <code>--modal-ground</code>{' '}
          <em>together</em>, because setting only the first leaves the fade resolving to its{' '}
          <code>surface</code> default and drawing a visible band. Both are per-mode by
          construction: dark measures card <code>#191918</code>, blocks <code>#222221</code>, and
          the fade ending on <code>#191918</code>.
        </Note>
        <Note>
          The footer holds one action and only the action. The thumbs were briefly out there,
          because the scroll hint was drawing on top of them at the foot of the scroller. That is
          fixed at the cause instead: the hint and its fade now share one <code>more</code> state,
          so the last row is never under them at rest.
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
          <strong>Title and period share one line</strong>, read out of the reference&rsquo;s own
          markup rather than inferred: its header is one <code>&lt;a&gt;</code> at{' '}
          <code>display:flex &middot; align-items:center &middot; gap:8px</code>, holding a{' '}
          <code>gap:4px</code> mark-and-title group and the period as its own block at 16/500 muted.
          Ours is <code>items-center</code> and <code>gap-x-2</code> to match. The one deliberate
          divergence: theirs is <code>nowrap</code> and ours wraps, because a row that cannot wrap
          can only overflow, and high browser zoom should get a second line rather than a clipped
          date.
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
