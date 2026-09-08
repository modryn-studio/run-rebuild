'use client';

/* THE `/today` RACK - the widget contract and every card that wears it (`S8`).
 *
 * RENAMED FROM `daily-recap.tsx` ON 2026-09-04, and the rename is the record of a decision rather
 * than tidying. This section was built when the recap WAS `/today`; it now racks `Net P&L` and
 * `Last session`, the two cards that shipped, and the recap is one specimen among them. On
 * 2026-09-03 that card was reset to a blank sheet (Luke: *"forget everything we have created for
 * this and start from scratch"*), so it holds no design authority here - it stays racked because
 * the component still compiles and a specimen costs nothing, not because it is the subject.
 * `monarch-dashboard-teardown.md` §A3.
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
import { AttentionRow } from '@/components/views/today/attention-strip';
import { Icon } from '@/components/ui/icon';
import { DailyRecap } from '@/components/views/today/daily-recap';
import { NetPnl } from '@/components/views/today/net-pnl';
import { LastSession } from '@/components/views/today/last-session';
import { MonthCalendar, type CalendarDay } from '@/components/views/today/month-calendar';
import { ScopeRow } from '@/components/views/today/scope-sheet';
import { ForcePhone } from '@/lib/use-phone';
import {
  PlotSkeleton,
  SessionRowsSkeleton,
  WidgetSkeleton,
} from '@/components/views/today/widget-skeleton';
import { LAST_SESSION_FIXTURE, LAST_SESSION_THIN } from '../_fixtures/trades';
import {
  RECAP_COMPARISON,
  RECAP_EMPTY,
  RECAP_PENDING,
  RECAP_PLAIN,
  RECAP_STRONG,
  RECAP_THIN,
  NET_PNL_SERIES,
  NET_PNL_ONE,
  NET_PNL_INTRADAY,
} from '@/components/views/today/fixtures';
import { Note, Row, Section } from '../_components/section';

/* A MONTH WITH ALL FOUR CELL STATES IN IT, and the flat day is the one a happy-path fixture never
   has. Two months so the arrows have somewhere to go and their clamp is visible at both ends: the
   back arrow dies on February, the forward arrow on March. */
const CALENDAR_FIXTURE: CalendarDay[] = [
  { day: '2027-02-24', cents: 41_250, trades: 6 },
  { day: '2027-02-25', cents: -18_800, trades: 11 },
  { day: '2027-02-26', cents: 7_400, trades: 3 },
  { day: '2027-03-01', cents: 84_000, trades: 9 },
  { day: '2027-03-02', cents: -61_025, trades: 14 },
  { day: '2027-03-03', cents: 0, trades: 2 },
  { day: '2027-03-04', cents: 12_600, trades: 4 },
  { day: '2027-03-05', cents: -3_450, trades: 7 },
  { day: '2027-03-08', cents: 1_284_000, trades: 21 },
  { day: '2027-03-09', cents: -22_100, trades: 5 },
  { day: '2027-03-11', cents: 9_900, trades: 3 },
  { day: '2027-03-12', cents: -7_250, trades: 8 },
  { day: '2027-03-16', cents: 33_400, trades: 6 },
  { day: '2027-03-17', cents: 0, trades: 1 },
  { day: '2027-03-18', cents: -14_050, trades: 9 },
  { day: '2027-03-19', cents: 52_775, trades: 12 },
];

/** `trader.display_timezone`'s stand-in. DISPLAY ONLY - it labels an axis and never buckets. */
const ZONE = 'America/Chicago';

