/* A SLOT WAITING TO BE FILLED: the dashed, full-width row that adds one more of whatever a list
 * holds. `/accounts` puts it under the roster; anything else with an owned, growable list wants the
 * same object rather than its own copy.
 *
 * ─── WHY DASHED, WHEN THE HOUSE RULE SAYS A CONTROL GETS A BORDER OR A SHADOW, NEVER BOTH ───────
 *
 * It gets the border, and the DASH is what makes it legible as an absence. A solid edge draws a
 * thing that exists; a dashed edge draws the outline of a thing that does not yet - which is
 * exactly the claim this control makes, and it is why it can sit at the end of a list of real cards
 * without being mistaken for one. It stays the only dashed object in the product, and a second use
 * needs the same argument or it is just decoration.
 *
 * ─── FULL INK (2026-08-26, Luke: "i like it. i just dont like that it's muted") ─────────────────
 *
 * It shipped `text-muted hover:text-text`, which is this system's METADATA role worn by a control -
 * the same defect `icon-button.tsx` records having removed for the same reason. Muted says "this is
 * a note about something else"; this is an ACTION, and the only action at the bottom of the roster.
 * Its quietness has to come from the ground it does not have and from the dash, not from dimmed
 * ink. Monarch, the reference for that page, draws its own equivalent at full ink too.
 *
 * `min-h-14` (56px) rather than the 36px control height: it spans the column, and a full-width
 * control as short as a button reads as a stretched button rather than as a row.
 *
 * ─── `border-strong`, NOT `border` (2026-08-27, Luke: "hard to see", on both modes) ─────────────
 *
 * Measured against the page ground it actually sits on, `--color-bg`: `--color-border` is 1.20:1 in
 * light and 1.55:1 in dark. That is a line you have to already know is there. `--color-border-strong`
 * takes it to 1.75:1 and 3.40:1 - the dark side clearing the 3:1 a non-text control is meant to, the
 * light side short of it but as far as this system's own scale goes before the next step up is
 * `--color-muted`, which is TEXT-WEIGHT ink and would draw a heavier edge than any solid control on
 * the page. Two forces were hiding it and only one is colour: a DASH paints roughly half the pixels
 * a solid line does at the same value, so this control needs the firmer token to read as level with
 * a solid `border` edge, not to out-shout it.
 *
 * This is the token the system already keeps for exactly this - "controls, which have to be findable"
 * (`globals.css`, on `--color-rule`) - so the dashed empty slot moves into the sentence it was
 * listed as an exception to. Hover still steps to `--color-muted`, which is now one step rather
 * than two.
 */

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';

export function AddSlot({
  children,
  className,
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'border-border-strong text-body text-text hover:bg-hover hover:border-muted flex min-h-14 w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed font-medium transition-colors',
        className
      )}
    >
      <Icon name="add" />
      {children}
    </button>
  );
}
