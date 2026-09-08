'use client';

import { useEffect } from 'react';

/* THE LAST RESORT, and the only boundary that can answer a failure in the ROOT LAYOUT itself.
 *
 * `(app)/error.tsx` catches everything thrown by a page inside the signed-in shell, which is almost
 * everything. It cannot catch two things: a throw inside `(app)/layout.tsx` (a boundary never
 * catches its own layout) and a throw anywhere outside that segment - `/login`, `/status`, the
 * kitchen sink, the root page. Those land here.
 *
 * IT RENDERS ITS OWN `<html>` AND `<body>` because it REPLACES the root layout rather than nesting
 * inside it. That is Next's contract for this file, and it is also the reason for the next rule.
 *
 * EVERY VALUE HERE IS INLINE AND LITERAL, WHICH IS DELIBERATE AND IS THE ONE PLACE IN THIS REPO
 * THAT IS TRUE. `CLAUDE.md` is unambiguous that `globals.css` is the design system and that a
 * screen needing a value adds it to the system first. This file is the exception, and the reason is
 * structural rather than a preference: the stylesheet is linked BY the root layout, and this
 * component exists precisely for the case where that layout did not render. A token-based error
 * screen would be styled by the exact thing that just failed. There is a scar behind that shape
 * already - a deploy that shipped current HTML against a stale stylesheet and made the phone
 * unusable while every check stayed green - so the surface whose whole job is "something is very
 * wrong" is the one surface that must not depend on CSS arriving.
 *
 * The values below are therefore hand-picked to survive with no stylesheet at all, and they are
 * hex rather than tokens for the same reason. `color-scheme` plus `prefers-color-scheme` gives both
 * modes without a class hook, since `.dark` is applied by a script this page has also lost.
 *
 * IT DOES NOT TRACK. `/api/track` is reachable, but a root-layout failure is not a product event
 * and the analytics module itself may be part of what failed. `console.error` reaches the Vercel
 * log, which is where a failure this deep is actually diagnosed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global error boundary]', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          colorScheme: 'light dark',
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          background: 'Canvas',
          color: 'CanvasText',
        }}
      >
        <main style={{ maxWidth: '30rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: '0.9375rem', lineHeight: 1.6, margin: '0.75rem 0 0', opacity: 0.7 }}>
            Nothing was lost and your record is unchanged. Reload the page, and if it happens twice,
            send this code with your report.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: '0.9375rem',
                margin: '0.75rem 0 0',
                opacity: 0.7,
                userSelect: 'all',
              }}
            >
              {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              minHeight: '2.75rem',
              padding: '0 1.25rem',
              border: '1px solid currentColor',
              borderRadius: '0.5rem',
              background: 'transparent',
              color: 'inherit',
              font: 'inherit',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
