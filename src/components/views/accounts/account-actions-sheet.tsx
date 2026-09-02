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
 * EDIT IS A LAYER TOO, AND IT SHIPPED AS A HANDOFF FOR EXACTLY ONE DAY. This file argued that its
 * three-screen stack and its confirmations made hosting it a bigger job than it was worth, and that
 * Edit being the rare action made the crossing acceptable. Luke used it and it was not: "the current
 * screen slides down quickly as if being closed and a new edit account screen slides up from the
 * bottom of the page with the header included. this is wrong." Right - the crossing is visible, and
 * "rare" is not a defence for a transition that reads as a bug.
 *
 * `useLabelAccountFlow` is the fix and it was smaller than the estimate, because `screenNode` was
 * already a pure function of a screen name. Its layers are spread into the array below; its
 * confirmations render after the sheet, which is where they have always gone.
 *
 * ─── WHAT BACK MEANS, AND WHY THE TWO ROWS ANSWER DIFFERENTLY ───────────────────────────────────
 *
 * The upload step DRAWS a back arrow, so its Back returns to the actions list. The edit screen draws
 * NONE at the bottom of its own stack, so its Back closes the whole sheet - Luke, 2026-09-02: "the
 * back arrow on the phone should do the same thing as the cancel button on the edit screen, which is
 * to close the whole sheet. same as the 'x' button in the header." The flow's own `back` already did
 * that, so passing it through decides nothing new. The rule underneath: a device Back may only go
 * where the screen shows a way to go.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { ModalBody } from '@/components/ui/modal-shell';
import { AccountSheet, useSheet } from './account-sheet';
import { ModalHeader } from './shared';
import { Door, TRADOVATE } from './add-account-modal';
import { FileUploadStep, type Picked } from './file-upload-step';
import { useAccountSiblings } from './account-modals';
import { useLabelAccountFlow } from './label-account-form';
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
  const siblings = useAccountSiblings();
  const sheet = useSheet(onClose);
  const [view, setView] = useState<'actions' | 'upload' | 'edit'>('actions');
  /* Lifted out of `FileUploadStep` for the same reason `AddAccountModal` lifts it: stepping back to
     the actions list and returning keeps a staged selection. Closing the sheet still discards it,
     which is the intended discard. */
  const [files, setFiles] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);

  const close = useCallback(() => {
    if (!busy) sheet.requestClose();
  }, [busy, sheet]);

  /* THE EDIT FLOW'S SCREENS, HANDED UP so they can be layers of THIS sheet rather than a second one
     sliding up over it with its own header. See `useLabelAccountFlow` for why two sheets cannot do
     what Luke asked for here.
     CALLED UNCONDITIONALLY, which hooks require and this one permits - it holds no effects, so a
     flow nobody has opened costs state and closures and touches nothing.
     `onSaved` AND `onClose` BOTH CLOSE THE WHOLE SHEET. Saving already ran `router.refresh()`
     inside the flow, so closing on top of that is what makes the change appear to happen in the
     page rather than after it - the same call `LabelAccountModal` makes. */
  const editFlow = useLabelAccountFlow({
    account,
    siblingCount: siblings(account),
    onClose: () => sheet.requestClose(),
    onSaved: () => sheet.requestClose(),
    onBusyChange: setBusy,
    asSheet: true,
  });

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
          onClick={() => setView('edit')}
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
    <>
      <AccountSheet
        open={sheet.open}
        onClose={close}
        /* WHAT BACK MEANS, AND THE SHEET ASKS WHILE THIS DECIDES - exactly as `AddAccountModal`
         splits the same question.
         NEITHER ROW DRAWS A BACK ARROW ANY MORE, so neither answers Back by walking to the actions
         list. That would be answering a gesture the UI never offered: `design-system.md` §6a, a
         device Back may only go where the screen shows a way to go.
         EDIT STILL ROUTES THROUGH ITS OWN `back`, because its DEEPER screens (type, firm) DO draw
         arrows and have to pop within the flow; at the bottom of its stack that same function
         closes, which is what Luke asked for ("the back arrow on the phone should do the same thing
         as the cancel button ... close the whole sheet").
         THE UPLOAD STEP HAS NO INNER STACK, so Back there is simply the exit - and `close` refuses
         while an import is in flight, which is the one press this screen must not obey. */
        onBack={view === 'edit' ? editFlow.back : close}
        /* AN IMPORT IN FLIGHT LOCKS EVERY EXIT - Escape, the scrim and the device Back button. The
         request is not cancelled by leaving, so the corpus write lands either way and the only
         thing an exit achieves is throwing away the result. */
        busy={busy || editFlow.busy}
        label={`Account actions for ${account.displayName ?? account.externalAccountId}`}
        /* INDEX IS DEPTH. Layer 1 RENAMES the bar (to the upload step's own header), which is the
         rule that says it slides rather than fades. `design-system.md` §6a. */
        layers={[
          actions,
          /* THE EDIT FLOW CONTRIBUTES A VARIABLE NUMBER, one per screen in its own stack, so it is
           spread rather than slotted. `edit` alone on an account that has a type; `edit -> type ->
           firm` at worst on an unlabelled one, which is the case `MAX_LAYERS` was raised to 4 for. */
          ...(view === 'edit' ? editFlow.layers : []),
          view === 'upload' ? (
            <FileUploadStep
              dryRun={dryRun}
              source={TRADOVATE}
              /* SCOPED, and this is the assertion that makes adoption trustworthy: the import began
               on THIS account's page, so the trader is saying the files belong to this row. The
               only signal permitted to fill in a `pending:` placeholder - `lib/intake/accounts.ts`
               re-checks it against the trader, the platform and `pending:%` regardless. */
              adoptAccountId={account.id}
              /* NO `onBack`, SO NO ARROW (Luke, 2026-09-02: "the import from csv screen ... from
                 the three dot menu doesn't need a back arrow in the header"). `AddAccountModal`
                 passes one because there this step sits over the DOORS and back means "pick a
                 different source". Here the row that opened it already named the only live source,
                 so an arrow would lead to a list whose one other entry is Edit — a way back to
                 nothing the trader wanted. `ModalHeader` draws the arrow only when handed a
                 handler, so omitting it is the whole change. */
              onClose={close}
              onDone={done}
              onBusyChange={setBusy}
              files={files}
              setFiles={setFiles}
            />
          ) : null,
        ]}
      />
      {/* A CONFIRMATION IS NOT A SCREEN OF THIS FLOW, so it goes outside the sheet entirely - after
          it in the DOM, which is what puts it on top without a second z-index to keep in step. The
          edit flow owns all three (close, delete, how-did-it-end) and renders them wherever its
          host puts them; `LabelAccountForm` places them the same way on its own path. They also put
          this sheet in `busy` while they are up, so one Escape closes exactly one thing. */}
      {view === 'edit' && editFlow.confirmations}
    </>
  );
}
