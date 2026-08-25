import type { Metadata, Viewport } from 'next';
import { Newsreader, Hanken_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { site } from '@/config/site';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

// THREE FACES, ONE JOB EACH. One grotesque for the whole app, mono for machine strings only
// (order ids, timestamps, tickers — never a money figure), and the editorial serif for the
// wordmark and nothing else. globals.css reads all three as --font-sans / --font-mono /
// --font-serif, so the variables must be on <html> or every one falls back to system-ui.
//
// The type scale is calibrated to Hanken specifically: its x-height measures 0.49em against
// system-ui's 0.445em, so it sets ~10% optically larger at the same px. That is why body is
// 14px here and not the 16px the reference uses. Swapping the face without re-deriving the
// scale would quietly undo that.
//
// `axes: ['opsz']` is load-bearing on any variable font with an optical-size axis. next/font
// only serves non-default axes you declare, so without it every glyph renders at the axis
// default — for Newsreader that is opsz 16, the TEXT cut: sturdy serifs, low stroke contrast,
// loose fit. Right at 20px, wrong at display sizes, and subtle enough to survive several
// design reviews before anyone names it.
const serif = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  variable: '--font-serif',
  display: 'swap',
});
const sans = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  /* THE KEYBOARD OVERLAYS, IT DOES NOT RESIZE (2026-08-24, Luke: "when i click in the search text
   * field, the phone's keyboard opens. but the footer does not need to move with the keyboard").
   *
   * This was `resizes-content`, which shrinks the LAYOUT viewport while a keyboard is up. That is
   * what `h-dvh` measures, so the whole shell column compressed and the bottom bar rode up to sit
   * on top of the keyboard - four nav tabs stacked above a keyboard the trader is typing into,
   * which is chrome competing with the thing it interrupted.
   *
   * `overlays-content` leaves the layout viewport alone: the keyboard is drawn OVER the page, the
   * bar stays at the foot of the document where it belongs, and the browser still scrolls the
   * focused field into view. The one thing to watch is a field low on the screen being covered -
   * not a risk for the surface that prompted this, since the phone's search row sits in the header
   * band at the very top. */
  interactiveWidget: 'overlays-content',
  /* WITHOUT THIS, EVERY `env(safe-area-inset-*)` IN THE CODEBASE RESOLVES TO ZERO (2026-08-25,
   * postcheck). iOS only reports the insets when the page opts into the full display area, and this
   * export set `interactiveWidget` alone - so three carefully-argued call sites were decoration:
   * the bottom bar's home-indicator clearance (`app-shell.tsx`), the filter sheet's footer
   * (`filter-sheet.tsx`) and `.pane-bottom-clearance` (globals.css). Each reads an inset that was
   * always 0, which is the silent kind of wrong: correct on every device without a notch, and on
   * the ones with it the failure looks like a design choice. */
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: site.name,
  description: site.description,
  // Private until it isn't — keep it out of search indexes until there's a reason not to.
  robots: { index: false, follow: false },
  // Icons are left to Next's file conventions: src/app/icon.png, favicon.ico, apple-icon.png.
  // Replace those three files with the project's mark. (Setting an `icons` block here would stop
  // the conventions entirely, so anything it forgot to list would silently disappear.)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: ThemeProvider's blocking script sets the .dark class
    // before hydration, which intentionally differs from the server-rendered markup.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${serif.variable} ${sans.variable} ${mono.variable}`}
    >
      {/* No font class on <body>: globals.css sets the family on <html> from --font-sans. */}
      <body className="antialiased">
        {/* The toggle used to float here at `fixed top-4 right-4`, with a note saying to move it
            into a real header once the project grew one. S3b grew one: the shell renders its own
            toggle inside the 64px header band, and a fixed copy would have sat on top of it.
            Surfaces OUTSIDE the shell — /login, /status — render their own. */}
        <ThemeProvider>{children}</ThemeProvider>
        {/* Vercel Web Analytics: pageviews only, no cookie, no cross-site identity, so it does not
            add anything to the Privacy Policy's cookie section. Inert in development and on any
            non-Vercel host, so local runs never emit. Our own /api/track handles product events;
            this covers traffic and referrers, which that deliberately does not. */}
        <Analytics />
      </body>
    </html>
  );
}
