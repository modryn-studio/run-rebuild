'use client';

// Client because the whole point of this section is triggering the same movement twice and
// comparing. A static page cannot make the argument.

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { Note, Row, Section } from '../_components/section';

/* A BAR THAT GROWS LEFT TO RIGHT, which is the clearest way to read a curve: the WIDTH over time is
 * literally the easing function plotted. scale-x + origin-left rather than an animated width, so the
 * whole thing runs on the compositor and no layout is recalculated per frame. */
function Track({ running, ease, label }: { running: boolean; ease: string; label: string }) {
  return (
    <div>
      <code className="text-caption text-muted">{label}</code>
      <div className="bg-surface mt-2 h-3 w-full overflow-hidden rounded-sm">
        <div
          className={cn(
            'bg-accent h-full w-full origin-left rounded-sm transition-transform duration-300',
            ease,
            running ? 'scale-x-100' : 'scale-x-0'
          )}
        />
      </div>
    </div>
  );
}

/* THE ONE THING A STILL IMAGE CANNOT ARGUE: a keyframe animation cannot be retargeted mid-flight,
 * and a transition can. Both squares below move the same distance for the same duration on the same
 * curve; the only difference is which mechanism drives them.
 *
 * The keyframe side runs through the Web Animations API rather than a CSS @keyframes rule, and that
 * is deliberate rather than clever. A rule would have to live in globals.css, which every project
 * inherits, so a demo that exists to show the WRONG approach would ship into every product forever
 * and outlive the deletion of this directory. The sink has to be removable by deleting the folder.
 * WAAPI is the same timing engine, so the behaviour on show is real and not a simulation.
 *
 * Travel is expressed as 100% of the square's own width on both sides, so the two distances are
 * provably identical rather than two numbers that happen to agree. */
function Interruptible() {
  const keyframed = useRef<HTMLDivElement>(null);
  const [right, setRight] = useState(false);
  const DURATION = 500;

  useEffect(() => {
    const el = keyframed.current;
    if (!el) return;
    // Always from its nominal start, never from where the square actually is. That is the whole
    // point: interrupt it and the square jumps back before setting off again.
    el.animate([{ translate: right ? '0%' : '100%' }, { translate: right ? '100%' : '0%' }], {
      duration: DURATION,
      easing: 'ease-in-out',
      fill: 'forwards',
    });
  }, [right]);

  return (
    <div>
      <Button onClick={() => setRight((r) => !r)}>Toggle</Button>
      <div className="mt-6 grid max-w-xl gap-6">
        <div>
          <code className="text-caption text-muted">keyframe animation: snaps on interrupt</code>
          <div className="bg-surface mt-2 w-64 rounded-sm p-1">
            <div ref={keyframed} className="bg-danger h-8 w-32 rounded-sm" />
          </div>
        </div>
        <div>
          <code className="text-caption text-muted">transition: reverses from where it is</code>
          <div className="bg-surface mt-2 w-64 rounded-sm p-1">
            <div
              className={cn(
                'bg-accent h-8 w-32 rounded-sm transition-transform duration-500 ease-in-out',
                right && 'translate-x-full'
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MotionSection() {
  const [running, setRunning] = useState(false);

  return (
    <Section
      id="motion"
      title="Motion"
      intro="Three curves, each with a job, and one that is banned. Easing describes the rate a thing changes at, so picking one is picking what the movement means. Press the button and watch the pairs: every bar below runs for exactly the same 300ms."
    >
      <Row label="Perception of speed" note="identical 300ms, and one feels slower">
        <Button onClick={() => setRunning((r) => !r)}>{running ? 'Reset' : 'Play'}</Button>
        <div className="mt-6 grid max-w-xl gap-6">
          <Track running={running} ease="ease-in" label="ease-in (banned)" />
          <Track running={running} ease="ease-out" label="ease-out" />
        </div>
        <Note>
          Both bars run for exactly 300ms. The ease-in one feels markedly slower, and that is the
          entire argument against it: easing changes PERCEIVED speed, so this is a performance
          decision, not a taste one. It also accelerates INTO its stop, which is the opposite of how
          anything in the physical world settles.
        </Note>
      </Row>

      <Row label="The three curves that are allowed" note="each answers a different question">
        <div className="grid max-w-xl gap-6">
          {/* No easing class at all, deliberately: `ease` is the PROJECT DEFAULT, so this bar
              inherits it and proves the default is what the docs claim. There is also no bare
              `ease` utility in Tailwind to reach for - only ease-in / ease-out / ease-in-out /
              ease-linear - which is worth knowing before someone writes one and wonders why
              nothing changed. */}
          <Track running={running} ease="" label="ease: a state change in place (the default)" />
          <Track
            running={running}
            ease="ease-out"
            label="ease-out: something entering or leaving"
          />
          <Track
            running={running}
            ease="ease-in-out"
            label="ease-in-out: something on screen moving"
          />
          <Track running={running} ease="ease-linear" label="linear: constant motion only" />
        </div>
        <Note>
          <strong>ease</strong> is the project default and the one built-in curve worth keeping: it
          covers hover and active colour, background and opacity, which is most of the transitions
          in this codebase. <strong>ease-out</strong> is for a menu, a tooltip or a scrim arriving
          and leaving, where the acceleration up front is what reads as responsive.{' '}
          <strong>ease-in-out</strong> is for something already on screen that moves or changes
          size, like the sidebar collapsing: a car pulling away and stopping again.{' '}
          <strong>linear</strong> is only for a marquee, a progress bar or a hold-to-delete, where
          the even passage of time IS the thing being shown.
        </Note>
      </Row>

      <Row label="Where they are set" note="the curve is the DEFAULT, never a per-component pick">
        <div className="border-border max-w-xl rounded-md border p-4">
          <p className="text-small">
            A bare <code className="text-caption">transition-colors</code> already runs 200ms on{' '}
            <code className="text-caption">ease</code>. Nothing has to ask for it.
          </p>
        </div>
        <Note>
          Tailwind ships its own 150ms curve, and every bare transition utility silently inherits it
          unless the theme overrides it, which is how a codebase ends up running two motion
          languages at once. Both custom curves here are the same family (easeOutCubic and its
          symmetric partner easeInOutCubic) so an entrance and a move read as the same hand, and
          they match the curve the other Modryn projects already ship.
        </Note>
      </Row>

      <Row
        label="Interruptible or not"
        note="press Toggle twice in quick succession, before the first move finishes"
      >
        <Interruptible />
        <Note>
          Both squares travel the same distance over the same 500ms. Let either finish and they are
          identical; interrupt one halfway and only the transition behaves. The keyframe SNAPS back
          to the start of its new run, because an animation cannot be retargeted once it is going:
          it knows its own from and to and nothing about where the element currently is. The
          transition reverses from wherever it got to, because the browser is interpolating a
          property rather than playing a timeline.
          <br />
          <br />
          This is why anything that opens and closes uses a transition here. The account menu at the
          bottom of the sidebar is the real instance: as keyframes it needed a second closing flag
          to stay mounted through its exit, an animationend listener to unmount, and a
          pointer-events guard for the case where that event never fires. All three exist only to
          work around the snap you can see on the left.
        </Note>
      </Row>

      <Row label="Reduced motion" note="scoped to what MOVES, not to everything">
        <p className="text-body max-w-2xl text-pretty">
          Colour and opacity transitions survive prefers-reduced-motion. Anything that moves an
          element through space, changes its size, or loops does not. Freezing the colour changes
          too would make the interface feel broken rather than calm, and they are not what the
          preference is for.
        </p>
      </Row>
    </Section>
  );
}
