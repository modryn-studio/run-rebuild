/* THE PRODUCT'S OWN MARKS. Re-homed from the original rack (2026-08-20).
 *
 * A SECTION OF ITS OWN, not folded into Feedback beside the spinner. A spinner is a generic
 * primitive every project ships; these three are the only place the product's identity appears as
 * a drawn thing rather than as a token, which is the boilerplate's `--font-heading` TODO answered.
 */

import { Spinner } from '@/components/ui/spinner';
import { LoadingMark } from '@/components/ui/loading-mark';
import { Wordmark } from '@/components/ui/wordmark';
import { Note, Row, Section } from '../_components/section';

export function BrandSection() {
  return (
    <Section
      id="brand"
      title="Brand marks"
      intro="The wordmark, the loading state built from it, and the spinner they sit beside. The wordmark is the one place the editorial serif appears in the app - everything else reads in the grotesque, so the face is an identity rather than a second body font."
    >
      <Row label="Wordmark" note="the serif, and the only place it appears">
        <Wordmark />
        <Note>
          Set in the display face (`--font-heading`, which points at Run&apos;s Newsreader rather
          than the boilerplate&apos;s `system-ui` placeholder). The full stop is part of the mark and
          not punctuation, so it never takes a space before whatever follows it.
        </Note>
      </Row>

      <Row label="Loading mark" note="the wordmark, breathing">
        <LoadingMark />
        <Note>
          The wordmark under `soft-pulse`, which the reduced-motion block already suppresses. Toggle
          reduced motion in the OS to check it still READS with the animation gone: a loading state
          that becomes invisible when motion is off has moved its whole meaning into the motion.
          Opacity only, never a glow and never a move.
        </Note>
      </Row>

      <Row label="Spinner" note="inherits currentColor, so it reads on any surface">
        <div className="flex flex-wrap items-center gap-8">
          <Spinner />
          <span className="text-accent">
            <Spinner />
          </span>
          <span className="text-muted">
            <Spinner />
          </span>
        </div>
        <Note>
          It takes `currentColor` rather than a token, which is what lets it sit inside a primary
          button and a bare row without either call site passing a colour. `linear` at 0.7s: a
          spinner is constant motion, which is that curve&apos;s one legitimate job, and Tailwind&apos;s
          stock 1s is a number nobody chose. A faster spinner makes an app feel faster to load at an
          identical real load time.
        </Note>
      </Row>
    </Section>
  );
}
