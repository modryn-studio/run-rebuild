'use client';

/* WHICH COLUMNS THE TAPE SHOWS. Sits in the tape card's own header row, where Monarch puts its
 * equivalent (measured on `app.monarch.com/transactions`, 2026-08-20: its table header carries
 * "All transactions · Edit multiple · Sort · Columns" at y=76, distinct from the page band's
 * Search/Date/Filters at y=14).
 *
 * IT REPLACED A COUNT. The header read "Trades · 360 trades", and the summary rail beside it already
 * says `Trades 360` off the same filtered set - `getDigest` and the tape count one set by
 * construction, so the two can never disagree and the second one is pure redundancy sitting exactly
 * where the reference puts CONTROLS. Monarch shows no count at all despite having the same
 * rail-plus-table shape.
 *
 * ─── WHY localStorage AND NOT THE URL ──────────────────────────────────────────────────────────
 *
 * Every narrowing in this product is URL state, because a filtered tape is a thing a trader reloads,
 * bookmarks and sends to themselves. This is NOT a narrowing: it changes nothing about which trades
 * are selected, only which facts about them are drawn. Sending someone a link should send them your
 * question, not your column widths. So it persists the way the sidebar and the summary rail do -
 * localStorage, same try/catch around a blocked store.
 *
 * ─── ONLY TWO COLUMNS ARE OFFERED, AND THAT IS THE HONEST SET ──────────────────────────────────
 *
 * The tape has four: instrument, account, time, result. The instrument is the row's SUBJECT and the
 * result is the reason a tape exists, so neither can be hidden - offering a toggle that empties the
 * row would be a control that can break the screen. Account and time are the two a trader genuinely
 * might not need: one account makes the account column a repeated constant, and a swing trader
 * checking a week does not read entry times. The list grows when the tape does.
 */

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Track } from '@/components/ui/switch';

export type TapeColumn = 'account' | 'time';

const COLUMNS: { key: TapeColumn; label: string }[] = [
  { key: 'account', label: 'Account' },
  { key: 'time', label: 'Time' },
];

const STORE_KEY = 'run_tape_columns';

/** Reads the stored preference. Absent means every column shows, so a cleared store returns to the
 *  default rather than to whatever a falsy check happened to produce. */
export function useTapeColumns() {
  const [hidden, setHidden] = useState<TapeColumn[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setHidden(JSON.parse(raw) as TapeColumn[]);
    } catch {
      // Private mode or blocked storage. Every column shows, which is the safe direction.
    }
  }, []);

  const toggle = (key: TapeColumn) =>
    setHidden((h) => {
      const next = h.includes(key) ? h.filter((k) => k !== key) : [...h, key];
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(next));
      } catch {
        // The preference is lost, the toggle still works. Never let storage break a control.
      }
      return next;
    });

  return { hidden, toggle };
}

export function ColumnsMenu({
  hidden,
  onToggle,
}: {
  hidden: TapeColumn[];
  onToggle: (key: TapeColumn) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative ml-auto">
      {/* THE SECONDARY BUTTON, not a bespoke chip (Luke, 2026-08-20). An earlier pass hand-rolled a
          bare control here with its own hover and press, which is precisely the fork the primitives
          exist to prevent - and the rack has a reviewed answer for "a labelled control that is not
          the primary action" already. `sm` because it sits inside a card header beside a title
          rather than in a form.
          NOT `HeaderControl`: that is the chip class for the SHELL's band, and this is inside the
          tape card. */}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-active={open ? 'true' : undefined}
        className="relative"
      >
        {/* AN EYE, NOT `filter`. Filters changes which trades the tape holds; this changes
            which facts about them are drawn. Two controls in one header wearing one mark say they
            do the same job. See `DrawnEye` in icon.tsx. */}
        <Icon name="eye" size={14} />
        Columns
        {/* A CORNER BADGE, NOT A THIRD ITEM IN THE LABEL (Luke, 2026-08-20). This sat inline in the
            flex flow at `size-1.5`, so it read as punctuation after the word and it MOVED the label
            every time a column was hidden. Search, Date and Filters all spell the same dot the same
            way three times over in `trades-controls.tsx` - `size-2`, pinned to the corner of a
            `relative` control - and this is the fourth control in the product saying "something here
            is narrowed", so it says it in the same place.
            It escapes the `truncate` on Button's inner span because its containing block is the
            BUTTON (the nearest positioned ancestor, hence `relative` above), and an overflow box
            only clips descendants whose containing block is inside it. */}
        {hidden.length > 0 && (
          <span aria-hidden className="bg-accent absolute -top-0.5 -right-0.5 size-2 rounded-full" />
        )}
      </Button>

      {open && (
        /* MENU'S OWN CHROME, NOT A BESPOKE PANEL (Luke, 2026-08-20 - "why are you not using the
           kitchen-sink when you create new items?"). This carried no border and `p-3` around
           self-padded rows; `@/components/ui/menu.tsx` already has the reviewed answer for "a small
           popover hanging off a header-row trigger" - bordered, `p-1`, `pop-in` - and there was no
           reason for this one to disagree with it. */
        <div
          role="dialog"
          aria-label="Columns"
          className="pop-in border-border bg-surface absolute top-full right-0 z-30 mt-1.5 w-56 rounded-[var(--radius)] border p-1 shadow-[var(--shadow-card)]"
        >
          {/* NO HOVER FILL ON THE ROW (Luke, 2026-08-20 - "this is a pop up menu, not a modal, there
              is a difference"). It read `Switch`, whose `slotSurface` ground-plus-hover-step is
              built for a settings sheet where each row IS its own recessed slot (see
              `switch-menu.tsx`'s demo, a bordered box of them) - the right answer there, the wrong
              one here. Measured on Monarch's own Columns popover (2026-08-20,
              app.monarch.com/transactions): `TransactionColumnsMenu__ColumnRow`'s only rule is
              `cursor: default` - no background, at rest or hovered, ever. `Track` (the bare switch,
              already exported for exactly this) replaces `Switch` so the row can drop the ground it
              no longer wants without inventing a second toggle visual.
              THE WHOLE ROW STAYS THE CLICK TARGET even so - that part of `Switch`'s reasoning was
              never about the hover fill, it was about hit-area on a phone, and dropping the fill
              does not have to cost that. */}
          <div className="flex flex-col">
            {COLUMNS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => onToggle(c.key)}
                aria-pressed={!hidden.includes(c.key)}
                className="flex h-9 w-full items-center justify-between gap-3 rounded-[var(--radius-sm)] px-2"
              >
                <span className="text-body text-text">{c.label}</span>
                <Track on={!hidden.includes(c.key)} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
