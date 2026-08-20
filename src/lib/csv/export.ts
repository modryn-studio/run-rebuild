/* WRITING a CSV, which is the other direction from everything else in this folder.
 *
 * WHY EXPORT EXISTS AT ALL, and it is not "because the reference has it". The corpus is the moat -
 * every fill, kept forever, including the sessions a broker deletes within hours of a breach. That
 * is a large thing to ask a trader for, and "you can take it out any time" is what makes the ask
 * reasonable. Export is trust infrastructure for the thing being defended, not a feature competing
 * with it.
 *
 * PLAIN NUMBERS, NOT FORMATTED MONEY. `-73.50`, never `-$73.50` and never `(73.50)`: this file is
 * read by a spreadsheet and an accountant's software, both of which parse the first and choke on the
 * other two. The screen's job is legibility, a file's job is arithmetic.
 */

/** RFC 4180: quote when the value holds a comma, a quote or a newline, and double any quote inside.
 *  A trader's note is free text, so all three are reachable - a note reading `sized up, again` would
 *  otherwise become two columns and silently shift every field after it. */
function cell(v: string | number | null | undefined): string {
  const raw = v === null || v === undefined ? '' : String(v);
  /* FORMULA INJECTION. Excel and Sheets EXECUTE a cell that opens with `=`, `+`, `-`, `@` or a
     control character, so a note reading `=HYPERLINK("http://x","click")` runs the moment the
     trader opens their own export. Three columns here are text somebody else wrote: the note, the
     account's display name, and the product name an importer supplied.
     A leading apostrophe is the standard neutraliser - the spreadsheet strips it and shows the text.

     THE TEST IS "IS THIS A NUMBER", NOT "WAS THIS A number". The first version keyed off the
     argument's type and it was wrong on the real file: `csvMoney` hands this a STRING, so every
     losing trade in the corpus came out as `'-118.39` and the Net column stopped being arithmetic -
     which is the one thing this file exists for (see the header). Caught on a live export before it
     was committed. A value that parses as a plain decimal is a number whatever its type, and the
     leading `-` and `+` that make it look dangerous are exactly what make it a number. */
  const numeric = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(raw);
  const s = numeric || !/^[=+\-@\t\r]/.test(raw) ? raw : `'${raw}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows to a CSV body. CRLF line endings, which is what RFC 4180 says and what Excel expects. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

/** Integer cents to a plain decimal a spreadsheet will read as a number. */
export const csvMoney = (cents: number) => (cents / 100).toFixed(2);

/* A BOM, and it is not optional on Windows. Excel reads a CSV as the system codepage unless the file
 * opens with a UTF-8 byte-order mark, so an account named with anything outside ASCII arrives
 * mojibake. Every other reader ignores it. */
export const BOM = '﻿';
