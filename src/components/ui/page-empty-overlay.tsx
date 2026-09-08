import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ICON_STROKE } from '@/components/ui/icon';
import { cn } from '@/lib/cn';

/* A PAGE'S EMPTY STATE, THE REFERENCE'S WAY: the page rendered with EXAMPLE data, held at 40%
 * opacity and inert, with one white card over it holding an icon, a headline, and one CTA.
 *
 * COPIED FROM THE DOM, NOT A SCREENSHOT (`app.monarch.com`, every page, 2026-09-08, Luke: *"basically
 * examples behind the scrim. modal with the cta ... i want the same"*). Their `PageEmptyOverlayCard`
 * is one component reused on Dashboard, Accounts, Transactions, Cash Flow, Reports, Recurring, Goals
 * and Investments; only the copy changes. Measured at 1280: a 500×243 white card, `position:
 * absolute` inside the page root, `padding: 24px`, `border-radius: 12px`, `box-shadow: 0 8px 16px
 * rgba(0,40,100,.08)`; a 24px accent-coloured stroke icon, a two-line headline, a 40px filled CTA
 * (`8px 16px`, 16px/500, 8px radius). Behind it the scroll container AND the page header sit at
 * `opacity: 0.4; pointer-events: none` with a transition. NO blur and NO dark scrim - the fade is
 * the whole treatment, and it is what lets the example read as the real page.
 *
 * ON RUN'S TOKENS. The card is `cardSurface`'s radius with the elevated shadow; the CTA is
 * `Button` `primary`; the icon is the accent at the `EmptyState` hero size. The one number this file
 * introduces is `opacity-40`, which is theirs, measured.
 *
 * THE EXAMPLE IS THE POINT, AND IT IS THE ONE PLACE THIS PRODUCT SHOWS A NUMBER IT CANNOT RECONCILE.
 * `CLAUDE.md`'s claim is "never show a number you cannot reconcile", and `/kitchen-sink` was gated the
 * same day for showing fixture money to strangers. This is different in exactly the way that
 * matters: the numbers are at 40%, inert, and under a card whose first words are "Let's begin". They
 * are a picture of what the page will hold, not a claim about the trader's trading, and a new trader
 * looking at an empty grid does not know what the product does. Luke made the call (2026-09-08);
 * this note is so nobody widens it - example data is legal ONLY behind this card, never in a card of
 * its own and never at full opacity.
 *
 * `aria-hidden` ON THE EXAMPLE, so a screen reader meets the card and not forty fake rows. `inert`
 * would be the semantic answer and React 19 supports it as a boolean attribute; `pointer-events`
 * plus `aria-hidden` plus `tabIndex` guarding in the children is what the reference ships, and it is
 * enough here because every example is static.
 */
export function PageEmptyOverlay({
  icon: Icon,
  headline,
  cta,
  children,
  className,
}: {
  icon: LucideIcon;
  /** Two lines at most. It says what the page will hold, in the trader's terms, never what is missing. */
  headline: string;
  /** One rendered control - a `Button` or a `Link` wearing `buttonClasses`. Never a handler. */
  cta: ReactNode;
  /** The page's own components with example props. Rendered, faded, inert. */
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      {/* THE EXAMPLE. `select-none` because a faded example that highlights on drag has stopped
          being a picture. `transition-opacity` so the day the real data arrives it fades up rather
          than snapping - the reference transitions this too. */}
      <div aria-hidden className="pointer-events-none opacity-40 transition-opacity select-none">
        {children}
      </div>

      {/* THE CARD. Absolute over the example and centred by its own margins, the reference's shape.
          `top-16` rather than dead-centre: their card sits in the upper third so it reads before the
          example does, and on a phone a centred card would land behind the thumb. */}
      <div
        role="region"
        aria-label={headline}
        /* `--shadow-lift` IS THE RAISED-OBJECT TOKEN - the reference's `0 8px 16px` sits between
           `card` and `lift`, and a card floating over a faded page is raised. Spacing is theirs,
           measured: icon 24, then 27px to a 24px/500 headline on a 36px line (Run's `text-h2` is
           24px/500 on 30px, the nearest role), then 32px to the 40px CTA. */
        className="bg-surface shadow-[var(--shadow-lift)] rounded-[var(--radius)] absolute inset-x-4 top-16 mx-auto flex max-w-lg flex-col items-start p-6 sm:inset-x-8"
      >
        <Icon size={24} strokeWidth={ICON_STROKE} aria-hidden className="text-accent" />
        <h2 className="text-h2 mt-6 text-balance">{headline}</h2>
        <div className="mt-8">{cta}</div>
      </div>
    </div>
  );
}
