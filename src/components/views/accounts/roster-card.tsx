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

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { fmtMoney } from '@/lib/format';
import {
  ACCOUNT_TYPE_LABELS,
  accountRowTitle,
  statusLabel,
  type AccountTypeKey,
} from '@/lib/prop-firms';
import type { RosterAccount } from '@/lib/accounts/read';
import { AccountLogo } from './account-logo';
import { TrendIndicator, sizeBase } from './trend-indicator';
import { useChartView } from './chart-view';

/** Consequences first. An account with no type yet lands in its own group at the foot. */
const GROUP_ORDER: AccountTypeKey[] = ['sim_funded', 'evaluation', 'personal'];
const UNLABELLED = 'unlabelled';
const UNLABELLED_TITLE = 'Not yet labelled';

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
    <svg width={72} height={20} className="overflow-visible" aria-hidden>
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

function Row({ a, freshness }: { a: RosterAccount; freshness: Date | null }) {
  const { shapeFor } = useChartView();
  const spark = shapeFor(a.id);
  const named = Boolean(a.displayName || a.propFirm);
  const stamp = ago(freshness);

  return (
    /* A LINK, NOT A BUTTON. v2 shipped this as a button that opened the rename modal, which was an
       accident of the row having nothing else to do; a row that stands for an object should open
       the object. A real `<a>` so middle-click, cmd-click and open-in-new-tab all work. */
    <Link
      href={`/accounts/details/${a.id}`}
      /* `pl-7`, NOT `px-5` — v2's measured inset. The extra 8px is the lane the drag grip occupies,
         and it is claimed now rather than when drag lands so the rows do not all shift sideways the
         day it does. `min-h-21` (84px) is a FLOOR, not a height: a wrapping name grows the row. */
      className="group/row hover:bg-hover relative flex min-h-21 w-full items-center gap-5 py-3 pr-5 pl-7 text-left transition-colors select-none"
    >
      <AccountLogo propFirm={a.propFirm} />

      <span className="min-w-0 flex-1">
        {/* A ROW IS ONE SIZE (`design-system.md` §2a). v2 ran four sizes across three tiers here -
            `text-body-lg` name, `text-body` sub-line, `text-small text-faint` stamp - and this
            build deleted the third ink tier outright. So the row is `text-body-lg` throughout and
            everything secondary is MUTED rather than smaller. */}
        <span className={cn('text-body-lg block truncate', named ? 'text-text' : 'text-muted')}>
          {accountRowTitle(a)}
        </span>
        {/* THE PROMPT IS THE SUB-LINE ITSELF, never a second element beside it. An unnamed account
            asks to be named in the one slot that would otherwise repeat what the figure says. */}
        <span className="text-body text-muted block truncate">
          {a.productName ??
            (named ? `${a.trades.toLocaleString('en-US')} trades` : 'Name this account')}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-4 sm:gap-6">
        <span className={cn('shrink-0', a.status === 'active' && 'hidden sm:block')}>
          <StatusChip status={a.status} />
        </span>

        {/* AT LEAST TWO POINTS, OR THERE IS NO SHAPE TO DRAW. One session is a dot, and a dot in a
            column of lines reads as a rendering failure rather than as a short history. */}
        {spark.length >= 2 && (
          <span className="hidden shrink-0 sm:block">
            <Spark curve={spark.map((p) => p.cents)} />
          </span>
        )}

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
          <span className="text-body-lg text-text block font-medium tabular-nums">
            {signed(a.netCents)}
          </span>
          {/* THE STAMP ANSWERS WHAT THE FIGURE CANNOT: a number with no timestamp cannot tell you
              whether it is this morning's or last month's. This is P5, the direct answer to the
              field's defining failure. */}
          {/* A TIER BELOW THE FIGURE. v2 sets `text-small text-faint`; `faint` was deleted here
              (two content tiers, not three) so this is `text-caption text-muted`, which is the same
              IDEA in this build's scale. At `text-body` it competed with the money above it. */}
          {stamp && <span className="text-caption text-muted block">{stamp}</span>}
        </span>
      </span>
    </Link>
  );
}

function Group({
  title,
  rows,
  freshness,
}: {
  title: string;
  rows: RosterAccount[];
  freshness: Map<string, Date>;
}) {
  const [open, setOpen] = useState(true);
  const [showHidden, setShowHidden] = useState(false);

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

  return (
    <Card className="overflow-hidden">
      {/* THE WHOLE HEADER IS THE CONTROL. v2 splits this - a chevron on desktop so the rest of the
          header can be a drag handle, the whole bar on a phone - and that split arrives with the
          drag slice. Until then one control is honest and two would be furniture. */}
      {/* A DIV, NOT A BUTTON, AND THE SPLIT IS v2'S. A bar that toggles on click cannot also be a
          thing you pick up, because every drag would end in a toggle. So on a desktop the CHEVRON is
          the control and the rest of the bar is the handle; below `sm` there is no drag, so the
          whole header becomes one tap target via the absolutely-positioned button below it.
          `max-sm:pl-5` because the 12px inset exists to line the chevron up, and there is no chevron
          on a phone. */}
      <div className="relative flex min-h-15 w-full items-center gap-2 py-2 pr-5 pl-3 select-none max-sm:pl-5">
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
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}
          className="lift-press text-muted hover:text-text hidden h-9 w-9 shrink-0 items-center justify-center rounded-full sm:flex"
        >
          <Icon
            name="chevron"
            size={16}
            className={cn('transition-transform', !open && '-rotate-90')}
          />
        </button>
        {/* ONE SET OF NODES, TWO LAYOUTS. Rendering the total twice behind visibility classes puts
            the same money on the page twice and invites the two copies to drift. */}
        <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 sm:flex">
          <span className="text-title text-text truncate font-medium sm:order-1">{title}</span>
          <span className="text-title text-text shrink-0 font-medium tabular-nums sm:order-3 sm:ml-auto">
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
        <div className={cn('overflow-hidden', !open && 'invisible')}>
          <div className="divide-rule border-rule divide-y border-t">
            {shown.map((a) => (
              <Row key={a.id} a={a} freshness={freshness.get(a.id) ?? null} />
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
                    {hiddenRows.map((a) => (
                      <Row key={a.id} a={a} freshness={freshness.get(a.id) ?? null} />
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
  if (accounts.length === 0) return <EmptyRoster onAdd={onAdd} />;

  const groups = [...GROUP_ORDER, UNLABELLED]
    .map((key) => ({
      key,
      title: key === UNLABELLED ? UNLABELLED_TITLE : ACCOUNT_TYPE_LABELS[key as AccountTypeKey],
      rows: accounts.filter((a) => (a.accountType ?? UNLABELLED) === key),
    }))
    .filter((g) => g.rows.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <Group key={g.key} title={g.title} rows={g.rows} freshness={freshness} />
      ))}

      {/* THE ONLY DASHED THING ON THE PAGE, and it earns it: a dashed edge reads as a slot waiting
          to be filled rather than as an object that exists. */}
      <button
        type="button"
        onClick={onAdd}
        className="border-border text-body text-muted hover:text-text hover:border-muted flex min-h-14 w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed font-medium transition-colors"
      >
        <Icon name="add" size={16} />
        Add an account
      </button>
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
