'use client';

/* THE PHONE'S CONTAINER FOR EVERY /accounts FLOW, and the two states that matter are the deepest one
 * and the closed one.
 *
 * IT IS RACKED WITH FIXTURE SCREENS RATHER THAN THROUGH `AddAccountModal`, and that is not a
 * shortcut. Every flow picks its container with `usePhone()`, and the rack runs at desktop width, so
 * going in through a flow would render a modal here and this section would specimen nothing. What is
 * being tested is the CONTAINER: that a layer slides, that the header swaps without travelling, and
 * that a dismissed panel is off-screen.
 *
 * CLOSED IS RENDERED UNCONDITIONALLY, for the reason `filter-sheet.tsx`'s section spells out at
 * length: on 2026-08-24 a stale stylesheet lost the one rule holding a `fixed inset-0 z-[70]` panel
 * off the screen, and the phone became unusable while every build signal stayed green. A closed
 * overlay leaves no mark on a page, which is exactly why nobody looks at it. Here it is on a page
 * somebody does look at, and if the build is wrong this row becomes a full-screen panel.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AccountSheet } from '@/components/views/accounts/account-sheet';
import { ModalHeader } from '@/components/views/accounts/shared';
import { ModalBody, ModalFooter } from '@/components/ui/modal-shell';
import { Note, Row, Section } from '../_components/section';

/** A stand-in screen: the chrome a real one renders, with a line of body under it. */
function Fixture({
  title,
  body,
  onBack,
  onClose,
  cta,
}: {
  title: string;
  body: string;
  onBack?: () => void;
  onClose: () => void;
  cta?: string;
}) {
  return (
    <>
      <ModalHeader title={title} onBack={onBack} onClose={onClose} />
      <ModalBody className="px-6 pt-4">
        <p className="text-body text-muted">{body}</p>
      </ModalBody>
      {cta && (
        <ModalFooter>
          <Button variant="outline" size="lg" className="w-full">
            {cta}
          </Button>
        </ModalFooter>
      )}
    </>
  );
}

export function AccountSheetSection() {
  const [open, setOpen] = useState(false);
  const [depth, setDepth] = useState(0);

  const close = () => {
    setOpen(false);
    setDepth(0);
  };
  const back = () => setDepth((d) => Math.max(0, d - 1));

  return (
    <Section
      id="account-sheet"
      title="Account sheet"
      intro="Below 768px there are no modals on /accounts: add, import, edit and both confirmations are full-screen panels arriving from the bottom. One rule decides whether a screen slides. The header changes, so the page slides. The header stays, so the body fades."
    >
      <Row label="Three depths, and the header never travels" note="opens the real container">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Open the sheet
        </Button>
        <Note>
          The base is the doors. Tap through and each new screen renames the bar, which is what earns
          it a slide of its own; the bar itself is hosted above every layer and portalled into, so it
          swaps on the frame of the tap while only the body moves. Back walks one layer at a time,
          and so does Escape and the device back button.
        </Note>
      </Row>

      <Row label="Closed is a state, and it is the one that broke" note="rendered, not assumed">
        <div className="text-small text-muted">
          A closed sheet is rendered directly below this line. If you can see a panel, the build is
          wrong, and that is the entire point of this row.
        </div>
        <AccountSheet
          open={false}
          onClose={() => {}}
          onBack={() => {}}
          label="Closed specimen"
          layers={[<Fixture key="base" title="Add account" body="" onClose={() => {}} />]}
        />
        <Note>
          The position it is dismissed to is a Tailwind utility at the call site; the class owns only
          the timing. The stylesheet that took the filter sheet down could not have taken this one,
          for the same reason.
        </Note>
      </Row>

      {open && (
        <AccountSheet
          open
          onClose={close}
          onBack={back}
          label="Add account"
          layers={[
            <Fixture
              key="doors"
              title="Add account"
              body="Brokers, and Import trades. Tap below to drill in."
              onClose={close}
              cta="Add manually"
            />,
            depth >= 1 ? (
              <Fixture
                key="manual"
                title="Add manually"
                body="Evaluation, Sim Funded, Personal. The bar renamed, so this page slid up."
                onBack={back}
                onClose={close}
              />
            ) : null,
            depth >= 2 ? (
              <Fixture
                key="detail"
                title="Evaluation"
                body="Firm, then size. The bar renamed again, so this slid too. Firm to Size does not rename it, so that one fades in place instead."
                onBack={back}
                onClose={close}
              />
            ) : null,
          ]}
        />
      )}

      {open && (
        /* The rack drives the depth from outside, because the fixture screens have no answers to
           give. In the product the flow itself decides which layers exist, from its own state. */
        <div className="fixed right-4 bottom-4 z-[80] flex gap-2">
          <Button size="sm" variant="secondary" onClick={back} disabled={depth === 0}>
            Back a layer
          </Button>
          <Button size="sm" onClick={() => setDepth((d) => Math.min(2, d + 1))} disabled={depth === 2}>
            Deeper
          </Button>
        </div>
      )}
    </Section>
  );
}
