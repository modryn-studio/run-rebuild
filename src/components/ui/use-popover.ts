'use client';

/* A HEADER POPOVER'S OPEN STATE, AND THE THREE THINGS THAT MAKE IT A DIALOG RATHER THAN A DIV.
 *
 * EXTRACTED FROM `trades-controls.tsx` (2026-08-26) when `/accounts` needed the same control. It was
 * private there, and the alternative was a second copy — which is how one page ends up trapping
 * focus and the other does not, six months after anyone remembers there are two. Every fix below
 * was paid for once already; a copy would have inherited none of them.
 *
 * FOCUS MOVES IN. `run-trading@v2` shipped its popovers without it (its issue #95), so a keyboard
 * user opened a dialog and stayed on the page behind it.
 *
 * AND FOCUS GOES BACK WHERE IT CAME FROM. Moving it in was only half the defect: a dialog that
 * dismisses into nowhere strands the keyboard at the top of the document, so Escape out of Filters
 * left the trader tabbing from the wordmark to reach the control they had just used.
 *
 * THE RESTORE IS GUARDED ON `isConnected`, because the trigger is not always still there — a
 * `Clear` unmounts when the last filter goes — and focusing a detached node silently sends focus to
 * `<body>`, which is the failure being fixed, with an extra step.
 */

import { useEffect, useRef, useState } from 'react';

export function usePopover(onOpen?: () => void) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  /* WHERE FOCUS CAME FROM, so it can go back. */
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    panel.current?.focus();

    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      const back = opener.current;
      opener.current = null;
      if (back?.isConnected) back.focus();
    };
  }, [open]);

  const toggle = () => {
    if (!open) onOpen?.();
    setOpen((o) => !o);
  };

  return { open, setOpen, toggle, root, panel };
}
