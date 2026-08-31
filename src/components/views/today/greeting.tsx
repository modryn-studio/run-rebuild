'use client';

/* THE GREETING, IN THE HEADER BAND WHERE THE PAGE TITLE WOULD BE.
 *
 * Measured on the reference, 2026-08-31: its dashboard has **no `h1`, `h2` or `h3` at all**. Where
 * every other screen carries a title it carries `Good afternoon, Luke!` in a `<span>` at
 * **18px / weight 500 / lh 24 / full ink**, in the band, at the left.
 *
 * That maps onto Run's ramp exactly - `text-title` is 18/24/500, the role the table calls "a card
 * title" - so this is a port to the pixel rather than an approximation of one. `wireframes.md` §5
 * already said to adopt the convention; what it did not say is that the greeting REPLACES the title
 * rather than sitting under it, which is what the markup shows and what makes the front door feel
 * like a front door instead of a page called Today.
 *
 * IT IS A PORTAL, NOT A BODY ELEMENT. The first pass put it in the page body under the shell's own
 * `<h1>Today</h1>`, which put two `h1`s in one document and said the screen's name twice
 * (2026-08-31, Luke: *"we dont need the copy of 'Today' in the heading. remove that"*). The shell
 * now returns no route title for `/today` (`SELF_TITLED`) and this takes the slot.
 *
 * A `<span>`, NOT AN `<h1>` - and that is the reference's own markup rather than a shortcut around
 * the duplicate-heading problem. A salutation is not the name of a document. The screen's name for
 * a screen reader is the `<title>`, which `metadata` sets to "Today".
 *
 * NO EXCLAMATION MARK. The reference ends on one and Run does not: this product's register is calm
 * and factual everywhere else, and a trading journal that greets a trader brightly on the morning
 * after a bad session is cheerful at exactly the wrong moment. `psychology.md` §6 governs the
 * strings on this surface.
 *
 * THE STRING IS COMPUTED ON THE SERVER and handed over finished. The hour has to come from
 * `trader.display_timezone`, which is a database column the shell does not carry, and computing it
 * on the client would render one greeting into the HTML and another after hydration.
 */

import { HeaderSlot } from '@/components/shell/header-slot';

export function Greeting({ text }: { text: string }) {
  return (
    <HeaderSlot slot="title">
      <span className="text-title text-text truncate font-medium">{text}</span>
    </HeaderSlot>
  );
}
