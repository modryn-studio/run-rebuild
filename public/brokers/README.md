# Broker / platform logos

Full-color brand logos for the connect screen (`src/components/views/accounts/connect-flow.tsx`),
rendered theme-aware: `*-light.png` (dark wordmark) in light mode, `*-dark.png` (white wordmark) in
dark mode. A missing/broken file falls back to a letter monogram automatically.

Two shapes are needed per source, for two different jobs:

- **Lockup** (`*-light.png` / `*-dark.png`) — the horizontal icon+wordmark, for the picker card
  where the brand has room to be read.
- **Logomark** (`*-logomark.png`) — the SQUARE mark alone, for circular slots (the intake progress
  panel, where it sits opposite Run's own mark). A lockup cannot hold that position: scaled into a
  56px circle its wordmark is unreadable. One file serves both themes when the mark is coloured.

## In use
- `tradovate-prop-light.png` / `tradovate-prop-dark.png` — the lockup. The light file is
  Tradovate's original; the dark file keeps the blue icon and recolors the wordmark to white.
- `tradovate-logomark.png` — the square mark, 1024x1024, transparent, centred. Made from a
  white-background source with a corner flood-fill rather than a global `-transparent white`, so
  the white gaps BETWEEN the triangles are cleared without punching holes anywhere the mark uses
  white internally:

  ```
  magick src.png -alpha set -bordercolor white -border 1     -fuzz 12% -fill none -floodfill +0+0 white -shave 1x1     -background none -trim +repage     -resize 900x900 -gravity center -extent 1024x1024 tradovate-logomark.png
  ```

## Later (each added as a new source when its adapter lands)
NinjaTrader, TopstepX, Rithmic, and other prop-firm brokers. Source each brand's official logo
(brand page or brandfetch.com/<domain>), and generate a light + dark lockup plus a square logomark
the same way. SVG preferred; PNG is fine.
