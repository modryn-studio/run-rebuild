'use client';

/* THE ROSTER: one card per kind of account, each carrying its own total.
 *
 * IT GROUPS BY TYPE, NOT BY STATUS, and `run-trading@v2` states the reason best: the type is "the
 * only split that changes what a number MEANS - a Sim Funded account can pay out, an Evaluation
 * cannot, and a Personal account is the trader's own money". Order is Sim Funded, Evaluation,
 * Personal: consequences first. What HAPPENED to an account is a chip on its row, not a card it
 * moves between.
 *
 * ⚠ THIS DISAGREES WITH `wireframes.md`, WHICH DRAWS A `CLOSED` GROUP, and the conflict is live
 * rather than resolved. The wireframe's argument is real - "CLOSED is a permanent group, not an
 * archive you dig for... the corpus made concrete on the first screen" - but it groups on a value
 * that CHANGES, which is what v2 refused: "which card it sits in is its PHASE - a fact about the
 * account - and a fact must not be editable by dropping". Built v2's way per Luke's "port exactly
 * how it is", and flagged for him to settle. A closed account is visible either way; the only
 * question is which card it sits in.
 *
 * HIDDEN ROWS STAY IN THE ARITHMETIC. That is the whole distinction between `hidden` and
 * `excludedFromTotals`: one is about the LIST, the other about the MATHS. So the group total is
 * computed from every row, not from the visible ones - hiding an account tidies the roster, it does
 * not change what you made.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { AddSlot } from '@/components/ui/add-slot';
import { useListDrag } from './use-list-drag';
import {
  GROUP_ORDER_KEY,
  ROW_ORDER_KEY,
  byStoredOrder,
  mergeRowOrder,
  readOrder,
  writeOrder,
} from '@/lib/accounts/order';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { fmtMoney } from '@/lib/format';
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_ORDER,
  UNLABELLED_TYPE,
  UNLABELLED_TYPE_TITLE,
  accountTitleParts,
  statusLabel,
  type AccountTypeKey,
} from '@/lib/prop-firms';
import type { RosterAccount } from '@/lib/accounts/read';
import { AccountLogo } from './account-logo';
import { TrendIndicator, sizeBase } from './trend-indicator';
import { useChartView } from './chart-view';

/* THE GROUP ORDER AND THE UNLABELLED GROUP'S NAME BOTH MOVED TO `lib/prop-firms.ts` (2026-08-27),
   because the summary rail and the phone's scope chips have to read in the same order and print the
   same word, and three private copies of three strings is how that stops being true. */

/** `+` on a gain, the minus `fmtMoney` already carries on a loss — the tape's own rule. */
const signed = (cents: number): string => (cents > 0 ? `+${fmtMoney(cents)}` : fmtMoney(cents));

/* HOW LONG AGO RUN HEARD ANYTHING. Coarse on purpose: the question is "is this current", and a
   figure accurate to the minute invites a precision the answer does not have. */
