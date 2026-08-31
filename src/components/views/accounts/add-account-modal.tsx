'use client';

/* "Add account", from inside the app. Ported from `run-trading@v2` (2026-08-15, S4e).
 *
 * THE ORDER IS THE DESIGN: a category row first, import second. The connected path is the whole
 * surface and importing is a row. Rank these the other way and the modal teaches the trader that
 * CSV is what Run wants from them, which is the opposite of true.
 *
 * Brokers leads even though it is dark, and that is a deliberate reversal of an earlier build. That
 * one put the live CSV path first and called it "ranking by honesty" — but it meant the modal's
 * whole order would have to be rearranged the week OAuth turns on. Ranking by DESTINATION with an
 * explicit "Soon" chip says the same honest thing without teaching the wrong priority.
 *
 * NO SEARCH FIELD, which is the one piece of the standard shape this drops. One rail, one source: a
 * search over a list of one is a control that exists to look busy. It arrives with the second rail.
 *
 * "ADD MANUALLY" LANDED 2026-08-28 (`D5`), and it is a BOTTOM BUTTON rather than a third card,
 * because it is not the same KIND of thing as the two above: those get fills IN, this one creates an
 * account with no fills yet, for the trader who bought an evaluation this morning. Ranking it as a
 * peer of the two intakes would say the three are alternatives, and they are not — it is what you do
 * when neither intake has anything to work with.
 * It brings `pending:<uuid>` account names with it, and therefore the ADOPTION PATH that
 * `resolveAccount` deliberately omitted until there was a caller for it.
 *
 * ─── TWO CONTAINERS, ONE FLOW (2026-08-28) ───────────────────────────────────────────────────────
 *
 * Below 768px this is not a modal at all but a full-screen sheet whose screens stack (Luke: "the add
 * account modal on mobile is not a modal ... basically no modals on mobile is the rule"). The DOORS
 * are byte-identical in both — same rows, same footer, same copy — so the screens are written once
 * and only the frame around them changes, which is what `surface.tsx` exists to arrange.
 *
 * THE LAYER MAP IS THE FLOW'S JOB, NOT THE SHEET'S, because only this component knows that "Import
 * from CSV" and "Add manually" are siblings one level down while the manual form's Firm/Size page is
 * a level below THAT. The rule deciding it is the header: a screen that renames the bar is a new
 * page and slides; a screen that does not is the same page and fades.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ModalShell, ModalBody, ModalFooter, useModalClose } from '@/components/ui/modal-shell';
import { AccountSheet, useSheet } from './account-sheet';
import { Button } from '@/components/ui/button';
import { ModalHeader, type Source } from './shared';
import { FileUploadStep, type Picked } from './file-upload-step';
import { useManualAccount } from './manual-account-form';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { usePhone } from '@/lib/use-phone';
import { slotSurface } from '@/components/ui/card';

/* The one live rail. Named "Tradovate", NOT "Tradovate Prop" (`widening-plan.md` §5.1): a trader
 * with a personal account reads "Prop" as "not for me" and leaves, and prop traders are on Tradovate
 * either way, so the shorter name loses nothing and stops turning people away. */
export const TRADOVATE: Source = {
  name: 'Tradovate',
  logoLight: '/brokers/tradovate-prop-light.png',
  logoDark: '/brokers/tradovate-prop-dark.png',
  mark: '/brokers/tradovate-logomark.png',
};

/* Whether the Tradovate connect can actually run. False until vendor OAuth credentials land. ONE
 * constant rather than a scatter of `disabled` props, so turning the rail on is a single edit and
 * cannot half-land: flip this and the Brokers row becomes clickable and drops its "Soon" chip. */
const TRADOVATE_CONNECT_LIVE = false;

type View = 'doors' | 'upload' | 'manual';

