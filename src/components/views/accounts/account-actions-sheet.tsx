'use client';

/* THE PHONE'S ACCOUNT MENU, AND IT IS A SHEET RATHER THAN A DROPDOWN (2026-09-02).
 *
 * Luke, off Monarch's iOS app: their account screen puts a `⋯` in the bar which opens Edit account
 * / Add transaction / Contact support. The INFORMATION ARCHITECTURE is the thing worth taking - a
 * phone bar holds one control per side, so a second real action has to live behind one affordance.
 * Their execution is not: it is a floating dark card that looks identical in light and dark, which
 * is what a popover painting its own ground over the page can only do.
 *
 * ─── WHY A FULL-SCREEN SHEET ────────────────────────────────────────────────────────────────────
 *
 * Because this app has NO anchored popover on a phone, anywhere. `/trades`' Filters becomes
 * `FilterSheet`; `ColumnsMenu` is dropped entirely; `RosterFilters` is desktop-only; add, import,
 * edit and both confirmations are already `AccountSheet`. `design-system.md` §6a: "below 768px a
 * dismissible surface is a full-screen sheet, not a centred card." A dropdown here would be the
 * first and only one, and it would arrive without the two things a sheet has already solved - the
 * device Back button (`useOverlayBack`) and per-mode grounds.
 *
 * The doors sheet this build already ships is also two rows and a footer button, so this is not a
 * heavier surface than the flow it leads into. It is the same one.
 *
 * ─── ONE SHEET, NOT TWO, AND THAT IS THE POINT OF THE COMPONENT ─────────────────────────────────
 *
 * The obvious build is a menu whose rows call the existing openers - and it is wrong on a phone.
 * `useImportTrades` mounts `ImportTradesModal`, which owns its OWN `AccountSheet`, so tapping
 * Import would slide this sheet down 200ms while another slid up: two full-screen surfaces crossing
 * in opposite directions for one tap.
 *
 * So the import is a LAYER of this sheet instead. Layer 0 is the action list, layer 1 is
 * `FileUploadStep` - the same component `AddAccountModal` hosts, hosted here instead. Nothing about
 * it is copied: it already takes `onBack`, `onClose`, `onDone`, `onBusyChange`, `files`/`setFiles`
 * and `adoptAccountId`, because it was built to be hosted. `AccountSheet` slides layer 1 up over
 * layer 0 on `.sheet-transition`, which is the rule the header states: the bar RENAMES, so it is a
 * place you arrived at.
 *
 * THE DOORS ARE SKIPPED, and that is correct rather than a shortcut. The doors ask WHICH SOURCE,
 * and the only live answer is CSV - Brokers is dark until vendor OAuth lands. `ImportTradesModal`
 * shows them anyway because it is reached from a control that says "Import trades" and has to
 * survive the day Brokers turns on. Here the row that was tapped ALREADY said "Import trades ·
 * Import from CSV", so a screen offering that one choice again would be the trader confirming a
 * decision they just made. The day Brokers is live this becomes a doors layer, and the layer array
 * below is where that goes.
 *
 * ─── EDIT HANDS OFF, AND IT IS NOT AN OMISSION ──────────────────────────────────────────────────
 *
 * `LabelAccountForm` owns its own three-screen stack AND its confirmations, which have to sit
 * OUTSIDE the panel holding them (its `sheet` prop's note says so). Hosting it as a layer here
 * means extracting a `useLabelAccountFlow` hook the way `useManualAccount` was extracted from this
 * same flow - the right eventual shape, and a 700-line refactor of the densest file in this
 * directory. It also buys less: Edit is a rare, deliberate act, where the import is the daily one
 * and the only one whose transition anybody will see twice a week.
 *
 * So Edit closes this sheet and opens its own, which is what EVERY row in Monarch's menu does too.
 * If the crossing transition reads badly there, the hook extraction is the fix and this comment is
 * the brief for it.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { ModalBody } from '@/components/ui/modal-shell';
import { AccountSheet, useSheet } from './account-sheet';
import { ModalHeader } from './shared';
import { Door, TRADOVATE } from './add-account-modal';
import { FileUploadStep, type Picked } from './file-upload-step';
import { useLabelAccount } from './account-modals';
import type { RosterAccount } from '@/lib/accounts/read';

export function AccountActionsSheet({
  account,
  onClose,
  dryRun = false,
}: {
  account: RosterAccount;
  /** Unmounts this component. The exit travel has already played by the time it runs. */
  onClose: () => void;
  /* DEMO ONLY, AND IT IS THIS SHEET'S ADMISSION TICKET TO THE RACK. `/kitchen-sink/demo`'s header
     claims nothing on it writes to the database, and that file records what it cost to find that
     untrue once: a scene mounted a flow whose upload step was live, so walking it posted to
     `/api/csv-import` for real. Its rule is "any scene added later takes `dryRun` or it does not go
     in", and layer 1 here IS that upload step. Never passed by app code. */
  dryRun?: boolean;
}) {
  const router = useRouter();
  const label = useLabelAccount();
  const sheet = useSheet(onClose);
  const [view, setView] = useState<'actions' | 'upload'>('actions');
  /* Lifted out of `FileUploadStep` for the same reason `AddAccountModal` lifts it: stepping back to
     the actions list and returning keeps a staged selection. Closing the sheet still discards it,
     which is the intended discard. */
  const [files, setFiles] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);

  const close = useCallback(() => {
    if (!busy) sheet.requestClose();
  }, [busy, sheet]);

  const toActions = useCallback(() => setView('actions'), []);

  /* THE SHEET'S OWN DISMISS GUARD ONLY REACHES ESCAPE AND THE BACK BUTTON, both in-app. A refresh
     or closing the tab bypasses it entirely - the corpus commit does not depend on this tab staying
     open, so the write still lands, but the trader watching the progress panel gets no warning
     before it vanishes. Same guard `AddAccountModal` carries, for the same upload. */
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  /* The page is a Server Component reading the corpus, so `refresh()` is what makes the new trades
     appear - not local state. One source of truth for what the trader owns. */
  const done = useCallback(() => {
    router.refresh();
    sheet.requestClose();
  }, [router, sheet]);

  const actions = (
    <>
      <ModalHeader title="Account" onClose={close} />
      <ModalBody className="px-6 pb-6">
        {/* EDIT LEADS, because it is the action that changes the ACCOUNT while the one below adds
            to its record - the same ordering the desktop band uses, where Edit sits before Filters
            for exactly that reason. */}
        <Door
          icon={<Icon name="edit" size={16} />}
          title="Edit account"
          desc="Name, type and firm"
          onClick={() => {
            /* CLOSE FIRST, THEN OPEN. The label editor owns its own sheet, so this one has to be
               leaving before that one arrives or two are mounted at once and both answer Escape.
               See this file's header for why Edit is not a layer. */
            sheet.requestClose();
            label(account);
          }}
        />
        <Door
          icon={<Icon name="upload" size={16} />}
          title="Import trades"
          desc="Import from CSV"
          onClick={() => setView('upload')}
        />
      </ModalBody>
    </>
  );

  return (
    <AccountSheet
      open={sheet.open}
      onClose={close}
      /* BACK MEANS ONE LAYER. From the upload step it returns to the actions list; from the list
         the sheet itself closes, which `AccountSheet` handles at depth 0. */
      onBack={toActions}
      /* AN IMPORT IN FLIGHT LOCKS EVERY EXIT - Escape, the scrim and the device Back button. The
         request is not cancelled by leaving, so the corpus write lands either way and the only
         thing an exit achieves is throwing away the result. */
      busy={busy}
      label={`Account actions for ${account.displayName ?? account.externalAccountId}`}
      /* INDEX IS DEPTH. Layer 1 RENAMES the bar (to the upload step's own header), which is the
         rule that says it slides rather than fades. `design-system.md` §6a. */
      layers={[
        actions,
        view === 'upload' ? (
          <FileUploadStep
            dryRun={dryRun}
            source={TRADOVATE}
            /* SCOPED, and this is the assertion that makes adoption trustworthy: the import began
               on THIS account's page, so the trader is saying the files belong to this row. The
               only signal permitted to fill in a `pending:` placeholder - `lib/intake/accounts.ts`
               re-checks it against the trader, the platform and `pending:%` regardless. */
            adoptAccountId={account.id}
            onBack={toActions}
            onClose={close}
            onDone={done}
            onBusyChange={setBusy}
            files={files}
            setFiles={setFiles}
          />
        ) : null,
      ]}
    />
  );
}
