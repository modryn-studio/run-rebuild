'use client';

// Client because loading is the state worth feeling rather than reading. Everything else on this
// page that can be a Server Component is one.

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Note, Row, Section } from '../_components/section';

const VARIANTS = ['primary', 'secondary', 'ghost'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;

export function ButtonsSection() {
  const [busy, setBusy] = useState(false);

  return (
    <Section
      id="buttons"
      title="Button"
      intro="Three variants, three sizes, and every state. Hover and focus cannot be drawn on a static page, so tab through this section rather than reading it."
    >
      <Row label="Variants and sizes">
        <div className="flex flex-col gap-4">
          {VARIANTS.map((variant) => (
            <div key={variant} className="flex flex-wrap items-center gap-4">
              <code className="text-caption text-muted w-20 shrink-0">{variant}</code>
              {SIZES.map((size) => (
                <Button key={size} variant={variant} size={size}>
                  Continue
                </Button>
              ))}
            </div>
          ))}
        </div>
      </Row>

      <Row label="Hover and press" note="hover one, then hold the mouse down on it">
        <div className="flex flex-wrap items-center gap-4">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
        <Note>
          Hover on the secondary moves the BORDER and nothing else, and deliberately a QUIET one: a
          bordered object cannot announce hover by filling its own ground without reading as a
          different object, and the border itself stays almost not there (a 15% mix, Luke&apos;s
          call over matching any reference exactly). Holding the mouse down does two things at once:
          the ground drops (secondary to the page&apos;s own, primary one step past its hover to
          accent-active) AND an INSET shadow says the surface went down. No button ever carries a
          DROP shadow - that claim belongs to Card - but an inset is the opposite claim and is what
          a press is made of. accent-active earns its place regardless: primary has no border to
          mark a press with, so its fill carries a colour step too.
        </Note>
      </Row>

      <Row label="States" note="tab here to check the focus ring">
        <div className="flex flex-wrap items-center gap-4">
          <Button>Default</Button>
          <Button disabled>Disabled</Button>
          <Button loading>Loading</Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
          <Button variant="secondary" loading>
            Loading
          </Button>
          <Button variant="ghost" disabled>
            Disabled
          </Button>
        </div>
      </Row>

      <Row label="Loading, for real" note="the double-submit guard, live">
        <div className="flex flex-wrap items-center gap-4">
          <Button
            loading={busy}
            onClick={() => {
              setBusy(true);
              setTimeout(() => setBusy(false), 2000);
            }}
          >
            Send the code
          </Button>
          <Note>
            The label swaps for a spinner and the button disables, so no async action can fire
            twice from an impatient double click. Click it twice and watch.
          </Note>
        </div>
      </Row>

      <Row label="Long label" note="truncates to one ellipsis, never escapes the box">
        <div className="max-w-sm">
          <Button className="w-full">
            Continue with the account you used the last time you were here
          </Button>
        </div>
        <Note>
          Run TRUNCATES where the boilerplate wraps, and that is a decision rather than a port
          artefact: a stated height is what makes every control in a row line up, so a button that
          grows taller breaks the thing the height was for. Measured, an unconstrained label pushed
          this to 1008px, 2.9x its container at 375. Labels here are short by design, so this is the
          failure mode and not the normal path. The ellipsis sits on the inner span rather than the
          button, because a centred flex container overflows at BOTH ends and clips the label on the
          left and the right with no ellipsis anywhere.
        </Note>
      </Row>
    </Section>
  );
}
