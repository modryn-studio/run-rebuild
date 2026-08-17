/* THE ONE PLACE AN ICON'S WEIGHT AND SIZE ARE DECIDED.
 *
 * HAND-DRAWN IS THE DEFAULT NOW, NOT LUCIDE (2026-08-15, Luke: "find ones that exist in the Marks
 * and feedback icon list now and replace them with v2's icon, direct swap"). Seventeen of this
 * file's twenty marks are `run-trading@v2`'s own drawings, ported verbatim — same geometry this
 * file already declared for itself before the swap, so nothing needed reconciling: `viewBox 0 0 24
 * 24`, `strokeWidth 1.5`, round cap, round join, all in ONE wrapper below exactly as before.
 *
 * WHY NOT ALL TWENTY. Three names have no v2 counterpart to swap in, and forcing one would be
 * inventing a mark rather than reusing an existing one, which is a different job than the one
 * asked for here:
 *   `read`    no concept match anywhere in v2's 34. `NoteMark` is closest by word-association
 *             ("note"/"read") and its own comment scopes it to the trader WRITING to themselves —
 *             the opposite of `read`'s job, which is receiving a finished figure.
 *   `expand`  v2 draws `Collapse` only, single-direction by its own design choice (the button that
 *             uses it never needs to point the other way). Rendering that path rotated 180deg
 *             would work visually, but it is a new composition this exercise did not ask for.
 *   `warn`    zero triangle/alert marks anywhere in v2's file. Confirmed by grep, not assumed.
 * All three stay on lucide-react, which is why the import below is not empty.
 *
 * A REAL BUG THE SWAP FIXED ON THE WAY PAST. `.check-draw` (globals.css) animates
 * `stroke-dashoffset` from 1 to 0 against `stroke-dasharray: 1`, which only reads as a full stroke
 * reveal if the path's length is normalised to 1 via the SVG `pathLength` attribute. Measured on
 * the lucide `Check` this used to draw: real path length 22.6, no `pathLength` set anywhere in
 * lucide's own node data — so the animation was drawing a repeating 1-unit dash/gap pattern the
 * whole time, not a continuous tick. v2's `Check` carries `pathLength={1}` because it was drawn
 * FOR this exact reveal. The swap is correctness, not just a family match.
 *
 * GOING CUSTOM STAYS A ONE-FILE CHANGE, still. That was always the point of the wrapper, and nothing
 * about today's swap changes it: a future mark, hand-drawn or borrowed, is still one entry here.
 *
 * The previous build measured what happens without a single wrapper: the sidebar had seven inline
 * icons at strokeWidth 1.3 / 1.6 / 1.8 across two viewBoxes while its icon module used 1.5 — a
 * painted spread of 1.00px to 1.50px, 50% variance, which is exactly what makes a set look like a
 * collection of unrelated drawings. `run-trading@v2` measured the identical failure independently
 * and drew the identical conclusion, which is the whole reason its geometry ported over with
 * nothing to reconcile.
 *
 * ADDING AN ICON: draw it here, through `Drawn` below, in v2's shape (one wrapper, geometry only,
 * nothing per-icon overrides stroke or viewBox) — or import a lucide fallback for something v2
 * never needed. Either way it is one new entry in `MARKS`. Never inline an `<svg>` anywhere else.
 */
