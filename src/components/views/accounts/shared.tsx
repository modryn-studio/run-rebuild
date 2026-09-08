'use client';

/* Pieces shared across the /accounts modals. Ported from `run-trading@v2` (2026-08-15, S4e),
 * carrying only what the upload flow needs — the roster, the detail page and the confirmation
 * dialogs arrive with their own slices.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Icon } from '@/components/ui/icon';
import { SheetHeader, SHEET_CONTROL_ICON } from '@/components/ui/sheet-header';
import { SurfaceHeader, useSurface } from './surface';
/* RE-EXPORTED, not re-declared. Every file in this folder already imports the ids from here, and the
   shell that owns them now lives in `ui/`. One line keeps those call sites honest without giving the
   ids two homes. */
import {
  ModalActions,
  MODAL_TITLE_ID,
  CONFIRM_TITLE_ID,
} from '@/components/ui/modal-shell';

export { MODAL_TITLE_ID, CONFIRM_TITLE_ID };
import { FindingList } from './finding-notice';
import type { PreflightFinding } from '@/lib/intake/preflight';
import { cn } from '@/lib/cn';

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
  const { mode } = useSurface();

  /* ON A PHONE THIS IS THE SHEET'S BAR, and `SurfaceHeader` is what puts it there — outside the
     layer that travels, so it swaps on the frame of the tap while only the body slides.
     THE SAME BAR THE TAPE'S SCREENS WEAR, from `ui/sheet-header.tsx`, rather than this grid scaled
     up: h-16 against h-14, `text-h3` against `text-title`, 22px controls against 14. A trader moving
     between Filters, a trade and Add account meets one header, which is the whole reason that
     component was pulled out of `views/trades`. */
  if (mode === 'sheet') {
    return (
      <SurfaceHeader>
        <SheetHeader
          /* THE BAR TAKES THE PANEL'S GROUND, NOT ITS OWN, and since 2026-09-01 it READS that
             ground rather than naming it. `SheetHeader` defaults to `bg-bg` because the trade
             screens it was built for are `bg-bg` all the way down; the /accounts panels are
             `bg-surface`, and the default painted a visible band across the top of every one of
             them. This said `bg-surface` for that reason and it was right until a modal arrived
             on a THIRD ground: `/today`'s recap sits on `--color-bg` and its bar stayed white,
             which is the same band bug with the colours swapped.
             `.modal-ground` resolves `--modal-ground` and falls back to `--color-surface`, so
             every existing caller is unchanged and a card that declares its own ground is
             followed. The bar is opaque either way - it has to be, since a travelling body
             passes underneath it - so what varies is only WHICH opaque. */
          className="modal-ground"
          title={title}
          lead={
            onBack && (
              <IconButton onClick={onBack} aria-label="Back">
                <Icon name="back" size={SHEET_CONTROL_ICON} />
              </IconButton>
            )
          }
          trail={
            onClose && (
              <IconButton onClick={onClose} aria-label="Close">
                <Icon name="close" size={SHEET_CONTROL_ICON} />
              </IconButton>
            )
          }
        />
      </SurfaceHeader>
    );
  }

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

/* THE HEADER OF A CONFIRMATION, which is a different object from `ModalHeader` above and not a
 * variant of it. That one is a NAVIGATION bar: it carries a Back arrow, a centred title, and an X,
 * because the screen under it is one step of a flow you can walk through. A confirmation is not a
 * step - it interrupts, asks one question and hands control back - so it has nothing to go back TO,
 * and its title is a question rather than a label.
 *
 * LEFT-ALIGNED, and that is the whole visual difference: a centred title reads as a place you have
 * arrived at, a left-aligned one reads as a sentence addressed to you. The X stays, because Escape
 * needs a visible twin.
 */
/* NO `showTitle` PROP, AND THE ATTEMPT IS WORTH ONE LINE OF HISTORY. On 2026-09-01 this gained one
 * so `/today`'s recap could render a title-less chrome row, and Luke rejected the result on sight:
 * *"why does the recap modal look so different from the other modals... i need consistency. update
 * the recap modal to be exactly the same format, padding, etc. as the other modals. how is this
 * difficult? shouldn't we have a standard?"* He is right, and the lesson generalises: the standard
 * is the two headers below, and a screen that wants a THIRD shape is a screen arguing with the
 * standard rather than a case the standard missed. The recap uses `ModalHeader` unchanged now. */
