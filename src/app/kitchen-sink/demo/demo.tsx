'use client';

/* THE LIVE DEMO — the add-account flow, walkable, one scene per reachable state.
 *
 * The rack next door shows the intake's pieces STATIC, which is what a rack is for: twelve things
 * side by side is how you catch that three of them disagree about a radius. It cannot show you the
 * flow, because a flow is the thing between the screens — how the modal arrives, what the back arrow
 * does, whether closing mid-upload is possible, how the panel hands over to the confirmation.
 *
 * IT MOUNTS THE REAL COMPONENTS, and that is the whole design. A harness that re-renders their
 * markup drifts from them within a day, and then you are iterating a replica: the copy on this page
 * would improve while the shipped screen stayed wrong. Everything below is the shipped component.
 * Only the state that would normally come from a session, a click path, or a finished upload is
 * supplied here.
 *
 * ── NOTHING HERE MAY REACH THE NETWORK, AND THAT HAS TO HOLD FOR EVERY SCENE ─────────────────
 *
 * Not just the one anyone thought about. v2 got this wrong in a way worth carrying: its upload scene
 * was behind `dryRun` while its Add-manually scene mounted a form that really posted, so walking
 * those screens created four live accounts in the corpus from a page whose own header promised it
 * could not. Luke found them on the roster.
 *
 * So the rule is the PROPERTY, not the patch: if a form mounted here can reach the network, this
 * file is lying. Any scene added later takes `dryRun` or it does not go in. What stays real is
 * everything worth reviewing — file staging, header detection, the step list, the beat, and every
 * layout decision. Only the request is suppressed.
 */

import { useState } from 'react';
import { AddAccountModal } from '@/components/views/accounts/add-account-modal';
import { FileUploadStep, type Picked } from '@/components/views/accounts/file-upload-step';
import { ModalShell } from '@/components/views/accounts/modal-shell';
import { ImportComplete, ModalHeader, RunMark, type Source } from '@/components/views/accounts/shared';
import { ProgressPanel, type Step } from '@/components/views/accounts/progress-panel';
import { ModalActions } from '@/components/views/accounts/modal-shell';
import { FindingList } from '@/components/views/accounts/finding-notice';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import type { PreflightFinding } from '@/lib/intake/preflight';

/** The one live rail, matching `add-account-modal`'s own constant. */
const TRADOVATE: Source = {
  name: 'Tradovate',
  logoLight: '/brokers/tradovate-prop-light.png',
  logoDark: '/brokers/tradovate-prop-dark.png',
  mark: '/brokers/tradovate-logomark.png',
};

/* THE FAILURE SCENE'S FINDINGS, and this is the scene that earns the page. A real refusal needs a
 * deliberately mutilated export, so it is the state nobody ever walks — which is exactly why the
 * copy in it went unreviewed for so long. Three at once, because preflight returns every finding in
 * one pass rather than the first: a trader who re-exports to fix one problem should not then meet a
 * second, and this is the only place that promise can be seen to hold. */
const DEMO_FINDINGS: PreflightFinding[] = [
  {
    code: 'fees_unmatched',
    blocking: true,
    detail: { total: 333, fillRange: 'Mar 3 to Mar 7', otherRange: 'Apr 1 to Apr 7' },
  },
  {
    code: 'round_trips_unmatched',
    blocking: true,
    detail: { blocked: 7, total: 77, fillRange: 'Mar 3 to Mar 7', otherRange: 'Mar 3 to Mar 9' },
  },
  { code: 'fees_implausible', blocking: true, detail: { perContractCents: 7_700, total: 333 } },
];

const FAILED_STEPS: Step[] = [
  { id: 'read', label: 'Reading your files', state: 'done' },
  { id: 'fills', label: 'Saving your fills', state: 'done' },
  { id: 'position_history', label: 'Saving your trades', state: 'failed', detail: 'Could not be matched' },
  { id: 'cash_history', label: 'Saving your fees', state: 'pending' },
];

type Scene = 'doors' | 'upload' | 'failed' | 'complete' | 'already-saved';

const SCENES: { id: Scene; label: string; note: string }[] = [
  {
    id: 'doors',
    label: 'Add account',
    note: 'The two doors. Brokers leads even though it is dark, because it is the destination and the ranking should not be rearranged the week OAuth turns on. Add manually is a later slice.',
  },
  {
    id: 'upload',
    label: 'Upload exports',
    note: 'DRY RUN, and the whole flow. Drop any CSVs (real Tradovate exports read their real types) and press Continue: no request is sent and nothing is written. The panel then runs the real measured beat and ends on the confirmation.',
  },
  {
    id: 'failed',
    label: 'Refused',
    note: 'The state that needs three broken exports to reach for real. Three findings at once, because preflight returns every one in a single pass. Back to files keeps the staged selection; Try again cannot double-count, by the dedupe key.',
  },
  {
    id: 'complete',
    label: 'Complete',
    note: 'The end of a normal import. One exit, and it is forward: a trader who stepped away mid-upload needs the confirmation still waiting for them.',
  },
  {
    id: 'already-saved',
    label: 'Already saved',
    note: 'Zero rows written, which is CORRECT on a re-upload and is a different sentence. Before this existed it read "Your record is in." over a drawn check, identical to a first import, and told Luke twice that it had succeeded at saving nothing (#79).',
  },
];

