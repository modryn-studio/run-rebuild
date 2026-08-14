'use client';

/* The light/dark switch, and it is an `IconButton` rather than its own control.
 *
 * WHAT THIS FILE USED TO BE, because the diff is the reasoning. It hand-rolled a 44px circle with
 * `border-border bg-surface`, a local `focus-visible:ring-accent/30`, and `active:scale-[0.98]` -
 * three decisions the system has each since made differently, sitting in the one primitive that had
 * never been racked. It was never argued for; it is simply the PRE-CONSOLIDATION version. The old
 * build resolved this on 2026-07-30 by folding the toggle into IconButton, and the rebuild carried
 * the stale copy across instead of the resolution. Racking it (2026-08-14) is what showed that, and
 * it is the entire case for the rack being a gate rather than a gallery.
 *
 * ALL THREE DIVERGENCES ANSWER TO ONE MOVE, and none of them needed a new decision:
 *
 *   44px bordered circle -> IconButton's 36px disc. Luke's "44x44 hit area STAYS" (2026-07-21) is
 *     not lost: `.lift-press` carries it as an invisible `::after { inset: -4px }`, so the target is
 *     44 and the chip reads at 36. And "bare glyph, no chrome at rest" (also 2026-07-21) is what
 *     `.lift-press` IS at rest - a transparent border and no fill. The hand-rolled version was
 *     violating that decision while claiming to hold it.
 *   local focus ring    -> the global `:focus-visible` outline. The `ring-accent/30` here is the
 *     same one removed from `button.tsx` app-wide: ~2.05:1 against its own ground, and it suppressed
 *     the 2px solid accent outline `globals.css` defines for everything.
 *   active:scale-[0.98] -> `--shadow-press`. A shrink is not a push; the object gets smaller and
 *     stays flat. One press gesture in the product, not two.
 *
 * A BARE GLYPH DOES NOT VANISH AT EITHER MOUNT, which is the one thing that could have justified
 * keeping chrome at rest, so it was checked rather than assumed. Both places this renders sit on
 * the page ground: the shell's 42px header band (`app-shell.tsx`) and, outside the shell, /login and
 * /status. `text-muted` on `bg` measures 5.17:1 in light and 7.07:1 in dark - a glyph, legible, with
 * no help from a border. In the header it is also adjacent to the Open-navigation control, which is
 * itself a bare glyph, so chrome here made one of two neighbouring shell controls look like an
 * object and the other like a mark.
 *
 * THE MARK IS THE DEFAULT 16px, not 18. Every other icon in a 36px control in this product sets at
 * the `Icon` default, and "one wrapper, one number, so two icons at the same size can never
 * disagree" is the rule that wrapper exists to enforce. 18 was part of the same pre-consolidation
 * copy.
 */

import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { useTheme } from '@/components/theme-provider';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <IconButton
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={className}
    >
      {theme === 'dark' ? <Icon name="sun" /> : <Icon name="moon" />}
    </IconButton>
  );
}
