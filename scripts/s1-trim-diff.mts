// What exactly does the trim remove? Free, and it runs the surgery so a broken cut throws here
// rather than mid-experiment.
const { NATHAN_LENS, HOLLIS_LENS } = await import('../src/lib/desk/lenses');
const { NATHAN_LENS_TRIMMED, HOLLIS_LENS_TRIMMED } = await import('../src/lib/desk/lenses-trimmed');
for (const [name, full, trimmed] of [
  ['Nathan', NATHAN_LENS, NATHAN_LENS_TRIMMED],
  ['Hollis', HOLLIS_LENS, HOLLIS_LENS_TRIMMED],
] as const) {
  const cutPct = ((1 - trimmed.length / full.length) * 100).toFixed(1);
  console.log(`${name}: ${full.length} -> ${trimmed.length} chars  (-${cutPct}%)`);
  for (const line of ['name the mechanism', 'congratulate nor scold', 'separate what happened',
                      'price it or you drop it', 'quote the arithmetic', 'number you are missing',
                      'Phrases that reflect', 'performance coach', 'Blunt, numerate']) {
    if (full.includes(line)) console.log(`   ${trimmed.includes(line) ? 'KEPT' : 'CUT '}  "${line}"`);
  }
}
