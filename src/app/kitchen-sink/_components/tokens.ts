/* The token inventory the sink renders.
 *
 * PLAIN MODULE, NO 'use client' AT THE TOP — both server sections and client islands import
 * these. An export of a 'use client' module becomes a client reference when a Server Component
 * imports it, and a plain string arrives as an opaque object (see CLAUDE.md).
 *
 * EVERY CLASS BELOW IS A LITERAL STRING ON PURPOSE. Tailwind finds classes by scanning source
 * text, so a composed `bg-${role}` generates no CSS and the swatch renders empty — which would
 * make this page lie about the exact thing it exists to prove. Writing them out also puts them
 * in front of `tailwindcss/no-custom-classname`, so a role listed here whose token does not
 * exist is a lint error rather than a blank square nobody notices.
 *
 * Keep in sync with the @theme block in src/app/globals.css. Adding a token there and not here
 * means the sink stops being the full inventory, which is the one way this page can go wrong.
 */

export type ColorRole = { name: string; swatch: string; use: string };

export const COLOR_ROLES: ColorRole[] = [
  { name: 'bg', swatch: 'bg-bg', use: 'page background' },
  { name: 'surface', swatch: 'bg-surface', use: 'panels, cards' },
  { name: 'elevated', swatch: 'bg-elevated', use: 'raised cards, popovers, modals' },
  { name: 'border', swatch: 'bg-border', use: 'borders, dividers' },
  { name: 'text', swatch: 'bg-text', use: 'body text' },
  { name: 'muted', swatch: 'bg-muted', use: 'secondary text, placeholders' },
  { name: 'accent', swatch: 'bg-accent', use: 'brand, primary CTA' },
  { name: 'accent-foreground', swatch: 'bg-accent-foreground', use: 'text on accent' },
  { name: 'accent-hover', swatch: 'bg-accent-hover', use: 'primary button hover (derived)' },
  { name: 'accent-active', swatch: 'bg-accent-active', use: 'primary button press, one step beyond hover (derived)' },
  { name: 'border-strong', swatch: 'bg-border-strong', use: 'the border a hover moves to (derived)' },
  { name: 'selected', swatch: 'bg-selected', use: 'a nav row that is active OR hovered - one ground for both (derived, per-mode %)' },
  { name: 'pressed', swatch: 'bg-pressed', use: 'any button-class control pushed in (derived)' },
  { name: 'rule', swatch: 'bg-rule', use: 'a line between two rows - quieter than border on purpose' },
  { name: 'success', swatch: 'bg-success', use: 'confirmation' },
  { name: 'warning', swatch: 'bg-warning', use: 'caution' },
  { name: 'danger', swatch: 'bg-danger', use: 'destructive, error' },
];

/* Pairs that have to survive a recolour, with the WCAG 2.2 AA threshold each one is judged
 * against: 4.5 for body text, 3 for large text and for non-text UI boundaries.
 *
 * Measured on a RENDERED probe rather than on the custom property, for two reasons. A custom
 * property is an unparsed token stream, so `--color-accent-foreground` reads back as the literal
 * text `contrast-color(var(--color-accent))` and cannot be measured. And a probe proves the
 * utility class exists at all, which reading the variable does not.
 */
export type ContrastPair = { label: string; probe: string; threshold: number; note?: string };