export function AddAccountModal({
  onClose,
  connected,
  dryRun = false,
  manual = true,
  adoptAccountId,
  title = 'Add account',
}: {
  onClose: () => void;
  /** How many broker logins are already connected. Counts LOGINS rather than accounts, because a
   *  firm issues one Tradovate login and a copy-trader runs many accounts under it. */
  connected: number;
  /** Whether the footer offers "Add manually". Off from an account page — see the footer's note. */
  manual?: boolean;
  /* THE ACCOUNT THIS IMPORT WAS LAUNCHED FROM. Passed straight to the upload step, which is what
     lets a hand-added `pending:` row adopt the real account name — see `lib/intake/accounts.ts`. */
  adoptAccountId?: string;
  /** "Add account" from the roster; "Import trades" from an account's own page. */
  title?: string;
  /* DEMO ONLY, AND THIS IS THE FIX FOR A REAL BUG (2026-08-15). `/kitchen-sink/demo`'s "doors" scene
   * mounted this component directly with no way to reach `FileUploadStep`'s `dryRun` — so clicking
   * through Import trades from that scene landed on the REAL upload step, which posts to
   * `/api/csv-import` for real. That is the exact v2 mistake this codebase's own comments warn
   * about: "the rule is the property, not the patch — if a form mounted here can reach the network,
   * this file is lying." It was not a hypothetical; it was reachable from the page whose header
   * claims nothing here writes to the database. Never passed by app code. */
  dryRun?: boolean;
}) {
  const router = useRouter();
  const phone = usePhone();
  const [view, setView] = useState<View>('doors');
  /* Held here, not in FileUploadStep: stepping back to the doors and returning keeps a staged
     selection. Closing the modal still discards it, which is the intended discard. */
  const [files, setFiles] = useState<Picked[]>([]);
  /* True while an upload is in flight. Every exit is blocked during it — leaving does not cancel the
     request, so the corpus write still lands while the result is thrown away. */
  const [busy, setBusy] = useState(false);

  /* TWO CONTAINERS, TWO CLOCKS, and both held HERE (#35, fixed 2026-08-31). A modal fades out in
     160ms and a sheet travels the height of the screen in 200, and each hook owns the delay before
     the owner above unmounts anything.
     THE MODAL CLOCK USED TO ARRIVE AS A PROP and nobody ever passed it. `closing` was declared,
     threaded to `ModalShell` and left `undefined` by every call site - `account-modals.tsx` renders
     `{adding && <AddAccountModal onClose={...} />}` and `import-trades-modal.tsx` forwards without
     it - so `Add account` and `Import trades` vanished in one frame while the editor beside them
     faded. The mechanism was built, wired and never switched on.
     Owning it here is what `label-account-modal.tsx` already does, and it makes the exit a property
     of the modal rather than something every call site has to remember. Both hooks are called
     unconditionally because hooks must be; only one is ever driven. */
  const sheet = useSheet(onClose);
  const modal = useModalClose(onClose);
  const leave = phone ? sheet.requestClose : modal.requestClose;

  const close = useCallback(() => {
    if (!busy) leave();
  }, [busy, leave]);

  /* `ModalShell`'s own dismiss guard only reaches Escape and the backdrop, both in-app. A refresh,
     a Back gesture, or closing the tab bypass it entirely — the write still lands (the corpus
     commit does not depend on this tab staying open), but the trader gets no warning before the
     progress panel they are watching just disappears. The browser's own confirmation is the one
     tool that reaches outside the app to cover those. */
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  /* The page is a Server Component reading the corpus, so `refresh()` is what makes a new account
     appear, not local state. One source of truth for what a trader owns. */
  const done = useCallback(() => {
    router.refresh();
    leave();
  }, [router, leave]);

  const toDoors = useCallback(() => setView('doors'), []);

  /* THE MANUAL FORM'S STATE LIVES HERE rather than inside a component that mounts on `view`,
     because on a phone its two pages go into two different LAYERS and a sheet's layers are
     siblings. See `manual-account-form.tsx`. On the modal path only one of the two is ever
     rendered, which is exactly what it was before. */
  const manualFlow = useManualAccount({
    onBack: toDoors,
    onClose: close,
    onCreated: done,
    onBusyChange: setBusy,
  });

  const uploadScreen = (
    <FileUploadStep
      dryRun={dryRun}
      source={TRADOVATE}
      adoptAccountId={adoptAccountId}
      onBack={toDoors}
      onClose={close}
      onDone={done}
      onBusyChange={setBusy}
      files={files}
      setFiles={setFiles}
    />
  );

  const doors = (
    <>
      {/* The first screen had NO close control at all in v2 until 2026-07-30 — only Escape and a
          backdrop click, neither of which is visible. Every later screen in the flow had an X,
          so the one screen a trader always sees first was the one with no way out. */}
      <ModalHeader title={title} onClose={close} />
      <ModalBody className="px-6 pb-6">
        <BrokerRow connected={connected} />
        <Door
          icon={<Icon name="upload" size={16} />}
          title="Import trades"
          desc="Import from CSV"
          onClick={() => setView('upload')}
        />
      </ModalBody>

      {/* THE THIRD DOOR, AND IT IS NOT A DOOR. A full-width OUTLINE button in the footer rather
          than a third card beside the two above: the cards are ways to get a RECORD in, and this
          is what you do when there is no record yet. Ranking it as their peer would say the
          three are alternatives for one job.
          IT IS DELIBERATELY NOT LABELLED "Prop firms" as a peer of Brokers, which v2 considered
          and rejected: a prop firm account IS a broker account — the firm does not hold the
          trades, Tradovate does, under a firm-issued login. Two doors called "Brokers" and
          "Prop firms" teach that false model, and a trader with an Apex account on Tradovate
          would have no way to pick between them.
          OFF FROM AN ACCOUNT PAGE (`manual={false}`), where the trader is already standing on an
          account and creating a second one is not what they came for. A SWITCH rather than a
          fork, so the doors above it can never drift apart. */}
      {manual && (
        <ModalFooter>
          <Button variant="outline" size="lg" className="w-full" onClick={() => setView('manual')}>
            Add manually
          </Button>
        </ModalFooter>
      )}
    </>
  );

  if (phone) {
    /* BACK MEANS ONE STEP, AND WHICH STEP DEPENDS ON WHERE YOU ARE. Inside the manual form it
       unwinds one ANSWER (Size back to Firm, Firm back to Type); anywhere else it returns to the
       doors. The sheet asks; this decides — the same split `dismiss` makes on the modal path. */
    const back = () => (view === 'manual' ? manualFlow.back() : toDoors());

    return (
      <AccountSheet
        open={sheet.open}
        onClose={close}
        onBack={back}
        /* AN IMPORT IN FLIGHT LOCKS THE EXIT, and this prop was simply missing (2026-08-28,
           postcheck) - `account-sheet.tsx` names this component as its reason for having it. */
        busy={busy}
        label={title}
        /* THE INDEX IS THE DEPTH, and the two lines below ARE the rule about headers.
           Layer 1 renames the bar ("Import from CSV" / "Add manually"), so it slides up over the
           doors. Layer 2 renames it again (the account type), so it slides up over layer 1. The
           Firm-to-Size change does NOT rename it, which is why it is not a layer at all — it is a
           keyed fade inside layer 2. */
        layers={[
          doors,
          view === 'upload' ? uploadScreen : view === 'manual' ? manualFlow.typeScreen : null,
          view === 'manual' && manualFlow.step !== 'type' ? manualFlow.detailScreen : null,
        ]}
      />
    );
  }

  // Escape and the backdrop dismiss the TOP layer only: a sub-view steps back to the doors, the
  // doors close the modal. The shell asks; this decides.
  const dismiss = () => (view === 'doors' ? onClose() : setView('doors'));

  return (
    <ModalShell onDismiss={dismiss} busy={busy} closing={modal.closing}>
      {view === 'upload'
        ? uploadScreen
        : view === 'manual'
          ? manualFlow.step === 'type'
            ? manualFlow.typeScreen
            : manualFlow.detailScreen
          : doors}
    </ModalShell>
  );
}

