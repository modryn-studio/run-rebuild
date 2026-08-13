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
  // Shrinks layout viewport when an on-screen keyboard opens — h-dvh containers
  // then exclude keyboard height without per-component visualViewport hacks.
  interactiveWidget: 'resizes-content',
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
