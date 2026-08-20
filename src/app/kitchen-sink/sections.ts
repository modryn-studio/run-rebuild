/* NAV MANIFEST: PLAIN DATA ONLY, NO COMPONENT REFERENCES.
 *
 * The first version of this file also carried each section's component and the page rendered
 * `SECTIONS.map(({ Component }) => <Component />)`. Two of the sections are Client Components, so
 * the array handed a Server Component a set of client references, and the entire page's client
 * tree stopped hydrating: effects ran, state updated, the DOM never changed, and nothing was
 * logged. Rendering the sections as literal JSX in page.tsx fixed it.
 *
 * So: this file holds ids, labels and groups; page.tsx composes the sections explicitly. Adding a
 * section is one entry here plus one line there, and both are in the same commit.
 *
 * Group order follows the settled convention for design system documentation: foundations, then
 * components, then patterns, then voice. It also sorts the page by how much of it is yours:
 * foundations are replaced wholesale by every project, voice by none of them.
 */

export const GROUPS = ['Foundations', 'Components', 'Patterns', 'Voice', 'Reference'] as const;
export type Group = (typeof GROUPS)[number];

export type NavEntry = { id: string; label: string; group: Group };

export const NAV: NavEntry[] = [
  { id: 'colour', label: 'Colour', group: 'Foundations' },
  { id: 'edges', label: 'Ink roles and edges', group: 'Foundations' },
  { id: 'type', label: 'Type', group: 'Foundations' },
  { id: 'surfaces', label: 'Surfaces', group: 'Foundations' },
  { id: 'spacing', label: 'Spacing', group: 'Foundations' },
  { id: 'motion', label: 'Motion', group: 'Foundations' },
  { id: 'icons', label: 'Icons', group: 'Foundations' },
  { id: 'buttons', label: 'Button', group: 'Components' },
  { id: 'inputs', label: 'Text field', group: 'Components' },
  { id: 'code', label: 'Code input', group: 'Components' },
  { id: 'controls', label: 'Icon button', group: 'Components' },
  { id: 'card', label: 'Card', group: 'Components' },
  { id: 'switch-menu', label: 'Switch and menu', group: 'Components' },
  { id: 'filters', label: 'Filter rows', group: 'Components' },
  { id: 'nav-row', label: 'Sidebar', group: 'Components' },
  { id: 'feedback', label: 'Feedback', group: 'Components' },
  { id: 'brand', label: 'Brand marks', group: 'Components' },
  { id: 'instrument-mark', label: 'Instrument mark', group: 'Components' },
  { id: 'trades', label: 'Trades', group: 'Patterns' },
  { id: 'columns-menu', label: 'Columns menu', group: 'Patterns' },
  { id: 'trade-detail', label: 'Trade detail', group: 'Patterns' },
  { id: 'intake', label: 'Intake', group: 'Patterns' },
  { id: 'patterns', label: 'Patterns', group: 'Patterns' },
  { id: 'overflow', label: 'The bad day', group: 'Patterns' },
  { id: 'voice', label: 'Voice', group: 'Voice' },
  { id: 'v2-reference', label: "v2's icon set", group: 'Reference' },
];
