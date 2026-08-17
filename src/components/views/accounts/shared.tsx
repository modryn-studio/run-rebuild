'use client';

/* Pieces shared across the /accounts modals. Ported from `run-trading@v2` (2026-08-15, S4e),
 * carrying only what the upload flow needs — the roster, the detail page and the confirmation
 * dialogs arrive with their own slices.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Icon } from '@/components/ui/icon';

/** `ModalShell` labels its dialog by this id, so exactly one element per screen carries it — the
 *  header's title, or the completion screen's headline, which IS that screen's title. */
export const MODAL_TITLE_ID = 'accounts-modal-title';

/* CENTRED, ONE ROW — back left, title middle, close right.
 *
 * SANS, NOT SERIF. In v2 this was a 22px editorial line inherited from the full-bleed onboarding
 * screens, where a centred serif belongs because it sits under a centred wordmark. Floating over
 * /accounts it was the largest, lightest, only-serif thing on screen. `text-title` is the app's own
 * heading step and reads at the same weight as the card titles underneath it. The wordmark keeps
 * the serif; it is the one place the editorial face is the brand rather than the UI.
 */
export function ModalHeader({
  title,
  onBack,
  onClose,
}: {
  title: string;
  onBack?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="grid h-14 shrink-0 grid-cols-[36px_1fr_36px] items-center px-3">
      {/* IconButton, not a hand-rolled square. In v2 these carried their own flat hover fill, which
          made the modal's two controls a different CLASS of control from every other icon button in
          the app. The primitive already existed and was already specced; that was drift, not a
          variant. */}
      <div className="flex justify-start">
        {onBack && (
          <IconButton onClick={onBack} aria-label="Back">
            <Icon name="back" size={16} />
          </IconButton>
        )}
      </div>
      <h2 id={MODAL_TITLE_ID} className="text-title text-text truncate text-center">
        {title}
      </h2>
      <div className="flex justify-end">
        {onClose && (
          <IconButton onClick={onClose} aria-label="Close">
            <Icon name="close" size={14} />
          </IconButton>
        )}
      </div>
    </div>
  );
}

/* THE END OF AN IMPORT, and it is a screen rather than a silent close (Luke, 2026-08-03: "i do not
 * want to just close and go to the app"). An effect used to fire the handoff the instant the run
 * resolved, so the modal closed itself and the trader was returned to the roster having been told
 * nothing.
 *
 * A RE-UPLOAD SAYS SO (`#79`). Uploading files already in the corpus writes nothing — correctly, the
 * dedupe key refuses them — and then said "Your record is in." over a drawn check, identical to a
 * first import. Luke's own v2 corpus carried three import events for one tape: two of them told him
 * they had succeeded at saving nothing. The per-file "already saved" detail IS computed and is
 * deliberately not rendered on success (five labels each with a number under them read as a busy
 * list). That was the right call for counts and it took with it the one detail that changes what the
 * screen MEANS, so the whole-import case carries it instead — which is where it belongs. "You
 * already had this" is a fact about the upload, not about any one file.
 *
 * The headline carries `MODAL_TITLE_ID` because it IS this screen's title.
 */
export function ImportComplete({ onDone, imported }: { onDone: () => void; imported?: number }) {
  /** Rows the database actually accepted, never rows attempted. Zero is a different screen. */
  const nothingNew = imported === 0;
  return (
    <>
      {/* The X is the only chrome, and it is not a duplicate control here: this screen has no
          forward, so dismiss IS the action. */}
      <div className="flex h-14 shrink-0 items-center justify-end pr-3">
        <IconButton onClick={onDone} aria-label="Close">
          <Icon name="close" size={14} />
        </IconButton>
      </div>
      <div className="flex flex-col items-center px-6 pt-4 pb-2 text-center">
        <span className="bg-accent text-accent-fg flex h-14 w-14 items-center justify-center rounded-full">
          <Icon name="check" size={28} className="check-draw" />
        </span>
        {/* Sans, like the header above it: a modal is UI, not an editorial surface. */}
        <h2 id={MODAL_TITLE_ID} className="text-h2 mt-5">
          {nothingNew ? 'Already saved.' : 'Your record is in.'}
        </h2>
        {nothingNew && <p className="text-body text-muted mt-2">Nothing new in these files.</p>}
      </div>
      <div className="mt-6 px-6 py-4">
        {/* `ModalActions`' classes inlined rather than imported: `modal-shell.tsx` imports
            `MODAL_TITLE_ID` from this file, so importing back the other way is a cycle. */}
        <div className="flex justify-end gap-2 max-sm:gap-3 [&>*]:max-sm:min-h-11 [&>*]:max-sm:flex-1">
          <Button size="sm" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    </>
  );
}

/* LOGOMARK, not the wordmark: it shares a row with a broker logo and a file icon, all inside
 * circular slots, and a text wordmark in that company reads as a caption rather than a peer.
 * Theme-aware for the same reason the favicon is — Run's ink is a saturated slate, so one asset
 * cannot serve both grounds. */
export function RunMark({ size = 24 }: { size?: number }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- a static local mark, not content */}
      <img
        src="/brand/logomark.png"
        alt=""
        aria-hidden
        width={size}
        height={size}
        className="object-contain dark:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- a static local mark, not content */}
      <img
        src="/brand/logomark-dark.png"
        alt=""
        aria-hidden
        width={size}
        height={size}
        className="hidden object-contain dark:block"
      />
    </>
  );
}

/* A connectable source (broker/platform). `logoLight`/`logoDark` point at files in
 * `/public/brokers`; a missing file falls back to a monogram.
 *
 * `mark` is the SQUARE logomark, used where the source sits in a circular slot opposite Run's own
 * mark (the progress panel). A horizontal lockup cannot hold that position: scaled to fit a 56px
 * circle its wordmark becomes unreadable, and it makes the pair look mismatched next to Run's
 * square mark. One file serves both themes when the mark is coloured, which Tradovate's is. */
export type Source = { name: string; logoLight: string; logoDark: string; mark?: string };

/** The square mark, for circular slots. Falls back to a monogram so a missing file degrades to
 *  something legible rather than an empty ring. */
export function SourceLogomark({ source, size = 28 }: { source: Source; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!source.mark || failed) {
    return <span className="text-body-lg text-muted font-medium">{source.name[0]}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a static local mark, not content
    <img
      src={source.mark}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className="object-contain"
      onError={() => setFailed(true)}
    />
  );
}

/** Full-colour brand logo, theme-aware, with a letter-monogram fallback so a missing or broken file
 *  never breaks the card. `size` is a Tailwind height class — the picker card wants it large, the
 *  modal's inline mention wants it small. */
export function SourceMark({ source, size = 'h-11' }: { source: Source; size?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className="text-body-lg flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] font-medium"
        style={{ background: 'var(--color-surface-2)', color: 'var(--color-muted)' }}
      >
        {source.name[0]}
      </span>
    );
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- a static local mark, not content */}
      <img
        src={source.logoLight}
        alt=""
        aria-hidden
        className={`${size} w-auto object-contain dark:hidden`}
        onError={() => setFailed(true)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- a static local mark, not content */}
      <img
        src={source.logoDark}
        alt=""
        aria-hidden
        className={`hidden ${size} w-auto object-contain dark:block`}
        onError={() => setFailed(true)}
      />
    </>
  );
}
