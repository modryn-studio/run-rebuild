import { fixupConfigRules } from '@eslint/compat';
import nextConfig from 'eslint-config-next';
import tailwind from 'eslint-plugin-tailwindcss';

export default [
  ...fixupConfigRules(nextConfig),
  {
    plugins: { tailwindcss: tailwind },
    settings: {
      // Tailwind v4 moved the token list out of a JS config and into CSS, so the checker reads
      // the stylesheet. THIS IS WHAT MAKES THE RULE SELF-MAINTAINING: the legal class list is
      // generated from the @theme block, so adding a token to globals.css is the only way to
      // make a class legal, and the checker can never drift from the design system.
      tailwindcss: { cssConfigPath: 'src/app/globals.css' },
    },
    rules: {
      // Disabled: false positive in Next.js SSR context. localStorage and URL params
      // are only available client-side, so useEffect is the correct initialization
      // pattern - lazy useState initializers would crash on the server.
      'react-hooks/set-state-in-effect': 'off',

      // THE DESIGN SYSTEM'S CENTRAL RULE, ENFORCED. Ported from modryn-base at S3c, 2026-08-13,
      // and it should have arrived with the stylesheet at S0 — the blueprint lists the lint rule
      // as part of the phase 3 artifact, and its gate says to prove the system with the linter
      // rather than by looking. This repo had the rule's premise in CLAUDE.md ("a utility with no
      // token behind it emits nothing") and no enforcement of it for four slices.
      //
      // Catches one thing: a class that LOOKS like a token but is not one.
      //   text-body-xl     a token that does not exist
      //   bg-elevated      a plausible variant that belongs to a DIFFERENT system
      //
      // That second case is not hypothetical here. S0 ported primitives whose classes named
      // `text-accent-foreground`, `bg-elevated`, `rounded-md` and `font-heading` — none of which
      // exist in this stylesheet. Tailwind emits nothing for them, silently, so the components
      // rendered unstyled and typechecked clean. S3c ports eight more primitives from the same
      // source, which is exactly when this rule earns its place.
      'tailwindcss/no-custom-classname': [
        'error',
        {
          // Legitimate one-offs live here and NOWHERE ELSE. If this list grows past a handful,
          // that is a signal the system is missing a token, not that the rule is wrong.
          // HAND-WRITTEN UTILITIES DEFINED IN globals.css OUTSIDE @theme, and that is why they
          // are here rather than being made into tokens: an animation and a font-family stack
          // are CSS rules, not scale values, so `@theme` has nowhere to put them. Each one is
          // real and greppable in the stylesheet — none is a suppression.
          //
          // If this list grows past a handful, that is a signal the system is missing a token,
          // not that the rule is wrong.
          whitelist: [
            'cursor-blink',
            // Mono + tabular-nums for MACHINE STRINGS — order ids, timestamps, tickers — and
            // deliberately never a money figure. globals.css:390.
            'num',
            // globals.css:386. The stylesheet names its one consumer: ui/wordmark.tsx.
            'serif',
            // globals.css:435, and already handled in the reduced-motion block at :659.
            'soft-pulse',
            // The raised-chip mechanic — rest / hover / press as one named pair, so a control
            // cannot invent its own version of "lifted". Both defined in globals.css.
            'lift-rest',
            'lift-press',
            // Menu's open animation.
            'pop-in',
            // The tick that draws itself in on a completed intake step. globals.css:820, with its
            // own note in the reduced-motion block explaining why it is exempt there.
            'check-draw',
            // The intake progress list. Defined ONLY in the reduced-motion block (globals.css:877),
            // which is the whole point of it: the travel is applied by Tailwind utilities on the
            // element, and this class exists solely as the hook that cancels it. S3c wrote the rule
            // before the panel it describes existed.
            'steps-track',
            // The app pane's scrollbar: `scrollbar-width: thin` plus a thumb from the border
            // token. Standard properties only, never `::-webkit-scrollbar` — the two do not
            // compose, so carrying both means maintaining two descriptions of one bar.
            'scroll-thin',
            // Structural, not visual: these carry no design decision.
            'sr-only',
            'group',
          ],
        },
      ],

      // The third case, and it needs its own rule: `text-[13px]` is VALID Tailwind syntax, so
      // no-custom-classname passes it. It is also exactly the one-off a design system forbids:
      // a value inlined into a component instead of added to @theme.
      //
      // Deliberately a WARNING. Structural arbitraries are legitimate and common
      // (`content-['']`, `grid-rows-[0fr]`, `transition-[grid-template-rows]`), so as an error
      // this would be suppressed everywhere within a week and stop meaning anything. As a
      // warning, a hardcoded `text-[13px]` still shows up in the output where you will see it.
      'tailwindcss/no-arbitrary-value': 'warn',

      // NO EM DASHES IN APP CONTENT. Studio-wide house style, and this repo's own CLAUDE.md
      // carries it as a rule: headlines, labels, any UI text. Code comments and docs are exempt.
      //
      // Fires on JSX text and on string/template literals, which is where user-visible copy
      // lives. COMMENTS AND MARKDOWN ARE EXEMPT on purpose: they are documentation, not app
      // content. The moment a character can reach a user, it is content.
      //
      // Escape hatch, for the rare legitimate case (a quoted source, a data fixture):
      //   // eslint-disable-next-line no-restricted-syntax
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXText[value=/\\u2014/]',
          message:
            'No em dashes in app content. Use a colon, a full stop, or parentheses instead.',
        },
        {
          selector: 'Literal[value=/\\u2014/]',
          message:
            'No em dashes in app content. Use a colon, a full stop, or parentheses instead.',
        },
        {
          selector: 'TemplateElement[value.raw=/\\u2014/]',
          message:
            'No em dashes in app content. Use a colon, a full stop, or parentheses instead.',
        },
      ],
    },
  },

  /* `cn()` is the class utility ITSELF, not a consumer of one. The plugin reads the rest
   * parameter's identifier (`...inputs`) as if it were a class string, which it can never be.
   * Scoped to the one file rather than loosening the rule everywhere. */
  {
    files: ['src/lib/cn.ts'],
    rules: { 'tailwindcss/no-custom-classname': 'off' },
  },

  /* THE LENS PROMPTS ARE INSTRUCTIONS TO A MODEL, NOT COPY SHOWN TO A PERSON.
   *
   * The em-dash rule guards user-facing text; nothing in here is rendered. Two further reasons
   * this is an exemption rather than a rewrite: these prompts were tuned across a measured
   * trim experiment and verified byte-identical to the tested arm, so re-punctuating them
   * silently invalidates that verification — and the read a trader actually sees is written by
   * the synthesiser and checked against the tape's whitelist, so it does not inherit its
   * punctuation from here anyway.
   *
   * Deliberately narrow: `lenses.ts` only. Error copy in `src/lib` is still user-facing and
   * still covered. */
  {
    files: ['src/lib/desk/lenses.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
];
