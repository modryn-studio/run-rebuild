/* THE BUILD PROVES ITS OWN STYLESHEET, because on 2026-08-24 it shipped one that was wrong and
 * nothing anywhere said so.
 *
 * Deployment `0849edc` served current HTML with a stale stylesheet: 56,566 bytes where a clean
 * build of the same commit produces 60,818, missing every rule the merged branch had added. The
 * filter sheet is a full-screen `fixed inset-0 z-[70]` panel held off-screen by exactly one of
 * those rules, so the phone rendered an inert overlay across the whole app and nothing could be
 * tapped. `npm run build` exited 0. `npm run lint` exited 0. `tsc` was clean. `/status` reported
 * the correct commit. Every signal this project had was green while the product was unusable.
 *
 * That is the same shape as the bug `eslint.config.mjs` exists to catch, one layer down: there,
 * a class with no token behind it emits nothing, silently. Here, a stylesheet that lost half its
 * rules ships, silently. The answer is the same one - stop remembering, start enforcing.
 *
 * IT DERIVES THE LIST FROM `globals.css` RATHER THAN CARRYING ONE. A hand-maintained list of
 * critical classes is a list that goes stale the first busy week, and a check that silently stops
 * covering the thing it was written for is worse than no check. So: every top-level class rule in
 * the stylesheet with a real body must survive into the build output, and every custom property
 * those rules read must be defined in it. Adding a rule to globals.css is the only way to extend
 * this, which is the property the lint rule has too.
 *
 * Deliberately NOT a CSS parser. It is a brace-depth scan over one file this repo owns, and its
 * failure mode is skipping a rule it does not understand rather than inventing one. A dependency
 * here would be a parser to keep current for a check that runs in five milliseconds.
 *
 * Usage: node scripts/verify-css.mjs [buildDir]   (default `.next`)
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BUILD_DIR = process.argv[2] ?? '.next';
const SOURCE = 'src/app/globals.css';

/** Every .css emitted under the build's static output, concatenated. */
function emittedCss(dir) {
  const out = [];
  const walk = (p) => {
    let entries;
    try {
      entries = readdirSync(p);
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(p, e);
      if (statSync(full).isDirectory()) walk(full);
      else if (e.endsWith('.css')) out.push(readFileSync(full, 'utf8'));
    }
  };
  walk(join(dir, 'static'));
  return out;
}

/* COMMENTS COME OUT FIRST, and that is not tidying - the first version of this scan skipped a
 * comment as it walked and captured the selector as everything since the previous `}`, which for
 * a rule preceded by a comment block is THE COMMENT. This stylesheet documents nearly every rule
 * it declares, so that quietly excluded most of the file: it found 19 classes where there are 40,
 * and `.sheet-transition` - the exact rule this script exists to protect - was one of the ones it
 * missed. A check that under-reports is worse than none, because it reports success.
 * Replaced with a space rather than nothing: a comment is a token separator in CSS. */
function stripComments(css) {
  let out = '';
  let i = 0;
  while (i < css.length) {
    if (css[i] === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? css.length : end + 2;
      out += ' ';
    } else {
      out += css[i];
      i++;
    }
  }
  return out;
}

/* TOP-LEVEL CLASS RULES ONLY, and "top level" is doing real work. A rule nested inside
 * `@media (prefers-reduced-motion)` or `@layer base` is conditional by design - `.steps-track`
 * exists ONLY inside the reduced-motion block, and asserting it would fail every honest build.
 * Depth 0 means the rule is unconditional, which is exactly the set that must always be present. */
function requiredFromSource(raw) {
  const css = stripComments(raw);
  const classes = new Set();
  const vars = new Set();
  let depth = 0;
  let selectorStart = 0;

  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') {
      if (depth === 0) {
        const selector = css.slice(selectorStart, i).trim();
        const body = bodyAt(css, i);
        // An EMPTY rule legitimately vanishes: `.scroll-thin { }` is a live example in this
        // stylesheet, and a minifier is right to drop it. Only rules that declare something are
        // promised to the output.
        if (body.trim() && selector.startsWith('.')) {
          const name = selector.match(/^\.([a-zA-Z][\w-]*)/);
          if (name) classes.add(name[1]);
          for (const m of body.matchAll(/var\((--[\w-]+)/g)) vars.add(m[1]);
        }
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) selectorStart = i + 1;
    }
  }
  return { classes, vars };
}

/** The text between the `{` at `open` and its matching `}`. */
function bodyAt(css, open) {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return '';
}

const sheets = emittedCss(BUILD_DIR);
if (sheets.length === 0) {
  console.error(`\nverify-css: no stylesheet found under ${BUILD_DIR}/static.`);
  console.error('The build emitted no CSS at all, which is never correct for this app.\n');
  process.exit(1);
}

const out = sheets.join('\n');
const { classes, vars } = requiredFromSource(readFileSync(SOURCE, 'utf8'));

const missingClasses = [...classes].filter((c) => !out.includes(`.${c}`));
// A token read from a hand-written rule is invisible to Tailwind's content detection, which is
// why CLAUDE.md requires those in `@theme static`. This is that rule, checked rather than trusted.
const missingVars = [...vars].filter((v) => !out.includes(`${v}:`));

if (missingClasses.length || missingVars.length) {
  console.error(`\nverify-css: the emitted stylesheet is missing rules that ${SOURCE} declares.\n`);
  if (missingClasses.length) {
    console.error(`  ${missingClasses.length} class(es) absent from the output:`);
    for (const c of missingClasses.sort()) console.error(`    .${c}`);
  }
  if (missingVars.length) {
    console.error(`\n  ${missingVars.length} custom propert(ies) read by a hand-written rule but never defined:`);
    for (const v of missingVars.sort()) console.error(`    ${v}`);
    console.error('\n  A token used only from hand-written CSS or an inline style needs `@theme static`,');
    console.error('  or Tailwind drops it and the rule reading it silently resolves to nothing.');
  }
  console.error('\nThis build would ship a broken stylesheet. Refusing it.');
  console.error('If a rule was deliberately removed, remove it from globals.css too.\n');
  process.exit(1);
}

console.log(
  `verify-css: ${classes.size} classes and ${vars.size} tokens accounted for across ${sheets.length} stylesheet(s).`
);
