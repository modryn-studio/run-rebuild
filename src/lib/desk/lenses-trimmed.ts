// THE TRIM — an A/B arm, not a rewrite.
//
// The question: how much of `HOW YOU SPEAK` is doing work, given that a lens writes to the
// SYNTHESIZER and never to the trader? The synthesizer rewrites everything under its own three
// rules, so anything in a lens that only shapes how it SOUNDS is spent tokens — and the twelve
// quotable phrases are worse than spent, because a quotable phrase in context is an invitation
// to emit it as if it were a finding.
//
// The wider argument is Anthropic's own: their team deleted more than 80% of Claude Code's
// system prompt when Opus 5 landed and the model got better, and their standing advice is to
// spend engineering effort on verification rather than instruction. This codebase already
// agrees from the other direction — a constraint earns entry only by a named, observed failure.
// The corollary nobody wrote down is that a constraint should LEAVE when a run shows it was
// carrying nothing.
//
// ── WHAT IS CUT AND WHAT IS KEPT ─────────────────────────────────────────────────────────
// CUT: pure register ("you sound like a performance coach", "blunt, numerate") and both
//      `Phrases that reflect how you talk` blocks.
// KEPT: every line that changes WHAT gets said rather than how it reads —
//      "name the mechanism rather than the mood", "separate what happened from what it means",
//      "neither congratulate nor scold", "price it or drop it", "quote the arithmetic",
//      "ask for the number you are missing".
//
// ── BUILT BY SURGERY, DELIBERATELY ───────────────────────────────────────────────────────
// The trimmed prompts are produced by REMOVING exact substrings from the originals rather than
// by being retyped. Two reasons, and the second is the important one:
//   1. Every kept word is provably byte-identical, so the arm differs only by the cut.
//   2. A missing substring THROWS. A retyped prompt that silently drifted, or a cut that
//      silently failed to apply, would produce an experiment measuring nothing while looking
//      like it measured something — which is the failure this whole project keeps meeting.
import { NATHAN_LENS, HOLLIS_LENS } from './lenses';

function cut(source: string, name: string, fragments: string[]): string {
  let out = source;
  for (const f of fragments) {
    if (!out.includes(f)) {
      throw new Error(
        `Trim for ${name} did not apply: fragment not found in the source prompt.\n` +
          `The originals have changed, so this arm is no longer the same experiment.\n---\n${f.slice(0, 120)}…`
      );
    }
    out = out.replace(f, '');
  }
  // Collapse the blank runs the cuts leave, so the trimmed prompt reads as written prose rather
  // than as something with holes in it.
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

const NATHAN_REGISTER = `Calm, precise, evidence-anchored. You sound like a performance coach who has sat behind real
traders on real red days, not a motivational speaker. Warm about the trader, ruthless about the
method.

`;

const NATHAN_PHRASES = `
**Phrases that reflect how you talk:**

- "That's a scold wearing a friendly font."
- "He won't journal. Losing traders never do. Build on what the tape already knows."
- "One session describes a day. It does not describe a man."
- "The market made that decision, not him. Don't hand him credit he didn't earn."
- "What would he argue with? That's the only read worth his attention."
- "Does it work, or does it just feel like it works? Those aren't the same thing."`;

const HOLLIS_REGISTER = `Blunt, numerate, unimpressed by outcomes. You quote the arithmetic rather than describing it. You
are neither alarmed nor reassuring — you are precise.

`;

// Kept from the cut register line, because "quote the arithmetic rather than describing it"
// changes what appears on the page — figures instead of adjectives — and is not a tone note.
const HOLLIS_REGISTER_REPLACEMENT = `You quote the arithmetic rather than describing it.

`;

const HOLLIS_PHRASES = `
**Phrases that reflect how you talk:**

- "An unpriced risk is a feeling."
- "He got a good result. I'm asking whether he'd survive that same decision twenty times."
- "What's your daily loss limit? Not a feeling, a number."
- "Same sentence, tenfold difference. Price it in his instrument before you call it risk."
- "Nothing here is materially risky, and saying otherwise would be manufactured concern."
- "Survival is the precondition. Everything else is decoration."`;

export const NATHAN_LENS_TRIMMED = cut(NATHAN_LENS, 'Nathan', [NATHAN_REGISTER, NATHAN_PHRASES]);

export const HOLLIS_LENS_TRIMMED = cut(
  HOLLIS_LENS.replace(HOLLIS_REGISTER, HOLLIS_REGISTER_REPLACEMENT),
  'Hollis',
  [HOLLIS_PHRASES]
);
