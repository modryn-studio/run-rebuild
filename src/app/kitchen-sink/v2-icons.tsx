/* `run-trading@v2`'s hand-drawn icon set, reproduced here for REFERENCE AND COMPARISON ONLY.
 *
 * Ported verbatim from `run-trading@v2:src/components/ui/icons.tsx` (2026-08-15, Luke: "i want
 * all of run-trading@v2's icons ported over to run-rebuild's kitchen-sink... but we will want to
 * make sure we are using run-rebuild's version of lineweight and whatnot").
 *
 * THAT CHECK CAME BACK CLEAN, AND IT IS WORTH STATING WHY THIS FILE EXISTS AT ALL GIVEN THAT.
 * v2's wrapper declares `viewBox="0 0 24 24"`, `strokeWidth={1.5}`, round cap, round join. This
 * build's `ICON_STROKE` (`components/ui/icon.tsx`) is 1.5 on lucide's own 24-box geometry with the
 * same round terminals — the two systems already agree on every number, because this build's
 * choice of 1.5 was made against the same measured reasoning v2's own file states. So nothing here
 * needed reconciling to render faithfully; the gallery is straightforward because the geometry
 * was never the open question.
 *
 * SCOPE, DELIBERATELY NARROW (Luke's call, 2026-08-15). This is a catalogue, not a migration.
 *   - `MARKS` in `components/ui/icon.tsx` is UNCHANGED. Every real screen keeps using lucide-react
 *     exactly as it does today.
 *   - CLAUDE.md's rule — "One icon set. lucide-react. Never inline an <svg>, never generate a UI
 *     icon" — stays true and unedited, because nothing outside `/kitchen-sink` imports this file.
 *   - A full swap was considered and set aside: v2 is a larger, differently-structured app (its
 *     nav is Today/Sessions/products/goals/rhythm/flow/plan/commitments, not this build's four
 *     items), so its 34 marks do not map one-to-one onto this build's 20 names. `Stack`, for
 *     instance, is not a nav icon in v2 at all — it is an empty-state illustration on the accounts
 *     roster. And v2 has no warning-triangle anywhere; this build's `warn` has no v2 counterpart.
 *     Forcing a mapping where none exists is a design decision, not a port, and it was not asked
 *     for here.
 *
 * EACH ICON IS ITS OWN COMPONENT, matching v2's own file shape exactly rather than flattening
 * everything into a generic "array of path strings" renderer. That is what keeps this diff-able
 * against the source: a future comparison is `git diff` against v2's file, not a re-derivation
 * from a lookup table this file invented.
 *
 * `Eye`'s `crossed` prop is rendered as two static entries below (`eye`, `eye (crossed)`) rather
 * than wired to a control, because this gallery is a reference sheet, not an interactive demo —
 * that distinction already exists one page over, at `/kitchen-sink/demo`.
 */

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

/* v2's own wrapper, copied rather than reused, on purpose: this file must render correctly even
   if this build's `Icon` wrapper (a different component, for a different icon set) changes shape
   later. A gallery that silently rides on the real wrapper's internals is not an honest snapshot
   of what v2 draws. */
function V2Icon({ children, size = 24, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

// ── base ─────────────────────────────────────────────────────────────────────────────────────

function V2Check(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M4.75 12.5 9.5 17.25 19.25 7" pathLength={1} />
    </V2Icon>
  );
}
function V2Plus(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M12 5.25v13.5M5.25 12h13.5" />
    </V2Icon>
  );
}
function V2Sun(props: IconProps) {
  return (
    <V2Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.75v2.5M12 18.75v2.5M2.75 12h2.5M18.75 12h2.5M5.6 5.6l1.75 1.75M16.65 16.65l1.75 1.75M18.4 5.6l-1.75 1.75M7.35 16.65L5.6 18.4" />
    </V2Icon>
  );
}
function V2Moon(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M20.5 13.35A8.5 8.5 0 1 1 10.65 3.5a6.8 6.8 0 0 0 9.85 9.85Z" />
    </V2Icon>
  );
}

// ── navigation ───────────────────────────────────────────────────────────────────────────────

function V2Home(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M12 4 4 11.5V20h16v-8.5Z" />
      <path d="M10 20v-5.5h4V20" />
    </V2Icon>
  );
}
function V2Today(props: IconProps) {
  return (
    <V2Icon {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </V2Icon>
  );
}
function V2Sessions(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M4 7h13M4 12h8M4 17h16" />
    </V2Icon>
  );
}
function V2Stack(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 15 9 5 9-5" />
    </V2Icon>
  );
}
function V2Live(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M6.5 6.5v11M17.5 6.5v11" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    </V2Icon>
  );
}
function V2Collapse(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M9.6 7.2 4.8 12l4.8 4.8M18.6 7.2 13.8 12l4.8 4.8" />
    </V2Icon>
  );
}
function V2Menu(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M3 6h18M3 12h18M3 18h10" />
    </V2Icon>
  );
}
function V2Chevron(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M19.5 9 12.75 15.75 6 9" />
    </V2Icon>
  );
}

// ── flow + file controls ────────────────────────────────────────────────────────────────────

