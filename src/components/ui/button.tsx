import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './spinner';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

// Uses the brand tokens defined in globals.css @theme:
//   accent / accent-fg / surface / text / muted / border
/* THE THREE STATES, TAKEN OFF THEIR BUTTON'S OWN CLASS LIST (2026-07-31). Their newer component
 * spells the whole contract out and it answers both of Luke's notes at once:
 *
 *   rest    border-border-primary  bg-background-primary  shadow-sm
 *   hover   not-disabled:hover:border-border-primary-hover        <- THE BORDER, AND NOTHING ELSE
 *   active  active:shadow-inset  active:bg-background-secondary   <- IT PUSHES IN
 *   off     disabled:bg-background-secondary disabled:text-content-secondary disabled:shadow-none
 *
 * "monarch doesn't highlight the entire button on hover. i think its just the border. and its
 * subtle." Correct, and it is why a filled hover felt wrong: a raised object that already has a
 * ground cannot announce hover by changing that ground without looking like a different object.
 *
 * "when buttons are clicked, they need to look like they've been pushed in. this is a big one for
 * me." It used to be `active:scale-[0.98]`, which is a SHRINK, not a push - the object gets smaller
 * and stays flat. `--shadow-press` is the inset the icon chips have always used, so the whole app
 * now has one press gesture instead of two. */
const variantClasses: Record<ButtonVariant, string> = {
  // Their primary has no shadow and darkens on hover (orange -> orangeDark); pine gets the same
  // treatment through --color-accent-hover rather than an opacity wash, which greys the fill.
  /* DISABLED IS A FADED ACCENT, NOT A GREY SWAP (2026-08-20, Luke), REVERSING 2026-08-13.
   *
   * This shipped as `disabled:bg-surface-2 disabled:text-muted disabled:opacity-100` on the
   * argument that opacity fades a filled control's edges into mush where a ground change stays
   * crisp. That argument holds for `secondary`, which has a BORDER to keep crisp; primary has no
   * border at all, so there is no edge for the fade to blur — there is only the fill, and a faded
   * pine still reads unmistakably as the primary action in its off state.
   *
   * The deciding evidence is that the swap left Run alone against every reference it derives from:
   * `modryn-base`, `run-trading@v2` AND Monarch all fade the accent here. A disabled primary that
   * turns warm grey stops looking like the same button and starts looking like a secondary one,
   * which is exactly what a disabled state must not do — it should say "this button, not yet",
   * not "a different button".
   *
   * `loading` inherits this for free (`disabled={disabled || loading}`), which is the case that
   * matters most: a CTA mid-submit should still be visibly the primary CTA.
   *
   * `secondary` deliberately KEEPS its ground swap: it has a border, the 2026-08-13 reasoning
   * applies to it unchanged, and base does the same thing there (`disabled:bg-surface`). */
  primary:
    'bg-accent text-accent-fg hover:bg-accent-hover active:bg-accent-active active:shadow-[var(--shadow-press)] disabled:opacity-50',
  /* THE EDGE PAIR IS `border` -> `border-strong`, AND IT WENT AWAY FOR HALF A DAY (2026-08-14).
   * The border pass moved this to a 3:1 field edge on the reading that an interactive control owes
   * SC 1.4.11 3:1. It does not: 1.4.11 asks that of the visual information REQUIRED to identify a
   * component, and this button has a visible text label doing that job, so its edge is chrome.
   * `Input` and `CodeInput` keep the strong edge because they have no label and no fill of their
   * own - there the outline IS the control. Reverted to exactly the pair this shipped with
   * (Luke: "i like run-trading@v2's border because it's more subtle. did you change them because of
   * a major issue?" - no).
   * The rest-to-hover step is 1.47x, which is the "subtle" the note above is describing; pointing
   * the hover at a compliant value made it 2.94x and read as the whole button lighting up. */
  secondary:
    /* NO RESTING DROP SHADOW (2026-08-20). This carried `--shadow-sm` under its own hairline, which
       is the combination `design-rules.md` forbids outright: a drawn edge and a cast shadow are two
       different claims about one object, and only `Card` may make the second. `modryn-base` deleted
       its equivalent token for exactly this. The border still marks the hit target and the fill
       still separates it from the ground; the press keeps its INSET, which is the opposite claim
       and stays legal. Same change `.lift-rest` took in globals.css, so the header controls and this
       button remain one control class.
       `btn-secondary` IS A STYLE HOOK, NOT DECORATION (2026-08-20). It carries no rules of its own -
       it exists so `globals.css` can key a hand-written `[data-active='true']` rule off something
       stable, for a popover trigger (Columns) that needs to stay visibly pushed in for as long as
       its panel is open. See that rule for why it is not a `data-[active=true]:` utility here. */
    'btn-secondary border-border bg-surface text-text border hover:border-border-strong active:bg-[var(--pressed-bg)] active:shadow-[var(--shadow-press)] disabled:bg-surface-2 disabled:text-muted disabled:shadow-none disabled:opacity-100',
  /* The quiet, always-accent-colored outline (a header "add" control, a secondary CTA beside a
   * primary one) - distinct from `secondary`, whose edge only firms up on hover.
   *
   * THE ALPHA STAYS, AND THE PASS THAT REMOVED IT WAS WRONG ON ITS FACTS (2026-08-14). It was
   * replaced with a solid accent on the claim that `accent/40` composited to 2.85:1 in light and
   * 1.09:1 in dark - "one token, two modes, two completely different results". Both numbers were
   * wrong, and from the same cause: Tailwind emits an alpha like this as `color-mix`, which
   * `getComputedStyle` returns as `oklab(0.476 -0.079 0.012 / 0.4)`, and the audit script read the
   * first three numbers in that string as if they were RGB channels. It measured an oklab lightness
   * of 0.476 as the red channel and reported near-black. Re-measured by compositing on a canvas
   * instead of parsing the string: 1.83 / 1.87 / 1.78 in light and 2.20 / 2.15 / 1.91 in dark. The
   * two modes agree, and the rest edge is quiet in both, which is the whole design of this variant.
   * No floor reaches it either way - the label identifies the control, so 1.4.11 does not bind.
   * Luke, 2026-08-14: "it is supposed to be subtle and then have the current border on hover only."
   * Restored to exactly the pair v2 ships. The rack's `Edges` proof now composites rather than
   * parses, so this row can be read instead of guessed at. */
  outline:
    'border border-accent/40 text-accent hover:border-accent active:shadow-[var(--shadow-press)] disabled:opacity-50',
  ghost:
    'text-muted hover:text-text hover:bg-[var(--pressed-bg)] active:bg-[var(--pressed-bg)] active:text-text active:shadow-[var(--shadow-press)] disabled:opacity-50',
};

