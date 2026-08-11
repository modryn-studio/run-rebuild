'use client';

/* Six-digit sign-in code entry.

   Built as ONE real <input> lying invisibly over six drawn boxes, not as six separate inputs.
   Six inputs is the obvious approach and it is the wrong one: it breaks paste (the clipboard lands
   entirely in box 1), it defeats `autocomplete="one-time-code"` so iOS/Android never offer to
   autofill the code from the notification, and it hands a screen reader six unlabelled fields for
   what is a single value. With one input all of that works natively and the boxes are pure
   decoration (aria-hidden), so the accessible surface is exactly one labelled text field.

   The caret is hidden and focus is drawn on the active box instead, because the global
   :focus-visible outline in globals.css would land on a transparent element and show nothing. */

import { useEffect, useRef, useState, type ClipboardEvent } from 'react';
import { cn } from '@/lib/cn';

const LENGTH = 6;

export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  /* GIVE FOCUS BACK WHEN THE FIELD RE-ENABLES (Luke, 2026-08-03: "i accidently typed in the wrong
   * code, now i can't type it in again. im locked out unless i submit a new email code").
   *
   * He was not locked out - the server allows three attempts, so the code was still good. He simply
   * could not type. Submitting disables this field while the check is in flight; disabling a FOCUSED
   * element blurs it, and re-enabling does not hand focus back (verified in the browser: focused
   * true -> disabled false -> re-enabled still false). Every other field in the product would just
   * look unfocused at that point. This one is a transparent input lying over six aria-hidden boxes,
   * so there is nothing to look unfocused: the trader sees six empty boxes, types into the void, and
   * concludes the code is spent. The lost focus ring goes with it, so there is not even a cue.
   *
   * Unconditional on the true -> false edge, and only on that edge. Re-enabling this field has
   * exactly one meaning - the trader may now type - so taking focus is never wrong. Guarding on the
   * edge keeps it from fighting `autoFocus` on the initial mount. */
  const wasDisabled = useRef(false);
  useEffect(() => {
    if (wasDisabled.current && !disabled) ref.current?.focus();
    wasDisabled.current = Boolean(disabled);
  }, [disabled]);

  // Digits only, never longer than the code. Everything (typing, paste, autofill) funnels through
  // here, so there is one place where the value can be malformed and it is this one.
  function commit(raw: string) {
    const next = raw.replace(/\D/g, '').slice(0, LENGTH);
    onChange(next);
    if (next.length === LENGTH) onComplete?.(next);
  }

  // Paste is handled explicitly so "123 456" and "code: 123456" both work; the default would
  // insert the punctuation and blow the maxLength.
  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    commit(e.clipboardData.getData('text'));
  }

  return (
    <div
      className="relative"
      // Clicking anywhere on the boxes focuses the real field underneath.
      onClick={() => ref.current?.focus()}
    >
      <input
        ref={ref}
        value={value}
        onChange={(e) => commit(e.target.value)}
        onPaste={handlePaste}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        // The panel only mounts once the code has been sent, so focusing on mount puts the caret
        // exactly where the next keystroke belongs instead of making the user click six small boxes.
        autoFocus={autoFocus}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={LENGTH}
        aria-label="Six digit sign-in code"
        aria-invalid={invalid || undefined}
        className="absolute inset-0 h-full w-full cursor-default text-transparent caret-transparent opacity-0 outline-none disabled:cursor-not-allowed"
      />
      {/* Boxes flex rather than sit at a fixed width: six 44px boxes plus gaps need 304px, but the
          sign-in card's content box is only 279px at 375px wide and 224px at 320px, so a fixed
          width overflowed the card on every iPhone-class screen. They grow to a 48px cap on
          desktop and shrink to fit below that. */}
      <div className="flex justify-center gap-1.5 sm:gap-2" aria-hidden>
        {Array.from({ length: LENGTH }, (_, i) => {
          // The "next empty slot" is the active one, and it stays on the last box once full so a
          // complete code doesn't leave the ring floating off the end.
          const isActive = focused && i === Math.min(value.length, LENGTH - 1);
          return (
            <div
              key={i}
              className={cn(
                // h-12 matches Input's min-h-12 and Button size="lg", so a code box and a text
                // field are the same height everywhere in the product.
                'num flex h-12 min-w-0 max-w-12 flex-1 items-center justify-center rounded-[var(--radius-sm)] border text-h2 transition-colors',
                disabled && 'opacity-50',
                invalid
                  ? 'border-neg text-neg'
                  : isActive
                    ? 'border-accent text-text'
                    : 'border-border text-text'
              )}
            >
              {value[i] ?? ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
