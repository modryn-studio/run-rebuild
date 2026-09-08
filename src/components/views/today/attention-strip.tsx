'use client';

/* THE LANE - one row above the grid, for the things only the trader can answer.
 *
 * `monarch-dashboard-teardown.md` §A15. Modelled on the reference's mobile "Let's review some
 * transactions" banner: chrome above the widget grid rather than a widget in it, absent on the days
 * it has nothing to say, and gone the moment the data resolves.
 *
 * ─── THE REFERENCE'S GEOMETRY, NOT THE REFERENCE'S FILL, AND THE TWO ARE SEPARABLE ───────────
 *
 * This bar was built recessed, filled with the accent on 2026-09-08 at Luke's instruction, then
 * reverted to recessed the same day once BOTH products were read off their markup. The round trip
 * is the reason this note is long: the conclusion is cheap to state and was expensive to reach.
 *
 * WHAT THE MARKUP SAID. Monarch splits three jobs across three hues, read live 2026-09-08:
 *
 *   data, the performance line        cyan       #00a2c7   (their /accounts chart SVG)
 *   default primary control           near-black #222221   (Enable credit score, Resume, Customize)
 *   brand and attention               orange     #ff692d   (the review banner, one CTA)
 *
 * **Their banner is loud because orange appears nowhere in their data.** That is the precondition,
 * and it is the part that does not travel: Run has ONE accent by an explicit decision - `globals.css`
 * calls pine *"the product's one accent (Rams, validated cold twice)"* - and that one accent is
 * already `Button` primary, the selection state, the switch, the badge, the chart's gradient and its
 * hover dot: 23 `bg-accent` fill sites. `/today` and `/accounts` share ONE `Plot`, stroked
 * `var(--color-accent)`, verified live at `rgb(86,183,155)` on both.
 *
 * SO A PINE BAR IS NOT THE ONLY PINE OBJECT. It is the largest one, sitting ~200px above a chart
 * line drawn in the identical token - not `dE 0.040` from it as Rams estimated, but `dE 0`.
 * Porting the fill without the palette structure under it is taking the artifact and leaving the
 * precondition, which is the error `§A13` and `§A14` were each written to catch.
 *
 * WHAT THE ROUND TRIP ACTUALLY FIXED, because it was not wasted. The first recessed version was a
 * thin 56px row with a 16px mark, and Luke was right that it was too quiet. The geometry pass is
 * what answered that, and it survives the revert: 72px, a 24px mark, a `text-body-lg` title over a
 * `text-body` note, the position in the stack's header, a two-button footer. The fill was solving a
 * problem the geometry had already solved.
 *
 * WHAT CARRIES THE ATTENTION INSTEAD. Position and absence. The bar sits above the headline figure
 * in a slot nothing else ever occupies, and it is not there on the days it has nothing to ask -
 * appearing at all is the signal. It is also the only RECESSED object on a page of raised cards
 * (`--color-surface-2`: *"a recessed slot, never raised"*), which is a category signal costing no
 * token. Monarch buys saturation on top of position because their banner competes with twelve
 * widgets on a scrolling dashboard; this competes with two cards.
 *
 * WHEN TO REOPEN THIS. When Run has a message that earns a loud hue - the self-set daily loss line
 * breached, an account near failing. `warn` exists for exactly that and is documented as the
 * red-zone gauge, and slot 3 IS the loss line. Filed as a GitHub issue rather than left as a
 * comment, so the palette is revisited against a message that deserves it instead of on housekeeping.
 *
 * ─── ONE LANE, AND TODAY IT HAS EXACTLY ONE TENANT ───────────────────────────────────────
 *
 * The lane was built general at Luke's instruction (2026-09-08), against a second tenant that has
 * since been ruled out: the quarantine notice was the intended one, and `§A14` sent it to the
 * OPERATOR instead. Three of the four quarantine reasons are Run defects a trader cannot resolve,
 * and A14's rule is the one that decides tenancy here:
 *
 *   "Before porting a card, ask WHO resolves the uncertainty it exists to resolve. A queue whose
 *    remedy lives with the operator is a support ticket wearing a card's clothes."
 *
 * ACCOUNTS PASSES THAT TEST AS CLEANLY AS ANYTHING COULD. Type, firm, size and "did this evaluation
 * end" are unresolvable by the operator BY DEFINITION - there is no file, no API and no support
 * inbox that can answer them. The person holding the phone is the only one who knows, which is
 * exactly the condition that makes the reference's card work on the reference's product.
 *
 * SO THE `numbers` TONE BELOW IS SPECIFIED AND UNOCCUPIED. Rams settled its vocabulary - the mark
 * differs and so does the SHAPE, because `finding-notice.tsx` already ruled that "colour alone would
 * put the whole distinction on the one axis a colourblind trader cannot use" - and the priority rule
 * is quarantine-class first, since a row that qualifies the figures is read before one that does
 * not. It costs one prop to keep and it is not a claim that a tenant exists.
 *
 * IF A SECOND TENANT EVER ARRIVES, BOTH ROWS RENDER. No counter, no "and 1 more", no collapse:
 * folding rows into a count is the backlog sentence §A15 struck, in fewer characters.
 *
 * THE CHEVRON IS NOT DECORATION. It appears only when the tap goes somewhere. Every item this
 * tenant raises is answerable, so it always draws one here; a tenant whose row has no remedy must
 * not.
 */

import { useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { AttentionStack } from './attention-stack';
import type { AttentionItem } from '@/lib/accounts/attention';

export function AttentionStrip({ items }: { items: AttentionItem[] }) {
  /* THE SNAPSHOT LIVES HERE, NOT IN THE STACK. Every save inside the flow calls `router.refresh()`,
     which re-reads this page and hands back a SHORTER list - so a stack reading the live prop would
     renumber and reorder itself under the trader's thumb between one card and the next. Taken on
     open, discarded on close, which is also why it is not a `useMemo`. */
  const [open, setOpen] = useState<AttentionItem[] | null>(null);

  /* NOTHING TO SAY, NOTHING ON SCREEN. `spec.md` §S9b's rule for the sibling surface, and the same
     reasoning: a permanent "0 to answer" row is a status light for a condition that is normal. */
  if (items.length === 0 && open === null) return null;

  const n = items.length;

  return (
    <>
      {n > 0 && (
        <AttentionRow
          tone="answer"
          title="Let's review your accounts"
          note={`${n} to check`}
          onClick={() => setOpen(items)}
        />
      )}

      {open && <AttentionStack items={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/**
 * ONE ROW OF THE LANE, and the shared part every tenant wears.
 *
 * Separated from the accounts tenant above so a second tenant can move in without redesigning the
 * lane, and so `/kitchen-sink` can rack both tones side by side without opening a flow that writes
 * to the database.
 *
 * `answer`  - we need a fact only you have. Nothing below is wrong.
 * `numbers` - something is out of the figures below, and they should be read differently.
 *
 * THE MARK CARRIES THE DISTINCTION, NOT THE GROUND, and the SHAPE differs as well as the colour -
 * `finding-notice.tsx`: "Colour alone would put the whole distinction on the one axis a colourblind
 * trader cannot use." One ground means the lane reads as one lane.
 */
export function AttentionRow({
  tone,
  title,
  note,
  onClick,
}: {
  tone: 'answer' | 'numbers';
  title: string;
  note: string;
  /** Omitted when the row leads nowhere, which is also what withholds the chevron. */
  onClick?: () => void;
}) {
  const answer = tone === 'answer';

  const inner = (
    <>
      {/* THE MARK LEADS, AT THE TOP OF THE NAMED SCALE (24px: 13 / 16 / 20 / 22 / 24). The reference
          sets theirs at roughly 47% of the banner's height, which would be ~32px here - off the
          scale, and `design-system.md`'s rule is that a value not in the system gets added to the
          system first rather than typed at a call site. 24 is the largest legal mark and it holds
          the same role: the banner's subject, stated before its sentence.
          THIS IS ALSO WHERE THE ACCENT IS SPENT, and it is the whole of it. A pine glyph on a
          recessed ground says "the lane's subject"; a pine GROUND would say what the chart below it
          already says in the same token. */}
      <Icon
        name={answer ? 'accounts' : 'warn'}
        size={24}
        className={cn('shrink-0', answer ? 'text-accent' : 'text-neg')}
      />
      <span className="min-w-0 flex-1">
        {/* ONE TYPE SIZE FOR THE ROW, WHICH IS THE SYSTEM'S OWN RULE and was being broken here.
            `design-system.md` §2a: "A row is ONE type size; chrome is never smaller than the content
            it controls." This was `text-body-lg` over `text-body`, which read as a heading with a
            caption under it and was most of why the bar stood 72px tall. Both lines are `text-body`
            now and the rank is carried the way the rest of the app carries it: weight and ink.
            PROSE IS `text`, CHROME IS `muted` - two tiers, never three. */}
        <span className="text-body text-text block font-medium">{title}</span>
        <span className="text-body text-muted block">{note}</span>
      </span>
      {onClick && <Icon name="chevron" size={20} className="text-muted shrink-0 -rotate-90" />}
    </>
  );

  /* THE GEOMETRY IS THE REFERENCE'S, IN RUN'S OWN STEPS. Theirs is a full-width rounded bar roughly
     11.7% of the screen's width tall, with the mark, a two-line block and a chevron on one baseline
     and padding about equal to the mark. Here: `--radius` (12px, "a slot"), `px-4 py-3.5`, and a
     24px mark over a 40px text block, which lands the bar at 68px.
     NOT A CARD, STILL. No border and no shadow on either branch: `Card` is the only thing in this
     system that gets the shadow, and a control gets a border OR a shadow, never both. */
  /* THE GEOMETRY, MEASURED AGAINST THE REFERENCE'S OWN BANNER (Luke, 2026-09-08: *"monarch's banner
     is tighter up to the header... not as tall"*).
     60px, DOWN FROM 72. Two 20px lines and `py-2.5`. The height came off the type first - one size
     for the row rather than 16-over-14 - and only then off the padding, because shrinking padding
     around oversized type would have made it cramped rather than shorter.
     `mt-2`, DOWN FROM `mt-4`. Measured live: this margin COLLAPSES THROUGH the page column (the
     bar is its first child and the column has no top padding), so it is not decoration between two
     boxes - it is the whole gap between the header band and the bar, and halving it is what
     "tighter up to the header" actually costs.
     STILL NOT A CARD. No border, no shadow: `Card` is the only thing here that gets the shadow, and
     a control gets a border OR a shadow, never both. */
  const base =
    'bg-surface-2 mt-2 flex w-full items-center gap-3.5 rounded-[var(--radius)] px-4 py-2.5 text-left';

  if (!onClick) return <div className={base}>{inner}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(base, 'hover:bg-hover transition-colors')}
    >
      {inner}
    </button>
  );
}

/* THE COPY IS THE REFERENCE'S SHAPE, AND IT USED TO BE TWICE THE LENGTH.
 *
 * Theirs:  `Let's review some transactions` over `2 remaining`
 * Ours:    `Let's review your accounts`     over `5 to check`
 *
 * WHAT CHANGED AND WHY (Luke, 2026-09-08: *"is our copy overboard? we should be keeping it
 * simple"*). It read `5 accounts need you` over `2 new, 3 not in your last import.` - which put the
 * count in the TITLE and a breakdown in the sub, inverting the reference's structure and saying in
 * eleven words what they say in two. The breakdown was also answering a question nobody has yet:
 * which kind each one is, is what the first card says.
 *
 * `to check`, NOT `remaining`. The one word of theirs that does not come across. A count of what is
 * left undone is a backlog by another spelling, and `CLAUDE.md` bans that state by name; `to check`
 * counts the same items without telling the trader they are behind on them.
 *
 * THE TITLE CARRIES NO NUMBER, so it does not need a plural branch and does not restate the sub.
 */