/* Sizes reflect the app's real button scale: sm = a compact header control, md = the standard
 * action, lg = a full-width CTA. Text sizes are locked type-scale roles, never hand-picked.
 *
 * HEIGHTS ARE EXPLICIT, NOT PADDING PLUS LINE-HEIGHT, and that is the fix rather than the style.
 * Derived from padding, `md` and `lg` BOTH CAME OUT AT 48px — two named sizes rendering one
 * height, which no call site could have detected and which the rack showed the moment all three
 * sat in a row. A stated height cannot silently equal its neighbour.
 *
 * 36px FOR `md` IS THE MEASURED REFERENCE, not a preference. Read live 2026-08-13:
 *   Monarch's labelled button   39px, 7.5px/12px padding, 16px/400, 8px radius
 *   the previous build          36px, both flavours ("Refresh" 12px/500, "Add account" 14px/500)
 * The old `md` at 48px was a third taller than either, which is why the app read heavier than the
 * thing it is derived from.
 *
 * `lg` STAYS 48 and that is deliberate: it is the full-width CTA, it is what the import flow
 * already hand-sets, and it matches the Input primitive so a stacked field-and-button pair agrees.
 */
const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-small',
  md: 'h-9 px-4 text-body',
  lg: 'h-12 px-6 text-body-lg',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  // Every CTA that triggers an async action uses this - the label swaps for a spinner and the
  // button disables, so no async action ever fires twice from a double-click. App-wide rule
  // (Luke, 2026-07-18): every CTA gets this, not just the ones already wired to something async.
  loading?: boolean;
  /* A PLAIN PROP, not `forwardRef`. React 19 passes `ref` through to a function component like any
     other prop, so the wrapper this used to need is gone. Added at S5c, where a popover trigger has
     to return focus to itself on close — a dialog that dismisses into nowhere strands the keyboard
     at the top of the document. */
  ref?: React.Ref<HTMLButtonElement>;
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading = false,
  disabled,
  children,
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      /* FOCUS IS THE GLOBAL RULE, not a local ring. This carried
       * `focus-visible:ring-accent/30 focus-visible:ring-2 focus-visible:outline-none`, which
       * suppressed the app-wide `:focus-visible` outline and replaced it with the accent at 30%
       * alpha and no offset — measured at roughly 2.05:1 against its own ground, on the most
       * common control in the product. IconButton and the Menu trigger kept the global 2px solid
       * accent, so a labelled button and an icon button in one header showed two different focus
       * treatments and the weaker one was on the button people actually tab to.
       *
       * THE LABEL TRUNCATES, AND IT TRUNCATES ON THE INNER SPAN (2026-08-20). The decision to
       * truncate rather than wrap stands and is measured: a long label pushed this to 1008px and
       * never reflowed, 2.9x its container at 375, and a button that overflows breaks the layout
       * around it where one that truncates is ugly and contained.
       *
       * What was WRONG is where `truncate` sat. On the button itself it combined with
       * `justify-center` to clip the label at BOTH ends with no ellipsis anywhere: a centred flex
       * container overflows symmetrically, so the text ran past the left and right padding at once
       * and `text-overflow` had no block box to render an ellipsis in. Measured on the rack at a
       * 384px button against a 408px label. Moved onto the span below, which is a flex ITEM and can
       * therefore shrink (`overflow-hidden` gives a flex item an automatic minimum size of 0), so it
       * now does what it always claimed to: one clean ellipsis at the end. */
      className={cn(
        'rounded-[var(--radius-sm)] inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-100 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {/* THE LABEL KEEPS ITS WIDTH WHILE LOADING. Swapping children outright collapsed the button
          from 81px to 50px at the exact moment of the click, shifting every control beside it in a
          right-aligned footer. `Menu` already reserves its trigger width for the same reason, so
          this is the system's existing answer rather than a new one. */}
      {loading ? (
        <span className="relative inline-flex min-w-0 items-center">
          <span className="invisible truncate">{children}</span>
          <span className="absolute inset-0 grid place-items-center">
            <Spinner />
          </span>
        </span>
      ) : (
        /* The span carries `truncate`, not the button. See the note on `className` above.
           `inline-flex` + `gap-2` rather than a plain span, because this is now the button's ONLY
           child: the button's own gap has nothing left to sit between, so an icon-plus-label call
           site would render the two flush together. NO `justify-center` — the button centres this
           span already, and centring again inside a box that can overflow splits the overflow
           evenly and clips the label at both ends with the ellipsis nowhere. */
        <span className="inline-flex min-w-0 items-center gap-2 truncate">{children}</span>
      )}
    </button>
  );
}