function ago(at: Date | null): string | null {
  if (!at) return null;
  const mins = Math.floor((Date.now() - at.getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

/* THE STATUS CHIP, and an ACTIVE account does not wear one below `sm`.
   Active is the resting state of most of the roster, so a chip on every row spends the reader's
   attention on the majority case and leaves nothing for the two that ended. */
function StatusChip({ status }: { status: string }) {
  const tone =
    status === 'active'
      ? 'border-accent/45 text-accent'
      : status === 'passed'
        ? 'border-pos/40 text-pos'
        : 'border-border text-muted';
  return (
    <span
      className={cn(
        'text-caption rounded-[var(--radius-sm)] border px-2 py-0.5 whitespace-nowrap uppercase',
        tone
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

/* THE ROW'S SHAPE, NOT ITS SCALE. 72x20, rebased so every account's line starts at its own zero -
 * the question a sparkline answers is "which way has this been going", and sharing a y scale across
 * a $150k funded account and a $50k eval would flatten the smaller one into a straight line.
 * COLOURED BY WHERE IT ENDED, which is the only thing on the row that is coloured besides the chip.
 * A dashed zero rule so a line sitting entirely below it reads as below something. */
function Spark({ curve }: { curve: number[] }) {
  const max = Math.max(...curve, 0);
  const min = Math.min(...curve, 0);
  const range = max - min || 1;
  const x = (i: number) => (i / (curve.length - 1)) * 72;
  const y = (v: number) => 20 - 1 - ((v - min) / range) * 18;
  const line = curve.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const up = curve[curve.length - 1] >= 0;

  return (
    /* `draw-in` ON THE SAME KEY DISCIPLINE THE BIG CHART USES, so a period change redraws the row's
       squiggle the way it redraws the line above it - left to right, same curve, same duration. It
       was the one thing on the page that swapped in a frame while everything around it drew.
       THE KEY IS THE GEOMETRY, so a change producing the same shape does not re-fire. Cheap here in
       a way it is not on the chart: a sparkline is at most a few dozen points. */
    <svg key={line} width={72} height={20} className="draw-in overflow-visible" aria-hidden>
      <line
        x1={0}
        x2={72}
        y1={y(0)}
        y2={y(0)}
        stroke="var(--color-border)"
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      <polyline
        points={line}
        fill="none"
        stroke={up ? 'var(--color-pos)' : 'var(--color-neg)'}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Row({
  a,
  freshness,
  held,
  style,
  handleProps,
}: {
  a: RosterAccount;
  freshness: Date | null;
  held: boolean;
  style?: React.CSSProperties;
  /** The list drag's pointer handlers. Empty when there is nothing to reorder. */
  handleProps: React.ComponentProps<'a'>;
}) {
  const { shapeFor } = useChartView();
  const spark = shapeFor(a.id);
  const named = Boolean(a.displayName || a.propFirm);
  const title = accountTitleParts(a);
  const stamp = ago(freshness);

  return (
    /* A LINK, NOT A BUTTON. v2 shipped this as a button that opened the rename modal, which was an
       accident of the row having nothing else to do; a row that stands for an object should open
       the object. A real `<a>` so middle-click, cmd-click and open-in-new-tab all work. */
    <Link
      href={`/accounts/details/${a.id}`}
      data-row={a.id}
      {...handleProps}
      /* THE ROW IS A REAL `<a>`, AND THAT IS WHY THIS LINE EXISTS (2026-08-26, Luke: "I should be
         able to move the account rows"). A browser natively drags an anchor: press and move on a
         link and it starts its own HTML5 drag with a ghost image, which pre-empts the pointer
         stream this gesture is built on. So the pointer handlers fired for the press and then
         never saw another move, and the row simply would not travel.
         It did not show up in testing because synthetic `PointerEvent`s do not trigger native
         dragging - only a real mouse does. A gesture on an anchor has to turn this off explicitly. */
      draggable={false}
      style={style}
      /* `pl-7`, NOT `px-5` — v2's measured inset. The extra 8px is the lane the drag grip occupies,
         and it is claimed now rather than when drag lands so the rows do not all shift sideways the
         day it does. `min-h-21` (84px) is a FLOOR, not a height: a wrapping name grows the row.
         ─── THE PHONE GETS ITS OWN FOUR NUMBERS (2026-08-27, Luke: "Monarch has found a way to fit
         the content on the screen better") ────────────────────────────────────────────────────────
         Measured at 390px before touching anything: the row was 84px tall around 68px of content -
         a 40px logo, a 44px two-line text block and 12px of padding each side - so 16px of every row
         was floor and nothing else. Eight rows and four group headers carried 208px of that between
         them, which is two and a half rows of the thing the trader opened the page for.
         `min-h-17` (68px) is the same content with the slack gone. The type scale is untouched:
         nothing here got smaller, the empty space did.
         `gap-3` and a 16px gutter, both matching `/trades`' own phone row. The 28px inset is the
         drag grip's lane, and the grip only ever appears on HOVER - which a touch screen does not
         have - so on a phone it was 12px held for a mark that cannot appear. The gutter also now
         agrees with the chart, the chips and the card above it: `/trades` records the same fix, that
         three surfaces each starting at a different x is what makes a column read as loose. */
      className={cn(
        'group/row hover:bg-hover relative flex min-h-17 w-full items-center gap-3 py-3 pr-4 pl-4 text-left transition-colors select-none sm:min-h-21 sm:gap-5 sm:pr-5 sm:pl-7',
        /* NO `cursor-grab` HERE, unlike the card header one level up, and the difference is real: a
           header is not a link, so grab is the only thing its cursor could say. A ROW is a link and
           the main way into an account, so `grab` would override the browser's own pointer and hide
           the primary action behind the secondary one. `grabbing` stays for the held state, where a
           drag is actually happening. */
        held && 'cursor-grabbing',
        /* THE SAME LANGUAGE THE HELD CARD USES ONE LEVEL UP, so "this is the one in your hand" reads
           identically at both levels. `bg-surface` rather than the hover tint because a lifted row
           passes OVER its neighbours and has to be opaque, or the row underneath shows through. */
        held && 'ring-accent bg-surface z-10 rounded-[var(--radius)] shadow-[var(--shadow-lift)] ring-2'
      )}
    >
      {/* THE GRIP TAKES OVER WHAT THE CURSOR STOPPED SAYING, and that is the whole reason this mark
          is on rows and not on card headers: it appears exactly where the cursor can no longer
          carry the message. A header still says grab, so it needs no dots; a row says pointer, so
          without dots nothing on it would suggest it can be moved.
          ON HOVER ONLY. A column of grips down a resting list is one mark per row competing with
          the account names for the same eye, and reordering is a thing you do twice a year.
          `aria-hidden` with no target of its own: the whole row is the handle, so this is a HINT
          rather than a control. A keyboard user gets nothing from it either way, which is its own
          gap and not one a visible glyph would close. */}
      <span
        aria-hidden
        className={cn(
          'text-muted pointer-events-none absolute left-1 opacity-0 transition-opacity',
          Object.keys(handleProps).length > 0 && 'group-hover/row:opacity-100',
          held && 'opacity-100'
        )}
      >
        <Icon name="grip" />
      </span>
      <AccountLogo propFirm={a.propFirm} />

      <span className="min-w-0 flex-1">
        {/* A ROW IS ONE SIZE (`design-system.md` §2a). v2 ran four sizes across three tiers here -
            `text-body-lg` name, `text-body` sub-line, `text-small text-faint` stamp - and this
            build deleted the third ink tier outright. So the row is `text-body-lg` throughout and
            everything secondary is MUTED rather than smaller. */}
        {/* TRUNCATE THE FIRM, NEVER THE ACCOUNT NUMBER (2026-08-27), and this is a defect the
            density pass exposed rather than one it caused. `/trades` fixed exactly this in August on
            Luke's instruction - "keep the size and account number untouched. truncate the name only"
            - and `accountTitleParts` was written for it. The roster kept printing one string and
            letting `truncate` cut whatever fell off the end, which at 154px turned BOTH
            "Apex Trader Funding 50K (...4021)" and "(...3907)" into the same visible characters:
            two rows for two different accounts, rendered identically, with the only thing that told
            them apart being the half that got cut. The last four digits are the disambiguator; they
            are the last thing that may go, not the first.
            `gap-1` is the space the string itself would carry - flex trims whitespace at an item's
            edge, so the layout has to put it back. Same note the tape's `AccountName` carries. */}
        <span
          className={cn('text-body-lg flex min-w-0 gap-1', named ? 'text-text' : 'text-muted')}
        >
          <span className="truncate">{title.head}</span>
          {title.tail && <span className="shrink-0">{title.tail}</span>}
        </span>
        {/* THE PROMPT IS THE SUB-LINE ITSELF, never a second element beside it. An unnamed account
            asks to be named in the one slot that would otherwise repeat what the figure says. */}
        {/* THE STATUS CHIP JOINS THE SUB-LINE ON A PHONE, and this is the single biggest thing that
            was wrong with this row at 390px. Measured: the name had 46px of width on a row carrying
            a chip and 122px on one without - the chip and its gaps cost 76px of the one string that
            says which account you are looking at, so every name read "My Fun…" or "Apex Tr…". Down
            here it sits beside "19 trades", which had the whole width to itself and nothing to say
            with it, and the name gets it back.
            TWO NODES, ONE VISIBLE. The desktop copy below keeps the right cluster's grouping, where
            there is room for it; this one is `sm:hidden`. Same shape `refresh-roster.tsx` uses, and
            the state is a prop, so the two cannot disagree.
            IT IS STILL A BADGE, not a fourth text tier. `design-system.md` §4 gives a badge its own
            radius and its own size precisely because it is a different KIND of object from the prose
            beside it - the "a row is ONE type size" rule governs text, not marks. */}
        {/* `text-meta`: 14px on a desktop as before, 12px on a phone. The token carries the reason;
            the short version is that this line and the stamp opposite it were the same size as the
            name and the figure they annotate, so the row had no supporting tier at 390px. */}
        <p className="text-meta text-muted flex items-center gap-2">
          <span className="truncate">
            {a.productName ??
              (named ? `${a.trades.toLocaleString('en-US')} trades` : 'Name this account')}
          </span>
          {a.status !== 'active' && (
            <span className="shrink-0 sm:hidden">
              <StatusChip status={a.status} />
            </span>
          )}
        </p>
      </span>

      <span className="flex shrink-0 items-center gap-4 sm:gap-6">
        <span className="hidden shrink-0 sm:block">
          <StatusChip status={a.status} />
        </span>

        {/* AT LEAST TWO POINTS, OR THERE IS NO SHAPE TO DRAW. One session is a dot, and a dot in a
            column of lines reads as a rendering failure rather than as a short history. */}
        {spark.length >= 2 && (
          <span className="hidden shrink-0 sm:block">
            <Spark curve={spark.map((p) => p.cents)} />
          </span>
        )}

        {/* THE MARKER AND THE FIGURE TRAVEL TOGETHER (v2's own grouping). At the row's outer `gap-4`
            the eye sat as far from the number it qualifies as the sparkline does, reading as a
            fourth column rather than as an annotation on the money. */}
        <span className="flex shrink-0 items-center gap-2">
          {/* AN EXCLUDED ROW KEEPS ITS OWN NUMBER. Its figure is real and it is the trader's; it is
            simply not part of a total. Dropping it would answer a question nobody asked - marking
            it answers the one they will, which is "why doesn't this add up". */}
          {a.excludedFromTotals && (
            <span
              className="text-muted shrink-0"
              role="img"
              aria-label="Left out of the chart and the group total"
              title="Left out of the chart and the group total"
            >
              <Icon name="eye" size={16} />
            </span>
          )}

          {/* A FLOOR, NOT A WIDTH (v2, measured). Right-aligned figures share a right edge and rag on
            the left, so a $54 row and a $15,030.01 row start 60px apart and anything beside them
            steps in and out down the column. A bigger number pushes past this rather than clipping. */}
          <span className="min-w-27 text-right">
            <p className="text-body-lg text-text font-medium tabular-nums">{signed(a.netCents)}</p>
            {/* THE STAMP ANSWERS WHAT THE FIGURE CANNOT: a number with no timestamp cannot tell you
              whether it is this morning's or last month's. This is P5, the direct answer to the
              field's defining failure. */}
            {/* `text-meta`, WHICH IS 14px HERE AND 12px ON A PHONE (2026-08-27), and the history of
              this one line is worth keeping because it moved twice.
              It shipped at `text-caption` (11px), which was too small and made one row carry three
              sizes. It was raised to a flat 14px on 2026-08-26 citing "Monarch sets its '21 hours
              ago' at 14px" - true, and read off Monarch's WEB app, while the reference for Run's
              phone is their native one. A number measured on the wrong surface.
              14 was right for a desktop and is still what this resolves to there. 11 was too small
              for a phone and 14 left the row with no supporting tier at all; 12 is the step between
              them, and it lives in the TOKEN so it can be moved once rather than here. */}
            {stamp && <p className="text-meta text-muted">{stamp}</p>}
          </span>
        </span>
      </span>
    </Link>
  );
}

function Group({
  title,
  rows,
  freshness,
  onReorder,
  held,
  grabbable,
  gripHandlers,
}: {
  title: string;
  rows: RosterAccount[];
  freshness: Map<string, Date>;
  /** The group's own rows, in their new order. The caller merges them into the flat list. */
  onReorder: (ids: string[]) => void;
  /** This card is currently in the trader's hand. */
  held: boolean;
  /** False when there is only one card, so there is nothing to trade places with. */
  grabbable: boolean;
  /** Spread onto the HEADER, which is this card's grip - see the Card below. */
  gripHandlers: React.ComponentProps<'div'>;
}) {
  const [open, setOpen] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  const { changeFor, range, periodLabel, periodShort } = useChartView();

  const counted = rows.filter((a) => !a.excludedFromTotals);
  const total = counted.reduce((n, a) => n + a.netCents, 0);
  const shown = rows.filter((a) => !a.hidden);
  const hiddenRows = rows.filter((a) => a.hidden);
  /* HIDDEN ROWS ARE STILL THIS GROUP'S ROWS — the change is over `rows`, not `shown`, for the same
     reason the total is. Hiding tidies the list; it does not change what you made. */
  const change = changeFor(rows.map((a) => a.id));
  /* At All time the change IS the total beside it, so the indicator would print one figure twice. */
  const hasWindow = range !== 'all';

  /* ROWS REORDER WITHIN THEIR OWN CARD AND NOWHERE ELSE. An account can never be dragged from one
     card into another, because which card it sits in is its TYPE - a fact about the account - and a
     fact must not be editable by dropping. Where it sits INSIDE the card is a preference, and a
     preference should be. That line is structural rather than a rule anyone has to enforce: each
     card is its own drag context, so there is no target in the next one to land in.
     `gap: 0` - rows sit flush under a divider, so a row jumping a slot travels exactly its own
     height. Only the VISIBLE rows take part; a hidden row is not in the list you are arranging. */
  const drag = useListDrag({
    keys: shown.map((a) => a.id),
    attr: 'row',
    gap: 0,
    enabled: shown.length > 1,
    onCommit: onReorder,
    listRef: list,
  });

  return (
    /* `overflow-hidden` GOES AWAY WHILE ONE OF ITS ROWS IS IN THE AIR (Luke, v2 2026-08-04: "monarch
       lets the user grab the account and move it anywhere above the card... Run's is hidden inside
       the card. but that ui is not good"). The card clips so its rounded corners do not cut the
       divided rows, and a held row inherited that for free - a row you can only drag WITHIN a box
       does not read as picked up.
       `relative z-20` IN THE SAME BREATH, or the freed row slides UNDER the next card instead of
       over it, which looks worse than the clipping did. */
    <Card
      className={cn(
        drag.dragging ? 'relative z-20 overflow-visible' : 'overflow-hidden',
        /* LIFTED OFF THE STACK WHILE IT IS IN YOUR HAND: the accent ring says WHICH card, the
           bigger shadow says it is above the others, and the z-index from the drag's own style
           makes that literally true. Same two marks the held ROW wears, so the gesture reads the
           same at both levels. */
        held && 'ring-accent shadow-[var(--shadow-lift)] ring-2'
      )}
    >
      {/* THE WHOLE HEADER IS THE CONTROL. v2 splits this - a chevron on desktop so the rest of the
          header can be a drag handle, the whole bar on a phone - and that split arrives with the
          drag slice. Until then one control is honest and two would be furniture. */}
      {/* A DIV, NOT A BUTTON, AND THE SPLIT IS v2'S. A bar that toggles on click cannot also be a
          thing you pick up, because every drag would end in a toggle. So on a desktop the CHEVRON is
          the control and the rest of the bar is the handle; below `sm` there is no drag, so the
          whole header becomes one tap target via the absolutely-positioned button below it.
          `max-sm:pl-5` because the 12px inset exists to line the chevron up, and there is no chevron
          on a phone. */}
      {/* THE HEADER IS THE GRIP, NOT THE WHOLE CARD. A card whose body is a grab handle cannot have
          rows you can also grab, and the rows are the second level of this same gesture. The
          chevron inside it still works: the hook refuses any press that lands on a `<button>`,
          which is what stopped `setPointerCapture` from swallowing its click.
          `sm:cursor-grab` ONLY - the gesture is mouse-only at both levels, so a phone must not
          advertise a grab it will not honour. */}
      <div
        {...gripHandlers}
        className={cn(
          /* `min-h-12` ON A PHONE (2026-08-27). Measured at 390px: 60px of bar around 40px of
             content, and the chevron it was sized to clear is `sm:` only - so the floor was holding
             room for a control that is not there. 48px still clears the 44px tap floor for the
             full-bar button behind it, and at `all` (where there is no change line) it takes 12px
             off every group header on the page.
             `pl-4`, not `pl-5`: the rows underneath moved to a 16px gutter, and a header indented
             further than its own rows reads as a different column. */
          'relative flex min-h-15 w-full items-center gap-2 py-2 pr-5 pl-3 select-none max-sm:min-h-12 max-sm:pr-4 max-sm:pl-4',
          grabbable && 'sm:cursor-grab',
          held && 'sm:cursor-grabbing'
        )}
      >
        {/* PHONE: the whole bar. It sits behind the content in paint order and the content is not
            interactive, so nothing is blocked. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}
          className="absolute inset-0 sm:hidden"
        />
        {/* DESKTOP: a real button, so it is reachable by keyboard and cannot be swallowed by a drag
            that starts on the bar beside it. */}
        {/* `IconButton`, NOT A HAND-ROLLED COPY OF IT (2026-08-26, Luke: "the account cards
            show/hide button. that should be icon button. that doesn't have a muted icon"). This was
            `lift-press ... h-9 w-9 ... rounded-full` re-typed by hand WITH `text-muted
            hover:text-text` - which is the exact ink `icon-button.tsx` carries a comment about
            having removed, because it "sat every icon control in the product one ink tier down".
            The hand-rolled copy had preserved the bug the primitive was fixed to kill. */}
        <IconButton
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}
          className="hidden sm:flex"
        >
          <Icon name="chevron" className={cn('transition-transform', !open && '-rotate-90')} />
        </IconButton>
        {/* ONE SET OF NODES, TWO LAYOUTS. Rendering the total twice behind visibility classes puts
            the same money on the page twice and invites the two copies to drift. */}
        <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 sm:flex">
          {/* `text-title` (18px) FROM `sm`, `text-body-lg` (16px) BELOW IT. The pair is the loudest
              thing on the phone after the hero and it repeats once per group, so at 18px four card
              headings set the volume of the whole scroll. At 16 they still out-rank every row - the
              rows' own name is 16px at weight 400 and this is 16px at 500, on its own ground, with
              a money figure beside it - so the band still reads as a band. Both are roles from the
              ramp; this is a step down the scale, not a hand-picked size. */}
          <span className="text-title max-sm:text-body-lg text-text truncate font-medium sm:order-1">
            {title}
          </span>
          <span className="text-title max-sm:text-body-lg text-text shrink-0 font-medium tabular-nums sm:order-3 sm:ml-auto">
            {signed(total)}
          </span>
          {/* THE GROUP'S OWN CHANGE, over the same window the chart above is drawing — which is the
              whole reason the period control lives in a provider rather than on the card.
              PHONE: a second row under the title. DESKTOP: between the title and the total. One set
              of nodes, one direction change; rendering the total twice behind visibility classes
              puts the same money on the page twice and invites the two copies to drift. */}
          {hasWindow && (
            <span className="col-span-2 sm:order-2 sm:col-span-1">
              <TrendIndicator
                variant="group"
                cents={change}
                periodLabel={periodLabel}
                periodShort={periodShort}
                baseDollars={sizeBase(counted)}
              />
            </span>
          )}
        </span>
      </div>

      {/* `grid-rows` 0fr -> 1fr, NOT `max-height`. A max-height transition needs a number bigger
          than the content, which makes a two-row group animate at a different SPEED from a
          twenty-row one and clips outright if the guess is low. `invisible` when closed so the
          rows leave the tab order rather than only the view. */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className={cn(!drag.dragging && 'overflow-hidden', !open && 'invisible')}>
          {/* NO WRAPPER AROUND EACH ROW. `data-row`, the handlers and the transform all go on the
              `<a>` itself, which is what `:scope > [data-row]` measures - a wrapper would make the
              held element and the styled element two different boxes, and the ring would then be
              drawn around a box the row does not fill. */}
          <div ref={list} className="divide-rule border-rule divide-y border-t">
            {shown.map((a, i) => (
              <Row
                key={a.id}
                a={a}
                freshness={freshness.get(a.id) ?? null}
                held={drag.isHeld(a.id)}
                style={drag.styleFor(a.id, i)}
                handleProps={drag.handlers}
              />
            ))}
          </div>

          {hiddenRows.length > 0 && (
            <>
              <div
                className={cn(
                  'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
                  showHidden ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                )}
              >
                <div className={cn('overflow-hidden', !showHidden && 'invisible')}>
                  {/* HIDDEN ROWS SIT ON THE HOVER GROUND, so the list they were taken out of stays
                      legible as the list. */}
                  <div className="divide-rule border-rule bg-hover divide-y border-t">
                    {shown.length === 0 && null}
                    {/* NO GRIP ON A HIDDEN ROW. The flap is a place things are put, not a list you
                        arrange - and it is not in `keys`, so offering a handle would be a gesture
                        with no slot to land in. */}
                    {hiddenRows.map((a) => (
                      <Row
                        key={a.id}
                        a={a}
                        freshness={freshness.get(a.id) ?? null}
                        held={false}
                        handleProps={{}}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHidden((v) => !v)}
                aria-expanded={showHidden}
                className="border-rule text-body text-muted hover:text-text flex min-h-11 w-full items-center gap-2 border-t px-5 py-2 text-left transition-colors"
              >
                <Icon name="eye" size={16} className="shrink-0" />
                {showHidden ? 'Collapse' : 'Show'} {hiddenRows.length} hidden{' '}
                {hiddenRows.length === 1 ? 'account' : 'accounts'}
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

export function RosterCard({
  accounts,
  freshness,
  onAdd,
}: {
  accounts: RosterAccount[];
  freshness: Map<string, Date>;
  onAdd: () => void;
}) {
  /* NULL UNTIL STORAGE HAS BEEN READ, not the natural order as the initial value. The server
     renders the natural order, and reading `localStorage` during the first client render is a
     hydration mismatch. One frame of the natural order is the price, and it is the same trade the
     sidebar's collapse preference makes. */
  const [groupOrder, setGroupOrder] = useState<string[] | null>(null);
  const [rowOrder, setRowOrder] = useState<string[] | null>(null);
  const list = useRef<HTMLDivElement>(null);

  /* READ BACK WHAT WAS WRITTEN. v2 shipped this feature writing to `localStorage` and NOTHING EVER
     READ IT BACK - the order lived exactly as long as the React tree did, and Luke found it by
     navigating away and returning. The write is the easy half. */
  useEffect(() => {
    setGroupOrder(readOrder(GROUP_ORDER_KEY));
    setRowOrder(readOrder(ROW_ORDER_KEY));
  }, []);

  const natural = [...ACCOUNT_TYPE_ORDER, UNLABELLED_TYPE]
    .map((key) => ({
      key: key as string,
      title: key === UNLABELLED_TYPE ? UNLABELLED_TYPE_TITLE : ACCOUNT_TYPE_LABELS[key as AccountTypeKey],
      rows: accounts.filter((a) => (a.accountType ?? UNLABELLED_TYPE) === key),
    }))
    .filter((g) => g.rows.length > 0);

  const groups = byStoredOrder(natural, groupOrder, (g) => g.key).map((g) => ({
    ...g,
    rows: byStoredOrder(g.rows, rowOrder, (a) => a.id),
  }));

  const drag = useListDrag({
    keys: groups.map((g) => g.key),
    attr: 'group',
    // The `gap-4` between cards, so a card jumping a slot travels its own height plus the gap.
    gap: 16,
    enabled: groups.length > 1,
    onCommit: (keys) => {
      setGroupOrder(keys);
      writeOrder(GROUP_ORDER_KEY, keys);
    },
    listRef: list,
  });

  /* AFTER THE HOOKS, NEVER BEFORE THEM. An early return above `useState` would change the hook
     count between an empty roster and a populated one, which React rejects outright. */
  if (accounts.length === 0) return <EmptyRoster onAdd={onAdd} />;

  return (
    <div ref={list} className="flex flex-col gap-4">
      {groups.map((g, i) => (
        <div key={g.key} data-group={g.key} style={drag.styleFor(g.key, i)}>
          <Group
            title={g.title}
            rows={g.rows}
            freshness={freshness}
            held={drag.isHeld(g.key)}
            grabbable={groups.length > 1}
            gripHandlers={drag.handlers}
            onReorder={(ids) =>
              setRowOrder((prev) => {
                const next = mergeRowOrder(prev, ids);
                writeOrder(ROW_ORDER_KEY, next);
                return next;
              })
            }
          />
        </div>
      ))}

      {/* NOT IN THE DRAG LIST, and it cannot be: `:scope > [data-group]` is what the hook measures,
          and this carries no such attribute - so "you cannot drop a card below Add an account" is
          structural rather than a rule to enforce. Same reason the summary rail is safe. */}
      <AddSlot onClick={onAdd}>Add an account</AddSlot>
    </div>
  );
}

/* THE EMPTY ROSTER NAMES THE NEXT ACTION IN THE TRADER'S OWN WORDS (P9), and it names the thing
   Run does that nothing else does: it keeps the sessions the broker deletes. */
function EmptyRoster({ onAdd }: { onAdd: () => void }) {
  return (
    <Card className="flex flex-col items-center px-6 py-14 text-center">
      <span className="text-muted">
        <Icon name="accounts" size={24} />
      </span>
      <p className="text-body-lg text-text mt-4 font-medium">No accounts yet</p>
      <p className="text-body text-muted mt-1 max-w-sm leading-relaxed">
        Add an account and every fill lands here, including the ones Tradovate deletes when an
        account ends.
      </p>
      <span className="mt-5">
        <Button onClick={onAdd}>
          <Icon name="add" size={16} />
          Add account
        </Button>
      </span>
    </Card>
  );
}
