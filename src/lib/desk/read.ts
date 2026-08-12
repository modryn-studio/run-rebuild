// The desk call: two lenses read the same tape in parallel, one synthesizer speaks.
//
// The instruction is deliberately almost nothing. Every rule in the engine this replaces
// existed because someone predicted a failure rather than observing one, and that is how it
// ended up unable to notice anything it had not been told to look for. Constraints earn entry
// here by a named, reproducible test failure, not by anticipation.
//
// One rule survives day one, and it is a code check on the output rather than a prompt
// instruction, so it cannot shape what the model is able to see: NUMBERS COME FROM THE TAPE.
// That one is backed by an observed failure on real data, which is the same bar being demanded
// of every other rule.
//
// The em-dash pass is not a constraint either — it is a deterministic post-process that never
// reaches the model.
import { generateText } from 'ai';
import { anthropic } from '@/lib/ai';
import type { Tape } from './tape';
import { renderTape } from './render';

export const DESK_MODEL = 'claude-opus-5';
export const DESK_EFFORT = 'high' as const;

/** Output budget per call, and it is NOT a style choice — it is a correctness one.
 *
 *  ── THE FAILURE THAT SET IT ──────────────────────────────────────────────────────────────
 *  Unset, the SDK default is 4,096. At `effort: high` on the ten-day tape, Nathan spent all
 *  4,096 on thinking and returned an EMPTY STRING. The synthesizer then wrote from one lens
 *  instead of two, produced a coherent read, and nothing anywhere said a seat had been lost.
 *  A one-lens read that looks exactly like a two-lens read is the worst shape a failure can
 *  take, and it cost a whole regression run to find.
 *
 *  It hid on the small tape because both lenses thought for ~1,400 tokens there. Thinking
 *  scales with the material; the cap did not.
 *
 *  32,000 is deliberately far above the ~4,100 Nathan actually needed. Output is billed on what
 *  is USED, not on what is allowed, so a generous ceiling costs nothing and a tight one costs a
 *  silent truncation. Constraint 14's reasoning applies to the budget as well as to the prose:
 *  concise, but never capped. */
export const DESK_MAX_OUTPUT_TOKENS = 32_000;

/** Claude Opus 5, US dollars per million tokens, from Anthropic's pricing page 2026-08-12.
 *  Here rather than in a config because a cost report with stale rates is worse than none. */
export const RATES = {
  input: 5,
  cacheWrite5m: 6.25, // 1.25x
  cacheRead: 0.5, // 0.1x
  output: 25,
} as const;

export interface Usage {
  /** Uncached input — billed at the full rate. */
  inputTokens: number | null;
  /** Read from cache at 0.1x. Zero on the first call of a prefix. */
  cacheReadTokens: number | null;
  /** Written to cache at 1.25x. Non-zero only on the first call of a prefix. */
  cacheWriteTokens: number | null;
  /** Includes thinking tokens at `effort: high`, which caching never discounts. */
  outputTokens: number | null;
}

/** What this call actually cost, in dollars. Printed per call rather than summed at the end:
 *  the interesting number is the SPLIT — how much is uncached input, how much is cache read, and
 *  how much is output that no cache can touch. A single total hides all three.
 *
 *  ── FIXED: THIS OVER-REPORTED BY ~50% ON ANY CACHED CALL ─────────────────────────────────
 *  `inputTokens` from the SDK is the TOTAL input, and the cache figures are components of it,
 *  not additions to it. Billing the total AND the cache write charged the same 103,667 tokens
 *  twice — once at $5 and again at $6.25 — and turned a $2.00 run into a reported $3.04.
 *
 *  Measured on the deep run: inputTokens 103,669, cacheWriteTokens 103,667. The difference of
 *  two is the genuinely uncached remainder, which is what the base rate applies to.
 *
 *  A cost meter that reads high is not the safe direction to be wrong in. It makes a cheap thing
 *  look expensive and gets a useful run cancelled. */
