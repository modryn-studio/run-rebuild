'use client';

/* THE DASHBOARD WIDGET, MEASURED OFF THE REFERENCE RATHER THAN REMEMBERED.
 *
 * `wireframes.md` §5 ported the contract from the teardown - title links out, one headline value, a
 * scope control inside the widget, a body that is a chart or a list or a specific empty state. That
 * is still the contract. What follows is the SHAPE, read with `getComputedStyle` on 2026-08-31
 * because the first pass built it from the four lines and got two things wrong.
 *
 * ─── WHAT THE MEASUREMENT SAID ─────────────────────────────────────────────────────────────────
 *
 *   card          radius 12px · no border · shadow 0 2px 4px rgba(34,32,29,.1) · padding 0
 *   header        78px tall, and it HAS a bottom rule: 0.667px solid rgb(246,245,243)
 *   title         18px / 500 / lh 27, with a 16px mark before it
 *   period        16px / 500 / muted, BESIDE the title (see the correction below)
 *   body          padding 20px · gap 16px · 16px / 400 · a chevron at the far right
 *
 * ONE CORRECTION TO THE FIRST PASS, and one correction TO THAT CORRECTION.
 *
 * **There IS a rule under the header** - the first pass argued there was not, from the reference's
 * own §3 reasoning about grounds, which is a good rule applied to a card that does not follow it.
 * That one still stands.
 *
 * **The period does NOT stack under the title** (corrected 2026-09-01). This note used to say it
 * did, measured off the recap card alone. Every other widget in the reference puts them inline -
 * `Budget September 2026`, `Your Weekly Recap August 23rd-29th` - so one card was read as the
 * contract. They share a line here and wrap to two only when the text outgrows the box.
 *
 * ─── WHAT MAPS ONTO RUN'S RAMP EXACTLY, AND IT IS MOST OF IT ───────────────────────────────────
 *
 * Monarch's base is 16px and Run's is 14, so their sizes shift one step down the ramp:
 * their 18/500 title is Run's `text-title` (18/24/500) to the pixel, and their 16px period and body
 * are Run's `text-body-lg`. Nothing here is a hand-picked size.
 *
 * ─── WHAT IS DELIBERATELY NOT PORTED ───────────────────────────────────────────────────────────
 *
 * **THE GRADIENT TITLE.** Monarch fills `Your Weekly Recap` with `AssistantGradientText` - the span
 * computes to `color: rgba(0,0,0,0)` with a gradient clipped to the glyphs, which is how it gets
 * that orange. `design-system.md`'s banned tells include gradient text, and it is banned for the
 * reason this is a good example of: it marks a surface as special by decoration rather than by
 * hierarchy. Run's version says the same thing with the accent MARK and leaves the title in ink.
 *
 * **THE DRAG HANDLE.** Their widgets carry drag dots that appear on hover
 * (`data-rbd-drag-handle-draggable-id="recap"`). Reordering is real and `useListDrag` already does
 * it for the roster - but it is a feature of a dashboard with enough widgets to reorder.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { cn } from '@/lib/cn';

/** One geometry for all three header shapes, so a link, a button and a plain block cannot drift
 *  apart. `py-4` rather than the reference's 13.5px: 14 is not a step on this scale and 16 is. */
const HEAD = 'border-rule flex w-full flex-col border-b px-5 py-4 max-md:px-4';

