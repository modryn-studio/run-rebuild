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
  PanelLeft,
  PanelRight,
  X,
  Check,
  ChevronDown,
  Moon,
  Sun,
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
  collapse: PanelLeft,
  expand: PanelRight,
  close: X,
  check: Check,
  chevron: ChevronDown,
  moon: Moon,
  sun: Sun,
} satisfies Record<string, LucideIcon>;

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