export function costOf(u: Usage): number {
  const m = (tokens: number, rate: number) => (tokens / 1_000_000) * rate;
  const cacheRead = u.cacheReadTokens ?? 0;
  const cacheWrite = u.cacheWriteTokens ?? 0;
  // Clamped at zero: if a provider ever reports inputTokens as the uncached figure instead of
  // the total, this must not go negative and quietly credit the bill.
  const uncached = Math.max(0, (u.inputTokens ?? 0) - cacheRead - cacheWrite);
  return (
    m(uncached, RATES.input) +
    m(cacheRead, RATES.cacheRead) +
    m(cacheWrite, RATES.cacheWrite5m) +
    m(u.outputTokens ?? 0, RATES.output)
  );
}

export interface LensRead extends Usage {
  name: string;
  text: string;
  ms: number;
}

export interface NumberCheck {
  /** Numeric tokens in the final text that are not asserted anywhere in the tape. */
  unverified: string[];
  checked: number;
}

export interface DeskRead {
  text: string;
  lenses: LensRead[];
  synthesis: Usage & { ms: number };
  numberCheck: NumberCheck;
  totalMs: number;
  /** Every call's cost, summed. Reported rather than estimated, so a plan's arithmetic can be
   *  checked against what was actually billed instead of against a token-count guess. */
  costUsd: number;
}

// Deterministic safety net for the repo's no-em-dash rule on rendered copy. Deliberately does
// NOT touch U+2212, the money minus.
const sanitize = (s: string) => s.replace(/\s*[—–]\s*/g, ', ');

// Dates, clock times, durations, money, prices, percentages and bare numbers — ordered most
// specific first so a figure is captured WHOLE. Order is the whole point: the first version
// led with the number branch, so `09:15:52` arrived as three separate unverifiable tokens
// ("09", "15", "52") and every clock time in a read produced three phantom failures.
//
// Two more shapes were being shredded by the old `\$?\d[\d,]*\.?\d*`, both because a comma or
// period could terminate the match with nothing after it: `$190,` and `$80.` were flagged as
// unverified when the tape holds `$190` and `$80` and the punctuation belonged to the
// sentence. A comma must now be followed by exactly three digits, and a decimal point by at
// least one.
const NUMBER_TOKEN =
  /\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}(?::\d{2})?|\d+m ?\d+s|\d+s\b|\$?\d{1,3}(?:,\d{3})+(?:\.\d+)?%?|\$?\d+(?:\.\d+)?%?/g;

// Sentence-level formatting a tape can never contain but a writer will always produce.
const IGNORE = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);

// SPELLED-OUT FIGURES ARE CLAIMS TOO, and they bypassed the check completely until a wrong
// one rode through: "eighteen of twenty-one positions were closed by a stop you had already
// placed", on a day whose true count was fourteen. Neither word was flagged, because neither
// is a digit. A number is a claim whether it is typed in digits or spelled.
//
// Small values stay ignorable for the same reason their digit forms are: "one thing", "say
// two words". Everything above ten is doing work in a sentence and gets checked.
const ONES = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const WORD_NUMBER = new RegExp(
  `\\b(?:(?:${Object.keys(TENS).join('|')})(?:[-\\s](?:${ONES.slice(1, 10).join('|')}))?|${ONES.join('|')})\\b`,
  'gi'
);

function spelledToNumber(raw: string): number | null {
  const s = raw.toLowerCase().replace(/\s+/g, '-');
  const [a, b] = s.split('-');
  if (a in TENS) return TENS[a] + (b ? ONES.indexOf(b) : 0);
  const i = ONES.indexOf(a);
  return i >= 0 ? i : null;
}

// OBSERVE-ONLY while the tolerance is unknown. A strict check would reject "one session, seven
// trades" and "the next 26 minutes" — true statements whose figures are derived rather than
// quoted — fall back to the old engine, and leave the early phases measuring this regex rather
// than the model. Log what it would have caught; enforce once the log says what the real
// tolerance is.
// The tape's figures as numbers, so a quoted figure can be recognised through the writer's
// rounding. Cached because a ten-day tape asserts thousands of them.
const NUMERIC_CACHE = new WeakMap<Tape, number[]>();
function numericWhitelist(tape: Tape): number[] {
  let xs = NUMERIC_CACHE.get(tape);
  if (!xs) {
    xs = [...tape.verifiedNumbers].map((s) => Number(s.replace(/[$,]/g, ''))).filter((n) => Number.isFinite(n));
    NUMERIC_CACHE.set(tape, xs);
  }
  return xs;
}