function V2Close(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </V2Icon>
  );
}
function V2ArrowLeft(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </V2Icon>
  );
}
function V2ArrowUp(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </V2Icon>
  );
}
function V2Trend(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M7 17 17 7M10.5 7H17v6.5" />
    </V2Icon>
  );
}
function V2More(props: IconProps) {
  return (
    <V2Icon {...props}>
      <circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </V2Icon>
  );
}
function V2Grip(props: IconProps) {
  return (
    <V2Icon {...props}>
      {[9, 15].map((cx) =>
        [6, 12, 18].map((cy) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" fill="currentColor" stroke="none" />
        ))
      )}
    </V2Icon>
  );
}
function V2ExternalLink(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M13.5 4.5H19.5V10.5" />
      <path d="M19.5 4.5 11 13" />
      <path d="M18 14.5v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h4" />
    </V2Icon>
  );
}
function V2Circle(props: IconProps) {
  return (
    <V2Icon {...props}>
      <circle cx="12" cy="12" r="9" />
    </V2Icon>
  );
}
function V2Search(props: IconProps) {
  return (
    <V2Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m15.75 15.75 4.25 4.25" />
    </V2Icon>
  );
}
function V2Doc(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </V2Icon>
  );
}
function V2Upload(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M12 12v6M9.5 14.5 12 12l2.5 2.5" />
    </V2Icon>
  );
}
function V2Files(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M8 6V4.8A1.8 1.8 0 0 1 9.8 3h5.7" />
      <path d="M15.5 3 20 7.5V17" />
      <path d="M12 7H5.8A1.8 1.8 0 0 0 4 8.8v10.4A1.8 1.8 0 0 0 5.8 21h8.4a1.8 1.8 0 0 0 1.8-1.8v-6.7z" />
      <path d="M12 7v5.5h4" />
    </V2Icon>
  );
}
function V2Sync(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M21 12a9 9 0 0 0-15.5-6.3M3 12a9 9 0 0 0 15.5 6.3" />
      <path d="M21 3v5h-5M3 21v-5h5" />
    </V2Icon>
  );
}
function V2Info(props: IconProps) {
  return (
    <V2Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.75" r="0.75" fill="currentColor" stroke="none" />
    </V2Icon>
  );
}

// ── account menu ─────────────────────────────────────────────────────────────────────────────

function V2Gear(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M9.88 5.85L9.98 3.23A9 9 0 0 1 14.02 3.23L14.12 5.85A6.5 6.5 0 0 1 16.26 7.09L18.58 5.86A9 9 0 0 1 20.61 9.37L18.38 10.76A6.5 6.5 0 0 1 18.38 13.24L20.61 14.63A9 9 0 0 1 18.58 18.14L16.26 16.91A6.5 6.5 0 0 1 14.12 18.15L14.02 20.77A9 9 0 0 1 9.98 20.77L9.88 18.15A6.5 6.5 0 0 1 7.74 16.91L5.42 18.14A9 9 0 0 1 3.39 14.63L5.62 13.24A6.5 6.5 0 0 1 5.62 10.76L3.39 9.37A9 9 0 0 1 5.42 5.86L7.74 7.09Z" />
      <circle cx="12" cy="12" r="2.6" />
    </V2Icon>
  );
}
function V2Filter(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M3.5 7h17M6.5 12h11M9.5 17h5" />
    </V2Icon>
  );
}
function V2Eye(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.75" />
    </V2Icon>
  );
}
function V2EyeCrossed(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.75" />
      <path d="M4 20 20 4" />
    </V2Icon>
  );
}
function V2Copy(props: IconProps) {
  return (
    <V2Icon {...props}>
      <rect x="9" y="9" width="11.5" height="11.5" rx="2.5" />
      <path d="M15 6.5v-1a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2V13a2 2 0 0 0 2 2h1" />
    </V2Icon>
  );
}
function V2NoteMark(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M4.5 6.5h15M4.5 12h15M4.5 17.5h9" />
    </V2Icon>
  );
}
function V2Bolt(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M13.5 3 7 13.5h4.3L10 21l7.5-11h-4.3L13.5 3Z" />
    </V2Icon>
  );
}
function V2SignOut(props: IconProps) {
  return (
    <V2Icon {...props}>
      <path d="M14.5 4.5H8a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h6.5" />
      <path d="M20 12H9.5M16.25 8.25 20 12l-3.75 3.75" />
    </V2Icon>
  );
}

/* THE FOUR GROUPS, IN V2'S OWN ORDER, matching the section comments in its source file exactly
 * ("── Navigation ──", "── Flow + file controls ──", "── Account menu ──"). Grouping a reference
 * catalogue by the source's own taxonomy, rather than inventing a new one, is what keeps this
 * comparable against a future `git diff` of the original. */
export const V2_ICON_GROUPS: { label: string; icons: [string, React.ComponentType<IconProps>][] }[] = [
  {
    label: 'base',
    icons: [
      ['check', V2Check],
      ['plus', V2Plus],
      ['sun', V2Sun],
      ['moon', V2Moon],
    ],
  },
  {
    label: 'navigation',
    icons: [
      ['home', V2Home],
      ['today', V2Today],
      ['sessions', V2Sessions],
      ['stack', V2Stack],
      ['live', V2Live],
      ['collapse', V2Collapse],
      ['menu', V2Menu],
      ['chevron', V2Chevron],
    ],
  },
  {
    label: 'flow + file controls',
    icons: [
      ['close', V2Close],
      ['arrow left', V2ArrowLeft],
      ['arrow up', V2ArrowUp],
      ['trend', V2Trend],
      ['more', V2More],
      ['grip', V2Grip],
      ['external link', V2ExternalLink],
      ['circle', V2Circle],
      ['search', V2Search],
      ['doc', V2Doc],
      ['upload', V2Upload],
      ['files', V2Files],
      ['sync', V2Sync],
      ['info', V2Info],
    ],
  },
  {
    label: 'account menu',
    icons: [
      ['gear', V2Gear],
      ['filter', V2Filter],
      ['eye', V2Eye],
      ['eye (crossed)', V2EyeCrossed],
      ['copy', V2Copy],
      ['note', V2NoteMark],
      ['bolt', V2Bolt],
      ['sign out', V2SignOut],
    ],
  },
];
