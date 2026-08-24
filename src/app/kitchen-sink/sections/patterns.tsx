import { Inbox, SearchX, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Row, Section } from '../_components/section';

export function PatternsSection() {
  return (
    <Section
      id="patterns"
      title="Patterns"
      intro="Loading, empty and error, assembled the way a screen actually assembles them. These three are the difference between an app and a demo, and they are the three that get invented at 11pm if they are not decided here."
    >
      <Row label="Empty, first run" note="nothing yet, and it is nobody's fault">
        <EmptyState
          icon={Inbox}
          title="Nothing here yet"
          description="Anything you save shows up here. Start with one and see how it feels."
          action={<Button>Add the first one</Button>}
        />
      </Row>

      <Row label="Empty, filtered" note="there is data, the filter just excludes it">
        <EmptyState
          icon={SearchX}
          title="No matches"
          description="Nothing fits that filter. Widen it, or clear it and start again."
          action={<Button variant="secondary">Clear the filter</Button>}
        />
      </Row>

      <Row label="Error" note="say what to do, not what went wrong internally">
        <EmptyState
          icon={WifiOff}
          title="That did not load"
          description="The connection dropped partway through. Nothing was lost, so trying again is safe."
          action={<Button variant="secondary">Try again</Button>}
        />
      </Row>

      <Row label="Loading a list" note="same shape as the loaded state, so nothing reflows">
        <div className="border-border divide-rule max-w-xl divide-y rounded-md border">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      </Row>
    </Section>
  );
}