export function Widget({
  title,
  /** Sits UNDER the title, muted. What the widget covers: a period, a count, a date. */
  period,
  /* A 16px mark before the title, AND the title takes the accent with it. The two travel together
     because they are one signal rather than two decorations: a mark and a coloured title together
     mean A MACHINE WROTE THIS, which is the distinction the reference draws and the only one on a
     dashboard of figure cards that is worth a colour.
     ONE PROP, NOT TWO, so a widget cannot end up with a mark and an ink title or the reverse. The
     day one genuinely needs a mark without the accent is the day to split them. */
  mark,
  href,
  /** The whole body becomes the target, with a chevron at its end. See `Body` below. */
  onOpen,
  /** The small control that scopes this widget only, at the header's far right. */
  scope,
  children,
  className,
}: {
  title: string;
  period?: string;
  mark?: IconName;
  href?: string;
  onOpen?: () => void;
  scope?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const head = (
    /* TITLE AND PERIOD SHARE ONE LINE, AND WRAP TO TWO ONLY WHEN THEY HAVE TO (2026-09-01, Luke:
       *"i was wrong to tell you to create two lines in the header. the title and the date can and
       should be on the same line. unless the browser zoom is high, then it can wrap into two
       lines"*). He is right and this file was wrong: its own note above claimed the reference
       stacks the period under the title, read off the recap card alone. Every other widget in the
       screenshot he sent puts them inline - `Budget September 2026`, `Your Weekly Recap August
       23rd-29th` - so the stack was a misreading of one card, not the contract.
       `flex-wrap` IS THE WHOLE MECHANISM, and it is why this is not a media query. The thing that
       forces the second line is the text outgrowing the box, which happens at high browser zoom,
       at a large system font size, and at a long period string - three causes with one cure. A
       breakpoint would answer only the narrow-viewport case and would still overflow at 200% zoom
       on a wide one.
       READ OUT OF THE REFERENCE'S MARKUP ON 2026-09-01, not inferred, and it corrected one thing
       this file had guessed. Its header is one `<a class="…HeaderClickable…">`:

         a       display:flex · align-items:CENTER · gap:8px · flex-wrap:nowrap
           div   flex items-center gap:4px  ->  [svg 16px, text-content-brand] [span 18/500]
           div   Description             ->  16px / 500 / rgb(119,117,115), its own block

       So the gap is 8px (`gap-x-2`) and the alignment is `items-center`, NOT the `items-baseline`
       written here first. Measured on their live page: title box 281-308, date box 283-307 - two
       boxes centred on 294.5 and 295, which is centre alignment and not a baseline match.
       THEIR ROW IS `nowrap` AND OURS IS NOT, and that is the one deliberate divergence. A row that
       cannot wrap can only overflow, and Luke's rule is that high zoom gets two lines rather than a
       clipped date. `flex-wrap` is the whole mechanism and it is why this is not a media query: the
       thing that forces the second line is text outgrowing the box, which happens at high browser
       zoom, at a large system font size, and at a long period string - three causes, one cure. */
    <span className="flex flex-wrap items-center gap-x-2 max-md:flex-col max-md:items-start max-md:gap-y-0.5">
      <span className="flex items-center gap-1.5 max-md:flex-row-reverse">
        {mark && <Icon name={mark} size={16} className="text-accent shrink-0" />}
        {/* THE TITLE INHERITS THE MARK'S COLOUR (2026-08-31, Luke: *"the title of that card should
            inherit the color of the icon... That's what monarch does. And just for this card, not
            the others"*), and the measurement says he read it exactly right. The reference fills
            that title with `linear-gradient(178deg, rgb(229,72,77) 20%, rgb(255,105,45) 80%)`
            clipped to the glyphs - and `rgb(255,105,45)` is its icon's colour, the gradient's own
            end stop. So "inherit the icon's colour" IS their effect with the decoration taken off,
            which is the version this design system allows: `design-system.md` bans gradient text,
            and a flat token says the same thing without it. */}
        <span
          className={cn('text-title font-medium', mark ? 'text-accent' : 'text-text')}
        >
          {title}
        </span>
      </span>
      {/* ONE STEP DOWN ON A PHONE, and it is this codebase's own compression rather than a new
          idea: `roster-card.tsx` writes `text-body-lg max-sm:text-body` on its figures, and
          `globals.css` steps `--text-meta` from 14 to 11 under the same `40rem`. Stacked under an
          18px title at 375px, a 16px date is barely a step and the pair reads as two headings.
          DESKTOP IS UNTOUCHED at 16, which is the reference's measured value and the one Luke
          signed off on 2026-09-01 (*"i think we are done iterating on the desktop version"*). */}
      {period && (
        <span className="text-body-lg max-sm:text-body text-muted font-medium">{period}</span>
      )}
    </span>
  );

  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      {/* THE HEADER IS THE LINK when the widget has a page, which is the contract's first line and
          the thing the first pass got right for the wrong reason: the reference wraps title AND
          period in one `<a>` (`DashboardWidget__HeaderClickable`), so the whole block is the target
          rather than a mark at the end of it. On a phone that difference is the affordance.
          `py-4` rather than the reference's 13.5px, because 14 is not a step on this scale and 16
          is. It reads 83px against their 78. */}
      {href ? (
        <Link href={href} className={cn(HEAD, 'hover:bg-hover transition-colors')}>
          {head}
        </Link>
      ) : onOpen ? (
        /* BOTH HALVES ARE TARGETS AND BOTH DO THE SAME THING, which is the reference's own shape
           and the thing this component got wrong until it was measured (2026-08-31). Its card
           carries an `<a>` over the header (553x53) AND a `<button>` over the body (585x88), each
           pointing at `/dashboard/weekly-recap`. A divider between them, and still one gesture.
           A widget whose title looks like a heading and is not clickable is a card that has to be
           aimed at, and the whole point of the divided shape is that it cannot be missed. */
        /* NO HOVER GROUND ON THE HEADER, and that is the reference's own behaviour rather than an
           omission (2026-08-31, Luke: *"the upper half of the card doesn't actually have a
           highlight on hover. just the lower half"*). Both halves are targets; only the body lights
           up. The reason it reads correctly is that the body is the one carrying the CHEVRON - the
           mark that says "this opens" - so the ground change belongs to the half that already
           claims the gesture. A title that lights up as well would make one card look like two
           controls. `focus-visible` is untouched: a keyboard user still gets a ring, because the
           thing being suppressed is a POINTER affordance, not the target itself. */
        <button type="button" onClick={onOpen} className={cn(HEAD, 'text-left')}>
          {head}
        </button>
      ) : (
        <div className={HEAD}>
          {head}
          {scope && <span className="mt-2">{scope}</span>}
        </div>
      )}

      {onOpen ? (
        /* THE BODY IS THE BUTTON, and this is the reference's own arrangement rather than a
           simplification of it: its recap card has NO call-to-action button. The body is one large
           target with a chevron at the far end, which is why the card can be 166px tall and still
           read as one gesture. The first pass drew a `Read it` button instead, which is a second
           thing to aim at inside a card that is already aimed at.
           `text-left` because a button centres its text and this is a paragraph. */
        <button
          type="button"
          onClick={onOpen}
          className="hover:bg-hover flex flex-1 items-center gap-4 px-5 py-5 text-left transition-colors max-md:px-4"
        >
          <span className="min-w-0 flex-1">{children}</span>
          <Icon name="chevron" size={18} className="text-muted shrink-0 -rotate-90" />
        </button>
      ) : (
        <div className="min-w-0 flex-1 px-5 py-5 max-md:px-4">{children}</div>
      )}
    </Card>
  );
}
