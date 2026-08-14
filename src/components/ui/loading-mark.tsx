import { Wordmark } from '@/components/ui/wordmark';
import { cn } from '@/lib/cn';

/* The waiting state: no spinner, no skeleton - the brand mark alone, centred, breathing.
 *
 * Why the wordmark and not the Spinner: a spinner says "a request is in flight", which is a
 * mechanical fact about the system. This appears while a whole surface is arriving, and the honest
 * message there is "Run is here, hold on" - a presence, not a progress report. `brand.md` names
 * `soft-pulse` as exactly that: "(presence)". So this is the existing primitive doing its stated
 * job rather than a new idea.
 *
 * `Spinner` stays what it is: the in-button, action-in-flight indicator. Two different waits, two
 * different marks, neither borrowed from the other.
 *
 * Reduced motion is already handled centrally - `.soft-pulse` is in the reduced-motion block in
 * globals.css, so this resolves to a still wordmark rather than a frozen animation mid-fade.
 */
export function LoadingMark({ className }: { className?: string }) {
  return (
    <div
      // role=status + aria-live so a screen reader is told the surface is loading. aria-busy marks
      // the region itself as pending. Without these the wait is silent to anyone not watching it.
      role="status"
      aria-busy="true"
      aria-live="polite"
      // h-full, not flex-1: the app shell's <main> is a plain block, so `flex-1` on a child of it
      // resolves to nothing and the mark sits at the top of the pane instead of its centre. Caught
      // by screenshotting the real suspended state rather than trusting the classes.
      //
      // `relative` IS LOAD-BEARING AND IT IS NOT ABOUT THIS ELEMENT (2026-08-14). Tailwind's
      // `sr-only` is `position: absolute`, and the span below had no positioned ancestor anywhere
      // up the tree - so its containing block was the INITIAL containing block, i.e. the document.
      // An absolutely positioned box whose containing block is the document is not clipped by any
      // ancestor's `overflow`, so a 1px invisible label escaped the rack's `h-dvh overflow-hidden`
      // shell and came to rest 4181px down the page, giving the document a full-height scrollbar of
      // its own beside the pane's. Two scrollbars, one of them native and therefore not following
      // the theme, from a screen-reader label nobody can see. `relative` gives it a containing block
      // and the escape stops. Any `sr-only` needs a positioned ancestor for this reason.
      className={cn('relative flex h-full items-center justify-center p-8', className)}
    >
      <Wordmark className="soft-pulse" />
      {/* The visible mark carries no text a reader can use, so the label is supplied here. */}
      <span className="sr-only">Loading</span>
    </div>
  );
}
