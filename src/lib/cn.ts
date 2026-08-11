import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The locked type scale (globals.css @theme) defines text-* SIZE tokens - text-micro through
// text-hero - alongside Tailwind's own text-* COLOR utilities (text-accent, text-muted, ...).
// Bare `twMerge` doesn't know our custom size tokens are a font-size group, so it silently treats
// `text-body-lg` and `text-accent-fg` as the same conflict group and drops one - e.g.
// `cn('text-accent-fg', 'text-body-lg')` used to lose the color entirely. Registering the scale
// as its own font-size group fixes that for every future `cn()` call, not just one component.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      // Keep in sync with the @theme type scale in globals.css - a step missing here is silently
      // treated as a text COLOR and merged away against one.
      // `mega` removed 2026-07-30 with the token. A step left listed here after its token is gone
      // is worse than useless: tailwind-merge would keep treating `text-mega` as a size and
      // silently swallow whatever real size it sat beside.
      'font-size': [{ text: ['micro', 'caption', 'small', 'body', 'body-lg', 'nav', 'title', 'h2', 'figure', 'display', 'hero'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