import { FileText, ChevronsRight, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { SVGProps } from 'react';

/** The system's stroke. Read the note above before changing it. */
export const ICON_STROKE = 1.5;

/** 16px. The default everywhere: it sits with a 14px body face without shouting. */
export const ICON_SIZE = 16;

/** What `Icon()` actually passes to whichever component a name resolves to. Both lucide's real
 *  components and the hand-drawn ones below satisfy this — lucide's accept a strictly wider prop
 *  set, and `Drawn` is written to accept exactly this one, so a single `MARKS` type covers both
 *  without importing lucide's own type for entries that no longer use it. */
type Glyph = (props: {
  size?: number | string;
  strokeWidth?: number;
  className?: string;
  'aria-hidden'?: boolean;
}) => React.JSX.Element;

/* v2's own wrapper, reproduced exactly rather than merged with a lucide-shaped one: `viewBox`,
 * `strokeWidth`, cap and join are declared here ONCE, the same discipline this file already
 * enforced before the swap. `props` spreads after the defaults, so a caller's `strokeWidth`
 * (there is exactly one caller, `Icon()` below, and it always passes `ICON_STROKE`) wins. */
type DrawnProps = SVGProps<SVGSVGElement> & { size?: number | string };
function Drawn({ children, size = ICON_SIZE, ...props }: DrawnProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

// ── hand-drawn, ported from run-trading@v2:src/components/ui/icons.tsx ─────────────────────────
// Each one is its own small component, in v2's own shape, so a future comparison is a plain
// `git diff` against the source rather than a re-derivation from a lookup table invented here.

function DrawnCheck(props: DrawnProps) {
  return (
    <Drawn {...props}>
      <path d="M4.75 12.5 9.5 17.25 19.25 7" pathLength={1} />
    </Drawn>
  );
}
function DrawnPlus(props: DrawnProps) {
  return (
    <Drawn {...props}>
      <path d="M12 5.25v13.5M5.25 12h13.5" />
    </Drawn>
  );
}
/* Three rules of decreasing length: the filter mark, ported verbatim from `run-trading@v2`'s
 * `icons.tsx`. Drawn rather than borrowed, which is what let the Filters control carry a mark at
 * all — the house rule is that a UI icon is never generated to fill a gap. */
function DrawnFilter(props: DrawnProps) {
  return (
    <Drawn {...props}>
      <path d="M3.5 7h17M6.5 12h11M9.5 17h5" />
    </Drawn>
  );
}
function DrawnSun(props: DrawnProps) {
  return (
    <Drawn {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.75v2.5M12 18.75v2.5M2.75 12h2.5M18.75 12h2.5M5.6 5.6l1.75 1.75M16.65 16.65l1.75 1.75M18.4 5.6l-1.75 1.75M7.35 16.65L5.6 18.4" />
    </Drawn>
  );
}
function DrawnMoon(props: DrawnProps) {
  return (
    <Drawn {...props}>
      <path d="M20.5 13.35A8.5 8.5 0 1 1 10.65 3.5a6.8 6.8 0 0 0 9.85 9.85Z" />
    </Drawn>
  );
}
/** `today`. A calendar, not a dashboard grid: body, header rule, two hanging bindings. */
function DrawnToday(props: DrawnProps) {
  return (
    <Drawn {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Drawn>
  );
}
/** `accounts`. Stacked plates: several accounts, one pile — v2's own comment for this exact
 *  concept, on its accounts roster empty state. */
function DrawnStack(props: DrawnProps) {
  return (
    <Drawn {...props}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 15 9 5 9-5" />
    </Drawn>
  );
}
/** `trades`. v2's `Sessions`: three rules of DIFFERENT lengths, a tape of unequal sittings, not a
 *  uniform list. Renamed here to the concept this build's nav actually names — v2's own comment
 *  is explicit that equal-length rules were rejected for reading as "a list", the framing this
 *  product refuses. */
function DrawnSessions(props: DrawnProps) {
  return (
    <Drawn {...props}>
      <path d="M4 7h13M4 12h8M4 17h16" />
    </Drawn>
  );
}
function DrawnCollapse(props: DrawnProps) {
  return (
    <Drawn {...props}>
      <path d="M9.6 7.2 4.8 12l4.8 4.8M18.6 7.2 13.8 12l4.8 4.8" />
    </Drawn>
  );
}
function DrawnMenu(props: DrawnProps) {
  return (
    <Drawn {...props}>
      <path d="M3 6h18M3 12h18M3 18h10" />
    </Drawn>
  );
}
function DrawnChevron(props: DrawnProps) {
  return (
    <Drawn {...props}>
      <path d="M19.5 9 12.75 15.75 6 9" />
    </Drawn>
  );
}
function DrawnClose(props: DrawnProps) {
  return (
    <Drawn {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Drawn>
  );
}
function DrawnArrowLeft(props: DrawnProps) {
  return (
    <Drawn {...props}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </Drawn>
  );
}
/** `settings`. An actual cog: a single closed path alternating root-arc and tooth-tip, not
 *  detached spokes (which reads as a sun/asterisk — a gear's teeth are part of its outline). */
function DrawnGear(props: DrawnProps) {
  return (
    <Drawn {...props}>
      <path d="M9.88 5.85L9.98 3.23A9 9 0 0 1 14.02 3.23L14.12 5.85A6.5 6.5 0 0 1 16.26 7.09L18.58 5.86A9 9 0 0 1 20.61 9.37L18.38 10.76A6.5 6.5 0 0 1 18.38 13.24L20.61 14.63A9 9 0 0 1 18.58 18.14L16.26 16.91A6.5 6.5 0 0 1 14.12 18.15L14.02 20.77A9 9 0 0 1 9.98 20.77L9.88 18.15A6.5 6.5 0 0 1 7.74 16.91L5.42 18.14A9 9 0 0 1 3.39 14.63L5.62 13.24A6.5 6.5 0 0 1 5.62 10.76L3.39 9.37A9 9 0 0 1 5.42 5.86L7.74 7.09Z" />
      <circle cx="12" cy="12" r="2.6" />
    </Drawn>
  );
}
/** `file`. v2's `Doc`: a document, the folded corner its own path since it is the whole read at
 *  15px. NOT named `File` there either — it would shadow the DOM `File` global. */
function DrawnDoc(props: DrawnProps) {
  return (
    <Drawn {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </Drawn>
  );
}
/** `upload`. File plus the arrow, so it reads as a family with `file` above rather than an
 *  unrelated drawing — the exact geometry `add-account-modal.tsx`'s door and the drop zone both
 *  render, replacing the lucide `FileUp` stand-in used before this pass. */
function DrawnUpload(props: DrawnProps) {
  return (
    <Drawn {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M12 12v6M9.5 14.5 12 12l2.5 2.5" />
    </Drawn>
  );
}
/** `files`. A stack of exports: two sheets, the back one an open path rather than a second full
 *  outline — a complete rectangle behind a complete rectangle reads as two icons overlapping. */
function DrawnFiles(props: DrawnProps) {
  return (
    <Drawn {...props}>
      <path d="M8 6V4.8A1.8 1.8 0 0 1 9.8 3h5.7" />
      <path d="M15.5 3 20 7.5V17" />
      <path d="M12 7H5.8A1.8 1.8 0 0 0 4 8.8v10.4A1.8 1.8 0 0 0 5.8 21h8.4a1.8 1.8 0 0 0 1.8-1.8v-6.7z" />
      <path d="M12 7v5.5h4" />
    </Drawn>
  );
}
/** `unmet`. v2's `Circle`, drawn for exactly this purpose — its own comment: "An unmet
 *  requirement. Paired with Check, which replaces it once satisfied." A hollow circle rather than
 *  an empty checkbox on purpose: a checkbox is a control the trader can operate, and these rows
 *  are a report on which files have arrived. */
function DrawnCircle(props: DrawnProps) {
  return (
    <Drawn {...props}>
      <circle cx="12" cy="12" r="9" />
    </Drawn>
  );
}

const MARKS = {
  today: DrawnToday,
  accounts: DrawnStack,
  trades: DrawnSessions,
  read: FileText,
  settings: DrawnGear,
  collapse: DrawnCollapse,
  expand: ChevronsRight,
  menu: DrawnMenu,
  close: DrawnClose,
  check: DrawnCheck,
  chevron: DrawnChevron,
  moon: DrawnMoon,
  sun: DrawnSun,

  // ── the intake flow (S4e) ──────────────────────────────────────────────────────────────────
  upload: DrawnUpload,
  file: DrawnDoc,
  files: DrawnFiles,
  unmet: DrawnCircle,
  back: DrawnArrowLeft,
  add: DrawnPlus,
  warn: TriangleAlert,

  // ── the tape (S5c) ─────────────────────────────────────────────────────────────────────────
  filter: DrawnFilter,
} satisfies Record<string, Glyph | LucideIcon>;

export type IconName = keyof typeof MARKS;

/** The names as a RUNTIME array, derived from the same object every lookup uses — never a second
 *  list hand-typed alongside it. This is what lets the rack assert "every icon is shown" instead
 *  of stating it: a name added to `MARKS` and never grouped in the rack shows up there as
 *  unplaced rather than silently missing, which is the failure this export exists to catch. */
export const ICON_NAMES = Object.keys(MARKS) as IconName[];

export function Icon({
  name,
  size = ICON_SIZE,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const Mark = MARKS[name];
  // `size` is passed as the attribute AND left overridable by a `size-*` class, since CSS beats
  // the width/height attributes. Call sites that need a different box use the class.
  return <Mark size={size} strokeWidth={ICON_STROKE} className={className} aria-hidden />;
}
