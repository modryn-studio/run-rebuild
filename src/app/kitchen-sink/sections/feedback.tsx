import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Note, Row, Section } from '../_components/section';

export function FeedbackSection() {
  return (
    <Section
      id="feedback"
      title="Spinner, skeleton, toggle"
      intro="Use a skeleton when you know the shape of what is coming, and a spinner when you do not. A skeleton that does not match its content reflows on load, which reads worse than the spinner it replaced."
    >
      <Row label="Spinner" note="inherits currentColor, so it reads on any surface">
        <div className="flex flex-wrap items-center gap-6">
          <Spinner />
          <span className="text-accent">
            <Spinner />
          </span>
          <span className="text-muted">
            <Spinner />
          </span>
          <span className="bg-accent text-accent-foreground inline-flex rounded-md p-3">
            <Spinner />
          </span>
        </div>
      </Row>

      <Row label="Skeleton" note="sized at the call site to match the real content">
        <div className="border-border max-w-md rounded-md border p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-24" />
            </div>
          </div>
          <Skeleton className="mt-6 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      </Row>

      <Row label="Skeleton on a Card" note="the ground it is actually used on, not the page">
        <Card className="max-w-md p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-24" />
            </div>
          </div>
          <Skeleton className="mt-6 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-20" />
        </Card>
        <Note>
          THIS ROW EXISTS BECAUSE THE ONE ABOVE IT COULD NOT FAIL. A skeleton is used inside a Card
          far more often than on the page, and the two grounds are different: ported verbatim from
          the boilerplate, this component took `surface`, which is the middle tier THERE and the
          card itself HERE. On the page it looked fine; on a Card it was the exact colour of the
          Card, and an opacity pulse only fades toward that same ground, so it did not render at
          all. Checking a placeholder against the one surface it is never used on is how that
          survives review. Both rows now, in both modes.
        </Note>
      </Row>

      <Row label="Theme toggle" note="bare glyph, IconButton underneath, nothing of its own">
        <ThemeToggle />
        <Note>
          This used to carry its own always-on border and fill, which is exactly the mistake
          IconButton exists to prevent: every icon-only control shares one mechanic (see Icon
          button above), and a component that skips the primitive is the one that drifts. Hover
          and press behave identically to the corner toggle, because this literally is the corner
          toggle.
        </Note>
      </Row>
    </Section>
  );
}
