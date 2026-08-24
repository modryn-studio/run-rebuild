'use client';

/* THE FILTER PANEL'S THREE PRIMITIVES: a column head, a tickable row, a picked chip. Ported from
 * `run-trading@v2`'s `roster-filters.tsx` (2026-08-19, S5c).
 *
 * SHARED FROM THE START HERE, where v2 grew them inside its roster panel and lifted them later. In
 * v2 they are used by three panels; here only one panel exists so far, and they still live in `ui/`
 * rather than beside it — a row that ticks and a chip that removes are the same object wherever a
 * filter appears, and the alternative is discovering that the second panel drew its own.
 */

import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/icon';

/** A column header. Fixed 50px so the three columns' heads line up across the divider. */
export function Head({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-rule flex h-[50px] shrink-0 items-center border-b px-3">
      <span className="text-small text-muted truncate font-medium">{children}</span>
    </div>
  );
}

/* One tickable line. A real `<button>` rather than a checkbox input: the whole row is the target, it
   carries a three-state mark no native checkbox draws without JS anyway, and this way the picked
   state uses the same tokens as every other picked thing in the app. */
export function Row({
  label,
  trailing,
  state,
  onClick,
  strong,
  indent,
  dead,
}: {
  label: string;
  trailing?: string;
  state: 'on' | 'off' | 'some';
  onClick: () => void;
  strong?: boolean;
  indent?: boolean;
  /* NOTHING LEFT TO SELECT under the other axes — the row stays, greyed and inert, rather than
     vanishing. ONLY THE LONG LISTS pass this: a list that shrinks under the cursor is a list you
     misclick, because ticking one account and watching a tree re-render moves the next thing you
     were about to press. The short token lists (Result) are two rows that already drop their empty
     options, so nothing jumps there.
     A TICKED ROW IS NEVER DEAD. It is the trader's own selection, and hiding the way back out of a
     filter they applied is worse than any of this. */
  dead?: boolean;
}) {
  const inert = dead && state === 'off';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === 'some' ? 'mixed' : state === 'on'}
      aria-disabled={inert || undefined}
      disabled={inert}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] py-1.5 pr-2 text-left transition-colors',
        indent ? 'pl-5' : 'pl-1',
        inert ? 'cursor-default opacity-40' : 'hover:bg-hover'
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors',
          state === 'off' ? 'border-border' : 'border-accent bg-accent text-accent-fg'
        )}
      >
        {state === 'on' && <Icon name="check" size={12} />}
        {/* A firm with SOME of its accounts ticked. A dash, not a tick, because the row is neither
            on nor off and drawing it as on would be a lie the trader has to click twice to unpick. */}
        {state === 'some' && <span className="bg-accent-fg h-0.5 w-2 rounded-full" />}
      </span>
      {/* Both levels read at full strength — the accounts ARE the content here, and muting them
          against a row of ticked boxes made them look disabled. Weight carries the hierarchy. */}
      <span className={cn('text-body text-text min-w-0 flex-1 truncate', strong && 'font-medium')}>
        {label}
      </span>
      {trailing && <span className="text-small text-muted shrink-0 tabular-nums">{trailing}</span>}
    </button>
  );
}

/* One thing you picked, in the right column, with its own way off. Removing from HERE rather than
   hunting it back down in the centre list is the whole reason that column exists. */
export function Chip({
  label,
  tail,
  onRemove,
}: {
  label: string;
  /* NEVER TRUNCATES, where `label` may. An account chip is "Tradeify" plus "50K (...4873)", and a
     plain truncate eats from the RIGHT — taking the four digits that are the only thing identifying
     the account and leaving the firm, which the trader already knew. Splitting it lets the firm give
     way while the identity survives. Same trick the tape row uses on its account column. */
  tail?: string;
  onRemove: () => void;
}) {
  const full = [label, tail].filter(Boolean).join(' ');
  return (
    <span className="hover:bg-hover group flex items-center gap-1.5 rounded-[var(--radius-sm)] py-1.5 pr-1 pl-1 transition-colors">
      {/* `gap-1` CARRIES THE SPACE, because flex will not: a flex container wraps each text run in
          an anonymous item and trims the whitespace at its edges, so the two halves would render
          flush together. Putting the space in the layout rather than the string means it survives
          however the halves are composed — and `full` above rebuilds it for `title`. */}
      <span className="text-body text-text flex min-w-0 flex-1 items-baseline gap-1" title={full}>
        <span className="truncate">{label}</span>
        {tail && <span className="shrink-0">{tail}</span>}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${full}`}
        className="text-muted hover:text-text hover:bg-border flex size-5 shrink-0 items-center justify-center rounded-full transition-colors"
      >
        <Icon name="close" size={12} />
      </button>
    </span>
  );
}
