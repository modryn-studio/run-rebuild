'use client';

/* WAITING STATES, ALL OF THEM, ON ONE SCREEN - and this section exists because the audit that
 * built it found a rule nothing was following (2026-09-03, Luke: *"look at all the different places
 * we use loading state as well. look at the /accounts page also. do a full review on this. also
 * look at consistency and the different loading state options."*).
 *
 * `feedback.tsx` racks the two PRIMITIVES - a `Spinner` on four grounds, a `Skeleton` on the page
 * and on a card. That is the right home for "does this mark render correctly". It is the wrong home
 * for "which mark, where, and when does it appear", which is a question about SIX ROUTE BOUNDARIES
 * and was answered differently by four of them. Those are compositions, and this project's rule is
 * that a composition is not done until the rack holds it in every state.
 *
 * WHAT THE AUDIT FOUND, and both findings are the reason this file is not just a specimen shelf:
 *
 *   1. `.wait-reveal` had one caller. It has been in `globals.css` with a paragraph of reasoning
 *      since it was written and exactly ONE component used it, so six boundaries were flashing a
 *      skeleton on prefetched navigations that already felt instant - the precise failure the class
 *      exists to prevent.
 *   2. `/accounts` had no boundary at all, so it answered a tab-to-tab move with the WORDMARK while
 *      `/trades` beside it answered with a skeleton.
 *
 * `design-system.md` §7 carries the full table and the outside sources. This is where you look at
 * it.
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingMark } from '@/components/ui/loading-mark';
import { RosterSkeleton } from '@/components/views/accounts/roster-skeleton';
import { PlotSkeleton, WidgetSkeleton } from '@/components/views/today/widget-skeleton';
import { Note, Row, Section } from '../_components/section';

export function WaitingSection() {
  return (
    <Section
      id="waiting"
      title="Waiting states"
      intro="Three marks, and one question decides which: do you know the shape of what is arriving? Yes is a skeleton, and it is the default. A bounded action you triggered is a spinner, inside buttons only. A whole surface arriving whose shape is unknown is the wordmark, on a cold entry into the app and nowhere else. Every one of them stays invisible for the first 300ms."
    >
      <Row label="The three marks" note="and the one question that picks one">
        <div className="grid max-w-4xl gap-4 sm:grid-cols-3">
          <Card className="flex h-40 flex-col items-center justify-center gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <span className="text-caption text-muted mt-2">Skeleton, shape known</span>
          </Card>
          <Card className="flex h-40 flex-col items-center justify-center gap-3">
            <Button loading>Apply</Button>
            <span className="text-caption text-muted mt-2">Spinner, in a button</span>
          </Card>
          <Card className="flex h-40 flex-col items-center justify-center gap-3">
            {/* `LoadingMark` is `h-full p-8` by design - it is built to centre itself in the
                shell's whole `<main>`, so dropped into a 160px card it eats the label's row. The
                height is capped HERE rather than by changing the primitive: the primitive is right
                for the one place it ships, and a rack that resizes a specimen to fit its own box is
                the rack accommodating the component rather than the reverse. */}
            <LoadingMark className="h-auto p-0" />
            <span className="text-caption text-muted mt-2">Wordmark, cold entry</span>
          </Card>
        </div>
        <Note>
          A skeleton is perceived as up to <strong>30% faster</strong> at identical real load times,
          because it states the layout before the content exists and gives the brain spatial
          information to process; a spinner gives it nothing but elapsed time. NN/g&rsquo;s 2026
          report puts the benefit specifically in the <strong>400ms&ndash;3s</strong> band, which is
          the number <code>.wait-reveal</code> is built around.
        </Note>
        <Note>
          §7 bans the spinner from a navigation outright: <em>a tap that opens a screen is not a
          request in flight, it is a surface arriving, and the wait belongs at the destination in
          the shape of what is coming.</em> A <code>useLinkStatus</code> spinner sat in a tape row
          for a day before that rule was written down. A spinner <em>inside a card</em> is the same
          mistake with a card around it.
        </Note>
        <Note>
          <strong>2026 guidance recommends a small inline spinner for 100&ndash;400ms loads, and Run
          declines it.</strong> Not a disagreement: that advice is about <em>actions</em>, which is
          exactly what the spinner is already reserved for here. For a <em>navigation</em> inside
          300ms the honest answer is nothing at all, because a mark that appears and vanishes adds a
          flicker rather than removing one.
        </Note>
      </Row>

      <Row label=".wait-reveal" note="press Reload and watch the first 300ms of each">
        <WaitRevealDemo />
        <Note>
          <strong>Both boxes are mounted at the same instant.</strong> The left one carries{' '}
          <code>.wait-reveal</code> and holds at opacity 0 for 300ms, then fades in over 200ms; the
          right one is bare. On a load that lands inside 300ms (which most navigations in this
          app do, because they are prefetched) the left one is never painted at all and the
          right one flashes.
        </Note>
        <Note>
          <code>both</code> fill is the load-bearing part of the rule. Without it the element is
          fully opaque during the delay and the whole point is lost.{' '}
          <code>both</code> makes the from-state apply <em>before</em> the animation starts. It is
          also deliberately <strong>not</strong> in the reduced-motion block: killing it would
          make the mark appear instantly, which is the flicker it exists to prevent. A 200ms opacity
          fade has no vestibular component; the delay is the accommodation.
        </Note>
        <Note>
          <strong>It wraps what stands in for data, never what is chrome.</strong>{' '}
          <code>/trades</code>&rsquo; boundary draws the real search field and does <em>not</em> fade
          it, because a search box does not depend on the response. Delaying it would empty
          the header band for 300ms, which is the 57px jag that boundary exists to prevent.{' '}
          <code>/trades/[id]</code> keeps its back arrow live for the same reason: the one thing a
          trader is certain to want from a screen that has not loaded is out of it.
        </Note>
      </Row>

      <Row label="/accounts, waiting" note="the boundary that did not exist until 2026-09-03">
        <div className="max-w-4xl">
          <RosterSkeleton />
        </div>
        <Note>
          <strong>This page answered a tab-to-tab move with the wordmark.</strong> It had no
          boundary of its own, so it fell through to <code>(app)/loading.tsx</code> (while{' '}
          <code>/trades</code>, in the same shell, showed a skeleton). Two tabs, one gesture, two
          answers.
        </Note>
        <Note>
          The note in <code>trades/loading.tsx</code> is what hid it. It asks <em>why /trades needed
          its own and /accounts did not</em> and answers correctly for the question it was asking:{' '}
          <code>/trades</code> portals a 57px search row into the shell&rsquo;s band, a sibling of{' '}
          <code>&lt;main&gt;</code>, so a suspended <code>/trades</code> moved the whole pane.{' '}
          <code>/accounts</code> portals into an existing flex row and shifts no geometry, so it had
          no <em>jag</em>. That got read as &ldquo;and therefore needs no boundary&rdquo;, which does
          not follow: it needed none to stop a jump, and still needed one to show the right mark.
        </Note>
        <Note>
          <strong>Compare it to the live page.</strong> Every class is copied from the real
          components rather than approximated: <code>min-h-14</code> / <code>sm:min-h-21</code> on a
          row, a 36px disc, the <code>bg-band</code> group header, and the same{' '}
          <code>lg:grid-cols-[minmax(0,1fr)_304px]</code> split the roster and the summary rail sit
          in. A card that arrives 40px taller than its placeholder makes everything under it jump.
        </Note>
        <Note>
          Widths are <strong>ragged</strong>, at roughly the measures real account names and rail
          figures produce. A column of identical bars reads as a placeholder <em>graphic</em>; an
          uneven one reads as text that has not arrived.
        </Note>
      </Row>

      <Row label="/today, waiting" note="one component, so six cards cannot drift">
        <div className="grid max-w-4xl items-start gap-4 lg:grid-cols-2">
          <WidgetSkeleton>
            <PlotSkeleton />
          </WidgetSkeleton>
          <WidgetSkeleton scope={false}>
            <PlotSkeleton />
          </WidgetSkeleton>
        </div>
        <Note>
          The same specimens appear under <strong>Today widgets</strong> beside the live card they
          stand in for, which is where you compare their heights. They are here so that every
          waiting state in the app is on one screen, which is the thing that was missing when four
          boundaries had drifted apart.
        </Note>
        <Note>
          The second one drops the header control. Not every card will have one: the reference prints{' '}
          <code>this month</code> as a <em>label</em> on its Goals and Recurring widgets, because a
          period control belongs only where more than one period is answerable, and a boundary
          that draws a control the page then does not mount is a boundary that reflows.
        </Note>
      </Row>
    </Section>
  );
}

/* TWO BOXES, ONE MOUNT, AND A KEY TO REMOUNT THEM. A CSS `animation-delay` only runs on mount, so
   the only way to see this rule is to mount it again - which is what the `key` does. A rack that
   describes a 300ms hold in prose is a rack asserting something nobody can check. */
function WaitRevealDemo() {
  const [run, setRun] = useState(0);

  return (
    <div className="flex max-w-4xl flex-col gap-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <div key={`reveal-${run}`}>
          <Card className="wait-reveal flex h-24 items-center gap-3 px-5">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
          </Card>
          <p className="text-caption text-muted mt-1.5">
            <code>.wait-reveal</code>, invisible for 300ms
          </p>
        </div>
        <div key={`bare-${run}`}>
          <Card className="flex h-24 items-center gap-3 px-5">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
          </Card>
          <p className="text-caption text-muted mt-1.5">bare, paints on the first frame</p>
        </div>
      </div>
      <div>
        <Button variant="secondary" onClick={() => setRun((n) => n + 1)}>
          Remount both
        </Button>
      </div>
    </div>
  );
}