export function TodaySection() {
  return (
    <Section
      id="today"
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
        <div className="grid max-w-4xl items-start gap-4 lg:grid-cols-2">
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

      <Row
        label="Net P&L"
        note="the first card on /today, and the reference's own chart component in a second wrapper"
      >
        <div className="grid max-w-4xl items-start gap-4 lg:grid-cols-2">
          <NetPnl
            series={NET_PNL_SERIES}
            intradaySeries={NET_PNL_INTRADAY}
            counted={3}
            scopeName={null}
            imported
            baseDollars={150_000}
            zone={ZONE}
          />
          <NetPnl
            series={NET_PNL_SERIES}
            intradaySeries={NET_PNL_INTRADAY}
            counted={1}
            /* THE SCOPED SPECIMEN. One account picked, so the trailing clause on a phone names it
               rather than counting to one. */
            scopeName="Tradeify 150K (...4425)"
            imported
            baseDollars={null}
            zone={ZONE}
          />
        </div>
        <Note>
          <strong>Open the period menu and step through it.</strong> All seven ranges, the same
          scale <code>/accounts</code> offers. This shipped with six and <code>1 day</code> was the
          one missing, on the argument that the day belongs to the <code>Last session</code> card:
          true about the <em>record</em>, false about the <em>curve</em>. It costs a second query,
          because a 1-day series is keyed by instants and cannot be sliced out of the daily one, so
          the page takes the same second read <code>/accounts</code> does. The default is{' '}
          <code>1 month</code>, meaning one calendar month back from the corpus&rsquo;{' '}
          <em>last trading day</em>: the same window <code>/accounts</code> draws under the same
          word, from the same <code>windowStart</code>.
        </Note>
        <Note>
          <strong>No &ldquo;1 week change&rdquo; after the delta.</strong> It sat ~20px from a menu
          already reading <code>1 week</code>, which is the trader&rsquo;s own selection spelled
          back at them. The reference prints both; this is where the port stops.{' '}
          <code>periodLabel</code> is optional on <code>TrendIndicator</code> now, and the whole
          trailing span disappears rather than rendering empty, or the row&rsquo;s{' '}
          <code>gap-x-1.5</code> would leave 6px of unexplained air after the figure. The phone
          keeps <code>periodShort</code>, because there it carries the account coverage and the
          summary rail is a screen below the fold.
        </Note>
        <Note>
          <strong>The title links to <code>/accounts</code>, not <code>/trades</code>.</strong> The
          reference&rsquo;s <code>Net worth</code> widget points at its accounts page and its{' '}
          <code>Transactions</code> widget points at the transactions one. The rule underneath: a
          widget&rsquo;s title goes to the page that <em>owns its subject</em>. This figure&rsquo;s
          subject is the accounts it is summed across; the round trips belong to{' '}
          <code>Last session</code>.
        </Note>
        <Note>
          This is <code>Plot</code>, the same component <code>/accounts</code> draws, at the same
          275px with the same six gridlines. Read out of the reference&rsquo;s markup on 2026-09-03
          rather than inferred: its dashboard widget and its accounts page both render{' '}
          <code>NetWorthPerformanceChart__LineChartContainer</code> at <code>height 275</code>, and
          only the width differs. The widget compresses by collapsing a button row into a dropdown
          and rounding the figure, <em>not</em> by shrinking the chart. An earlier plan here
          called for a 96px sparkline with the axes off; that was reasoned from the card&rsquo;s
          size instead of read out of it.
        </Note>
        <Note>
          <strong>A widget is not a small page, and this card shipped as one for an hour.</strong>{' '}
          Read with <code>getComputedStyle</code> on both running apps: between the
          reference&rsquo;s dashboard widget and its accounts page, exactly <em>one</em> thing
          shrinks: the figure, 24px &rarr; 18px. The delta stays 16/600, the axis stays
          12/500, the chart stays 275px, and the eyebrow is dropped. Their widget comes out{' '}
          <strong>15px shorter</strong> than their page card. Ours shrank nothing: 26px on both, and
          the widget was <strong>36px taller</strong> than the page card it was meant to compress.
        </Note>
        <Note>
          The fix was <em>where the figure lives</em>, not a smaller font. Their widget has no
          figure row at all. <code>CardTitle</code> IS the figure, one 18/500 ink span
          reading <code>-$334,452 net worth</code>, with the delta in the{' '}
          <code>Description</code> slot beside it, both inside the same <code>&lt;a&gt;</code>, and
          the body holding nothing but the chart. So the title here is{' '}
          <code>-$2,092.29 net P&amp;L</code> and the period slot takes the{' '}
          <code>TrendIndicator</code>. That deleted a 30px row and its 16px gap: the card is now
          372px against <code>/accounts</code>&rsquo; 382, which is the reference&rsquo;s own
          relationship rather than the inverse of it.
        </Note>
        <Note>
          It also <em>satisfies</em> §2a instead of bending it. The header row is now one type size
          (18px) and hierarchy comes from ink and weight alone: ink figure, muted qualifier,
          coloured delta. The first build put a 26px figure under an 18px title, which is two sizes
          in one card. What deliberately does <em>not</em> shrink: the plot, the axis and the delta.
          A widget is compact by carrying less chrome, not by printing the same chrome smaller.
        </Note>
        <Note>
          <strong>The headline is all-time and the delta is windowed</strong>, which is the one
          place this diverges from the reference on purpose. Net worth is a <em>balance</em>, so
          Monarch can window both; P&amp;L is a <em>flow</em>, so a windowed headline IS the delta
          and printing both prints one number twice. <code>pnl-chart.tsx</code> settled that, and a
          card beside it may not disagree.
        </Note>
        <Note>
          The second specimen has <strong>no stated account size</strong>, so the delta prints no
          percentage rather than a confident wrong one. Null the moment <em>one</em> counted account
          is unsized. A percentage against a partial base is a wrong number, not a partial
          one, and it would drift toward looking right as more accounts got labelled.
        </Note>
        <Note>
          <strong>The picker sits in the header&rsquo;s right edge, outside the link.</strong> That
          is the reference&rsquo;s <code>DashboardWidget__HeaderRight</code>, a sibling of{' '}
          <code>HeaderClickable</code>, and the reason is mechanical as much as visual: a{' '}
          <code>&lt;button&gt;</code> inside an <code>&lt;a&gt;</code> is invalid HTML and clicking
          the menu would navigate. The clickable is <code>flex-1</code> and carries the padding, so
          a widget with no control renders the box it did before the slot existed. Hover the
          three headers in &ldquo;The standard&rdquo; above and below to confirm the ground still
          reaches the card&rsquo;s edges.
        </Note>
      </Row>

      <Row
        label="The lane, above the grid"
        note="chrome, not a card: recessed where every widget is raised"
      >
        <div className="max-w-2xl">
          <AttentionRow
            tone="answer"
            title="Let's review your accounts"
            note="1 to check"
            onClick={() => {}}
          />
          <AttentionRow
            tone="answer"
            title="Let's review your accounts"
            note="5 to check"
            onClick={() => {}}
          />
        </div>
        <Note>
          The empty state is <strong>no element at all</strong>, which is why it has no specimen
          here: the strip is a pure function of the account rows and the import log, so there is
          never a &ldquo;0 to answer&rdquo; row. Position is the whole attention budget. It sits
          above the headline figure, in a slot nothing else occupies, and it was not on the page
          yesterday.
        </Note>
      </Row>

      <Row
        label="The second tone, specified and unoccupied"
        note="no tenant wears it today; §A14 sent quarantine to the operator"
      >
        <div className="max-w-2xl">
          <AttentionRow
            tone="numbers"
            title="2 trades we could not match"
            note="Out of every figure below"
          />
          <AttentionRow
            tone="answer"
            title="Let's review your accounts"
            note="1 to check"
            onClick={() => {}}
          />
        </div>
        <Note>
          The lane was built general, against a second tenant that has since been ruled out:{' '}
          <strong>§A14 sent quarantine to the operator</strong>, because three of its four causes are
          Run defects a trader cannot resolve. So this row is a <em>specimen of the vocabulary</em>,
          not of a shipping surface. The top row draws <strong>no chevron</strong>, which is the rule
          it demonstrates: a chevron promises somewhere to go, and a row with no remedy has nowhere.
        </Note>
        <Note>
          Kept because it costs one prop and it settles two things in advance. The mark carries the
          distinction and so does the <em>shape</em>. <code>finding-notice.tsx</code>:{' '}
          <em>colour alone would put the whole distinction on the one axis a colourblind trader
          cannot use</em>. And if a second tenant ever arrives, both rows render in priority order,
          never a count: folding them into &ldquo;and 1 more&rdquo; is the backlog sentence §A15
          struck, in fewer characters.
        </Note>
      </Row>

      <Row
        label="The filled version, tried and reverted"
        note="racked as evidence: the fill needs a palette Run does not have"
      >
        <div className="max-w-2xl">
          <div className="bg-accent text-accent-fg mt-4 flex w-full items-center gap-3.5 rounded-[var(--radius)] px-4 py-3.5">
            <Icon name="accounts" size={24} className="shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="text-body-lg block font-medium">3 accounts need you</span>
              <span className="text-body block">2 new, 1 not in your last import.</span>
            </span>
            {/* The old copy and the old type scale, kept together on purpose: this specimen is what
                the bar looked like before 2026-09-08, and changing half of it would make the
                comparison dishonest. */}
            <Icon name="chevron" size={20} className="shrink-0 -rotate-90" />
          </div>
        </div>
        <Note tone="danger">
          Shipped for part of 2026-09-08 and reverted once both products were read off their markup.
          Monarch splits three jobs across three hues: data is cyan <code>#00a2c7</code>, the default
          primary control is near-black <code>#222221</code>, and orange <code>#ff692d</code> is
          brand and attention. <strong>Their banner is loud because orange appears nowhere in their
          data.</strong> Run has one accent by decision, and it is already <code>Button</code>{' '}
          primary, the selection state, the switch, the badge and the chart line: this bar would sit
          about 200px above a <code>Plot</code> stroked in the identical token.
        </Note>
        <Note>
          The round trip was not wasted. The first recessed bar was a thin 56px row with a 16px mark
          and it genuinely was too quiet; the geometry pass answered that and survives the revert.
          The fill was solving a problem the geometry had already solved. Reopen the palette when
          there is a message that earns a loud hue: slot 3 is the self-set daily loss line, and{' '}
          <code>warn</code> is already documented as the red-zone gauge.
        </Note>
      </Row>

      <Row label="Net P&L, the states that ship wrong" note="one session, no totals, and day one">
        <div className="grid max-w-4xl items-start gap-4 lg:grid-cols-2">
          <NetPnl
            series={NET_PNL_ONE}
            intradaySeries={NET_PNL_INTRADAY}
            counted={1}
            scopeName={null}
            imported
            baseDollars={50_000}
            zone={ZONE}
          />
          {/* THE STATE THIS CARD SHIPPED WRONG. `imported` is true and the series is EMPTY, which
              is what switching every account out of totals actually produces - not a shorter
              series, an absent one. Racked as the page produces it rather than as it reads well. */}
          <NetPnl
            series={[]}
            intradaySeries={[]}
            counted={0}
            scopeName={null}
            imported
            baseDollars={null}
            zone={ZONE}
          />
          <NetPnl
            series={[]}
            intradaySeries={[]}
            counted={0}
            scopeName={null}
            imported={false}
            baseDollars={null}
            zone={ZONE}
          />
          {/* THE THIRD BLANK, added by the 2026-09-03 postcheck. `counted` is 1 and the series is
              empty, which is a real scope holding nothing - NOT an exclusion, and it used to say so
              anyway. Racked because the three read almost alike and only one of them is about a
              switch the trader can flip. */}
          <NetPnl
            series={[]}
            intradaySeries={[]}
            counted={1}
            scopeName="Personal (...4470)"
            imported
            baseDollars={null}
            zone={ZONE}
          />
        </div>
        <Note>
          <strong>One session</strong> draws the move off the baseline, not a floating dot, and
          that is <code>cumulate</code>&rsquo;s zero anchor doing its job: it opens the line at the
          axis on the day before the first one that moved, because cumulative P&amp;L before you
          have traded <em>is</em> zero. Without it a first winning day would start partway up the
          plot with no baseline to read it against. Every range collapses to the same two points
          here, which is the honest answer rather than a bug.
        </Note>
        <Note>
          <strong>Every account left out of totals</strong> is a state a trader can reach from{' '}
          <code>/accounts</code> and then not understand, so the card names the switch instead of
          reporting zero. v2 shipped the other way and its rail read +$954.99 under a chart reading
          &minus;$26,995.06.
        </Note>
        <Note>
          <strong>Day one replaces the plot rather than drawing an empty one</strong>, which is what
          the reference does on its Investments widget. 275px of unlabelled grid is a worse answer
          than a sentence on the one screen a new trader opens first. No button: the header is
          already the door to <code>/trades</code>, and a call to action inside a card that is
          already one target is a second thing to aim at. The picker is <em>absent</em>, not
          disabled: a period control belongs only where more than one period is answerable.
        </Note>
        <Note>
          <strong>The third blank is a real scope holding nothing.</strong> One account picked, Run
          holds no countable trades for it. That state used to print{' '}
          <em>&ldquo;Every account is left out of totals. Turn one back on from Accounts&rdquo;</em>{' '}
          over an account that is not excluded and cannot be turned back on. Only a hand-edited URL
          reaches it (neither picker offers a no-trade account), but a sentence that is
          correct only because of who can reach it is a trap for the next surface reading the same
          param.
        </Note>
        <Note>
          And it does not <em>count</em>. No &ldquo;no imports yet&rdquo;, no days, no zero. It says
          what the card will hold, not what is missing: the re-entry rule, and the one this
          card was most likely to break.
        </Note>
      </Row>

      <Row
        label="A widget, waiting"
        note="the loading mark for every card /today will ever hold"
      >
        <div className="grid max-w-4xl items-start gap-4 lg:grid-cols-2">
          <WidgetSkeleton>
            <PlotSkeleton />
          </WidgetSkeleton>
          <WidgetSkeleton scope={false}>
            <PlotSkeleton />
          </WidgetSkeleton>
        </div>
        <Note>
          <strong>Skeleton, decided once for the whole page.</strong>{' '}
          <code>design-system.md</code> §7 asks one question: do you know the{' '}
          <em>shape</em> of what is arriving? On <code>/today</code> the answer is always yes, more
          strongly than anywhere else in the app, because a widget&rsquo;s geometry is fixed by{' '}
          <code>Widget</code> before any data exists. So there is nothing a spinner could honestly
          stand in for. The numbers: a skeleton reads as up to <strong>50% faster</strong> at
          identical real load times, and NN/g finds the benefit lands in the{' '}
          <strong>400ms&ndash;3s</strong> band, which is where a two-query dashboard read sits.
        </Note>
        <Note>
          §7 also bans the spinner from a navigation outright: <em>a tap that opens a screen is not
          a request in flight, it is a surface arriving, and the wait belongs at the destination in
          the shape of what is coming.</em> A spinner inside a card is that mistake with a card
          around it. The spinner keeps one job in this product: inside buttons. The wordmark keeps
          one: a cold entry into the app.
        </Note>
        <Note>
          <strong>Three bars in the header, not one</strong>, because the real header holds three
          things at fixed positions and all three exist before the data does. One wide bar would say
          &ldquo;something arrives here&rdquo; and then reflow into three, which §7 calls out as
          reading worse than the spinner it replaced. Widths are ragged at roughly the real
          measures. The second specimen drops the control: not every card will have one, and the
          reference prints <code>this month</code> as a <em>label</em> on its Goals and Recurring
          widgets, where only one period is answerable.
        </Note>
        <Note>
          <strong>Compare its height to the live card above.</strong> Every class is copied from{' '}
          <code>widget.tsx</code> rather than approximated, and the body reads{' '}
          <code>Plot</code>&rsquo;s own <code>--chart-h</code> values &ndash; 242px below{' '}
          <code>sm</code>, 275 above. Round that to a convenient number and the card jumps 33px on
          a phone at the moment the data lands, which is the reflow the skeleton exists to prevent.
        </Note>
        <Note>
          On the route it is wrapped in <code>.wait-reveal</code>, which holds it invisible for
          300ms and then fades it in over 200ms &ndash; most navigations here are prefetched and
          land inside that window, where a mark that appears and vanishes <em>adds</em> a flicker.
          Measured: at a 20x CPU throttle, a client navigation from <code>/accounts</code> to{' '}
          <code>/today</code> rendered no skeleton frame at all. It is not wrapped here, because a
          specimen you cannot see is not a specimen.
        </Note>
      </Row>

      <Row
        label="Net P&L on a phone"
        note="press and drag across the chart - the header reads, not a tooltip"
      >
        <ForcePhone value>
          <div className="max-w-[390px]">
            <NetPnl
              series={NET_PNL_SERIES}
              intradaySeries={NET_PNL_INTRADAY}
              counted={9}
              scopeName={null}
              imported
              baseDollars={450_000}
              zone={ZONE}
            />
          </div>
        </ForcePhone>
        <Note>
          <strong>Hold the chart and slide.</strong> The reference&rsquo;s iOS app answers a scrub
          in the card&rsquo;s <em>header</em> rather than with a popover: the title&rsquo;s{' '}
          <code>net P&amp;L</code> drops, the figure becomes the hovered point&rsquo;s running
          level, the delta recomputes against the window&rsquo;s base, and the date lands to the
          right of it. A tooltip on a 390px chart is drawn under the thumb that summoned it, and the
          finger covers roughly the area the panel needs.
        </Note>
        <Note>
          <strong>The 1-day range is the one that had a bug.</strong>{' '}
          <code>foldIntraday</code> anchors the session at its open with{' '}
          <code>cents: 0</code>, so that curve describes the day&rsquo;s <em>movement</em> while
          every other range is a slice of the cumulative series, where a point <em>is</em> the
          running level. Read the same way, the first dot printed <code>$0.00</code>, which tells a
          trader they are flat on the year because they are flat on the morning. The previous
          session&rsquo;s close is added back, so the first dot reads the morning&rsquo;s balance
          against a <code>$0.00</code> change, and the last reads the all-time total against the
          day&rsquo;s move.
        </Note>
        <Note>
          <strong>What this specimen can and cannot show.</strong>{' '}
          <code>ForcePhone</code> overrides the <em>hook</em>, so the scrub readout and the
          suppressed tooltip are real here. It cannot override a <em>media query</em>: the chip row
          under the chart and the header&rsquo;s <code>filter</code> mark are{' '}
          <code>sm:hidden</code> / <code>md:hidden</code>, which resolve against the viewport rather
          than this box. Open <code>/kitchen-sink</code> on a real phone for those, which is why this
          route ships to production rather than living on localhost.
        </Note>
      </Row>

      <Row label="Which account" note="the phone sheet's rows, behind the header's filter mark">
        <div className="border-rule max-w-[390px] overflow-hidden rounded-lg border">
          <ScopeRow label="All accounts" selected onClick={() => {}} />
          <ScopeRow label="Apex Trader Funding 50K (...4021)" selected={false} onClick={() => {}} />
          <ScopeRow label="Take Profit Trader 100K (...3145)" selected={false} onClick={() => {}} />
          <ScopeRow label="Tradeify 150K (...4425)" selected={false} onClick={() => {}} />
        </div>
        <Note>
          <strong>The sheet itself cannot be racked</strong>, and that is a property of the sheet
          rather than a gap: it is <code>fixed inset-0</code>, so a specimen would cover the page it
          is specimened on. Its trigger cannot either: the mark is <code>md:hidden</code> and does
          not render at a desktop viewport. The row is the part with states.
        </Note>
        <Note>
          <strong>Second row long enough to wrap is the case to watch.</strong> Account labels are
          composed by <code>toFacetAccount</code> and run to about 30 characters; at 390px the
          longest of them nearly fills the row beside the tick. It truncates rather than wrapping,
          because a two-line row in a list of one-line rows reads as a different kind of thing.
        </Note>
        <Note>
          The tick is on the <strong>right</strong>, which is where every other selected row in this
          app puts it, and the row is one type size: the selected state is carried by the mark and
          the weight, never by a second size.
        </Note>
      </Row>

      <Row
        label="Last session"
        note="card 2 on /today, and the proof under card 1's figure"
      >
        <div className="grid max-w-4xl items-start gap-4 lg:grid-cols-2">
          <LastSession
            session={LAST_SESSION_FIXTURE}
            href="/trades"
            counted={3}
            imported
            zone={ZONE}
          />
          <LastSession
            session={LAST_SESSION_THIN}
            href="/trades"
            counted={1}
            imported
            zone={ZONE}
          />
        </div>
        <Note>
          <strong>Six rows in the fixture, five on the card, and the count says 5.</strong> That is
          not a bug in the specimen, it is the behaviour worth racking:{' '}
          <code>sessionTotals</code> counts <code>state = &lsquo;ok&rsquo;</code> only, so the
          quarantined row is <em>listed, marked and out of every total</em>. Doctrine requires it -
          an exclusion may never silently shrink the record - and this card is where a trader would
          notice it, which is most of the reason the card exists.
        </Note>
        <Note>
          <strong>Why Run has this card at all</strong> is the question{' '}
          <code>monarch-dashboard-teardown.md</code> §3.9 was missing until 2026-09-04. The
          reference&rsquo;s <code>Transactions</code> widget is an <em>action queue</em> - somewhere
          to categorise without navigating - and Run deleted that chore. This one is the{' '}
          <em>proof</em> under card 1: a curve cannot demonstrate &ldquo;our numbers are the
          broker&rsquo;s numbers&rdquo;, and rows can.
        </Note>
        <Note>
          <strong>No picker and no call to action</strong>, and each is a rule rather than a
          simplification. The account scope is <em>page-level</em> (§A8), so a control here would be
          a second answer to &ldquo;which accounts&rdquo;. And the header is already the link, to{' '}
          <code>/trades</code> pinned to this session - a pill under the rows would be a second thing
          to aim at inside a card that is already aimed at.
        </Note>
        <Note>
          <strong>Two columns, not four, and this rack row is what caught it.</strong> The first
          build passed <code>hidden={'{[]}'}</code>. <code>TradeRow</code> is sized for a full-width
          tape and its <code>sm:</code> rules are <em>viewport</em> queries, so in a narrow card at a
          wide viewport every column renders and the elastic two collapse - measured here at 416px:
          instrument 27px, account 45px, and the instrument name at <em>zero</em>. A half-width{' '}
          <code>/today</code> card is 376px at a 1024 viewport and does not clear 560 until about
          1400, so no amount of column-dropping saves the four-column form.
        </Note>
        <Note>
          <strong>The reference already answered it:</strong> Monarch&rsquo;s own{' '}
          <code>Transactions</code> widget row is the merchant and the amount - no account, no time,
          both of which live on its full page. So this card draws{' '}
          <code>TradeRow</code>&rsquo;s own <em>phone</em> form at every width, which{' '}
          <code>trades-tape.tsx</code> already designed and already defends: the list is for
          scanning, the detail is for checking. What it costs is stated in the component - the
          account is one tap away in <code>TradeSheet</code>, and the page&rsquo;s scope band already
          names which accounts are in view.
        </Note>
        <Note>
          The date is <code>displaySessionDate</code> - the same string <code>/trades</code> prints on
          its session bands, and longer than a widget header wants. Reused anyway:{' '}
          <code>lib/time/session.ts</code> owns every date in this product so two surfaces cannot
          disagree about which day it is, and <code>Widget</code>&rsquo;s head wraps.
        </Note>
      </Row>

      <Row
        label="Last session, the states that ship wrong"
        note="day one, every account excluded, and a scope that holds nothing"
      >
        <div className="grid max-w-4xl items-start gap-4 lg:grid-cols-2">
          <LastSession session={null} href="/trades" counted={0} imported={false} zone={ZONE} />
          <LastSession session={null} href="/trades" counted={0} imported zone={ZONE} />
          <LastSession session={null} href="/trades" counted={2} imported zone={ZONE} />
          <WidgetSkeleton scope={false}>
            <SessionRowsSkeleton />
          </WidgetSkeleton>
        </div>
        <Note>
          <strong>Three blanks, not one</strong>, and they are word for word{' '}
          <code>Net P&amp;L</code>&rsquo;s. The two cards describe one set of accounts, so a page
          that explained one condition two different ways would be worse than either. Day one names
          what the card will hold; the second names the switch on <code>/accounts</code> that emptied
          it; the third is a scope that is real and holds nothing.
        </Note>
        <Note>
          <strong>None of them prints a date, and none of them counts.</strong> No &ldquo;0
          sessions&rdquo;, no &ldquo;last traded 9 days ago&rdquo;, no date Run holds no trades for.
          That is <code>CLAUDE.md</code>&rsquo;s re-entry rule, and this is the card most able to
          break it: a session card is exactly the shape that wants to tell you how long it has been.
        </Note>
        <Note>
          <strong>The skeleton is the fourth specimen</strong> because it is a shipped state.{' '}
          <code>scope={'{false}'}</code>: this card mounts no header control, and a boundary drawing a
          112px bar where nothing will land is a boundary that reflows by exactly that much.
        </Note>
      </Row>

      <Row
        label="The month"
        note="the reference's calendar, the field's cell (§A16)"
      >
        <div className="grid max-w-4xl items-start gap-4 lg:grid-cols-2">
          <MonthCalendar
            days={CALENDAR_FIXTURE}
            endsOn="2027-03-19"
            counted={3}
            imported
          />
          <MonthCalendar days={[]} endsOn={null} counted={0} imported={false} />
        </div>
        <Note>
          <strong>Three grounds and a blank, and the blank is the fourth state.</strong> A winning
          day, a losing day, and a <em>break-even</em> day that was traded and moved nothing - which
          gets the recessed ground rather than being rounded up into green. A day with no trades has
          no fill at all: it is not part of the record, which is a different fact from a zero in it.
        </Note>
        <Note>
          <strong>The muted numeral opposite the date is the trade count</strong>, not a second
          date. It was <code>9 trades</code> on its own line and it clipped to{' '}
          <code>14 trade</code> at this width - seven columns inside a half-width card leaves ~47px
          of cell, and <code>text-caption</code> is the smallest step the system has. The word
          survives in the cell&rsquo;s <code>aria-label</code>, where there is no width at all.
        </Note>
        <Note>
          <strong>The figure in a cell is ink, not pos/neg</strong>, and it is the one place this
          departs from the tape&rsquo;s row rule on purpose. The <em>ground</em> already carries the
          sign, so colouring the number as well would stack two signals on one axis and leave a
          colourblind trader with neither. Weight carries the emphasis instead.
        </Note>
        <Note>
          <strong>Open the arrows and walk back.</strong> They clamp to the data - back to the first
          month with trades, forward to the month of the last trading day - so the control cannot
          walk into a month that could only ever be empty. The card opens on the month of{' '}
          <code>endsOn</code>, never on today&rsquo;s: a trader back after two weeks lands on the
          month they actually traded.
        </Note>
      </Row>
    </Section>
  );
}