export const CONTRAST_PAIRS: ContrastPair[] = [
  { label: 'text on bg', probe: 'text-text bg-bg', threshold: 4.5 },
  { label: 'text on surface', probe: 'text-text bg-surface', threshold: 4.5 },
  { label: 'text on elevated', probe: 'text-text bg-elevated', threshold: 4.5 },
  { label: 'muted on bg', probe: 'text-muted bg-bg', threshold: 4.5, note: 'the one that usually fails' },
  { label: 'muted on surface', probe: 'text-muted bg-surface', threshold: 4.5 },
  { label: 'accent-foreground on accent', probe: 'text-accent-foreground bg-accent', threshold: 4.5, note: 'derived by contrast-color()' },
  { label: 'accent on bg', probe: 'text-accent bg-bg', threshold: 4.5, note: 'links and inline accent text' },
  { label: 'accent-foreground on accent-hover', probe: 'text-accent-foreground bg-accent-hover', threshold: 4.5, note: 'the label must survive the hover' },
  { label: 'accent-foreground on accent-active', probe: 'text-accent-foreground bg-accent-active', threshold: 4.5, note: 'the tightest pair in the system - a dark-mode label reading elevated is itself dark, so darkening the fill further COSTS contrast' },
  { label: 'border-strong on bg', probe: 'text-border-strong bg-bg', threshold: 3, note: 'a hovered edge has to be findable' },
  { label: 'border-strong on elevated', probe: 'text-border-strong bg-elevated', threshold: 3, note: 'the ground a hovered button or card actually sits on' },
  { label: 'muted on pressed', probe: 'text-muted bg-pressed', threshold: 4.5, note: 'a pressed icon glyph on touch, where :hover never applied' },
  { label: 'rule on elevated', probe: 'text-rule bg-elevated', threshold: 3, note: 'deliberately quieter than border - not held to the 3:1 non-text bar, it only separates' },
  { label: 'success on bg', probe: 'text-success bg-bg', threshold: 4.5 },
  { label: 'warning on bg', probe: 'text-warning bg-bg', threshold: 4.5, note: 'amber on light is the usual miss' },
  { label: 'danger on bg', probe: 'text-danger bg-bg', threshold: 4.5 },
  { label: 'border on bg', probe: 'text-border bg-bg', threshold: 3, note: 'non-text boundary, 3:1' },
  { label: 'border on elevated', probe: 'text-border bg-elevated', threshold: 3, note: 'a field or a card sits HERE, not on bg - this is the one that actually matters' },
];

/* The type scale. `sample` is deliberately a real sentence: a step is wrong in a way you can see
 * in prose and cannot see in the word "Aa". */
export type TypeStep = { name: string; cls: string; sample: string };

/* THE FULL RAMP, NOT BASE'S EIGHT. This was copied verbatim from `modryn-base` at first, which
 * meant four of Run's own steps — `micro`, `nav`, `title`, `figure` — had no row here at all,
 * breaking this file's own rule two paragraphs up. Ordered largest to smallest, matching base's
 * convention; where two steps share a px size (`nav` and `body-lg`, both 16), the one with the
 * distinct weight/tracking sits first since that is the whole reason it is a separate token. */
export const TYPE_STEPS: TypeStep[] = [
  { name: 'display', cls: 'text-display', sample: 'Ship the thing' },
  { name: 'h1', cls: 'text-h1', sample: 'Ship the thing' },
  { name: 'figure', cls: 'text-figure', sample: '$1,337.35' },
  { name: 'h2', cls: 'text-h2', sample: 'What this section covers' },
  { name: 'h3', cls: 'text-h3', sample: 'A smaller heading, still a heading' },
  { name: 'title', cls: 'text-title', sample: 'The page header title, next to the wordmark.' },
  { name: 'nav', cls: 'text-nav', sample: 'A sidebar row: wayfinding, not body copy.' },
  { name: 'body-lg', cls: 'text-body-lg', sample: 'The size a landing page paragraph is set at, one step above body.' },
  { name: 'body', cls: 'text-body', sample: 'The default. Everything that is not a heading or a caption is set at this size.' },
  { name: 'small', cls: 'text-small', sample: 'Help text under a field, secondary metadata, timestamps.' },
  { name: 'caption', cls: 'text-caption', sample: 'Labels, table headers, the smallest thing allowed to carry meaning.' },
  { name: 'micro', cls: 'text-micro', sample: 'BADGE LABEL' },
];

export const RADIUS_STEPS = [
  { name: 'sm', cls: 'rounded-sm', use: 'inputs, small chips' },
  { name: 'md', cls: 'rounded-md', use: 'the default: buttons, fields, dropdowns' },
  { name: 'lg', cls: 'rounded-lg', use: 'cards, modals, large panels' },
  { name: 'full', cls: 'rounded-full', use: 'avatars and toggles ONLY, never pill-everything' },
];

/* The allowed spacing steps and no others: 4 8 12 16 24 32 40 48 64 80 96px. Rendering them as
 * bars makes the gaps in the scale visible — you can see that there is no 5, no 7, no 9. */
export const SPACING_STEPS = [
  { step: '1', px: 4, cls: 'w-1' },
  { step: '2', px: 8, cls: 'w-2' },
  { step: '3', px: 12, cls: 'w-3' },
  { step: '4', px: 16, cls: 'w-4' },
  { step: '6', px: 24, cls: 'w-6' },
  { step: '8', px: 32, cls: 'w-8' },
  { step: '10', px: 40, cls: 'w-10' },
  { step: '12', px: 48, cls: 'w-12' },
  { step: '16', px: 64, cls: 'w-16' },
  { step: '20', px: 80, cls: 'w-20' },
  { step: '24', px: 96, cls: 'w-24' },
];