// ROUNDING IS QUOTING, NOT INVENTING. "$623" for a tape figure of $622.50, or "56" for 56.50,
// is a writer being readable, and treating it as an unverified number buried the real signal:
// of 100 flags across Phase 3, none was a fabrication and nearly all were this.
//
// A token is accepted when some tape figure, reduced to the token's OWN precision by either
// rounding or truncation, equals it. Both, because a writer does both: 622.50 rounds to 623,
// and 56.50 truncates to 56.
function matchesRounded(tok: string, tape: Tape): boolean {
  const n = Number(tok.replace(/[$,%]/g, ''));
  if (!Number.isFinite(n)) return false;
  const dot = tok.indexOf('.');
  const d = dot === -1 ? 0 : tok.replace(/[$,%]/g, '').length - dot;
  const p = 10 ** d;
  for (const v of numericWhitelist(tape)) {
    if (Math.round(v * p) / p === n || Math.trunc(v * p) / p === n) return true;
  }
  return false;
}

export function checkNumbers(text: string, tape: Tape): NumberCheck {
  const found = text.match(NUMBER_TOKEN) ?? [];
  const unverified: string[] = [];
  for (const raw of found) {
    const tok = raw.trim();
    if (IGNORE.has(tok)) continue;
    if (tape.verifiedNumbers.has(tok)) continue;
    // Money written without the symbol, or a price written with commas.
    const bare = tok.replace(/[$,]/g, '');
    if (tape.verifiedNumbers.has(bare) || tape.verifiedNumbers.has(`$${bare}`)) continue;
    if (matchesRounded(tok, tape)) continue;
    unverified.push(tok);
  }

  const spelled = text.match(WORD_NUMBER) ?? [];
  for (const raw of spelled) {
    const n = spelledToNumber(raw);
    if (n === null || n <= 10) continue;
    if (tape.verifiedNumbers.has(String(n))) continue;
    if (matchesRounded(String(n), tape)) continue;
    unverified.push(`${raw} (${n})`);
  }

  return { unverified: [...new Set(unverified)], checked: found.length + spelled.length };
}

// The AI SDK reports cache tokens on a nested detail object. Read defensively: a missing field
// must show as null, never as a zero, because "the cache did nothing" and "we could not see what
// the cache did" are different findings and a zero would silently claim the first.
type UsageLike = {
  inputTokens?: number;
  outputTokens?: number;
  inputTokenDetails?: { cacheReadTokens?: number; cacheWriteTokens?: number };
};
const readUsage = (u: UsageLike | undefined): Usage => ({
  inputTokens: u?.inputTokens ?? null,
  outputTokens: u?.outputTokens ?? null,
  cacheReadTokens: u?.inputTokenDetails?.cacheReadTokens ?? null,
  cacheWriteTokens: u?.inputTokenDetails?.cacheWriteTokens ?? null,
});

