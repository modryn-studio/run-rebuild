import { cn } from '@/lib/cn';

/* The compact icon-only control: a 36px square that acts ON the shell rather than navigating it.
 *
 * WHY A COMPONENT AND NOT A CLASS STRING. The old string had already been retyped at every call
 * site, and each copy is a place the next hover language forks. This is one mechanic across four
 * declarations and two colour modes; it cannot survive as something people retype.
 *
 * TWO HIT SHAPES, ONE PRODUCT. A nav row is full-width and 40px tall; this is a 36px square. The
 * SHAPE is what says which is which, so a control that acts on the shell never reads as a place
 * to go. That is why this does not simply reuse the nav row's ground fill.
 *
 * THE MECHANIC: rest = nothing, hover = a raised chip appears, press = the same chip pushes in.
 * Measured off a reference header icon button (CSS extracted live, 2026-07-28), because a
 * physical affordance is what makes this read as a different CLASS of control from a nav row
 * rather than a smaller one. The measured values, and what each became here:
 *
 *   rest       transparent, chip invisible          -> same. The border is present but transparent
 *                                                      at rest, so the chip's arrival cannot shift
 *                                                      the icon by a pixel.
 *   hover      #fff ground, 1px #e4e1de, 0 1px 2px  -> `surface` + `border` + `--shadow-card`. Not
 *                                                      a new look: brand.md already fixes that
 *                                                      trio as what "raised" means in Run. Same
 *                                                      statement, icon scale.
 *   press      #f6f5f3 ground, shadow flips inset   -> `bg` + `--shadow-press`. The chip drops back
 *                                                      to the page's own value, still outlined, so
 *                                                      it reads as pushed into the page it lifted
 *                                                      off. The measured drop is 1.100 in contrast
 *                                                      terms; `surface` to `bg` is 1.100 exactly.
 *   0.1s ease-out                                   -> same duration, house curve.
 *
 * NOT ROUND, though the measured reference is a 9999px circle. ui-ux-standards hard ban #6 is
 * pill-everything, Run holds one radius scale, and the only full rounds in the product are the
 * avatar and the status dots - marks, not controls. `--radius-sm` is the translation. What was
 * worth having is the compact icon-sized target and its lift, not a radius.
 *
 * DARK IS MEASURED, NOT INVERTED. A white chip on a dark ground is wrong, and the token that means
 * "one step lighter than the page" is not the same token in both modes. Contrast against the page
 * ground, computed from the palette:
 *
 *              light                              dark
 *   chip       `surface` over `bg`     1.100      `surface-2` over `bg`     1.165
 *   pressed    `bg`, the page itself   1.000      `surface` over `bg`       1.072
 *
 * `surface` is the raised value in light but only a 1.072 step in dark, which is the same
 * imperceptible step that made the diluted nav hovers fail, so dark shifts both grounds one token
 * up the ramp. That reproduces the measured hover-to-press drop (1.100 measured, 1.087 here)
 * instead of guessing at an inversion. Dark deliberately does NOT fall all the way to `bg`: a
 * 1.165 drop under an inset shadow reads as a hole, not a button. The inset shadow is separately
 * re-weighted for dark (`--shadow-press`, 0.10 ink -> 0.40 black) because a 10% ink shadow on a
 * near-value dark surface does not register at all.
 *
 * A CIRCLE SINCE 2026-08-01, and it is a rule rather than a preference: shape follows the control's
 * CONTENT. An icon-only control is a disc; a labelled one is a --radius-sm rectangle. Measured on the
 * reference, which does exactly this - their icon buttons are 9999px and their labelled buttons 8px.
 * It also settles what Luke asked: the sidebar toggle now matches the wordmark beside it and the
 * chevron that opens the trade drawer, and none of them match Edit/Filters, which are a different
 * kind of object and always were. Logos and avatars stay round for the same reason they always were.
 *
 * The four state declarations live in globals.css as `.lift-press`; only the geometry and the ink
 * are utilities here. The reasoning for that split is in the CSS.
 */
/* `disabled:` ADDED 2026-08-13. The hover fix earlier that day stopped a disabled button LIFTING,
 * which left it worse than before: it no longer moved, but it still looked exactly like a live
 * control and the cursor never said otherwise. Matches Button ghost, its closest sibling - a bare
 * control with no ground of its own. */
const ICON_BUTTON =
  'lift-press text-muted hover:text-text flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-50';

/* `className` CANNOT RE-POSITION THIS ONE, and it fails silently, so it is stated here rather than
 * learned twice. `.lift-press` sets `position: relative` to anchor the invisible 44px hit expander,
 * and globals.css keeps that rule UNLAYERED on purpose so a stray utility at a call site cannot
 * half-override the mechanic. Unlayered beats Tailwind's layered utilities, so `fixed`/`absolute`
 * passed in here resolve to `relative` plus an offset — the control lands somewhere in the middle
 * of the page with no error and no type complaint. Caught 2026-08-14 when ThemeToggle became an
 * IconButton and took /status's corner toggle with it. Wrap this in a positioned element instead;
 * every other utility passes through fine. */
export function IconButton({ className, ...props }: React.ComponentProps<'button'>) {
  // `type="button"` before the spread so a caller inside a form can still override it. Without the
  // default, one of these dropped into a <form> silently submits it.
  return <button type="button" {...props} className={cn(ICON_BUTTON, className)} />;
}