export function ConfirmHeader({ title, onCancel }: { title: string; onCancel: () => void }) {
  const { mode } = useSurface();

  /* A CONFIRMATION ON A PHONE IS STILL A SHEET (2026-08-28, Luke: "basically no modals on mobile is
     the rule"), and it keeps its QUESTION as the bar's title rather than being renamed to a place.
     The left-alignment this component exists for is a desktop distinction - a centred title reads as
     somewhere you arrived, a left-aligned one as a sentence addressed to you - and it does not
     survive a 390px bar that every other screen centres. What carries the distinction here instead
     is that the bar has no back arrow: there is nothing to go back TO, because a confirmation
     interrupts rather than being a step you walked through. */
  if (mode === 'sheet') {
    return (
      <SurfaceHeader>
        <SheetHeader
          className="modal-ground"
          title={title}
          lead={null}
          trail={
            <IconButton onClick={onCancel} aria-label="Cancel">
              <Icon name="close" size={SHEET_CONTROL_ICON} />
            </IconButton>
          }
        />
      </SurfaceHeader>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 px-6 pt-5">
      <h2 id={CONFIRM_TITLE_ID} className="text-title text-text font-medium">
        {title}
      </h2>
      <IconButton onClick={onCancel} aria-label="Cancel">
        <Icon name="close" size={14} />
      </IconButton>
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
 *
 * ─── IT NAMES THE ACCOUNT (2026-09-02), AND THAT IS AN EDGE-CASE FIX, NOT A FLOURISH ────────────
 *
 * `ImportOutcome` has carried `accounts` since the stream was written and this screen threw it
 * away, which left one failure completely silent. A trader standing on Account A's page uploads
 * files that actually belong to Account B. Adoption cannot fire - `lib/intake/accounts.ts` gates it
 * on `like 'pending:%'`, and a real row is not a placeholder - so the rows resolve to B by
 * `external_account_id`, land correctly on B, and this screen said "Your record is in." over a
 * drawn check. `router.refresh()` then re-read A's page, which is unchanged. Every part of that is
 * correct except what the trader was told: they watched a success animation for an import that put
 * nothing where they were looking, and had no way to find out until they went hunting.
 *
 * The same sentence does a second job on `/trades`, where the import is unscoped by construction
 * and the account is never stated anywhere else in the flow.
 *
 * IT IS THE RAW `external_account_id`, not a composed roster title. That is what an unlabelled
 * account shows on the roster too, and this file is `'use client'` - reaching for `accountRowTitle`
 * would pull a db-backed module's VALUES across the boundary for a cosmetic gain.
 */
export function ImportComplete({
  onDone,
  imported,
  accounts,
  warnings,
}: {
  onDone: () => void;
  imported?: number;
  /** Every account the rows resolved to. Usually one; a copy-trader's export carries many. */
  accounts?: string[];
  /* NON-BLOCKING FINDINGS, WHICH USED TO STOP HERE (2026-09-04). The route already sent them
     (`warnings: checks.findings.filter((f) => !f.blocking)`) and `use-import-run` already carried
     them onto the outcome, but this screen never took the prop, so every warning the import raised
     was computed, streamed, stored and dropped. The route's own comment said they "still have to
     reach the trader"; this is where they finally do.

     A REFUSAL REPLACES THE PANEL, A WARNING SITS UNDER THE RECEIPT. `ImportRefused` exists because
     a blocking finding IS the outcome. These are not: the import landed, and the warning qualifies
     it. So it goes below the "Filed under" line, in the same screen, and the Done button still
     ends the flow. */
  warnings?: PreflightFinding[];
}) {
  /** Rows the database actually accepted, never rows attempted. Zero is a different screen. */
  const nothingNew = imported === 0;
  const landed = accounts?.filter(Boolean) ?? [];
  return (
    <>
      {/* The X is the only chrome, and it is not a duplicate control here: this screen has no
          forward, so dismiss IS the action. */}
      <CompleteHeader onDone={onDone} />
      <div className="flex flex-col items-center px-6 pt-4 pb-2 text-center">
        <span className="bg-accent text-accent-fg flex h-14 w-14 items-center justify-center rounded-full">
          <Icon name="check" size={28} className="check-draw" />
        </span>
        {/* Sans, like the header above it: a modal is UI, not an editorial surface. */}
        <h2 id={MODAL_TITLE_ID} className="text-h2 mt-5">
          {nothingNew ? 'Already saved.' : 'Your record is in.'}
        </h2>
        {nothingNew && <p className="text-body text-muted mt-2">Nothing new in these files.</p>}
        {/* AFTER the "already saved" line rather than instead of it: the two answer different
            questions ("did anything change" and "where did it go") and a re-upload of the wrong
            account's files needs both. */}
        {landed.length > 0 && (
          <p className="text-body text-muted mt-2">
            Filed under <span className="text-text">{formatList(landed)}</span>.
          </p>
        )}
      </div>
      {/* LEFT ALIGNED, unlike everything above it. The block above is a receipt read at a glance and
          centres for that; a finding is two lines of prose with a number in them, and centred prose
          re-finds its own left edge on every line. `FindingNotice` is `text-left` for the same
          reason on the refusal screen. */}
      {warnings && warnings.length > 0 && (
        <div className="mt-6 px-6">
          <FindingList findings={warnings} />
        </div>
      )}
      <div className="mt-6 px-6 py-4">
        {/* `ModalActions` PROPERLY, not its four classes copied (2026-08-31). This read them by
            hand because `modal-shell.tsx` imported `MODAL_TITLE_ID` from this file and importing
            back the other way was a cycle. The shell owns the ids now, so the edge points one way
            and the real component can be used. */}
        <ModalActions>
          <Button size="sm" onClick={onDone}>
            Done
          </Button>
        </ModalActions>
      </div>
    </>
  );
}

/* "A", "A and B", "A, B and C" - the serial comma left off, matching the app's own copy elsewhere.
 * Not `Intl.ListFormat`: it is locale-aware and this app's copy is not, so it would produce a
 * sentence in one language around account names in another. */
function formatList(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/* THE COMPLETION SCREEN'S ONLY CHROME. A bare X in a modal, because the headline below carries the
 * title; a full bar on a sheet, because a phone screen with a floating X and no bar reads as a
 * broken header rather than as a deliberate absence — and because the bar is 64px of the ground
 * everything else on the phone is measured against. */
function CompleteHeader({ onDone }: { onDone: () => void }) {
  const { mode } = useSurface();
  if (mode === 'sheet') {
    return (
      <SurfaceHeader>
        <SheetHeader
          className="bg-surface"
          title=""
          lead={null}
          trail={
            <IconButton onClick={onDone} aria-label="Close">
              <Icon name="close" size={SHEET_CONTROL_ICON} />
            </IconButton>
          }
        />
      </SurfaceHeader>
    );
  }
  return (
    <div className="flex h-14 shrink-0 items-center justify-end pr-3">
      <IconButton onClick={onDone} aria-label="Close">
        <Icon name="close" size={14} />
      </IconButton>
    </div>
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

/* ONE ANSWER TO "HOW DID IT END?", and it is a shared component because TWO screens ask that
 * question of the same account. `close-account-modal.tsx` asks it when the account is still open,
 * and the editor asks it when a type change leaves a stored ending the new type cannot hold. They
 * were the same fifteen lines of markup twice, which is exactly the drift `design-system.md` names:
 * peers in a choice list are one component at one size, varying only what is in them.
 *
 * `min-h-14` BELOW `md`, NOT `sm` (2026-08-28, postcheck). These measure 48px from their padding,
 * which clears the 44px floor already - but every other pick row on a phone in this product is 56px
 * (`filter-sheet.tsx`'s `PickRow`, unconditionally), and a choice list that is 8px shorter than the
 * choice list one screen away is drift nobody can name and everybody feels. `max-sm` is 639px and
 * `PHONE_QUERY` - the width at which this becomes a full-screen sheet - is 767px, so the version
 * this shipped with left a 128px band where the sheet was up and the rows were short.
 *
 * `border` IS IN THE BASE, and that is not decoration (2026-08-28, postcheck). Tailwind's preflight
 * sets `border: 0 solid`, so `border-accent` on its own colours a zero-width border and emits
 * NOTHING - the selected row was signalled by LOSING its `bg-hover` fill, which read lighter and
 * flatter than the two unselected ones beside it. `.select-pop` is animation only. The fill and the
 * border are the pattern `account-fields.tsx`'s `Chip` already uses, and this now matches it.
 *
 * `aria-pressed` RATHER THAN A RADIO, because that is what it is: a set of toggles where pressing
 * one releases the others, and a screen reader gets the state without a fieldset the sighted layout
 * does not have. */
export function EndingChoice({
  label,
  on,
  onPick,
}: {
  label: string;
  on: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={on}
      className={cn(
        'flex w-full items-center rounded-[var(--radius)] border px-4 py-3 text-left transition-colors max-md:min-h-14',
        on
          ? 'select-pop border-accent text-accent bg-accent/8'
          : 'border-transparent bg-hover hover:bg-surface-2 text-text'
      )}
    >
      <span className="text-body-lg">{label}</span>
    </button>
  );
}
