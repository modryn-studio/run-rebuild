/* THE ONE PLACE AN ICON'S WEIGHT AND SIZE ARE DECIDED.
 *
 * Nothing outside this file imports `lucide-react`. That is the entire point, and it buys two
 * things that are worth more than they look:
 *
 * 1. STROKE MATCHES THE SYSTEM. Lucide ships `strokeWidth: 2` (verified in the installed
 *    package). This system is built for 1.5 — at Run's sizes a 2px stroke reads chunky against a
 *    14px body face and a hairline border token, and the whole register is warm paper and fine
 *    rules. What makes a borrowed icon set LOOK borrowed is almost never the drawing; it is that
 *    the marks are heavier than everything around them. One number, declared once, fixes that.
 *
 * 2. GOING CUSTOM STAYS A ONE-FILE CHANGE. The day Run needs a mark no library ships — an armed
 *    lockout, a sealed account, the corpus — a half-library, half-custom set starts reading as
 *    mismatched, because stroke weight and terminal style never quite agree. At that point you
 *    own the whole set. With this wrapper that swap edits one file; without it, it is a hunt
 *    through every component, which is the version of the job that never gets done.
 *
 *    The previous build measured what happens without it: the sidebar had seven inline icons at
 *    strokeWidth 1.3 / 1.6 / 1.8 across two viewBoxes while its icon module used 1.5 — a painted
 *    spread of 1.00px to 1.50px, 50% variance, which is exactly what makes a set look like a
 *    collection of unrelated drawings.
 *
 * ON-SCREEN WEIGHT SCALES WITH RENDERED SIZE, and that is intended. A 24-box mark drawn at 16px
 * paints a 1.0px stroke. Smaller marks optically want finer strokes; what matters is that two
 * icons at the SAME size always agree.
 *
 * ADDING AN ICON: re-export it from the map below. Do not import from `lucide-react` anywhere
 * else, and never inline an `<svg>` in a component.
 */
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  FileText,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  X,
  Check,
  ChevronDown,
  Moon,
  Sun,
  Upload,
  FileSpreadsheet,
  Files,
  Circle,
  ArrowLeft,
  Plus,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

/** The system's stroke. Read the note above before changing it. */
export const ICON_STROKE = 1.5;

/** 16px. The default everywhere: it sits with a 14px body face without shouting. */
export const ICON_SIZE = 16;

export type IconName = keyof typeof MARKS;

/* Named for the JOB, not for the drawing. `Read` rather than `FileText` means the day the mark
 * changes, every call site already says what it meant.
 *
 * `Read` is deliberately NOT a sparkle. The sparkle is the category's AI cliche, and it misstates
 * this product: a read is checked arithmetic with a sentence written around it, and every figure
 * in it is verified against the tape. A mark promising magic promises the opposite of the claim.
 */
const MARKS = {
  today: LayoutDashboard,
  accounts: Wallet,
  trades: Receipt,
  read: FileText,
  settings: Settings,
  collapse: ChevronsLeft,
  expand: ChevronsRight,
  menu: Menu,
  close: X,
  check: Check,
  chevron: ChevronDown,
  moon: Moon,
  sun: Sun,

  /* ── the intake flow (S4e) ────────────────────────────────────────────────────────────────
   * `unmet` is a hollow circle rather than an empty checkbox on purpose: a checkbox is a control
   * the trader can operate, and these rows are a report on which files have arrived. Offering
   * something that looks pressable and is not is worse than a plain dot.
   *
   * NO `sync` HERE, on purpose, and its absence is worth a line: it was added with this batch
   * under a comment saying "the Auto-sync door, dark until the vendor creds land" and the door it
   * describes was never built that way — `add-account-modal.tsx`'s Brokers row uses the broker's
   * OWN logomark image, never a generic glyph, because a mark that labels a whole category of
   * future rails cannot borrow one rail's icon. Found while auditing the rack against real call
   * sites (2026-08-15): zero references anywhere outside this file. Removed rather than kept
   * "for later" — an icon nothing draws is exactly the one-off this wrapper exists to prevent, and
   * the day a sync affordance is real, it earns its entry then. */
  upload: Upload,
  file: FileSpreadsheet,
  files: Files,
  unmet: Circle,
  back: ArrowLeft,
  add: Plus,
  warn: TriangleAlert,
} satisfies Record<string, LucideIcon>;

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