/* The Brokers category row: title, an "N connected" sub-line, the rail's logomark, then a chevron.
 *
 * A CATEGORY rather than a named broker, because the category is what survives adding rail #2:
 * NinjaTrader, Rithmic and ProjectX all land inside this row rather than each earning a card and
 * pushing the others down.
 *
 * DARK UNTIL THE VENDOR CREDENTIALS LAND. The row is present, first, and carries its real count,
 * because it is the destination and the modal's ranking should not be rearranged the week OAuth
 * turns on. What it must not do is look clickable while it cannot work.
 */
function BrokerRow({ connected }: { connected: number }) {
  const live = TRADOVATE_CONNECT_LIVE;
  return (
    <button
      type="button"
      disabled={!live}
      /* A SELECTABLE CARD INSIDE A MODAL is its own object class. In v2 this was the card surface in
         miniature — border, fill, shadow, deepening on hover — i.e. a raised card sitting on a
         raised card. Measured on the reference, the equivalent row is a FILL AND NOTHING ELSE. That
         is the honest reading: inside a modal the modal is the raised thing, and its choices are
         recessed slots on it, not more sheets floating above it. */
      className={`flex w-full items-center gap-3 rounded-[var(--radius)] px-4 py-4 text-left transition-colors ${
        live ? 'bg-hover hover:bg-surface-2' : 'bg-hover cursor-not-allowed opacity-60'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-body-lg text-text font-medium">Brokers</span>
          {!live && (
            <span className="eyebrow text-muted border-border rounded-[var(--radius-sm)] border px-1.5 py-0.5">
              Soon
            </span>
          )}
        </span>
        {/* The count, always, including zero. "0 connected" is the honest state and it is the line
            that changes the day the first connection lands. */}
        <span className="text-body text-muted block">{connected} connected</span>
      </span>
      {/* The rail's logomark on a permanently-light tile, for the same reason the firm picker uses
          one: a single asset has to survive both themes. */}
      <span
        className="border-border flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border"
        style={{ background: 'var(--color-logo-tile)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a static local mark, not content */}
        <img src={TRADOVATE.mark} alt="" className="h-full w-full object-contain" />
      </span>
      {/* Chevron points down by default; a quarter-turn anticlockwise is "points right". */}
      <Icon name="chevron" size={16} className="text-muted shrink-0 -rotate-90" />
    </button>
  );
}

function Door({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(slotSurface, 'mt-3 flex w-full items-center gap-3 px-4 py-4 text-left')}
    >
      <span className="min-w-0 flex-1">
        <span className="text-body-lg text-text block font-medium">{title}</span>
        <span className="text-body text-muted block">{desc}</span>
      </span>
      {/* Mark on the RIGHT at 32px, matching BrokerRow's logomark exactly. In v2 it led the row at
          40px, so the two cards in this stack put their marks on opposite sides at different sizes
          and read as two unrelated components rather than one list. */}
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        /* THE CARD'S OWN GROUND, not `surface-2` (Luke, 2026-07-31: "the icon for Import trades is
           darker bg than the card. so when user hovers over the card and the card darkens, it makes
           the button fade into the card's bg"). `surface-2` IS the slot's hover ground, so hovering
           painted the slot the exact colour of the chip and the chip disappeared.
           MUTED, not accent: pine is the one accent and it is spent on things you act on. A mark
           that labels a row is not one of those. */
        style={{ background: 'var(--color-surface)', color: 'var(--color-muted)' }}
      >
        {icon}
      </span>
      <Icon name="chevron" size={16} className="text-muted shrink-0 -rotate-90" />
    </button>
  );
}