/** The upload step wired to the dry run. Files stage for real, so type detection and the
 *  requirement row are genuinely exercised; Continue never posts. */
function UploadScene({ onClose }: { onClose: () => void }) {
  const [files, setFiles] = useState<Picked[]>([]);
  return (
    <FileUploadStep
      dryRun
      source={TRADOVATE}
      files={files}
      setFiles={setFiles}
      onBack={onClose}
      onClose={onClose}
      onDone={onClose}
      onBusyChange={() => {}}
    />
  );
}

/* The refused panel, assembled here rather than driven through a fake failure. Mounting the real
   `FileUploadStep` and making its dry run fail would mean teaching the hook to lie on purpose,
   which is a worse thing to own than this composition: the two children below (`ProgressPanel`,
   `FindingList`) ARE the shipped components, and the arrangement they sit in is four lines. */
function FailedScene({ onClose }: { onClose: () => void }) {
  return (
    <>
      <ModalHeader title="Building your record" />
      <ProgressPanel
        from={<Icon name="files" size={26} className="text-muted" />}
        to={<RunMark size={26} />}
        steps={FAILED_STEPS}
      />
      <div className="mt-2 px-6 pb-2">
        <p className="text-small text-muted mb-3">
          Everything ticked above is saved. Trying again will not duplicate it.
        </p>
        <FindingList findings={DEMO_FINDINGS} />
        <div className="mt-4">
          <ModalActions>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Back to files
            </Button>
            <Button size="sm" onClick={onClose}>
              Try again
            </Button>
          </ModalActions>
        </div>
      </div>
    </>
  );
}

export function AddAccountDemo() {
  /* `null` means nothing mounted, so the modals really are dismissable here. Closing one in the app
     returns you to the roster; closing one here returns you to this picker. In v2 every close was a
     no-op at first, which made the scenes feel stuck. */
  const [scene, setScene] = useState<Scene | null>('doors');
  /* Remounts the modal so a scene re-opens at its first step rather than wherever it was left. */
  const [nonce, setNonce] = useState(0);

  const show = (s: Scene) => {
    setScene(s);
    setNonce((n) => n + 1);
  };
  const close = () => setScene(null);

  return (
    <div className="bg-bg text-text min-h-dvh">
      <header className="border-border flex flex-wrap items-center gap-4 border-b px-6 py-4">
        <div className="mr-auto">
          <h1 className="text-title text-text">Add account, live</h1>
          <p className="text-small text-muted mt-0.5">
            Real components, scripted state. Nothing here writes to the database.
          </p>
        </div>
        <a href="/kitchen-sink" className="text-link text-small">
          Back to the rack
        </a>
        <ThemeToggle />
      </header>

      <div className="flex flex-wrap gap-2 px-6 py-4">
        {SCENES.map((s) => (
          <button
            key={s.id}
            onClick={() => show(s.id)}
            aria-pressed={scene === s.id}
            className={`text-small rounded-[var(--radius-sm)] border px-3 py-1.5 transition ${
              scene === s.id
                ? 'border-accent text-accent select-pop'
                : 'border-border bg-surface text-muted hover:text-text'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p className="text-small text-muted max-w-prose px-6 pb-8">
        {scene
          ? SCENES.find((s) => s.id === scene)!.note
          : 'Closed. Pick a scene to mount it again.'}
      </p>

      {scene === 'doors' && <AddAccountModal key={nonce} onClose={close} connected={0} />}

      {scene === 'upload' && (
        <ModalShell key={nonce} onDismiss={close}>
          <UploadScene onClose={close} />
        </ModalShell>
      )}

      {scene === 'failed' && (
        <ModalShell key={nonce} onDismiss={close}>
          <FailedScene onClose={close} />
        </ModalShell>
      )}

      {scene === 'complete' && (
        <ModalShell key={nonce} onDismiss={close}>
          <ImportComplete imported={777} onDone={close} />
        </ModalShell>
      )}

      {scene === 'already-saved' && (
        <ModalShell key={nonce} onDismiss={close}>
          <ImportComplete imported={0} onDone={close} />
        </ModalShell>
      )}
    </div>
  );
}
