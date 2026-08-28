'use client';

/* RENDERS ITS CHILDREN ABOVE `md` AND NOTHING BELOW IT — a class cannot do this job here.
 *
 * `max-md:hidden` hides PIXELS. The subject page's tape ships its first 300 rows, and on a phone
 * that is 300 rows of DOM built, laid out and kept alive so that `display: none` can throw them
 * away — under a `RecentTrades` table drawn from the same array that shows four. Measured on one
 * real account at 390px before this existed: 30 rows in the document, 4 of them visible.
 *
 * IT DOES NOT SAVE THE PAYLOAD, and it should not be sold as if it did. `sessions` is a prop on a
 * Client Component either way, so the rows cross the wire whichever branch renders — which is
 * correct, because `RecentTrades` reads the same array and a second query for four rows would be
 * the thing this codebase keeps refusing. What it saves is the DOM.
 *
 * WHAT IT DOES NOT DO, STATED HONESTLY. `usePhone` starts at the SERVER's answer and corrects in a
 * layout effect - it has to, or the tree hydrates against HTML that disagrees with it, which is the
 * error this whole pair was rewritten to fix. So the server still SENDS the rows and the browser
 * still parses them; what this removes is their life after that first commit, before paint. A phone
 * ends up with four rows in the document instead of three hundred, which is the thing that costs on
 * every subsequent scroll, resize and re-render. It is not a saving on first parse and should not be
 * described as one.
 */

import type { ReactNode } from 'react';
import { usePhone } from '@/lib/use-phone';

export function DesktopOnly({ children }: { children: ReactNode }) {
  const phone = usePhone();
  return phone ? null : <>{children}</>;
}
