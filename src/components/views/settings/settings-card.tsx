import type { ReactNode } from 'react';
import { cardSurface } from '@/components/ui/card';
import { cn } from '@/lib/cn';

/* ONE SETTINGS SECTION: a title, an optional sentence under it, and a body.
 *
 * COPIED FROM THE REFERENCE'S MARKUP, NOT ITS PIXELS (read live on `app.monarch.com/settings/*`,
 * 2026-09-08). Every settings page there is a single column of white cards: 757px wide, 12px radius,
 * `0 2px 4px rgba(34,32,29,.1)`, on a `#f6f5f3` ground. The card carries a heading row - the title
 * left, sometimes one action right ("Edit", "New tag") - then a rule, then the body. `Data` stacks
 * five of them; `Display` has one. The unit is the card, so the unit here is the card.
 *
 * `cardSurface` RATHER THAN NEW VALUES. The system already has a card radius and a card shadow that
 * were measured against this same reference, so the numbers above are what those tokens ARE. A
 * second radius for settings would be the design system dying one one-off at a time.
 *
 * A SERVER COMPONENT. It renders structure only; the forms inside it are the client islands, which
 * keeps the interactive surface to the controls that need it (`CLAUDE.md`: a Server Component
 * passes DATA to a client one, never behaviour - so `action` here is a rendered node, not a
 * callback).
 */
export function SettingsCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  /** Sits in the heading row, right-aligned. Rendered, never a handler. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(cardSurface, 'overflow-hidden', className)} aria-labelledby={slug(title)}>
      <header className="flex items-start justify-between gap-4 px-5 py-4">
        <div>
          <h2 id={slug(title)} className="text-h3">
            {title}
          </h2>
          {/* Guidance, so ink rather than muted (`text-field.tsx` makes the same call for a hint). */}
          {description && <p className="text-body mt-1 max-w-prose text-pretty">{description}</p>}
        </div>
        {action}
      </header>
      <div className="border-rule border-t px-5 py-4">{children}</div>
    </section>
  );
}

/** A stable id for `aria-labelledby`, from the title. Titles are short English nouns here. */
const slug = (title: string) => `settings-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

/* A LABELLED ROW INSIDE A CARD: text on the left, one control on the right. The reference's
 * `Preferences` page is a stack of these - a bold line, a sentence under it, a switch at the end -
 * and `label-account-form.tsx` already draws the identical shape for its Visibility switches, which
 * is the point: a setting is the same object everywhere it appears. */
export function SettingsRow({
  title,
  note,
  control,
}: {
  title: string;
  note?: string;
  control: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-body font-medium">{title}</p>
        {note && <p className="text-body text-muted mt-0.5 max-w-prose text-pretty">{note}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
