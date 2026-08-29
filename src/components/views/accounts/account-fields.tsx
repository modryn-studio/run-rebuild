'use client';

/* THE THREE QUESTIONS TRADOVATE CANNOT ANSWER, as reusable fields.
 *
 * Ported from `run-trading@v2`, where two forms ask them and must ask identically: the label form
 * (an account that arrived inside a CSV named `FTDFYL100183704873` and nothing else) and, when it
 * lands, "Add manually" (a trader who bought an account this morning and has nothing to import).
 * Same three questions, same order, different reason for being on screen - so the fields live here
 * and the forms differ only in what they do with the answers. The second caller is `D5`'s and is
 * why this is a module rather than three functions inside the form.
 *
 * NONE OF THESE ASK FOR RULES, and that is a decision rather than an omission. Drawdown limits,
 * daily caps and consistency ratios differ per firm AND per product, change without notice, and a
 * trader typing them in is doing homework - the exact chore this product exists to end. Firm plus
 * product name is enough to look a rulebook up later; asking a trader to transcribe one is asking
 * them to be the database.
 */

import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { slotSurface } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { ACCOUNT_TYPES, type AccountType } from '@/lib/db/schema';
import { ACCOUNT_SIZES, ACCOUNT_TYPE_LABELS, sizeLabel } from '@/lib/prop-firms';

/** A label over its control. `mt-4` between fields, measured off the reference at 16px. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 first:mt-3">
      {/* `text-small` (12px), WHICH IS v2'S AND WAS 14px HERE (2026-08-28). A field label is CHROME
          over its control, not prose beside it - and at 14px five of them stacked read as a list of
          headings rather than as captions, which is most of why this screen felt taller than v2's.
          `design-system.md` §2a bans `text-small` on `/trades`, where a ROW is one type size; a
          modal's label-over-control stack is the case the rule was never about.
          `text-muted` AT A LIGHTER WEIGHT rather than v2's `text-faint` for the hint: this build
          deleted the third content tier (#67), so a hint is the same ink as its label and separates
          by weight. Two tiers, never three. */}
      <p className="text-small text-muted mb-2 font-medium">
        {label}
        {hint && <span className="font-normal"> {hint}</span>}
      </p>
      {children}
    </div>
  );
}

/* ONE SELECTABLE CONTROL for every chip row. `select-pop` on the selected state is the app-wide rule
 * for a card or chip that can be picked.
 *
 * `min-h-11` BELOW `sm` ONLY (44px). v2 measured these at 29px tall, which is fine for a mouse and
 * under the floor for a thumb - and every screen that renders them is a modal a trader will fill in
 * on a phone. Left at their natural height on a desktop, where a row of seven 44px chips would read
 * as seven buttons rather than as one choice.
 *
 * THE SELECTED STATE IS TOKENS, NOT v2'S INLINE `color-mix`. v2 hand-wrote three CSS properties in a
 * `style` object here; this build has `select-pop` for exactly this and `border-accent` /
 * `text-accent` for the rest, so the whole thing is classes and the dark mode follows without a
 * second declaration. */
export function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'text-body inline-flex items-center rounded-[var(--radius-sm)] border px-3 py-1.5 transition-colors max-sm:min-h-11',
        on
          ? 'select-pop border-accent text-accent bg-accent/8'
          : 'border-border bg-surface text-muted hover:text-text'
      )}
    >
      {children}
    </button>
  );
}

/* TYPE. Not derivable from any export or API response, ever - a Sim Funded account and an Evaluation
 * produce byte-identical files. So this is the one field that can only be ASKED, and it is the field
 * that matters most: a funded account can pay out and an evaluation cannot, which changes what every
 * number on the page means.
 *
 * ROWS, NOT CHIPS, AND IT OWNS ITS OWN SCREEN. This was a chip row in both of v2's forms until Jobs
 * and Rams said the same thing independently (2026-07-30). A chip is a FILTER affordance - a thing
 * you toggle beside other things - and this is "pick one, continue", so a row with a chevron is the
 * honest shape: pressing it is the answer AND the navigation, which is why the screen needs no
 * footer button.
 *
 * NO LABEL ABOVE THEM. "Evaluation", "Sim Funded" and "Personal" name themselves, so a "Type"
 * heading would be a word spent restating the three words underneath it. */
export function TypeRows({
  onPick,
  current,
  busy,
}: {
  onPick: (t: AccountType) => void;
  /** What the account is set to RIGHT NOW, ticked. An editor that does not show the current value
   *  is a form that makes you remember what you picked. */
  current?: AccountType | null;
  /** The row mid-save, when this screen is the whole editor and commits from here. */
  busy?: AccountType | null;
}) {
  return (
    <>
      {ACCOUNT_TYPES.map((t) => {
        const on = current === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onPick(t)}
            disabled={busy != null}
            aria-current={on ? 'true' : undefined}
            className={cn(
              slotSurface,
              /* `border` IN THE BASE, or `border-accent` colours a zero-width border and emits
                 nothing - Tailwind's preflight is `border: 0 solid` (2026-08-28, postcheck). The
                 check mark carried the selection on its own, so this was invisible rather than
                 wrong; `border-transparent` keeps the row's box identical either way. */
              'mt-3 flex w-full items-center gap-3 border border-transparent px-4 py-4 text-left disabled:opacity-60',
              on && 'border-accent'
            )}
          >
            <span
              className={cn(
                'text-body-lg min-w-0 flex-1 font-medium',
                on ? 'text-accent' : 'text-text'
              )}
            >
              {ACCOUNT_TYPE_LABELS[t]}
            </span>
            {busy === t ? (
              <Spinner className="text-muted size-4 shrink-0" />
            ) : on ? (
              <Icon name="check" size={16} className="text-accent shrink-0" />
            ) : (
              <Icon name="chevron" size={16} className="text-muted shrink-0 -rotate-90" />
            )}
          </button>
        );
      })}
    </>
  );
}

/* SIZE. Chips, not a number field: prop accounts sell in a handful of round SKUs, and a typo'd
 * "5000" would silently make every percentage in the app wrong. The write path refuses a size that
 * is not on the list for the same reason.
 *
 * ASKED FOR THE TWO PROP TYPES ONLY. A personal account's size is whatever the trader deposited; it
 * is not a product, and it is not a number any firm set.
 *
 * A DERIVED VALUE THAT IS NOT ONE OF THE SKUs GETS ITS OWN CHIP rather than snapping to the nearest.
 * A 100K account reading 100,000 is fine; one reading 104,300 means the derivation was wrong about
 * something, and the useful thing to do with that is SHOW it - snapping would hide a broken
 * assumption behind a plausible answer. */
export function SizeField({
  value,
  onChange,
  hint,
}: {
  value: number | null;
  onChange: (n: number) => void;
  hint?: string;
}) {
  const offScale =
    value !== null && !(ACCOUNT_SIZES as readonly number[]).includes(value);
  return (
    <Field label="Size" hint={hint}>
      <div className="flex flex-wrap gap-2">
        {ACCOUNT_SIZES.map((s) => (
          <Chip key={s} on={value === s} onClick={() => onChange(s)}>
            {sizeLabel(s)}
          </Chip>
        ))}
        {offScale && (
          <Chip on onClick={() => onChange(value)}>
            {sizeLabel(value)}
          </Chip>
        )}
      </div>
    </Field>
  );
}
