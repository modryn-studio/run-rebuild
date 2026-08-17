'use client';

/* THE REFUSAL SCREEN. It REPLACES the progress panel rather than sitting under it, and that is the
 * whole fix (2026-08-15, Luke: "the scroll area is too skinny. not tall enough. makes it hard to
 * read. unacceptable").
 *
 * WHAT WAS WRONG, MEASURED. The failed state used to keep `ProgressPanel` at full height and bolt
 * the findings underneath it. On a 529px viewport the dialog is 450px (`max-h-[85dvh]`) and the
 * panel alone measured 296px of it — 66% — leaving 34px for the findings. Wrapping those 34px in a
 * scroll container, which was the first attempt, made them reachable and still unreadable: a
 * three-line finding in a 34px window is a peephole.
 *
 * THE PANEL HAS DONE ITS JOB BY THEN. Its purpose is showing work land, step by step, while the
 * trader waits. Once the run has failed it is reporting HISTORY, and it was spending two thirds of
 * the screen on that while the thing the trader has to act on got a sliver. So the failure state
 * drops it and states the same outcome in one line.
 *
 * SYMMETRY WITH SUCCESS, AND THAT IS WHY THIS IS NOT A SECOND STACKED MODAL. `ImportComplete`
 * already replaces the panel outright when a run succeeds; a refusal is the same kind of moment
 * and deserves the same treatment. Luke floated a separate pop-up for the errors, which is the
 * right instinct (the findings DO need their own surface) with a costlier mechanism: a second layer
 * needs its own z-index above `ModalShell`'s z-[60], its own dismissal rules against a shell whose
 * `busy` guard deliberately locks every exit, and it puts the trader two dismissals from the file
 * picker they need to get back to. Replacing the body inside the existing shell buys the same room
 * and none of that.
 *
 * NO CEREMONY, DELIBERATELY, and this is the one place it differs from `ImportComplete`. That
 * screen earns its 56px disc and centred headline: finishing is a moment worth marking. A refusal
 * is a work order. Every pixel spent on a big centred mark is a pixel taken from the sentence
 * telling the trader which export to pull again, so the identity here is the header line and
 * nothing else.
 */

import { Button } from '@/components/ui/button';
import { ModalBody, ModalFooter, ModalActions } from './modal-shell';
import { ModalHeader } from './shared';
import { FindingList } from './finding-notice';
import type { PreflightFinding } from '@/lib/intake/preflight';

export function ImportRefused({
  findings,
  error,
  partiallySaved,
  onBack,
  onRetry,
}: {
  /** The blocking findings. The only surface `PreflightCode` ever reaches. */
  findings: PreflightFinding[];
  /** Fallback for a genuine exception, which carries no code. */
  error: string | null;
  /** Whether any file landed before the failure. Changes both the heading and whether the
   *  retry-is-safe reassurance is true enough to show. */
  partiallySaved: boolean;
  onBack: () => void;
  onRetry: () => void;
}) {
  return (
    <>
      {/* No X and no back arrow in the chrome: the footer carries both real exits, and a third
          control that does the same thing as one of them is a choice the trader has to read twice.
          (`ImportComplete` has an X precisely because it has only ONE forward action.) */}
      <ModalHeader title={partiallySaved ? 'Some of this was saved' : 'Nothing was imported'} />

      <ModalBody className="px-6">
        {/* SAYS WHAT SURVIVED BEFORE WHAT TO DO NEXT. A partial import reads as total loss
            otherwise, and the trader needs to know a retry cannot double-count. Only shown when
            something actually landed: on a preflight refusal nothing was written at all, and
            claiming otherwise would be the confident-wrong reassurance this product refuses. */}
        {partiallySaved && (
          <p className="text-small text-muted mb-4">
            What already saved is saved. Trying again will not duplicate it.
          </p>
        )}

        {findings.length > 0 ? (
          <FindingList findings={findings} />
        ) : (
          error && <p className="text-small text-neg">{error}</p>
        )}
      </ModalBody>

      {/* PINNED, so the way out never scrolls away however long the findings run. */}
      <ModalFooter>
        <ModalActions>
          <Button variant="secondary" size="sm" onClick={onBack}>
            Back to files
          </Button>
          <Button size="sm" onClick={onRetry}>
            Try again
          </Button>
        </ModalActions>
      </ModalFooter>
    </>
  );
}