async function callLens(name: string, system: string, tape: string): Promise<LensRead> {
  const t0 = Date.now();
  const { text, usage, finishReason } = await generateText({
    model: anthropic(DESK_MODEL),
    system,
    maxOutputTokens: DESK_MAX_OUTPUT_TOKENS,
    // CACHED, AND THE CONTENT IS BYTE-IDENTICAL TO WHAT `prompt:` PRODUCED.
    //
    // The tape is the same 55k+ tokens on every run, so re-sending it at full price to ask the
    // same question twice is pure waste: a cache read is 0.1x. Marking it costs nothing and
    // changes nothing the model sees — same role, same order, one text block, same string. That
    // matters because the first thing this pipeline has to do is pass a REGRESSION test, and a
    // restructured request would be another variable in it.
    //
    // The cached prefix is system + this block, so each lens caches separately (their systems
    // differ) and a second run of the same lens on the same tape hits. Reads refresh the TTL, so
    // sequential runs stay warm inside the 5-minute window.
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `${tape}\n\nSay one thing.`,
            providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
          },
        ],
      },
    ],
    providerOptions: { anthropic: { effort: DESK_EFFORT } },
  });
  const out = text.trim();
  // A LENS THAT SAYS NOTHING MUST STOP THE RUN, not quietly reduce the desk to one seat.
  // This is the whole lesson of the run that found it: the synthesizer accepted an empty
  // colleague, wrote a confident read from the survivor, and every downstream signal — cost,
  // timing, number check, the prose itself — looked normal. Nothing is more dangerous in this
  // architecture than a failure that reads as a success.
  if (!out) {
    throw new Error(
      `Lens "${name}" returned no text (finishReason: ${finishReason}, ` +
        `output tokens: ${usage?.outputTokens ?? '?'}). Its entire budget went to thinking. ` +
        `Raise DESK_MAX_OUTPUT_TOKENS rather than accepting a one-lens read.`
    );
  }
  if (finishReason === 'length') {
    throw new Error(
      `Lens "${name}" was truncated at ${usage?.outputTokens ?? '?'} output tokens. ` +
        `A half-written read is worse than none, because it still looks like a read.`
    );
  }
  return { name, text: out, ms: Date.now() - t0, ...readUsage(usage) };
}

// The synthesizer gets the tape as well as the two reads, for the same reason a parent session
// holds the original context when its subagents report back: it has to be able to tell which
// read the record actually supports.
//
// Three constraints, and each one earned entry by something observed in a real run rather than
// anticipated (Luke, after reading Phase 1's output):
//   - PLAIN LANGUAGE. The reads were accurate and needlessly hard, e.g. "roughly self-funding
//     at $2 a point" for "cheap while you were trading micros".
//   - CONCISE. Length was not capped and must not be: capping would have cut the best line in
//     the ten-day read. Density is the fix, not a word limit.
//   - NO SELF-REFERENCE. One read opened "Run here. One thing." A product that announces
//     itself is a product introducing a character, and the trader did not ask to meet one.
// Nothing here says what to notice, which is the line these must not cross.
const SYNTH_SYSTEM = `You are writing to the trader whose record this is. Two colleagues have each
read it and written to you. Neither of them speaks to him; you do. Say one thing.

Write the way a good teacher explains something to someone smart who is new to the words. Short
sentences. Plain language over jargon whenever plain language is just as exact. Say it in as few
words as it takes, and no fewer.

Never name or refer to yourself, and never announce that you are about to say something. Just say
it.`;

export async function deskRead(tape: Tape, lenses: { name: string; prompt: string }[]): Promise<DeskRead> {
  const started = Date.now();
  const rendered = renderTape(tape);

  const reads = await Promise.all(lenses.map((l) => callLens(l.name, l.prompt, rendered)));

  const t0 = Date.now();
  // NOT CACHED, deliberately. The tape is a shared prefix here too, but the lens outputs that
  // follow it differ on every run, so caching the tape portion means splitting this into two
  // content blocks — a real change to the request shape. That waits until after the regression
  // has a baseline. It is one third of the input and the cheapest third to leave on the table.
  const { text, usage } = await generateText({
    model: anthropic(DESK_MODEL),
    system: SYNTH_SYSTEM,
    maxOutputTokens: DESK_MAX_OUTPUT_TOKENS,
    prompt: `${rendered}\n\n${reads.map((r) => `--- ${r.name} ---\n${r.text}`).join('\n\n')}`,
    providerOptions: { anthropic: { effort: DESK_EFFORT } },
  });
  const final = sanitize(text.trim());
  const synthesis = { ms: Date.now() - t0, ...readUsage(usage) };

  return {
    text: final,
    lenses: reads,
    synthesis,
    numberCheck: checkNumbers(final, tape),
    totalMs: Date.now() - started,
    costUsd: [...reads, synthesis].reduce((s, u) => s + costOf(u), 0),
  };
}
