'use client';

/* WHICH PROP FIRM IS THIS ACCOUNT WITH? The one question Tradovate can never answer for us
 * (`docs/docs from run-trading/prop-firm-identity.md`), asked once, in the cheapest form that stays
 * honest.
 *
 * THE SHAPE: a search field over a short "Most popular" section, which typing replaces with
 * matches. The reason is not the search - it is that A PICKER SHOULD OPEN ON AN ANSWER, NOT ON A
 * LIST. Five names a trader recognises beats twenty-three they have to read.
 *
 * THE LIST IS CLOSED, and that reversed an earlier call in v2 (Luke, 2026-07-30). It used to accept
 * whatever you typed, on the reasoning that a trader whose firm is missing must never meet a dead
 * end. The reason to refuse an unknown name is specific: THE LIST IS EVERY FIRM ON TRADOVATE, and a
 * firm not on it is one whose accounts cannot reach Run through this rail at all - so accepting the
 * name would create a row that can never receive a fill. Free text also poisons two things
 * downstream: the confirmed prefix -> firm table that makes the next trader's intake shorter, and
 * any future rulebook lookup, both of which key on the firm being one of a known set.
 *
 * THE WRITE PATH IS DELIBERATELY LOOSER THAN THIS SCREEN. `/api/accounts` length-caps the firm
 * rather than enumerating it, because prop firms launch monthly and a server that hard-refuses an
 * unlisted name turns "we have not heard of yours yet" into "you cannot use Run". The closed list is
 * a product decision about what this PICKER offers; it is not a database constraint.
 */

import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { slotSurface } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { AccountLogo } from './account-logo';
import { PROP_FIRM_NAMES, POPULAR_PROP_FIRMS, findPropFirm } from '@/lib/prop-firms';

export function FirmPicker({
  onPick,
  autoFocus,
}: {
  onPick: (firm: string) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => (q ? PROP_FIRM_NAMES.filter((f) => f.toLowerCase().includes(q)) : POPULAR_PROP_FIRMS),
    [q]
  );

  return (
    <div>
      {/* `focus-within`, NOT a focus style on the input: the field reads as ONE lit object when
          active, and the ring has to sit on the wrapper for the mark inside it to be enclosed too.
          The global `:focus-visible` outline is untouched and still does the accessibility work. */}
      <div className="border-border bg-surface focus-within:border-accent flex min-h-12 items-center gap-2 rounded-[var(--radius-sm)] border px-4 transition-colors">
        <Icon name="search" size={16} className="text-muted shrink-0" />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search or type your firm"
          maxLength={60}
          aria-label="Prop firm"
          autoComplete="off"
          /* `text-body-lg` (16px) AND IT STAYS 16 ON A PHONE. iOS Safari zooms the page when a
             focused input is under 16px and never zooms back - the same reason `/trades`' search
             field is exempt from every type-scale step this build has taken. */
          className="text-body-lg text-text placeholder:text-muted min-w-0 flex-1 bg-transparent py-3 outline-none"
        />
        {/* Only present with something to clear, so the resting field stays a field rather than a
            control cluster. */}
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="text-muted hover:text-text hit-44 shrink-0 transition-colors"
          >
            <Icon name="close" size={14} />
          </button>
        )}
      </div>

      {/* NO BORDER AND NO SCROLLER OF ITS OWN. v2 shipped this as a bordered box with its own
          `max-h` + `overflow-y-auto` INSIDE a card that also scrolled, so at browser zoom you met
          two scrollbars and had to pick the right one. It is an unframed run of rows inside the
          dialog's single scroll region, and "Most popular" is a plain muted label at the same
          gutter as everything else. */}
      <div className="mt-3">
        {!q && <p className="text-body text-muted mb-2 font-medium">Most popular</p>}
        {matches.map((f) => (
          <Option key={f} label={f} onClick={() => onPick(f)} />
        ))}
        {matches.length === 0 && (
          /* THE DEAD END, SAID PLAINLY. The obvious move here is a "request this firm" button; there
             is nothing honest to put behind one yet, and the truth is more useful: a firm absent
             from this list is not on Tradovate, so its accounts could not reach Run even if the name
             were accepted. */
          <div className="py-6 text-center">
            <p className="text-body-lg text-text">No match for &ldquo;{query.trim()}&rdquo;</p>
            {/* FIRST PERSON, NOT THIRD. The app never refers to itself by name to the person using
                it (CLAUDE.md): "we connect through Tradovate" is the app talking, "Run connects
                through Tradovate" is the app describing someone else. */}
            <p className="text-body text-muted mx-auto mt-1 max-w-xs">
              We connect through Tradovate. Firms that trade elsewhere are not supported yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ONE ROW: a 32px mark, then the name over the firm's domain.
 *
 * PILLS RATHER THAN HAIRLINE-SEPARATED ROWS. A divider says "these are rows in one object", a pill
 * says "these are separate things you pick between", and the second is the truth here.
 *
 * IT REUSES `AccountLogo` RATHER THAN v2'S OWN `FirmLogo`. That component already draws a firm's
 * mark on a permanently light tile in both themes, already falls back to the initial when a file is
 * missing, and already takes its size as a prop. v2 has two components doing this because its
 * roster's version grew separately; copying that split would import the drift along with the
 * feature. */
function Option({ label, onClick }: { label: string; onClick: () => void }) {
  const firm = findPropFirm(label);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(slotSurface, 'mb-2 flex w-full items-center gap-3 px-4 py-2 text-left')}
    >
      <AccountLogo propFirm={label} size={32} />
      <span className="min-w-0 flex-1">
        <span className="text-body-lg text-text block truncate font-medium">{label}</span>
        {firm && <span className="text-body text-muted block truncate">{firm.domain}</span>}
      </span>
    </button>
  );
}
