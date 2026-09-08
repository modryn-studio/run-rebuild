/* THE BUILD PROVES ITS OWN SOURCE IS READABLE, because on 2026-09-08 three files were not and
 * nothing anywhere said so.
 *
 * `src/lib/fees/allocate.ts`, `src/lib/intake/statement.ts` and `src/lib/next-path.ts` each carried
 * a RAW control byte inside a string or a regex - a literal NUL as a composite-key separator, and
 * literal 0x1f / 0x7f inside `safeNext`'s character class. Every one of them compiled, passed lint,
 * and behaved correctly at runtime. What they did not do is show up in a search: `grep` and
 * `ripgrep` classify a file containing a NUL as binary and skip it entirely, with no error and no
 * warning.
 *
 * So the fee allocator, the statement reconciler and the `?next=` redirect guard - three of the
 * most doctrine-critical files in this repo - were invisible to every audit sweep run against it,
 * `grep -rn FRICTION .` included. CLAUDE.md's friction ritual, the scar-tissue greps, and four
 * review passes all silently skipped them. A rule that cannot be searched for is a rule nobody can
 * check, and this project's whole method is enforcement over memory.
 *
 * The fix at each site was to write the escape (`\0`, `\x1f`) instead of the byte. Identical string
 * at runtime, identical behaviour, and the file stays text. This script is here so the next one is
 * caught by the build rather than by an audit that happens to look.
 *
 * WHAT COUNTS AS A VIOLATION: any C0 control character except tab, LF and CR, plus DEL (0x7f), in
 * any file the build treats as source. Tab and the newlines are ordinary whitespace; everything
 * else in that range is either an accident or something that wanted to be an escape.
 *
 * Usage: node scripts/verify-source-readable.mjs [rootDir]   (default `src`)
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.argv[2] ?? 'src';
const EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '.css', '.json', '.md']);

/** Tab, LF and CR are ordinary whitespace. Everything else below 0x20, plus DEL, is not. */
const isForbidden = (code) => (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0x7f;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (EXTENSIONS.has(path.slice(path.lastIndexOf('.')))) out.push(path);
  }
  return out;
}

const findings = [];
for (const file of walk(ROOT)) {
  // Read as text: a binary asset never reaches here because its extension is not in the set above.
  const lines = readFileSync(file, 'utf8').split('\n');
  for (const [i, line] of lines.entries()) {
    const codes = [...new Set([...line].map((c) => c.charCodeAt(0)).filter(isForbidden))];
    if (codes.length > 0) {
      findings.push({
        file,
        line: i + 1,
        codes: codes.map((c) => `0x${c.toString(16).padStart(2, '0')}`),
        // Show the line with the offenders made visible, so the error names the column too.
        text: [...line].map((c) => (isForbidden(c.charCodeAt(0)) ? '␠' : c)).join('').trim().slice(0, 100),
      });
    }
  }
}

if (findings.length > 0) {
  console.error(`\nverify-source-readable: ${findings.length} raw control character(s) in source.\n`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  ${f.codes.join(' ')}`);
    console.error(`    ${f.text}`);
  }
  console.error('\nA file carrying one of these is skipped as BINARY by grep and ripgrep - silently.');
  console.error('Write the escape instead of the byte (`\\0`, `\\x1f`): same string, searchable file.\n');
  process.exit(1);
}

console.log(`verify-source-readable: ${ROOT} is text, all the way down.`);
