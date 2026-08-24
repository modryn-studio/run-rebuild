/* Measurement helpers for the sink's client islands. No DOM work happens at import time, so this
 * stays a plain module — only client components call into it. */

export type Rgb = [number, number, number];

/* getComputedStyle returns legacy `rgb()` / `rgba()` for hex and named inputs, including the
 * black-or-white that contrast-color() resolves to. It does NOT for everything: a token built with
 * color-mix() computes to `oklab(...)`, and this repo now derives accent-hover, border-strong and
 * pressed that way so that recolouring the accent carries them. Those are exactly the values worth
 * measuring, so "cannot parse it" would have made this page silently stop checking the pairs it
 * had just gained.
 *
 * So: a fast path for rgb(), and a canvas fallback for everything else. Painting one pixel and
 * reading it back makes the browser resolve ANY colour syntax it understands down to sRGB, which
 * is the space the WCAG maths wants anyway. Anything the browser itself cannot parse is reported
 * as unmeasured rather than as a wrong number. */
export function parseRgb(value: string): Rgb | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (match) {
    const parts = match[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n))) {
      return [parts[0], parts[1], parts[2]];
    }
    return null;
  }

  return rasterise(trimmed);
}

/* One pixel, painted and read back.
 *
 * The sentinel matters: assigning an unparseable value to fillStyle is a no-op that leaves the
 * previous one in place, so without seeding a known colour first an unknown syntax would silently
 * measure as whatever was last set. Seed with a colour nothing else here is, check it actually
 * moved, and only then trust the pixel. */
function rasterise(value: string): Rgb | null {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const SENTINEL = '#ff00ff';
  ctx.fillStyle = SENTINEL;
  ctx.fillStyle = value;
  if (ctx.fillStyle === SENTINEL) return null;

  ctx.clearRect(0, 0, 1, 1);
  ctx.fillRect(0, 0, 1, 1);

  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return a === 0 ? null : [r, g, b];
}

export function toHex([r, g, b]: Rgb): string {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}

// WCAG 2.2 relative luminance. APCA is the better perceptual model and is where WCAG 3 is
// heading, but WCAG 3 is not expected to be a Recommendation before 2028 and 2.2 AA is what
// every audit and every piece of legislation actually tests against. Measure what you are judged on.
function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/* READ BOTH THEMES IN ONE PASS, WITHOUT MAKING THE USER TOGGLE.
 *
 * Side by side is the whole point: a contrast failure you can only find by flipping the toggle
 * and remembering what the other mode looked like is a failure you will not find.
 *
 * The tokens live on `:root` with a `.dark` block overriding them, so the dark values are only
 * reachable while `.dark` is on <html>. This flips the class, reads, and flips it back.
 *
 * It is safe because it is synchronous. getComputedStyle forces a style recalculation
 * immediately, and the browser cannot paint until this task yields, so the class is already
 * restored before anything reaches the screen — no flash, at any refresh rate.
 *
 * The alternative was a `.light` block mirroring every value so a subtree could be forced light
 * while <html> is dark. That is a third copy of the palette to keep in sync, and a third copy
 * is the drift this repo keeps paying for elsewhere. Two style recalculations, once on mount,
 * is the cheaper trade.
 */
export function captureBothModes<T>(read: () => T): { light: T; dark: T } {
  const root = document.documentElement;
  const wasDark = root.classList.contains('dark');

  root.classList.remove('dark');
  const light = read();

  root.classList.add('dark');
  const dark = read();

  root.classList.toggle('dark', wasDark);
  return { light, dark };
}
